/**
 * 手工修正/补充的界面译文。
 *
 * 批量机器翻译（见 scripts/i18n/translate-ui-strings.ts）负责覆盖率，
 * 这里放高频、关键或机器翻译不准确的词条；后写入的键覆盖生成词典。
 */
export const ZH_OVERRIDES: Readonly<Record<string, string>> = {
  // 关键设置项
  'Show context usage and speed': '显示上下文占用与速度',
  'Text size': '文字大小',
  'Global instructions': '全局提示词',
  'Default tool approval': '默认工具审批',
  'Interface language': '界面语言',
  'Auto-compact context': '自动压缩上下文',
  "Summarize the conversation automatically once a session reaches 80% of the model's context window. When disabled, compress manually from the chat input with /compact.":
    '当会话达到模型上下文窗口的 80% 时自动总结对话；关闭后可在对话输入框用 /compact 手动压缩。',

  // 常用单词/短标签
  Search: '搜索',
  'New Chat': '新建对话',
  'New chat': '新建对话',
  'Open settings': '打开设置',
  'Copy error': '复制错误信息',
  'Saving...': '保存中…',
  Loading: '加载中',
  'Loading...': '加载中…',
  Create: '创建',
  Add: '添加',
  Remove: '移除',
  Edit: '编辑',
  Delete: '删除',
  Rename: '重命名',
  Close: '关闭',
  Back: '返回',
  Next: '下一步',
  Finish: '完成',
  Skip: '跳过',
  Done: '完成',
  Apply: '应用',
  Reset: '重置',
  Default: '默认',
  Enable: '启用',
  Disable: '禁用',
  Yes: '是',
  No: '否',
  Error: '错误',
  Warning: '警告',
  Success: '成功',
  Context: '上下文',
  Model: '模型',
  Provider: '服务商',
  Session: '会话',
  Tool: '工具',
  Permission: '权限',
  Workspace: '工作区',
  Agent: '智能体',
  Approve: '批准',
  Deny: '拒绝',
  Approvals: '审批',

  // 修正机器翻译
  Expires: '过期时间',
  'Show context usage': '显示上下文占用',
  'Check Again': '重新检查',
  'Always Allow': '始终允许',
  'Always Ask': '始终询问',

  // 思考强度标签
  High: '高',
  Medium: '中',
  Low: '低',
  'Extra High': '极高',
  Max: '最高',

  // 侧栏、文件树与输入框占位
  'Use / to plan and run commands. Use @ for context.':
    '输入 / 运行命令，输入 @ 添加上下文。',
  'Group by Age': '按时间分组',
  'Group by Workspace': '按工作区分组',
  'Group by workspace': '按工作区分组',
  'Hide sidebar': '隐藏侧边栏',
  'Show sidebar': '显示侧边栏',
  'Hide file tree': '隐藏文件树',
  'Show file tree': '显示文件树',
  'Pin globally': '全局置顶',
  'Unpin globally': '取消全局置顶',
  'Open file': '打开文件',
  'Search agents...': '搜索智能体…',
  'Connect workspace': '连接工作区',
  'New agent': '新建智能体',
};
