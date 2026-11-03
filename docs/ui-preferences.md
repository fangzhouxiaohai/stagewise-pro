# 界面偏好、全局提示词与默认权限

本次改造在原有“上下文压缩”之外，补齐了四项全局设置：界面语言、文字大小、
默认工具审批模式、全局提示词。

## 一、界面语言（简体中文 / English，默认简体中文）

- 位置：设置 → 智能体 → 常规 → 界面语言。
- 默认 `zh-CN`；切换为 English 后立即恢复英文原文，无需重启。
- 实现：渲染层之上的本地化字典（`apps/browser/src/ui/i18n/`）
  - `zh.generated.json`：由 `scripts/i18n/translate-ui-strings.ts` 从 UI 源码提取
    并调用本机 llama.cpp 模型批量翻译生成，当前覆盖约 940 条文案；
  - `zh.overrides.ts`：高频/关键文案的人工修正；
  - `translator.ts`：MutationObserver 监听文本节点与
    `placeholder/title/aria-label/alt/data-placeholder` 属性，命中词典时替换，
    切回英文时按保存的原文恢复；
  - 跳过区域：聊天消息正文（`data-i18n-skip`）、代码块、输入框、ProseMirror
    编辑器、Monaco、终端，避免翻译用户内容或模型输出。

已覆盖：设置页全部导航与章节、聊天输入框、侧栏、命令面板、压缩提示、
右键菜单与下拉框（弹层挂载时、绘制前同步翻译）、审批模式菜单、
常用弹窗和错误提示。

保留英文（有意或暂未覆盖）：模型与服务商品牌名、模型自带描述、原生应用菜单、
外部 ACP 代理（Claude Code/Codex/OpenCode）自身的输出。

## 二、文字大小（S / M / L / XL / XXL，默认 M）

- 位置：设置 → 智能体 → 常规 → 文字大小。
- 通过根字号缩放实现（rem 驱动的 Tailwind 排版会随之外观缩放）：

| 选项 | 根字号 | 相对 M |
| --- | --- | --- |
| S | 14.4px | 0.90 |
| M | 16px | 1.00 |
| L | 17.28px | 1.08 |
| XL | 18.56px | 1.16 |
| XXL | 20px | 1.25 |

- 与现有“界面缩放”（uiZoomPercentage）叠加生效。

## 二点五、原生菜单本地化

- 顶部应用菜单（stagewise / 编辑 / 用户 / 帮助）与网页右键菜单会跟随界面语言：
  - 应用菜单：关于、设置、GitHub/Discord、退出、编辑菜单各项、用户菜单
    （打开控制台/退出登录/加载中）、帮助菜单（报告问题/切换开发者工具）。
  - 网页右键菜单：撤销/重做/粘贴/全选/剪切/复制、链接与图片/视频/音频操作、
    复制链接地址、复制文本、搜索引擎搜索、打印/保存页面、检查元素、拼写建议。
- 实现：`apps/browser/src/shared/ui-language.ts` 保存主进程当前语言，
  `AppMenuService` 在偏好变化时重建菜单，`ContextMenuWebContent` 在每次弹出时读取；
  切换语言后菜单立即更新，无需重启。
- 渲染进程的界面文案仍由 `apps/browser/src/ui/i18n` 字典层负责。

## 二点六、侧栏快速明暗切换

- 位置：左侧栏底部、设置齿轮左侧新增月亮/太阳按钮。
- 行为：读取 `globalConfig.appColorScheme` 与系统主题计算当前是否暗色；
  点击后切换为显式的 `light` / `dark`（不再跟随系统），图标与悬浮提示同步变化；
  设置 → 个性化中的“应用配色”选项会同步显示当前值。
- 实现：`sidebar-auth-footer.tsx` 调用 `config.set({ appColorScheme })`；
  `src/shared/color-scheme.ts` 提供 `isDarkColorScheme` / `resolveNextColorScheme`
  纯函数并配有单测；`nativeTheme.themeSource` 更新后，UI 的 `systemTheme`
  状态驱动根节点 `dark` class。
