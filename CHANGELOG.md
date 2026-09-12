# Changelog

All notable changes to this project will be documented in this file.

## [0.3.1] - 2026-09-12

### Fixed
- **Upgrading the plugin left 「WSL 模式」 unselectable.** The boot-time
  installer treated an already-installed preset as final: when the packaged
  files differed it only logged `packaged files differ — set force: true`, so
  the files an earlier release had copied were never replaced. Because dsh
  0.1.5 made `dsh-persona`'s `prefix` required, that stale composition failed
  the whole mount with `$.prefix missing required value`; the session refused
  the preset and the picker could not offer the mode. Installing 0.3.0 did not
  help, because its install path saw a directory that was already there.
  The installer now refreshes the packaged files whenever they differ from the
  installed copy, so the first boot on this release repairs the install.
  `install.mjs` already refreshed; `lib/index.js` did not.
- A directory holding only the residue of an interrupted install (no
  `agent.cordis.yml`) is now repaired instead of skipped: the composition file,
  not the whole file set, decides whether a usable preset is already in place.
- A preset root that cannot be written is reported and ignored rather than
  thrown, so a read-only `${DSH_HOME}` can no longer fail the profile boot.

### Added
- `autoUpdate: false` on the plugin row: report drift without overwriting, for
  a deployment that maintains its own copy of the preset.
- `npm test` — installer regression tests (`tests/install.test.mjs`), including
  the stale-preset upgrade path this release fixes. `prepublishOnly` runs them
  together with `npm run check`.

### Changed
- `force: true` still overwrites unconditionally. The preset directory stays
  plugin-owned; a preset a user wants to customize belongs in a copy under a
  new id, so refreshing this one never discards authored work.

## [0.3.0] - 2026-09-12

Adapts the preset to **dsh 0.1.5-rc.1** and moves distribution to **GitHub
direct install** (npm publishing dropped).

### Breaking
- **`dsh-persona` no longer accepts `text`** (0.1.5-rc.1 makes `prefix` required
  and adds `suffix`). The preset's persona row now uses `prefix` + `suffix`;
  the previous `text:` form fails schema validation at mount.
- **`dsh-tool-bash` no longer accepts `toolName`** — the model-facing tool is
  always registered as `bash`. The `toolName: wsl` config was removed, so the
  tool label is now `bash` instead of `wsl`. Commands still run through WSL;
  only the label changed. This is an upstream constraint, not a regression we
  can fix from a preset.

### Changed
- Distribution: **install from GitHub**, no npm publish.
  `dsh plugin --profile web add github:yukitakasama/dsh-wsl-preset`
- `wsl-executor.mjs`: added `GIT_PAGER=cat` to the terminal environment
  overrides, matching upstream `dsh-bash-local`.
- Documented the correct way to target a specific dsh instance: set
  `DSH_HOME`, not `dsh plugin --dir` (which pnpm interprets as its working
  directory and desyncs from the profile manifest DSH rewrites).
- `install.mjs`: `--home DIR` added as the preferred flag; `--dir DIR` kept as
  an alias.
- README rewritten around GitHub install, with a dsh 0.1.5-rc.1 compatibility
  table.

### Added
- Synced the tool surface with the shipped `standard` preset of 0.1.5-rc.1:
  - `@deepseek-ai/dsh-command-goal` row
  - `@deepseek-ai/dsh-tool-present` row
  - `tool-subagent`: `modelSelectionSettings: true`
  - `tool-web`: `fetch: true`
- `peerDependencies`: `@deepseek-ai/dsh >= 0.1.5-rc.1`

### Migration
If you installed an earlier version:

1. Reinstall from GitHub:
   ```bash
   dsh plugin --profile web add github:yukitakasama/dsh-wsl-preset
   ```
2. Reinstall the preset files (they are only copied on boot, and the persona
   schema changed):
   ```bash
   node install.mjs --force
   ```
   or set `force: true` on the plugin row in `cordis.patch.yml`.
3. Restart DSH.

## [0.2.0] - 2026-09-12

### Changed
- Package renamed from `@deepseek-ai/dsh-wsl-preset` to
  `@yukitakasama/dsh-wsl-preset` (personal scope).
- Added `publishConfig.access: "public"`, repository/bugs/homepage metadata.

> This release was never published to npm — distribution moved to GitHub
> direct install in 0.3.0.

## [0.1.0] - 2026-08-10

### Added
- Initial release: WSL agent preset with `wsl -e bash -c` execution.
- Idempotent preset installation, automatic WSL detection, sandbox-aware gating.
- `install.mjs` local installation script.
