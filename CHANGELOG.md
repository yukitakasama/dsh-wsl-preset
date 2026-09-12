# Changelog

All notable changes to this project will be documented in this file.

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
