/**
 * wsl-executor: WSL bash provider for the `wsl` agent preset.
 *
 * Wraps every command with `wsl -e bash -c <command>` to run Linux commands
 * through Windows Subsystem for Linux. Only Node built-in modules are imported:
 * preset-local files resolve against the preset directory, so DSH package
 * imports (node_modules) would fail, while `node:fs` is always available.
 *
 * Contract: conforms to the `ctx.shell` seam of dsh 0.1.5-rc.1
 * (`@deepseek-ai/dsh-shell`) — `sandboxMode`, `resolve`, `run`, `start` — and
 * therefore stays a plain functional plugin that calls `ctx.provide('shell', …)`
 * instead of subclassing the `ShellExecutor` service. That subclass route needs
 * `@deepseek-ai/dsh-shell` at import time, which is unreachable from a preset
 * directory; the produced object is behaviourally identical for the tool layer.
 *
 * Sandbox note: WSL cannot run inside the Windows restricted-token sandbox,
 * so commands are gated on the danger-full-access policy. The bash tool's
 * single-call `sandbox_permissions: "danger-full-access"` escalation, or
 * switching the session to full access, satisfies the gate.
 */

import { existsSync } from 'node:fs'

/** Cordis plugin name used by loader diagnostics. */
export const name = 'wsl-executor'

/** Required host services; ordering matters because apply() reads them eagerly. */
export const inject = ['subprocess', 'sandboxPolicy']

/** Node's maximum timer delay before setTimeout clamps to 1ms. */
const MAX_TIMER_DELAY_MS = 2147483647

const ENV_OVERRIDES = {
  NO_COLOR: '1',
  TERM: 'dumb',
  PAGER: 'cat',
  GIT_PAGER: 'cat',
}

/**
 * Resolve the WSL executable path. Checks `wsl.exe` on PATH and common locations.
 */
function detectWslPath(env = process.env) {
  if (process.platform !== 'win32') {
    return 'wsl'
  }
  // Check common WSL locations
  const candidates = [
    env.SystemRoot ? `${env.SystemRoot}\\System32\\wsl.exe` : undefined,
    'C:\\Windows\\System32\\wsl.exe',
  ]
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && existsSync(candidate)) return candidate
  }
  return 'wsl'
}

function positiveNumber(config, label, fallback) {
  const value = config[label] ?? fallback
  if (!Number.isFinite(value) || value <= 0) {
    throw new TypeError(`${name}: ${label} must be a positive finite number`)
  }
  return value
}

export function resolveConfig(config, env = process.env) {
  const source = config ?? {}
  const timeoutMs = positiveNumber(source, 'timeoutMs', 120000)
  const maxTimeoutMs = positiveNumber(source, 'maxTimeoutMs', 600000)
  const graceMs = positiveNumber(source, 'graceMs', 3000)
  if (timeoutMs > MAX_TIMER_DELAY_MS || maxTimeoutMs > MAX_TIMER_DELAY_MS || graceMs > MAX_TIMER_DELAY_MS) {
    throw new TypeError(`${name}: timeoutMs, maxTimeoutMs and graceMs must be no greater than ${MAX_TIMER_DELAY_MS}`)
  }
  return {
    wslPath: detectWslPath(env),
    cwd: typeof source.cwd === 'string' && source.cwd.length > 0
      ? source.cwd
      : undefined,
    timeoutMs,
    maxTimeoutMs,
    maxOutputBytes: positiveNumber(source, 'maxOutputBytes', 64000),
    maxSpillBytes: positiveNumber(source, 'maxSpillBytes', 64 * 1024 * 1024),
    graceMs,
  }
}

/** Fuse upstream cancellation with an identifiable timeout. */
function timeoutSignal(upstream, timeoutMs) {
  const timer = new AbortController()
  const id = setTimeout(() => {
    timer.abort(new Error('BASH_TIMEOUT'))
  }, timeoutMs)
  const signal = upstream === undefined
    ? timer.signal
    : AbortSignal.any([upstream, timer.signal])
  return {
    signal,
    timedOut: () => timer.signal.aborted,
    dispose: () => clearTimeout(id),
  }
}

/** Project a settled subprocess collector into the tool result shape. */
function finalOutput(reader) {
  const read = reader.readFrom(0)
  return {
    text: read.text,
    truncated: read.lossy,
    ...read.spillPath === undefined ? {} : { spillPath: read.spillPath },
  }
}

/** Wrap a spawn failure with the shell path and workdir that caused it. */
function spawnError(wslPath, workdir, cause) {
  return new Error(`${name}: failed to start ${wslPath} (workdir: ${workdir}): ${cause?.message ?? String(cause)}`, {
    cause,
  })
}