- 切换过渡：使用 View Transitions API 做圆形扩散/回缩，以按钮中心为圆心：
  - 切到暗色：新暗色主题从左下角向右上角扩散（720ms，ease-out 曲线）；
  - 切到浅色：旧暗色主题从右上角向左下角回缩（720ms，ease-in-out 曲线）；
  - 边缘叠加一层流光：柔和光晕 + 旋转的锥形高光，跟随圆弧边缘移动；
  - 不支持 View Transitions 或系统开启“减少动态效果”时，降级为 220ms 颜色淡入。
- 实现：`src/ui/utils/color-scheme-transition.ts`（半径计算、方向判定、
  过渡播放与流光覆盖层，含单测）；`PersonalizationThemeSyncer` 在动画期间
  跳过 CSS 颜色过渡，避免边缘拖影；`browser-base.css` 中关闭默认交叉淡入、
  设置新旧快照层级并定义 `.theme-reveal-glow`。
- 悬浮提示文案已加入中英词典（“Switch to dark mode”/“切换到暗黑模式”）。

## 二点七、设置页返回按钮

- 位置：设置侧栏顶部。
- 样式：整行宽度、1px 边框、12px 圆角，与侧栏导航项对齐。
- 鼠标移入：从指针进入位置向外扩散一层主色填充（600ms）。
- 点击：在点击位置生成水波纹，延迟 260ms 关闭设置页，保证动画可见。
- 实现：`settings/sidebar.tsx` 的 `SettingsBackButton` 与
  `browser-base.css` 中的 `.settings-back-button` / `.settings-back-ripple`。

## 二点八、上下文占用显示

- 设置 → 智能体 → 常规中的“显示上下文占用”打开后，模型选择器旁显示上下文
  占用百分比；关闭后仅在占用超过 80% 时显示圆环。
- 圆环颜色随占用变化（≥70% 警告色，≥90% 错误色），悬浮提示显示
  `x% - 12k / 64k used`。
- 生成速度的计算与显示已整体移除，界面不再出现 `tok/s`。

## 三、默认工具审批模式（默认 Always allow）

- 位置：设置 → 智能体 → 常规 → 默认工具审批。
- 选项：始终询问（Always ask）、智能审批（Smart approval）、始终允许（Always allow）。
- 新建会话在创建时读取该偏好作为初始 `toolApprovalMode`，首次安装默认
  Always allow，不再需要每个会话手动切换。
- 已存在的会话保留各自已保存的模式；输入框内的审批选择仍可随时临时切换。
- 实现：`AgentHost.defaultToolApprovalModeProvider` → `AgentManager.createAgent`
  的默认状态；浏览器端由 `preferencesService.get().agent.defaultToolApprovalMode` 提供。

## 四、全局提示词

- 位置：设置 → 智能体 → 常规 → 全局提示词（多行输入 + 保存按钮）。
- 保存后追加到每个原生智能体系统提示词末尾：

```
<global-user-instructions>
用户输入的全局指令
</global-user-instructions>
```

- 每次构建上下文时实时读取，修改后对下一个步骤立即生效；空内容不追加。
- 不作用于外部 ACP 代理（其提示词由外部程序管理）。
- 实现：`AgentHost.globalSystemPromptProvider` →
  `BaseAgent.applyGlobalSystemPrompt`（`appendGlobalSystemPrompt` 纯函数，含单测）。

## 五、代码结构与测试

