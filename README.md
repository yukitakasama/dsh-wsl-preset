# dsh-wsl-preset

DeepSeek Harness 插件：一键安装「WSL 模式」agent preset —— 把 DSH 标准模式中的 shell 调用映射到 Windows Subsystem for Linux (WSL)，让 Windows 上的开发环境真正拥有完整的 Linux 命令行能力。

> 适配 **dsh 0.1.5-rc.1**。分布方式为 **GitHub 直装**（无需 npm 发布）。

## About

DSH 自带的标准模式在 Windows 上默认使用 PowerShell 作为 shell，但很多开发工作需要 Linux 命令（如 `grep`、`sed`、`awk`、`rsync` 等）。虽然可以手动配置 WSL，但需要修改预设文件和执行器，对普通用户不友好。

本插件交付一个可安装的预设变体：**同一套标准 persona + 完整工具表面**（bash、文件系统、搜索、技能、工作流、委托、present 等），但 shell 执行器换成 WSL —— 每次命令执行 `wsl -e bash -c <command>`，并通过沙箱感知门控保证不绕过安全边界。

## 特性

- **GitHub 直装**：`dsh plugin add github:...` 通过 pnpm 直接拉取本仓库，无需 npm 发布；
- **幂等安装**：插件启动时把打包的预设复制到用户预设根（`${DSH_HOME:-~/.dsh}/.agent-presets/wsl/`），已存在则跳过，`force: true` 才覆盖；
- **自动探测 WSL**：检查 `wsl.exe` 是否可用（System32 目录），无需硬编码路径；
- **沙箱感知门控**：WSL 运行时无法在 Windows 受限令牌沙箱内启动，因此命令仅在「完全访问」策略下执行——不绕过沙箱，受限时给出明确升级指引；
- **完整功能**：与标准模式工具表面保持一致（仅 shell 执行环境不同）；
- **正确预设标签**：会话选择器与状态栏显示「WSL 模式」。

## 工作原理

| 环节 | 说明 |
| --- | --- |
| 插件行 | `cordis.patch.yml` 在 web profile 组合中插入 `dsh-wsl-preset`，启动时安装预设文件 |
| 预设组合 | `agent.cordis.yml` 中 `wsl-shell` 组以 entry-local realm 提供 `shell` 服务，`tool-bash` 注册模型工具 |
| 执行器 | `wsl-executor.mjs` 通过 host 的 `subprocess` 服务执行 `wsl -e bash -c`，处理超时、后台、输出截断与错误诊断 |
| 沙箱门控 | `run`/`start` 校验策略：仅 `danger-full-access`（或部署无沙箱）放行，否则抛出带指引的错误 |

## 兼容性说明（dsh 0.1.5-rc.1）

本版本针对 0.1.5-rc.1 的接口变更做了适配：

| 变更 | 处理 |
| --- | --- |
| `dsh-persona` 移除 `text`，改为必填 `prefix` + `suffix` | 预设已改用 `prefix`/`suffix`（旧写法会挂载失败） |
| `dsh-tool-bash` 移除 `toolName` 配置，工具名固定为 `bash` | 已移除 `toolName`；WSL 改变的是**执行内容**而非工具名 |
| 标准 preset 新增 `command-goal`、`present` 行 | 已同步补齐 |
| `tool-subagent` 新增 `modelSelectionSettings` | 已同步，`modelSelectionSettings: true` |
| `tool-web` 默认开启 `fetch` | 已同步为 `fetch: true` |

## 安装

### 方式一：GitHub 直装（推荐）

```bash
dsh plugin --profile web add github:yukitakasama/dsh-wsl-preset
```

`dsh plugin` 会把参数转发给 profile 目录下的 pnpm；pnpm 克隆本仓库并安装依赖，随后 DSH 自动把声明了 `dsh.bundle` 的包加入 profile 的 layer 栈。

**锁定版本 / 分支 / 提交**：

```bash
dsh plugin --profile web add github:yukitakasama/dsh-wsl-preset#v0.3.0
```

**更新**：

```bash
dsh plugin --profile web update @yukitakasama/dsh-wsl-preset
```

### 针对特定 dsh 实例安装

`dsh` 通过 `DSH_HOME` 定位实例。安装前把它指向目标实例的 home 目录即可：

**bash / WSL**：