/** Register the WSL executor as the entry-local `shell` provider. */
export function apply(ctx, config) {
  const resolved = resolveConfig(config)
  const subprocess = ctx.get('subprocess')
  if (subprocess === undefined) {
    throw new Error(`${name}: ctx.subprocess is unavailable`)
  }
  const sandboxPolicy = ctx.get('sandboxPolicy')

  const gateMessage = (mode) =>
    `${name}: WSL cannot start inside the "${mode ?? 'unknown'}" sandbox `
    + '(WSL requires full process access to initialize). '
    + 'Retry this exact command once with sandbox_permissions: "danger-full-access" plus a justification, '
    + 'or ask the user to switch the session sandbox mode to full access.'

  const spawnSpec = (spec, argv, stdoutMaxBytes, signal) => ({
    argv,
    cwd: spec.workdir,
    stdio: {
      stdin: spec.stdin !== undefined ? { data: spec.stdin } : 'ignore',
      stdout: { maxBytes: stdoutMaxBytes, spill: { maxBytes: resolved.maxSpillBytes } },
      stderr: { maxBytes: resolved.maxOutputBytes, spill: { maxBytes: resolved.maxSpillBytes } },
    },
    graceMs: resolved.graceMs,
    signal,
    env: {
      ...ENV_OVERRIDES,
      ...spec.env,
      ...spec.dshEnv,
    },
  })

  const spawnShell = (spec, stdoutMaxBytes, signal) => {
    try {
      return subprocess.spawn(spawnSpec(
        spec,
        [resolved.wslPath, '-e', 'bash', '-c', spec.command],
        stdoutMaxBytes,
        signal,
      ))
    } catch (error) {
      throw spawnError(resolved.wslPath, spec.workdir, error)
    }
  }

  const executor = {
    /** Advertise confinement so the bash tool offers per-call escalation. */
    get sandboxMode() {
      return sandboxPolicy === undefined ? undefined : sandboxPolicy.defaultMode
    },

    resolve(request) {
      const timeoutMs = Math.min(request.timeoutMs ?? resolved.timeoutMs, resolved.maxTimeoutMs)
      if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
        throw new Error(`${name}: request.timeoutMs must be a positive finite number`)
      }
      const stdoutMaxBytes = request.stdoutMaxBytes ?? resolved.maxOutputBytes
      if (!Number.isFinite(stdoutMaxBytes) || stdoutMaxBytes <= 0) {
        throw new Error(`${name}: request.stdoutMaxBytes must be a positive finite number`)
      }
      return {
        command: request.command,
        workdir: request.workdir ?? resolved.cwd ?? process.cwd(),
        timeoutMs,
        stdoutMaxBytes,
        ...request.signal === undefined ? {} : { signal: request.signal },
        ...request.stdin === undefined ? {} : { stdin: request.stdin },
        ...request.env === undefined ? {} : { env: request.env },
        ...request.dshEnv === undefined ? {} : { dshEnv: request.dshEnv },
        sandboxPolicy: request.sandboxPolicy ?? (sandboxPolicy?.resolve === undefined ? undefined : sandboxPolicy.resolve()),
      }
    },

    async run(spec) {
      const mode = spec.sandboxPolicy?.mode
      if (mode !== undefined && mode !== 'danger-full-access') {
        throw new Error(gateMessage(mode))
      }
      const fused = timeoutSignal(spec.signal, spec.timeoutMs)
      try {
        const handle = spawnShell(spec, spec.stdoutMaxBytes, fused.signal)
        let outcome
        try {
          outcome = await handle.done
        } catch (error) {
          throw spawnError(resolved.wslPath, spec.workdir, error)
        }
        const stdout = finalOutput(handle.collected.stdout)
        const stderr = finalOutput(handle.collected.stderr)
        const timedOut = fused.timedOut()
        const aborted = spec.signal !== undefined && spec.signal.aborted && !timedOut
        return {
          ...outcome,
          timedOut,
          aborted,
          timeoutMs: spec.timeoutMs,
          stdout,
          stderr,
          ...mode === undefined ? {} : { sandbox: { mode, denied: false } },
        }
      } finally {
        fused.dispose()
      }
    },

    start(spec) {
      const mode = spec.sandboxPolicy?.mode
      if (mode !== undefined && mode !== 'danger-full-access') {
        throw new Error(gateMessage(mode))
      }
      const running = spawnShell(spec, resolved.maxOutputBytes, spec.signal)
      const collected = {
        stdout: running.collected.stdout,
        stderr: running.collected.stderr,
      }
      let spawnFailureNote
      const consumeSpawnFailure = () => {
        const note = spawnFailureNote ?? ''
        spawnFailureNote = undefined
        return note
      }
      let stdoutOffset = 0
      let stderrOffset = 0
      const proc = {
        status: 'running',
        exitCode: null,
        signal: null,
        done: running.done.then((outcome) => {
          if (proc.status === 'running') {
            proc.status = spec.signal?.aborted === true || outcome.signal !== null
              ? 'killed'
              : 'completed'
          }
          proc.exitCode = outcome.exitCode
          proc.signal = outcome.signal
        }, (error) => {
          proc.status = 'killed'
          spawnFailureNote = spawnError(resolved.wslPath, spec.workdir, error).message
        }),
        readOutput: () => {
          const out = collected.stdout.readFrom(stdoutOffset)
          const err = collected.stderr.readFrom(stderrOffset)
          stdoutOffset = out.nextOffset
          stderrOffset = err.nextOffset
          const errText = err.text.length > 0 ? err.text : consumeSpawnFailure()
          const separator = out.text.length > 0 && !out.text.endsWith('\n') ? '\n' : ''
          return {
            delta: out.text + (errText.length > 0 ? `${separator}[stderr]\n${errText}` : ''),
            lossy: out.lossy || err.lossy,
            ...out.spillPath === undefined ? {} : { stdoutSpillPath: out.spillPath },
            ...err.spillPath === undefined ? {} : { stderrSpillPath: err.spillPath },
          }
        },
        kill: () => {
          if (proc.status !== 'running') return false
          proc.status = 'killed'
          running.terminate()
          return true
        },
      }
      return proc
    },
  }

  ctx.provide('shell', executor)
}
