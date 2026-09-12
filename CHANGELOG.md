# Changelog

All notable changes to this project will be documented in this file.

## [0.2.0] - 2026-09-12

### Changed
- **BREAKING**: Package name changed from `@deepseek-ai/dsh-wsl-preset` to `@yukitakasama/dsh-wsl-preset`
- Updated package scope to use personal npm account for public distribution
- Enhanced documentation with specific instance installation instructions

### Added
- Support for installing to specific dsh instances using `--dir` flag
- `publishConfig.access: "public"` to ensure npm package is publicly installable
- `peerDependencies` specification requiring `@deepseek-ai/dsh >= 0.1.5-rc.1`
- `prepublishOnly` script to run validation before publishing
- Repository, bugs, and homepage URLs in package.json for better npm package page

### Fixed
- Updated all documentation and configuration files to reference the new package name
- Improved README with clearer installation instructions for different use cases

### Migration Guide
If you previously installed this package as `@deepseek-ai/dsh-wsl-preset`:

1. Uninstall the old package:
   ```bash
   dsh plugin --profile web remove @deepseek-ai/dsh-wsl-preset
   ```

2. Install the new package:
   ```bash
   dsh plugin --profile web add @yukitakasama/dsh-wsl-preset
   ```

3. Restart your DSH instance

## [0.1.0] - 2026-08-10

### Added
- Initial release of dsh-wsl-preset plugin
- WSL bash executor for Windows environments
- Idempotent preset installation
- Automatic WSL detection
- Sandbox-aware command gating
- Complete tool surface compatibility with standard mode
- Local installation script (install.mjs)
