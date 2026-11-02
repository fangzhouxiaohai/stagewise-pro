<div align="center">

<picture>
  <source media="(prefers-color-scheme: dark)" srcset=".github/assets/logo-combo-dark.svg">
  <img src=".github/assets/logo-combo.svg" alt="stagewise pro" height="60" />
</picture>

<h3>stagewise pro · 本地增强版智能体 IDE</h3>

<p>基于 stagewise 的本地增强分支，重点补齐中文体验、上下文压缩与日常使用细节。</p>

</div>

---

## 本仓库改动（相对上游）

### 品牌与界面

- 程序名称改为 **stagewise pro**：窗口标题、任务栏名称、安装器、原生应用菜单同步更新。
- 默认 **简体中文**，可在设置 → 智能体 → 常规中切换 English；页面文案、原生应用菜单、
  网页右键菜单均跟随切换，无需重启。
- 文字大小支持 **S / M / L / XL / XXL** 五档，整体界面随根字号缩放。
- 左侧栏底部新增明暗主题快捷按钮：
  - 切换到暗色：新主题从左下角按钮位置以圆形方式向右上角扩散；
  - 切换到浅色：旧暗色主题从右上角向左下角回缩，露出浅色主题；
  - 扩散/回缩边缘带流光高光，时长 680ms；
  - 遵循系统“减少动态效果”设置，不支持 View Transitions 时退化为颜色淡入。

### 上下文与压缩

- 对话输入框支持 `/compact` 斜杠命令，手动压缩上下文。
- 设置 → 智能体 → 常规新增“自动压缩上下文”（默认开启）：会话达到模型上下文窗口
  80% 时自动总结历史，压缩完成后继续当前任务，不中断执行。
- 压缩过程在对话内显示动画与结果，失败时显示原因。
- 模型选择器旁显示上下文占用百分比与最近生成速度（例如 `42% · 18 tok/s`），
  可在设置中关闭。

### 审批与提示词

- 默认工具审批模式可在设置中配置（默认“始终允许”），新会话自动生效；
  已有会话保留各自的审批模式，输入框仍可临时切换。
- 设置 → 智能体 → 常规新增“全局提示词”：保存后追加到每个原生会话的
  `<global-user-instructions>` 段，对下一步生效。

### 兼容与数据

- 品牌更名后仍沿用原用户数据目录（Windows 下为 `%APPDATA%\stagewise`），
  升级不会丢失会话、设置、技能与模型配置。
- 程序安装到 `E:\softs\stagewise-pro`，不写入 C 盘；详见
  [安装说明](docs/installation.md)。
- 外部 ACP 代理（Claude Code、Codex、OpenCode 等）的提示词与输出由其自身管理，
  不受全局提示词与界面翻译影响。
- 系统文件选择框、系统弹窗按钮等由操作系统控制，不随应用语言切换。

## 安装

使用 `stagewise-pro-<版本>-x64-setup.exe` 安装：

- 默认安装到 `E:\softs\stagewise-pro`；
- 如果 E 盘不存在，则默认安装到 `C:\softs\stagewise-pro`；
- 如果两个盘都不可用，安装向导会停留在目录选择页，由用户指定位置；
- 安装向导本身也允许手动修改安装目录。

安装包位于：

```text
apps/browser/out/release/make/inno/stagewise-pro-<版本>-x64-setup.exe
```

用户数据保留在 `%APPDATA%\stagewise`，覆盖安装不会丢失会话与设置。
开发调试时也可以使用 `pwsh -File scripts/install-portable.ps1` 直接复制到
`E:\softs\stagewise-pro`。完整说明见 [docs/installation.md](docs/installation.md)。

## 开发

```bash
pnpm install
pnpm dev
pnpm check
pnpm test
```

构建 Windows 安装包：

```bash
cd apps/browser
$env:RELEASE_CHANNEL="release"
$env:APP_VERSION_OVERRIDE="1.31.26"
$env:BUILD_MODE="production"
pnpm make --arch=x64
```

## 文档

- [上下文压缩说明](docs/context-compaction.md)
- [界面偏好、原生菜单、明暗主题与全局提示词](docs/ui-preferences.md)

## 许可与致谢

本项目基于 [stagewise](https://github.com/stagewise-io/stagewise) 修改，
遵循 AGPLv3 许可。上游版权归 stagewise GmbH 所有；本仓库的本地增强改动
（中文本地化、文字尺寸、默认审批、全局提示词、上下文压缩交互、明暗主题动效、
stagewise pro 品牌）由本仓库维护者提供。
