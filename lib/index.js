/**
 * dsh-wsl-preset host plugin: installs the `wsl` agent preset into the user
 * preset root when the profile boots.
 *
 * The preset is the WSL variant of the shipped `standard` preset: same
 * persona and tool surface, but the bash tool runs every command through
 * Windows Subsystem for Linux (WSL) instead of the local shell, providing
 * a Linux environment on Windows.
 *
 * Installation is idempotent and self-refreshing:
 *  - nothing installed yet                  → copy the packaged files
 *  - installed and byte-identical           → log and return
 *  - installed but drifted                  → overwrite the packaged files and
 *    keep every extra local file
 *  - `force: true`                          → overwrite unconditionally
 *  - `autoUpdate: false`                    → never overwrite; only report the
 *    drift, for a deployment that intentionally maintains its own copy
 *
 * Refreshing on drift is the DEFAULT rather than an opt-in because the preset
 * directory is plugin-owned and an upstream schema change can make an older
 * copy unmountable. `@deepseek-ai/dsh-persona` requires `prefix` since dsh
 * 0.1.5 (it accepted `text` before), so a preset installed by release 0.1.0
 * fails the entire mount with `$.prefix missing required value` — the session
 * then refuses 「WSL 模式」 and the mode cannot be selected at all. An
 * installer that only reports the drift leaves that failure in place on every
 * later boot, so upgrading the plugin would never repair it. With a refresh,
 * the first boot on the new release repairs the install.
 *
 * A user who wants to customize the preset should copy it to a new preset id
 * from the Web UI and edit that copy; this directory is plugin-owned.
 *
 * Failures here never fail the profile boot: the preset is optional content,
 * and a read-only or missing preset root must not take the whole harness down.
 */
import { cpSync, existsSync, mkdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'
import { fileURLToPath } from 'node:url'

/** Cordis plugin name used by loader diagnostics. */
export const name = 'dsh-wsl-preset'

/** The preset id this plugin owns; also its directory name under the preset root. */
const PRESET_ID = 'wsl'

/** The packaged files that define the preset. */
const PRESET_FILES = ['agent.cordis.yml', 'wsl-executor.mjs', 'preset.yml']

/**
 * The composition file inside {@link PRESET_FILES}. Its presence is what makes
 * the directory a usable preset: a directory holding only some of the files is
 * the residue of an interrupted install, not a preset.
 */
const COMPOSITION_FILE = PRESET_FILES[0]

/** Package-local preset source directory. */
const SOURCE_DIR = fileURLToPath(new URL('../agent-presets/wsl/', import.meta.url))

/**
 * The user preset root: `${DSH_HOME:-~/.dsh}/.agent-presets`.
 *
 * `DSH_HOME` is what selects a DSH instance, so reading it here — rather than
 * the process's own install directory — is what makes one installed plugin
 * serve whichever instance booted it.
 * @returns the absolute preset root path.
 */
export function userPresetRoot() {
  const home = process.env.DSH_HOME && process.env.DSH_HOME.length > 0
    ? process.env.DSH_HOME
    : join(homedir(), '.dsh')
  return join(home, '.agent-presets')
}

/** Byte-compare two files; false when either is unreadable. */
function filesEqual(a, b) {
  try {
    return readFileSync(a).equals(readFileSync(b))
  } catch {
    return false
  }
}

/**
 * The packaged files whose installed copy differs, in declaration order.
 * @param targetDir - the installed preset directory.
 * @returns the differing file names; empty when the install is current.
 */
function driftedFiles(targetDir) {
  return PRESET_FILES.filter(file => !filesEqual(join(SOURCE_DIR, file), join(targetDir, file)))
}

/**
 * Copy the packaged preset files into `targetDir`, creating it when absent.
 * Only {@link PRESET_FILES} are touched, so a file a user added beside them
 * survives.
 * @param targetDir - the installed preset directory.
 */
function copyPreset(targetDir) {
  mkdirSync(targetDir, { recursive: true })
  for (const file of PRESET_FILES) {
    cpSync(join(SOURCE_DIR, file), join(targetDir, file), { force: true })
  }
}

/**
 * Install the packaged preset, or refresh it when the packaged files changed.
 * @param ctx - the row's context; unused, the install target comes from `DSH_HOME`.
 * @param config - `force` to overwrite unconditionally, `autoUpdate: false` to
 * only report drift.
 */
export function apply(ctx, config = {}) {
  const force = config.force === true
  const autoUpdate = config.autoUpdate !== false
  const targetDir = join(userPresetRoot(), PRESET_ID)
  // An absent composition file means the directory is not a usable preset, even
  // if some of its files survived an interrupted install.
  const installed = existsSync(join(targetDir, COMPOSITION_FILE))

  try {
    if (!installed) {
      copyPreset(targetDir)
      console.log(`[${name}] installed preset "${PRESET_ID}" -> ${targetDir}`)
      return
    }

    const drifted = driftedFiles(targetDir)
    if (force || (drifted.length > 0 && autoUpdate)) {
      copyPreset(targetDir)
      console.log(
        `[${name}] refreshed preset "${PRESET_ID}" at ${targetDir}`
        + (drifted.length > 0 ? ` (changed: ${drifted.join(', ')})` : ''),
      )
      return
    }

    console.log(
      `[${name}] preset "${PRESET_ID}" already installed at ${targetDir}`
      + (drifted.length > 0
        ? `; packaged files differ (${drifted.join(', ')}) — set autoUpdate: true or force: true to overwrite`
        : ''),
    )
  } catch (error) {
    console.error(
      `[${name}] could not install preset "${PRESET_ID}" at ${targetDir}: ${error?.message ?? String(error)}. `
      + 'Install it manually with `node install.mjs --home <DSH_HOME> --force`, or make that directory writable.',
    )
  }
}
