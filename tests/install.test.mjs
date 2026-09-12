/**
 * Regression tests for the boot-time preset installer in `lib/index.js`.
 *
 * The defect these pin: an already-installed preset directory was never
 * refreshed, so upgrading the plugin left a composition that an upstream
 * schema change had made unmountable. dsh 0.1.5 replaced `dsh-persona`'s
 * `text` config key with a required `prefix`, so a preset installed by release
 * 0.1.0 failed the whole mount (`$.prefix missing required value`) on every
 * later boot, and 「WSL 模式」 could not be selected. `verify-config`-style
 * schema validation of the installed copy is a runtime concern; what is pinned
 * here is that the installer actually replaces the stale copy.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  utimesSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { apply, name, userPresetRoot } from '../lib/index.js'

/** The package root, one level above `tests/`. */
const PACKAGE_ROOT = fileURLToPath(new URL('..', import.meta.url))

/** The preset source directory the installer copies from. */
const SOURCE_DIR = join(PACKAGE_ROOT, 'agent-presets', 'wsl')

/** The packaged files the installer owns. */
const PRESET_FILES = ['agent.cordis.yml', 'wsl-executor.mjs', 'preset.yml']

/**
 * A composition with the persona row release 0.1.0 shipped. An installed dsh
 * 0.1.5-rc.1 rejects it at mount because the row carries the removed `text`
 * key instead of the required `prefix`.
 */
const STALE_COMPOSITION = [
  '# The `wsl` agent preset: identical to standard but uses WSL Linux commands as shell.',
  '- id: persona',
  "  name: '@deepseek-ai/dsh-persona'",
  '  config:',
  '    text: >-',
  '      You are a coding agent powered by the {{model}} model.',
  '',
].join('\n')

/** A timestamp far enough in the past that a rewrite is unambiguous. */
const PAST = new Date('2001-01-01T00:00:00Z')

/** Read one packaged preset file. */
function packaged(file) {
  return readFileSync(join(SOURCE_DIR, file), 'utf8')
}

/**
 * Run `body` against an isolated DSH home and restore `DSH_HOME` afterwards.
 * @param body - receives the temp home and the preset directory inside it.
 */
function withHome(body) {
  const previous = process.env.DSH_HOME
  const home = mkdtempSync(join(tmpdir(), 'dsh-wsl-preset-'))
  process.env.DSH_HOME = home
  try {
    body({ home, presetDir: join(home, '.agent-presets', 'wsl') })
  } finally {
    if (previous === undefined) delete process.env.DSH_HOME
    else process.env.DSH_HOME = previous
    rmSync(home, { recursive: true, force: true })
  }
}

test('the installer reports the plugin name', () => {
  assert.equal(name, 'dsh-wsl-preset')
})

test('the user preset root follows DSH_HOME', () => {
  withHome(({ home }) => {
    assert.equal(userPresetRoot(), join(home, '.agent-presets'))
  })
})

test('a fresh home receives every packaged preset file', () => {
  withHome(({ presetDir }) => {
    assert.equal(existsSync(presetDir), false)
    apply({}, {})
    for (const file of PRESET_FILES) {
      assert.equal(readFileSync(join(presetDir, file), 'utf8'), packaged(file), file)
    }
  })
})

test('an unchanged preset is left alone', () => {
  withHome(({ presetDir }) => {
    apply({}, {})
    const composition = join(presetDir, 'agent.cordis.yml')
    utimesSync(composition, PAST, PAST)
    apply({}, {})
    assert.ok(
      Math.abs(statSync(composition).mtimeMs - PAST.getTime()) < 1000,
      'a current preset must not be rewritten',
    )
  })
})

test('a preset installed by an earlier release is refreshed on the next boot', () => {
  withHome(({ presetDir }) => {
    mkdirSync(presetDir, { recursive: true })
    writeFileSync(join(presetDir, 'agent.cordis.yml'), STALE_COMPOSITION)
    for (const file of ['wsl-executor.mjs', 'preset.yml']) {
      cpSync(join(SOURCE_DIR, file), join(presetDir, file))
    }

    apply({}, {})

    const refreshed = readFileSync(join(presetDir, 'agent.cordis.yml'), 'utf8')
    assert.equal(refreshed, packaged('agent.cordis.yml'))
    assert.doesNotMatch(refreshed, /^\s+text:/mu, 'the removed persona config key survived the upgrade')
  })
})

test('autoUpdate: false reports the drift instead of overwriting', () => {
  withHome(({ presetDir }) => {
    mkdirSync(presetDir, { recursive: true })
    writeFileSync(join(presetDir, 'agent.cordis.yml'), STALE_COMPOSITION)
    apply({}, { autoUpdate: false })
    assert.equal(readFileSync(join(presetDir, 'agent.cordis.yml'), 'utf8'), STALE_COMPOSITION)
  })
})

test('force: true rewrites even a byte-identical preset', () => {
  withHome(({ presetDir }) => {
    apply({}, {})
    const composition = join(presetDir, 'agent.cordis.yml')
    utimesSync(composition, PAST, PAST)
    apply({}, { force: true })
    assert.ok(
      Math.abs(statSync(composition).mtimeMs - PAST.getTime()) > 1000,
      'force must rewrite the composition',
    )
  })
})

test('a directory left by an interrupted install is repaired', () => {
  withHome(({ presetDir }) => {
    mkdirSync(presetDir, { recursive: true })
    writeFileSync(join(presetDir, 'wsl-executor.mjs'), 'stale')
    apply({}, {})
    for (const file of PRESET_FILES) {
      assert.equal(readFileSync(join(presetDir, file), 'utf8'), packaged(file), file)
    }
  })
})

test('an unusable preset root is reported rather than thrown', () => {
  withHome(({ home, presetDir }) => {
    // A FILE where the preset root has to be: creating the directory cannot succeed.
    writeFileSync(join(home, '.agent-presets'), '')
    assert.doesNotThrow(() => apply({}, {}))
    assert.equal(existsSync(presetDir), false)
  })
})

test('the packaged composition keeps the persona keys dsh 0.1.5 requires', () => {
  const rows = packaged('agent.cordis.yml').split(/^- id: /mu).slice(1)
  const persona = rows.find(row => row.startsWith('persona'))
  assert.ok(persona, 'the composition must carry a persona row')
  assert.match(persona, /^\s+prefix:/mu)
  assert.doesNotMatch(persona, /^\s+text:/mu)
})
