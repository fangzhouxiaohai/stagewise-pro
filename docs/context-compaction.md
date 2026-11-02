# 上下文压缩功能说明（斜杠命令 + 自动压缩开关）

## 一、需求背景

原实现的上下文压缩完全由内部阈值驱动：每次步骤结束后检查已用 token，超过
`min(阈值 × 上下文窗口, 100k)` 才自动压缩，用户既看不到入口，也无法手动触发，
更不能关闭。本次改造补齐两项能力：

1. 聊天输入框新增 `/compact` 斜杠命令，随时手动压缩当前会话上下文。
2. 设置中新增“自动压缩上下文”（Auto-compact context）开关：
   - 打开（默认）：所有会话达到模型上下文窗口的 80% 时自动压缩；
   - 关闭：不再自动压缩，仅保留手动命令。

## 二、功能行为

### 2.1 手动压缩 `/compact`

- 入口：聊天输入框输入 `/`，选择 `Compact`，回车执行（也可输入 `compact` 过滤）。
- 该命令是即时动作：不会插入消息、不会发送给模型；执行后输入框内容清空并保留焦点。
- 执行过程使用同一个 Toast 提示位（先显示进行中，再覆盖为结果），避免堆叠多条提示。
- 结果状态与提示：

| 状态 | 触发场景 | 界面提示 |
| --- | --- | --- |
| `compressed` | 压缩成功 | Context compressed：折叠了 N 条较早消息 |
| `skipped / busy` | 已有压缩任务在执行 | Compression already running |
| `skipped / nothing-to-compact` | 历史太短或全部在保留预算内 | Nothing to compress |
| `skipped / agent-not-active` | 会话未激活（历史列表中的预览） | Nothing to compress |
| `unsupported / external-runtime` | Claude Code、Codex、OpenCode 等外部代理运行时 | Context compression unavailable |
| `failed` | 摘要模型级联全部失败 | Context compression failed |

- 压缩成功后，边界消息上方会出现既有的 `Compressed previous conversation` 标记；
  输入框右侧的上下文占用指示器会立即回落到压缩后的估算值。
- 编辑历史消息时的输入框不提供该命令。

### 2.2 自动压缩开关

- 位置：设置 → Agent → General → `Auto-compact context`（默认开启）。
- 打开：每次步骤结束后读取实时偏好，`usedTokens > 0.8 × contextWindow` 时自动压缩，
  不受历史 100k 绝对上限约束（该上限仅用于未接入用户偏好的宿主）。
- 关闭：`handlePostStep` 不再触发自动压缩；手动 `/compact` 不受影响。
- 策略通过宿主注入的读取函数实时获取，因此修改开关后已存在的会话立即生效，无需重启。

### 2.3 压缩算法（沿用既有实现）

- 保留预算：`min(0.2 × contextWindow, 40k tokens)`；
- 保留条数下限：`max(5, minUncompressedMessages ?? 10)`；
- 从历史末尾向前累计估算 token 确定边界；边界之前的消息交给摘要模型折叠为
  `metadata.compressedHistory`，边界及之后的消息保持原文；
- 已存在的摘要会被新一轮压缩吸收（链式压缩），旧原文不会重复序列化。

## 三、代码结构

| 文件 | 说明 |
| --- | --- |
| `packages/agent-core/src/agents/shared/auto-compaction.ts` | 触发阈值解析（宿主策略优先，历史配置兜底） |
| `packages/agent-core/src/agents/base-agent.ts` | 自动压缩触发、手动压缩入口 `compactHistoryNow`、压缩结果类型、压缩后回写用量 |
| `packages/agent-core/src/host/host.ts` | 新增 `autoCompactionPolicyProvider` 宿主能力位 |
| `packages/agent-core/src/services/agent-manager/agent-manager.ts` | `agents.compactHistory` 命令注册与 `compactAgentHistory` |
| `apps/browser/src/backend/main.ts` | 注入读取偏好 `agent.autoCompactContext` 的策略提供者 |
| `apps/browser/src/shared/karton-contracts/ui/shared-types.ts` | 偏好字段 `agent.autoCompactContext`（默认 `true`）与 schema 默认值 |
| `apps/browser/src/shared/karton-contracts/ui/index.ts` | Karton 契约 `agents.compactHistory` |
| `apps/browser/src/backend/services/agent-manager/agent-manager.ts` | 转发 `agents.compactHistory` RPC |
| `apps/browser/src/ui/hooks/use-compact-context.ts` | 手动压缩的 UI 逻辑与 Toast 状态 |
| `apps/browser/src/ui/screens/main/agent-chat/chat/_components/rich-text/slash/provider.ts` 等 | `/compact` 内置命令条目、图标、选择后的即时执行 |
| `apps/browser/src/ui/screens/settings/sections/general-settings-section.tsx` | 自动压缩开关 |
| `.agents/skills/history-compression/SKILL.md` | 同步更新压缩触发说明 |

