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
- 打开：每个步骤结束以及每次发起新请求之前都会读取实时偏好，
  `usedTokens > 0.8 × contextWindow` 时自动压缩，不受历史 100k 绝对上限约束
  （该上限仅用于未接入用户偏好的宿主）。
- 窗口口径统一：步骤结束时会同时把当前模型真实的 `contextWindowSize` 写回
  agent 状态，输入框指示器与后端触发阈值使用同一个窗口值，避免“界面显示 80%
  但后端认为没到”的口径偏差。
- 关闭：不再触发自动压缩；手动 `/compact` 不受影响。
- 策略通过宿主注入的读取函数实时获取，因此修改开关后已存在的会话立即生效，无需重启。

### 2.3 压缩过程可见与任务连续性

- 对话内提示：压缩开始时在聊天区底部显示带旋转图标的 `Compressing context...`
  动画；完成后显示 `Context compressed - N earlier messages summarized`，
  8 秒后自动收起；失败则显示 `Context compression failed`（智能体继续使用未压缩历史）。
- 状态由 agent 状态的瞬态字段 `compaction` 驱动（running / completed / failed，
  含触发来源 auto/manual、开始/结束时间、折叠与保留消息数），不写数据库。
- 自动压缩从“后台 fire-and-forget”改为 **await 后再继续步骤循环**：压缩成功后
  下一次模型请求直接使用压缩后的历史，任务不会中断，也不会因上下文溢出报错。
- 额外增加请求前检查：恢复会话或上一轮刚越过 80% 时，先压缩再发请求。

### 2.4 上下文占用显示

- 位置：设置 → Agent → General → `Show context usage`（默认开启）。
- 打开后，输入框模型选择器旁显示上下文占用百分比；圆环颜色随占用变化
  （≥70% 警告色，≥90% 错误色），悬浮提示给出 `x% - 12k / 64k used`。
- 关闭后仅在占用超过 80%（或 dev 构建）时显示圆环。
- 生成速度的计算与显示已移除，不再有 `tok/s` 相关逻辑与界面。

### 2.6 关于“超过 80% 却看不到压缩”的排查结论

本机核查了 `%APPDATA%\stagewise\stagewise\preferences.json` 与
`agents/instances.sqlite`：

- `autoCompactContext` 未写入 preferences.json，但 schema 默认值为 `true`，
  运行时实际生效；
- Qwen 本地会话最近一步 `used_tokens = 49,353`，模型窗口 `65,536`（75.3%），
  严格来说尚未达到 80%；DeepSeek 会话 `177,685 / 1,048,576`（17%）。

虽然没有复现出“越过 80% 仍不触发”的确定性逻辑错误，但确认了三个会造成
“看起来没有压缩”的真实问题，并已修复：

1. **压缩完全不可见**：旧实现用 `void` 后台触发，压缩期间界面没有任何提示，
   用户看到占用停在 80% 以上会以为没压缩；压缩与下一步并发时还可能因上下文
   溢出导致任务中断。现在改为等待压缩完成再继续，并在对话内显示动画与结果。
2. **窗口口径可能不一致**：旧实现不把后端解析到的 `contextWindowSize` 写回状态，
   输入框会走选择器/200k 兜底值；现在每个步骤结束都会回写真实窗口。
3. **只在步骤结束后检查**：恢复会话或跨轮时不会在发请求前检查；现在请求前
   也会检查一次。

### 2.7 压缩算法（沿用既有实现）

- 保留预算：`min(0.2 × contextWindow, 40k tokens)`；
- 保留条数下限：`max(5, minUncompressedMessages ?? 10)`；
- 从历史末尾向前累计估算 token 确定边界；边界之前的消息交给摘要模型折叠为
  `metadata.compressedHistory`，边界及之后的消息保持原文；
- 已存在的摘要会被新一轮压缩吸收（链式压缩），旧原文不会重复序列化。

## 三、代码结构

| 文件 | 说明 |
| --- | --- |
| `packages/agent-core/src/agents/shared/auto-compaction.ts` | 触发阈值解析（宿主策略优先，历史配置兜底） |
| `packages/agent-core/src/agents/base-agent.ts` | 请求前/步骤后压缩检查、`compactHistoryNow`、压缩状态机、上下文窗口回写 |
| `packages/agent-core/src/types/agent.ts` | 瞬态字段 `compaction` |
| `packages/agent-core/src/host/host.ts` | 新增 `autoCompactionPolicyProvider` 宿主能力位 |
| `packages/agent-core/src/services/agent-manager/agent-manager.ts` | `agents.compactHistory` 命令注册与 `compactAgentHistory` |
| `apps/browser/src/backend/main.ts` | 注入读取偏好 `agent.autoCompactContext` 的策略提供者 |
| `apps/browser/src/shared/karton-contracts/ui/shared-types.ts` | 偏好字段 `autoCompactContext` / `showContextStats`（默认均 `true`） |
| `apps/browser/src/shared/karton-contracts/ui/index.ts` | Karton 契约 `agents.compactHistory` |
| `apps/browser/src/backend/services/agent-manager/agent-manager.ts` | 转发 `agents.compactHistory` RPC |
| `apps/browser/src/ui/hooks/use-compact-context.ts` | 手动压缩的 UI 逻辑与 Toast 状态 |
| `apps/browser/src/ui/screens/main/agent-chat/chat/_components/message-compaction.tsx` | 对话内压缩进行中/结果提示 |
| `apps/browser/src/ui/screens/main/agent-chat/chat/_components/context-usage-ring.tsx` | 上下文占用百分比显示 |
| `apps/browser/src/ui/screens/main/agent-chat/chat/_components/rich-text/slash/provider.ts` 等 | `/compact` 内置命令条目、图标、选择后的即时执行 |
| `apps/browser/src/ui/screens/settings/sections/general-settings-section.tsx` | 自动压缩与上下文占用显示开关 |
| `.agents/skills/history-compression/SKILL.md` | 同步更新压缩触发说明 |

