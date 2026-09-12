# dsh-wsl-preset v0.2.0 更新报告

## 概述

本次更新将 dsh-wsl-preset 项目适配到最新版 dsh (0.1.5-rc.1)，并确保包可以通过 npm 公开安装，同时支持针对特定 dsh 实例的安装。

## 主要变更

### 1. 包名变更 (Breaking Change)
- **旧包名**: `@deepseek-ai/dsh-wsl-preset`
- **新包名**: `@yukitakasama/dsh-wsl-preset`
- **原因**: 使用个人 npm 账户发布，确保公开可访问性

### 2. 版本升级
- 版本号从 `0.1.0` 升级到 `0.2.0`
- 标记为 breaking change，因为包名变更

### 3. npm 发布配置
```json
{
  "publishConfig": {
    "access": "public"
  },
  "peerDependencies": {
    "@deepseek-ai/dsh": ">=0.1.5-rc.1"
  }
}
```
- 添加 `publishConfig.access: "public"` 确保包可以公开安装
- 添加 `peerDependencies` 明确依赖 dsh 0.1.5-rc.1 或更高版本
- 添加 `prepublishOnly` 脚本进行发布前验证

### 4. 特定实例安装支持
更新文档和配置，支持针对特定 dsh 实例安装:
```bash
dsh plugin --profile web add @yukitakasama/dsh-wsl-preset --dir /path/to/dsh/instance
```

### 5. 文档完善
- 更新 README.md 中的所有安装命令
- 添加针对特定实例的安装说明
- 更新 cordis.patch.yml 注释
- 创建 CHANGELOG.md 记录版本变更
- 添加迁移指南

## 兼容性

### 与最新 dsh 的兼容性
- ✅ 代码结构与 dsh 0.1.5-rc.1 完全兼容
- ✅ 使用标准的 Cordis 插件规范
- ✅ shell 服务接口保持一致
- ✅ sandbox 策略机制未变更

### 核心功能验证
经代码审查确认:
- ✅ WSL executor 实现符合 dsh-shell 接口规范
- ✅ 沙箱门控逻辑正确 (仅在 danger-full-access 模式下运行)
- ✅ subprocess 服务调用方式正确
- ✅ 预设安装逻辑幂等且安全

## 测试清单

发布前需验证:
- [ ] 本地语法检查: `npm run check`
- [ ] npm 包发布: `npm publish`
- [ ] 通过 npm 安装: `dsh plugin --profile web add @yukitakasama/dsh-wsl-preset`
- [ ] 特定实例安装: `dsh plugin --profile web add @yukitakasama/dsh-wsl-preset --dir <path>`
- [ ] WSL 模式基本功能: 创建会话 → 选择 WSL 模式 → 执行 bash 命令
- [ ] 沙箱门控: 验证非 full-access 模式下的错误提示

## 迁移指南

### 对于已安装旧版本的用户

1. 卸载旧包:
```bash
dsh plugin --profile web remove @deepseek-ai/dsh-wsl-preset
```

2. 安装新包:
```bash
dsh plugin --profile web add @yukitakasama/dsh-wsl-preset
```

3. 重启 DSH 实例

### 对于首次安装的用户

直接安装新包:
```bash
dsh plugin --profile web add @yukitakasama/dsh-wsl-preset
```

或使用本地安装脚本:
```bash
git clone https://github.com/yukitakasama/dsh-wsl-preset.git
cd dsh-wsl-preset
node install.mjs
```

## 文件变更清单

### 修改的文件
- `package.json` - 更新包名、版本、npm 配置
- `cordis.patch.yml` - 更新包名引用和文档
- `install.mjs` - 更新 PLUGIN_NAME 常量
- `README.md` - 更新所有安装命令和说明

### 新增的文件
- `CHANGELOG.md` - 版本变更日志
- `UPDATE_REPORT.md` - 本更新报告

### 未修改的核心文件
- `lib/index.js` - 预设安装逻辑无需变更
- `agent-presets/wsl/wsl-executor.mjs` - WSL executor 实现与最新 dsh 兼容
- `agent-presets/wsl/agent.cordis.yml` - 预设配置符合最新规范
- `agent-presets/wsl/preset.yml` - 预设元数据无需变更

## 发布步骤

1. **代码验证**
```bash
npm run check
```

2. **提交代码到 GitHub**
```bash
git add .
git commit -m "feat: update to v0.2.0 with new package name and dsh 0.1.5-rc.1 compatibility"
git push origin main
```

3. **创建 Git 标签**
```bash
git tag v0.2.0
git push origin v0.2.0
```

4. **发布到 npm**
```bash
npm publish
```

5. **创建 GitHub Release**
- 标题: `v0.2.0 - Package Name Update & DSH 0.1.5 Compatibility`
- 内容: 复制 CHANGELOG.md 中的 [0.2.0] 部分

6. **创建 Pull Request** (如果需要)
- 如果原仓库需要 PR，创建从 yukitakasama/dsh-wsl-preset 的 PR
- 标题: `Update to v0.2.0: New package scope and dsh 0.1.5 compatibility`
- 内容: 参考本 UPDATE_REPORT.md

## 注意事项

1. **Breaking Change**: 包名变更是 breaking change，现有用户需要手动迁移
2. **npm 账户**: 需要 yukitakasama npm 账户的发布权限
3. **测试**: 发布前务必在本地完整测试所有功能
4. **文档**: 确保所有文档中的包名引用都已更新

## 作者信息

- 作者: yukitakasama
- 更新日期: 2026-09-12
- dsh 版本: 0.1.5-rc.1
- 包版本: 0.2.0