```bash
DSH_HOME=/path/to/instance/.dsh dsh plugin --profile web add github:yukitakasama/dsh-wsl-preset
```

**PowerShell**：

```powershell
$env:DSH_HOME="D:\path\to\instance\.dsh"; dsh plugin --profile web add github:yukitakasama/dsh-wsl-preset
```

> 不要用 `--dir` 来指定实例：`dsh plugin` 会把 `--dir` 原样透传给 pnpm，它改变的是 pnpm 的工作目录，而 DSH 仍按 `DSH_HOME` 回写 profile 清单，两者会不一致。

### 方式二：源码本地安装

不走网络，速度最快：

```bash
git clone https://github.com/yukitakasama/dsh-wsl-preset.git
cd dsh-wsl-preset
node install.mjs
```

脚本会自动完成三件事：
1. 复制预设文件到 `<DSH_HOME>/.agent-presets/wsl/`
2. 注入插件行到 DSH profile 的 `cordis.patch.yml`
3. 复制插件包到 profile 的 `node_modules/`

支持参数：
- `--force` — 强制覆盖已存在的预设文件
- `--home DIR`（别名 `--dir DIR`）— 指定 DSH Home 目录（默认 `~/.dsh`）

### 方式三：手动安装

1. 把 `agent-presets/wsl/` 目录复制到 `<DSH_HOME>/.agent-presets/`
2. 确保插件包已在 profile 的 `node_modules/` 中（或直接复制本仓库）
3. 在 profile 的 `cordis.patch.yml` 中添加：

```yaml
- insert:
    - id: dsh-wsl-preset
      name: '@yukitakasama/dsh-wsl-preset'
```

**重启 DSH 后生效**。

## 使用

1. Web 界面新建会话，选择 **WSL 模式**；
2. 二选一启用命令执行：
   - 把会话沙箱切到**完全访问**，之后所有命令直接走 WSL；
   - 或保持 workspace-write，让模型在第一次调用失败后按提示用 `sandbox_permissions: "danger-full-access"` + justification 单次升级（走正常审批流程）。

## 配置

**预设配置**（`agent-presets/wsl/agent.cordis.yml` 中 `wsl-executor`）：

| 字段 | 默认 | 说明 |
| --- | --- | --- |
| `timeoutMs` | 120000 | 单次命令默认超时（上限 `maxTimeoutMs`） |
| `maxTimeoutMs` | 600000 | 超时上限 |
| `maxOutputBytes` | 64000 | 单流保留字节数（溢出写入 spill 文件） |
| `maxSpillBytes` | 67108864 | spill 文件上限 |
| `graceMs` | 3000 | 终止进程的 SIGTERM→SIGKILL 宽限 |

**插件配置**（`cordis.patch.yml` 插入行）：

| 字段 | 默认 | 说明 |
| --- | --- | --- |
| `force` | `false` | 预设已存在时是否用包内文件覆盖（保留用户额外文件） |

## 开发

```bash
npm run check   # node --check lib/index.js && node --check agent-presets/wsl/wsl-executor.mjs
```

## 限制

- 会话沙箱为 workspace-write（或更窄）时，WSL 无法启动（Windows 受限令牌限制），需切换完全访问或单次升级——这是沙箱边界，插件不绕过；
- 与标准模式一致，命令为**每次调用新 shell**（不保持 `cd`/`export` 状态）；
- **工具名固定为 `bash`**：dsh ≥ 0.1.5-rc.1 的 `dsh-tool-bash` 不再支持 `toolName` 配置，因此模型侧看到的工具名是 `bash`（原先的 `wsl` 标签无法保留）。功能不受影响，命令仍全部经 WSL 执行；
- 需要系统已安装并启用 WSL（`wsl --install` 或通过 Windows 功能启用）。

## 项目结构

```
dsh-wsl-preset/
├── package.json          # 包清单，声明 dsh.bundle.patch
├── cordis.patch.yml      # profile 组合层：插入插件行
├── install.mjs           # 源码本地安装脚本
├── lib/index.js          # host 插件：启动时幂等安装预设
└── agent-presets/wsl/
    ├── preset.yml        # 预设元数据（名称、描述、排序）
    ├── agent.cordis.yml  # agent-plane 组合（工具表面 + WSL shell）
    └── wsl-executor.mjs  # WSL shell 执行器（ctx.shell provider）
```

## License

MIT