| 文件 | 说明 |
| --- | --- |
| `apps/browser/src/ui/i18n/zh.generated.json` | 批量翻译词典（约 940 条） |
| `apps/browser/src/ui/i18n/zh.overrides.ts` | 关键文案人工修正 |
| `apps/browser/src/ui/i18n/translator.ts` | DOM 翻译层（文本 + 属性、跳过规则、英文恢复） |
| `apps/browser/src/ui/i18n/text-size.ts` | 文字尺寸 → 根字号映射 |
| `apps/browser/src/ui/components/ui-preference-syncer.tsx` | 应用语言/文字尺寸偏好 |
| `apps/browser/scripts/i18n/translate-ui-strings.ts` | 文案提取 + 本地模型翻译脚本（可重复执行，自动跳过已译词条） |
| `packages/agent-core/src/agents/shared/system-prompt.ts` | 全局提示词拼装 |
| `packages/agent-core/src/host/host.ts` | 默认审批模式与全局提示词两个宿主能力位 |
| `apps/browser/src/shared/karton-contracts/ui/shared-types.ts` | `general.language`、`general.uiTextSize`、`agent.defaultToolApprovalMode`、`agent.globalSystemPrompt` |
| `apps/browser/src/ui/screens/settings/sections/general-settings-section.tsx` | 四项设置的 UI |

测试：

```bash
pnpm -F @stagewise/agent-core exec vitest run src/agents/shared/system-prompt.test.ts
pnpm -F stagewise exec vitest run src/ui/i18n/translator.test.ts src/ui/i18n/text-size.test.ts
pnpm -F stagewise exec vitest run src/shared/karton-contracts/ui/shared-types.test.ts
pnpm -F stagewise typecheck
pnpm check
```

## 六、稳定性取舍（重要）

最初版本使用 MutationObserver 实时翻译新增/变化的文本，但实际运行中与
React 重渲染、Virtuoso 列表测量形成了“翻译 → 重排 → 重渲染 → 再翻译”的
反馈环，渲染进程持续占用约 70% CPU，界面卡顿甚至无法响应 CDP。

定位方式：通过 CDP 在切换语言前注入 `MutationObserver.prototype.observe`
补丁，分别关闭 `characterData`、`childList`，观察 CPU 与响应性；最终确认
只要禁用对 `document.body` 的 `childList` 监听，中文界面即可稳定。

最终实现**完全不使用 MutationObserver**，改为：

- 启动时立即扫描一次，并在 800ms / 2500ms 各补扫一次，覆盖首屏懒加载的主界面；
- 用户交互（click / keydown / focusin）后 250ms 合并重扫一次，
  最小间隔 900ms；
- 属性（placeholder/title 等）在每次扫描时一并处理；
- 切回英文时按保存的原文恢复，并移除交互监听。

取舍：少数在运行时原地更新的动态文案（如“保存中…”）可能要等到下一次
交互重扫才变成中文；静态标签、按钮、设置页、导航、弹窗在打开后均为中文。
这是为了彻底避免布局反馈环、保证界面不卡顿而接受的取舍。

## 七、安装与验证

- 安装程序：`stagewise-pro-1.31.29-x64-setup.exe`（Inno Setup，当前用户安装）。
  - 默认安装到 `E:\softs\stagewise-pro`；
  - E 盘不存在时默认 `C:\softs\stagewise-pro`；
  - 两个盘都不可用时停留在目录选择页，由用户指定位置；
  - 安装向导弹出时也可手动修改目录。
  安装包位于 `apps/browser/out/release/make/inno/`，构建方法见
  [installation.md](installation.md)。
- 用户数据仍位于 `%APPDATA%\stagewise`，覆盖安装不会丢失会话与设置。
- 验证方式：安装后启动应用，通过 Chrome DevTools Protocol 截图设置页，确认：
  - 设置页导航与内容为中文；
  - 界面语言、文字大小、默认工具审批、全局提示词、自动压缩、上下文占用显示
    六项设置均存在且可操作；
  - 默认工具审批显示“始终允许”，文字大小显示“M”，界面语言显示“简体中文”；
  - 中文模式下渲染进程 CPU 保持低位、CDP 可正常响应（无反馈环）；
  - 侧栏日期分组显示“今天 / 昨天”，聊天输入框占位符为中文；
  - 历史页日期为“2026年11月2日星期一”，清除数据按钮、关于页“查看全部”、
    已归档空状态均为中文。
