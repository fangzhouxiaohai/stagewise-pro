/**
 * 系统提示词拼装工具。
 */

/** 全局提示词在系统提示词中的包裹标签。 */
export const GLOBAL_INSTRUCTIONS_TAG = 'global-user-instructions';

/**
 * 把设置中的全局提示词追加到系统提示词末尾。
 *
 * - 未配置或只有空白时原样返回；
 * - 使用固定 XML 标签包裹，便于模型区分宿主内置规则与用户指令。
 */
export function appendGlobalSystemPrompt(
  base: string,
  extra: string | undefined,
): string {
  const instructions = extra?.trim();
  if (!instructions) return base;
  return `${base}\n\n<${GLOBAL_INSTRUCTIONS_TAG}>\n${instructions}\n</${GLOBAL_INSTRUCTIONS_TAG}>`;
}
