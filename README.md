# dsh-wsl-preset

DeepSeek Harness 插件：一键安装「WSL 模式」agent preset —— 把 DSH 标准模式中的 bash 调用映射到 Windows Subsystem for Linux (WSL)，让 Windows 上的开发环境真正拥有完整的 Linux 命令行能力。

## About

DSH 自带的标准模式在 Windows 上默认使用 PowerShell 作为 shell，但很多开发工作需要 Linux 命令（如 `grep`、`sed`、`awk`、`rsync` 等）。虽然可以通过 WSL 手动配置，但需要修改预设文件和执行器，对普通用户不友好。

本插件交付一个可安装的预设变体：**同一套标准 persona + 完整工具表面**（bash、文件系统、搜索、技能、工作流等），但 bash 工具每次命令执行 `wsl -e bash -c <command>`，并通过沙箱感知门控保证不绕过安全边界。

## 特性

- **幂等安装**：插件启动时把打包的预设复制到用户预设根（`${DSH_HOME:-~/.dsh}/.agent-presets/wsl/`），已存在则跳过，`force: true` 才覆盖；
- **自动探测 WSL**：检查 `wsl.exe` 是否可用（System32 目录），无需硬编码路径；
- **沙箱感知门控**：WSL 运行时无法在 Windows 受限令牌沙箱内启动，因此命令仅在"完全访问"策略下执行——不绕过沙箱，受限时给出明确升级指引；
- **完整功能**：与标准模式一致，包含所有工具（bash、文件系统、搜索、技能、工作流、委托等），仅 shell 执行环境不同；
- **正确 UI 标签**：工具标签显示 "WSL" 而非 "Bash" 或 "Pwsh"，状态栏显示 "WSL 模式"。

## 工作原理

| 环节 | 说明 |
| --- | --- |
| 插件行 | `cordis.patch.yml` 在 web profile 组合中插入 `dsh-wsl-preset`，启动时安装预设文件 |
| 预设组合 | `agent.cordis.yml` 中 `wsl-shell` 组以 entry-local realm 提供 `shell` 服务，`tool-bash` 注册模型工具（`toolName: wsl`） |
| 执行器 | `wsl-executor.mjs` 通过 host 的 `subprocess` 服务执行 `wsl -e bash -c`，处理超时、后台、输出截断与错误诊断 |
| 沙箱门控 | `run`/`start` 校验策略：仅 `danger-full-access`（或部署无沙箱）放行，否则抛出带指引的错误 |

## 安装

```bash
dsh plugin --profile web add @deepseek-ai/dsh-wsl-preset
```

或手动合并 `cordis.patch.yml` 到 profile patch 层。**重启 DSH 后生效**；重启后插件会自动安装预设（已存在则 no-op，不会覆盖你已有的版本）。

也可以不装插件，直接把 `agent-presets/wsl/` 目录复制到 `~/.dsh/.agent-presets/`。

## 使用

1. Web 界面新建会话，选择 **WSL 模式**；
2. 二选一启用 bash：
   - 把会话沙箱切到**完全访问**，之后所有 bash 调用直接走 WSL；
   - 或保持 workspace-write，让模型在第一次调用失败后按提示用 `sandbox_permissions: "danger-full-access"` + justification 单次升级（走正常审批流程）。

## 配置

**预设配置**（`agent-presets/wsl/agent.cordis.yml` 中 `wsl-executor`）：

| 字段 | 默认 | 说明 |
| --- | --- | --- |
| `timeoutMs` | 120000 | 单次命令默认超时（上限 `maxTimeoutMs`） |
| `maxTimeoutMs` | 600000 | 超时上限 |
| `maxOutputBytes` | 64000 | 单流保留字节数（溢出写入 spill 文件） |
| `graceMs` | 3000 | 终止进程的 SIGTERM→SIGKILL 宽限 |

**插件配置**（`cordis.patch.yml` 插入行）：

| 字段 | 默认 | 说明 |
| --- | --- | --- |
| `force` | `false` | 预设已存在时是否用包内文件覆盖（保留用户额外文件） |

## 开发

```bash
pnpm install
node --check lib/index.js
node --check agent-presets/wsl/wsl-executor.mjs
```

## 限制

- 会话沙箱为 workspace-write（或更窄）时，WSL 无法启动（Windows 受限令牌限制），需切换完全访问或单次升级——这是沙箱边界，插件不绕过；
- 与原标准模式不同，bash 为**每次调用新 shell**（不保持 cd/export 状态）——通过 WSL 执行时，每次命令都在独立的 bash 实例中运行；
- 需要系统已安装并启用 WSL（`wsl --install` 或通过 Windows 功能启用）。

## dsh-std 兼容性

本插件遵循 DSH 社区插件规范：

- **包结构**：标准 `package.json` + `dsh.bundle.patch` 声明 + `cordis.patch.yml` 插入行
- **安装模式**：幂等安装到用户预设根，支持 `force` 覆盖
- **预设格式**：标准 `preset.yml` + `agent.cordis.yml` 组合文件
- **执行器隔离**：通过 entry-local realm 隔离 shell 服务，不污染其他预设

> 注：dsh-std 协议（@dsh-std/manifest）目前处于早期草案阶段，采用自愿。本插件暂未添加 `dsh-plugin.json` 清单文件，待协议稳定后可补充。

## License

MIT
