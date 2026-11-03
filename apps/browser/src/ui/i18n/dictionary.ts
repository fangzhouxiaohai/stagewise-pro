import generated from './zh.generated.json';
import { ZH_OVERRIDES } from './zh.overrides';

/**
 * 英文界面文案 → 简体中文的对照表。
 *
 * 键为界面源码中的原始英文字符串（会做 trim 后精确匹配），值为中文译文。
 * 该文件由 `scripts/i18n/translate-ui-strings.ts` 批量生成，关键文案可在
 * `zh.overrides.ts` 中手工修正；生成脚本见仓库 scripts/i18n 目录。
 */
export const ZH_DICTIONARY: Readonly<Record<string, string>> = {
  ...(generated as Record<string, string>),
  ...ZH_OVERRIDES,
};

/** 带动态数字/名称的文案模式（精确匹配失败后的兜底）。 */
const PATTERNS: ReadonlyArray<{
  pattern: RegExp;
  translate: (match: RegExpMatchArray) => string;
}> = [
  {
    pattern: /^Reconnecting\.\.\. \(attempt (\d+)\/(\d+)\)$/,
    translate: (m) => `正在重新连接…（第 ${m[1]}/${m[2]} 次尝试）`,
  },
  {
    pattern: /^Connection failed after (\d+) attempts$/,
    translate: (m) => `连接在 ${m[1]} 次尝试后失败`,
  },
  {
    pattern: /^Context compressed - (\d+) messages? summarized$/,
    translate: (m) => `上下文已压缩：已折叠 ${m[1]} 条较早消息`,
  },
  {
    pattern: /^Explored (\d+) files?$/,
    translate: (m) => `浏览了 ${m[1]} 个文件`,
  },
  {
    pattern: /^Explored (\d+) files? and (\d+) scripts?$/,
    translate: (m) => `浏览了 ${m[1]} 个文件和 ${m[2]} 个脚本`,
  },
  {
    pattern: /^Explored (\d+) files?, (\d+) scripts? and (\d+) attachments?$/,
    translate: (m) => `浏览了 ${m[1]} 个文件、${m[2]} 个脚本和 ${m[3]} 个附件`,
  },
  {
    pattern: /^Explored the codebase$/,
    translate: () => '浏览了代码库',
  },
  {
    pattern: /^Reading file\.\.\.$/,
    translate: () => '正在读取文件…',
  },
  {
    pattern: /^Enabling (.+)\.\.\.$/,
    translate: (m) => `正在启用 ${m[1]}…`,
  },
  {
    pattern: /^(\d+) earlier messages summarized$/,
    translate: (m) => `已折叠 ${m[1]} 条较早消息`,
  },
];

/**
 * 翻译一段界面文案。未命中词典或模式时返回原文。
 */
export function translateUiString(text: string): string {
  const dictHit = ZH_DICTIONARY[text];
  if (dictHit !== undefined) return dictHit;

  const normalized = text.replace(/\s+/g, ' ').trim();
  if (normalized !== text) {
    const normalizedHit = ZH_DICTIONARY[normalized];
    if (normalizedHit !== undefined) return normalizedHit;
  }

  for (const { pattern, translate } of PATTERNS) {
    const match = normalized.match(pattern);
    if (match) return translate(match);
  }

  return text;
}
