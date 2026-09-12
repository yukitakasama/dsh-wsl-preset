# dsh-wsl-preset v0.3.0 更新报告

**日期**：2026-09-12
**目标 dsh 版本**：0.1.5-rc.1
**包版本**：0.3.0
**作者**：yukitakasama

---

## 一、为什么要更新

原项目基于 dsh 0.0.x 时代的插件接口编写，在 0.1.5-rc.1 上存在**两个会直接导致预设挂载失败**的破坏性变更：

| # | 插件 | 变更 | 旧项目的后果 |
| --- | --- | --- | --- |
| 1 | `@deepseek-ai/dsh-persona` | 移除 `text` 字段，改为**必填** `prefix` + 可选 `suffix` | 预设挂载即报 schema 错误，WSL 模式不可用 |
| 2 | `@deepseek-ai/dsh-tool-bash` | 移除 `toolName` 配置，工具名硬编码为 `bash` | `toolName: wsl` 被 schema 丢弃（或报错），「WSL」工具标签失效 |

此外，官方 `standard` preset 在 0.1.5-rc.1 中新增了若干行与配置项，原 WSL preset 未同步，导致工具表面落后于标准模式。

---

## 二、核验方法

不依赖猜测，直接对照本机安装的 dsh 0.1.5-rc.1 源码逐项核对：

- 官方 standard preset：`@deepseek-ai/dsh-agent-presets/presets/standard/agent.cordis.yml`
- 人格 schema：`@deepseek-ai/dsh-persona/lib/index.js`
- bash 工具 schema：`@deepseek-ai/dsh-tool-bash/lib/index.js`
- shell 服务契约：`@deepseek-ai/dsh-shell/lib/types/{index,types}.d.ts`
- 官方执行器参考实现：`@deepseek-ai/dsh-bash-local/lib/index.js`
- 插件安装机制：`@deepseek-ai/dsh/lib/plugin-*.js`、`profile-boot-*.js`

---

## 三、实际修改内容

### 3.1 `agent-presets/wsl/agent.cordis.yml`（重写）

**修复破坏性变更**

```yaml
# 旧（0.1.5-rc.1 下挂载失败）
- id: persona
  name: '@deepseek-ai/dsh-persona'
  config:
    text: >-
      You are a coding agent powered by the {{model}} model. Your working directory is {{cwd}}.
      You use WSL Linux commands (bash) as your shell execution environment.

# 新
- id: persona
  name: '@deepseek-ai/dsh-persona'
  config:
    prefix: >-
      You are a coding agent powered by the {{model}} model.
      You use WSL Linux commands (bash) as your shell execution environment.
    suffix: Your working directory is {{cwd}}.
```

```yaml
# 旧：toolName 已不受支持
- id: tool-bash
  name: '@deepseek-ai/dsh-tool-bash'
  config:
    enableRunInBackground: false
    toolName: wsl

# 新：只保留受支持的配置项
- id: tool-bash
  name: '@deepseek-ai/dsh-tool-bash'
  config:
    enableRunInBackground: false
```

**与标准模式对齐工具表面**

| 新增/修改 | 内容 |
| --- | --- |
| 新增行 | `@deepseek-ai/dsh-command-goal` |
| 新增行 | `@deepseek-ai/dsh-tool-present` |
| 修改 | `tool-subagent` 增加 `modelSelectionSettings: true` |
| 修改 | `tool-web` 由 `fetch: false` 改为 `fetch: true` |
| 同步 | 各段注释更新为 0.1.5-rc.1 官方措辞 |

**保留的设计**：`wsl-shell` isolate 组（entry-local realm 提供 `shell`）与 WSL 执行器，这是本插件与标准模式的唯一有意差异。保留了 `subprocess`/`sandboxPolicy` 从 host 层解析的行为——realm 只隔离 `shell`。

### 3.2 `agent-presets/wsl/wsl-executor.mjs`（小改）

执行器的 `sandboxMode` / `resolve` / `run` / `start` 四件套**与 0.1.5-rc.1 的 `ctx.shell` 契约本就一致**，因此无需重写。仅做：

- `ENV_OVERRIDES` 增加 `GIT_PAGER: 'cat'`，与官方 `dsh-bash-local` 的终端环境集合对齐；
- 补充模块头部注释，说明为何采用 `ctx.provide('shell', …)` 的普通对象形式而非 `ShellExecutor` 子类形式。

> **关于执行器实现形式的说明**：0.1.5-rc.1 的官方执行器（`LocalBashExecutor`）通过 `class extends ShellExecutor` 注册服务。预设目录位于 `${DSH_HOME}/.agent-presets/`，其模块解析路径不包含 dsh 的 `node_modules`，无法 `import '@deepseek-ai/dsh-shell'`；因此本执行器继续使用普通函数式插件 + `ctx.provide('shell', executor)`。cordis 4.0.2 仍完整支持 `ctx.provide`，且工具层只依赖上述四件套，行为等价。

### 3.3 `package.json`