## 四、验证记录

执行并通过的命令：

```bash
pnpm -F @stagewise/agent-core exec vitest run src/agents/shared/auto-compaction.test.ts
pnpm -F stagewise exec vitest run "<slash provider 测试>" "<偏好 schema 测试>"
pnpm -F @stagewise/agent-core test      # 639 项通过；3 项因 Windows 无 symlink 权限失败（与本改动无关）
pnpm -F stagewise test                  # 1174 项通过；2 项因 Windows 无 symlink 权限失败（与本改动无关）
pnpm -F stagewise typecheck             # ui / backend / preload / storybook 全部通过
pnpm check                              # Biome 通过
```

Windows 安装包：

```powershell
$env:PATH = "C:\Users\A\AppData\Roaming\npm;" + $env:PATH
$env:RELEASE_CHANNEL = 'release'
$env:APP_VERSION_OVERRIDE = '1.31.1'
$env:BUILD_MODE = 'production'
Push-Location apps/browser
pnpm make --arch=x64
Pop-Location
```

- 采用 `release` 渠道：沿用已有的 `%APPDATA%\stagewise` 用户数据与安装目录。
- 版本使用 `APP_VERSION_OVERRIDE=1.31.1`：本机已安装 1.31.0，覆盖安装需要更高版本号，
  避免 Squirrel 拒绝降级；不修改仓库中的 `package.json` 版本。
- 产物（`apps/browser/out/release/make/squirrel.windows/`）：
  - `stagewise-1.31.1-x64-setup.exe`（205 MB，SHA256 `5FAD0EE2454DED7FFF9044B7DE1D84D8A36F4FB7C87B26F495C9285E2B1D6BC3`）
  - `stagewise-1.31.1-x64-full.nupkg`、`RELEASES-win32-x64`（自动更新用）
- ZIP 产物名 `stagewise-win32-x64-1.30.2.zip` 中的版本号取自仓库 `package.json`，
  与实际安装版本不一致；Squirrel 安装包名称与版本信息均为 1.31.1。
- 产物内已核对：`app.asar` 含 `command:compact`、`autoCompactContext`、`agents.compactHistory`、
  `Auto-compact context`、`Context compressed` 等新增字符串；`resources/bundled/eslint-server`
  与 `resources/bundled/acp` 均已打包。

## 五、构建问题与处理记录

本次为本机首次构建，环境与 CI 存在差异，按“先复现、再定位、后修复”的顺序处理：

| 现象 | 复现/证据 | 处理 |
| --- | --- | --- |
| `pnpm` 无法启动（`MODULE_NOT_FOUND`，指向 `E:\DevCache\pnpm\store\v11\...`） | 系统 PATH 中的 `E:\DevCache\pnpm\bin\pnpm.CMD` 指向已不存在的 store | 构建命令前将 `C:\Users\A\AppData\Roaming\npm` 加入 PATH；仓库命令使用 `corepack pnpm`（10.30.3，与 packageManager 一致） |
| `pnpm install` 失败：`@electron/node-gyp` 从 codeload.github.com 拉取超时 | 直连 GitHub 返回 `ECONNREFUSED` | 临时将 `pnpm-lock.yaml` 中该 tarball 指向 `gh-proxy.com` 镜像完成安装，安装后已还原 lockfile |
| `@posthog/cli` postinstall 下载失败导致安装退出码非 0 | GitHub Releases 不可达 | 追加 `pnpm install --frozen-lockfile --ignore-scripts` 完成链接；`@posthog/cli` 仅用于 CI 源码映像上传，不影响本地构建 |
| Electron 二进制缺失（重新链接后 `dist/` 为空） | `node_modules/electron/dist` 不存在 | 在 `node_modules/electron` 下以 `ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/` 重跑 `install.js` |
| `bundle:eslint` 下载 vscode-eslint 失败 | 脚本从 GitHub archive 下载 | 通过 `gh-proxy.com` 下载 vscode-eslint 3.0.10 源码，按脚本相同步骤（pnpm install、webpack 构建）产出 `bundled/eslint-server/eslintServer.cjs` |
| vscode-eslint 源码中的 `client/src/shared`、`server/src/shared` 是符号链接，Windows 解压后变成 14 字节占位文件 | webpack 报 `Can't resolve './shared/settings'` | 将根目录 `$shared/*.ts` 复制到这两个目录后重新构建 |
| Squirrel 打包失败：`CreateZipFromDirectory` 找不到可执行文件 | `electron-winstaller/vendor` 缺少 `7z.exe`（重装依赖后 postinstall 产物丢失） | 复制 `7z-x64.exe`/`7z-x64.dll` 为 `7z.exe`/`7z.dll` 后重新打包成功 |
| 测试中 5 个用例因 `EPERM: symlink` 失败 | Windows 未开启开发者模式/无符号链接权限 | 与本改动无关，属既有环境限制：agent-core 3 个、browser 2 个，均为符号链接创建测试 |