## 四、验证记录

执行并通过的命令：

```bash
pnpm -F @stagewise/agent-core exec vitest run src/agents/shared/auto-compaction.test.ts
pnpm -F stagewise exec vitest run "<slash provider 测试>" "<偏好 schema 测试>"
pnpm -F stagewise exec vitest run src/backend/services/telemetry.test.ts  # 含 3 项空密钥启动用例
pnpm -F @stagewise/agent-core test      # 639 项通过；3 项因 Windows 无 symlink 权限失败（与本改动无关）
pnpm -F stagewise test                  # 1174 项通过；2 项因 Windows 无 symlink 权限失败（与本改动无关）
pnpm -F stagewise typecheck             # ui / backend / preload / storybook 全部通过
pnpm check                              # Biome 通过
```

Windows 安装包：

```powershell
$env:PATH = "C:\Users\A\AppData\Roaming\npm;" + $env:PATH
$env:RELEASE_CHANNEL = 'release'
$env:APP_VERSION_OVERRIDE = '1.31.2'
$env:BUILD_MODE = 'production'
Push-Location apps/browser
pnpm make --arch=x64
Pop-Location
```

- 采用 `release` 渠道：沿用已有的 `%APPDATA%\stagewise` 用户数据与安装目录。
- 版本使用 `APP_VERSION_OVERRIDE`：本机原安装 1.31.0，覆盖安装需要更高版本号，
  避免 Squirrel 拒绝降级；不修改仓库中的 `package.json` 版本。
- 最终可用产物（`apps/browser/out/release/make/squirrel.windows/`）：
  - `stagewise-1.31.2-x64-setup.exe`（205,825,536 字节，SHA256 `42B8D89F69443B20C4D376E1E9B23E025C3191A9DCDC3D8F843C552831E76426`）
  - `stagewise-1.31.2-x64-full.nupkg`、`RELEASES-win32-x64`（自动更新用）
- ZIP 产物名中的版本号取自仓库 `package.json`（1.30.2），与实际安装版本不一致；
  Squirrel 安装包名称与版本信息均为 1.31.2。
- 产物内已核对：`app.asar` 含 `command:compact`、`autoCompactContext`、`agents.compactHistory`、
  `Auto-compact context`、`Context compressed`、`phc_local_build_telemetry_disabled` 等字符串；
  `resources/bundled/eslint-server` 与 `resources/bundled/acp` 均已打包。
- 本机已实际安装并启动验证：安装目录为 `%LOCALAPPDATA%\stagewise\app-1.31.2`，
  主窗口正常打开，`window-state.json` 正常写入，未再出现启动崩溃弹窗。

## 五、安装失败排查记录

### 5.1 现象一：`Installer has failed`（安装程序弹窗）

- 日志位置：`%LOCALAPPDATA%\SquirrelTemp\Squirrel-Install.log`、`Squirrel-Install.1.log`。
- 关键日志：`CreateUninstallerRegistryEntry` 报
  `FileNotFoundException: ...\packages\stagewise-1.31.1-full.nupkg`；
  `.1.log` 中同时出现 `Failed to remove existing directory ... app-1.31.1\squirrel.exe ... 访问被拒绝`。
- 根因：首次安装因下载卸载图标（`raw.githubusercontent.com`）阻塞约 95 秒，
  期间用户又多次双击安装包；后启动的实例执行“burning it to the ground”时删除了
  先启动实例正在使用的 `packages` 目录，先启动实例随后在写入卸载注册表时找不到
  nupkg 而失败。属于并发安装导致的互删，不是安装包结构问题。
- 处理：结束所有 stagewise/Update/Setup 进程后，仅运行一次安装包并等待其完整结束；
  安装成功（`packages\stagewise-1.31.2-full.nupkg`、`app.ico`、`stagewise.exe` 均正常生成）。

### 5.2 现象二：安装完成后启动报 `Unhandled Promise Rejection`

- 错误：`Error: You must pass your PostHog project's api key.`（`TelemetryService` 构造阶段）。
- 根因：本地构建没有 `.env.prod`，`POSTHOG_API_KEY` 为空；
  `posthog-node` 构造时校验密钥非空并抛错，导致主进程启动中断。
- 修复：`apps/browser/src/backend/services/telemetry.ts` 在密钥缺失时记录警告，
  使用占位密钥并保持 `disabled: true`，本地构建可正常启动且不会上报任何数据；
  正式构建注入真实密钥，行为不变。新增 3 个单测覆盖空密钥场景。
- 重建 1.31.2 安装包并在本机覆盖安装验证通过。

## 六、构建问题与处理记录

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