- 版本 `0.2.0` → `0.3.0`；
- 新增 `peerDependencies`：`@deepseek-ai/dsh >= 0.1.5-rc.1`；
- 保留 `dsh.bundle.patch` 声明（GitHub 安装时 DSH 依据它把本包加入 profile layer 栈）；
- **刻意不添加 `prepare` 脚本**：pnpm 安装 git 依赖时会执行 `prepare`，而 pnpm 默认拦截它并要求在 `pnpm-workspace.yaml` 的 `allowBuilds` 中授权。本插件没有构建步骤，省略 `prepare` 即可让 GitHub 直装零摩擦。

### 3.4 文档与脚本

- `README.md`：改为 **GitHub 直装优先**；新增 0.1.5-rc.1 兼容性对照表；修正「工具标签显示 WSL」这一已失效的描述；新增「针对特定实例安装」正确做法（`DSH_HOME`）；新增项目结构说明。
- `cordis.patch.yml`：注释更新为 GitHub 安装命令，并说明为何不能用 `--dir` 指定实例。
- `install.mjs`：新增 `--home DIR` 首选参数（`--dir` 保留为别名），解析逻辑同步更新。
- `CHANGELOG.md`：补齐 0.3.0 条目与迁移指南。

---

## 四、关于「针对特定实例安装」

原 README 给出的 `dsh plugin --profile web add <pkg> --dir /path/to/instance` **语义有误**。核查 `@deepseek-ai/dsh/lib/plugin-*.js` 后确认：

- `dsh plugin` 是 **pnpm 的透传器**：它在 `resolveProfileDir(profile)` 目录下运行 `pnpm <args>`；
- `--dir` 是 **pnpm 自己的 `-C, --dir`**，含义是「改变 pnpm 的工作目录」；
- 而 DSH 在 pnpm 结束后，仍按 `DSH_HOME` 解析出的 profile 目录回写 `dsh.profile.bundles` 清单。

因此传 `--dir` 会让「pnpm 装到 A 目录、DSH 回写 B 目录」，两者不一致。

**正确做法**是安装前设置 `DSH_HOME`：

```bash
DSH_HOME=/path/to/instance/.dsh dsh plugin --profile web add github:yukitakasama/dsh-wsl-preset
```

```powershell
$env:DSH_HOME="D:\path\to\instance\.dsh"; dsh plugin --profile web add github:yukitakasama/dsh-wsl-preset
```

---

## 五、关于 npm 公开发布（已放弃）

曾尝试 `npm publish`，被 npm 以 403 拒绝：

```
403 Forbidden - PUT https://registry.npmjs.org/@yukitakasama%2fdsh-wsl-preset
Two-factor authentication or granular access token with bypass 2fa enabled is required to publish packages.
```

即该 npm 账号开启了 2FA，而本地持有的 token 属于「发布需要 OTP」类型。两条出路：

1. 在 npmjs.com 创建勾选 **Bypass 2FA** 的 Granular Access Token；
2. 发布时用 `npm publish --otp=<6位码>`。

**最终决定**：不折腾 npm，改为 GitHub 直装。`dsh plugin add` 原生支持 git 源（源码中对 `github:`/`git+`/`.git` 有显式分支），用户一条命令即可安装，且免去版本发布与 2FA 流程。

---

## 六、验证清单

| 项目 | 状态 |
| --- | --- |
| `npm run check`（`node --check` 两个 JS 文件） | ✅ 通过 |
| persona schema 对照 `dsh-persona` 源码 | ✅ `prefix`/`suffix` 匹配 |
| tool-bash schema 对照 `dsh-tool-bash` 源码 | ✅ 仅保留 `enableRunInBackground` |
| 新增行对应的包存在性 | ✅ `dsh-tool-present`、`dsh-command-goal` 均已安装 |
| 工具表面与官方 standard 逐行对比 | ✅ 仅 shell 段有意不同 |
| shell 契约对照 `dsh-shell` 类型定义 | ✅ 四件套一致 |
| GitHub 安装命令形式对照 `dsh` 源码 | ✅ `github:` 前缀被识别 |

> 尚待在真实 WSL 会话中做端到端手工验证（切换完全访问 → 执行 Linux 命令）。

---

## 七、已知限制

1. **工具名不再是 `wsl`**：上游 `dsh-tool-bash` 硬编码工具名为 `bash`，预设层无法重命名。功能不受影响，命令仍全部经 WSL 执行，仅模型侧看到的工具标签变为 `bash`。若要恢复独立标签，上游需提供 `dsh-tool-wsl` 这类独立包。
2. **每次调用新 shell**：与标准模式一致，不保持 `cd`/`export` 状态。
3. **沙箱边界**：会话处于 workspace-write 或更窄时 WSL 无法启动，需完全访问或单次升级。
4. **依赖系统已装 WSL**。

---

## 八、变更文件清单

| 文件 | 变更 |
| --- | --- |
| `agent-presets/wsl/agent.cordis.yml` | 重写（persona、toolName、新增行、注释） |
| `agent-presets/wsl/wsl-executor.mjs` | 小改（GIT_PAGER、头部注释） |
| `package.json` | 版本 0.3.0、peerDependencies |
| `README.md` | 重写安装与兼容性说明 |
| `cordis.patch.yml` | 注释更新 |
| `install.mjs` | `--home` 参数 |
| `CHANGELOG.md` | 0.3.0 条目 |

未改动：`lib/index.js`、`agent-presets/wsl/preset.yml`、`LICENSE`。
