import { describe, expect, it } from 'vitest';
import {
  appendGlobalSystemPrompt,
  GLOBAL_INSTRUCTIONS_TAG,
} from './system-prompt';

describe('appendGlobalSystemPrompt', () => {
  it('未配置全局提示词时原样返回', () => {
    expect(appendGlobalSystemPrompt('base prompt', undefined)).toBe(
      'base prompt',
    );
    expect(appendGlobalSystemPrompt('base prompt', '')).toBe('base prompt');
    expect(appendGlobalSystemPrompt('base prompt', '   \n ')).toBe(
      'base prompt',
    );
  });

  it('使用固定标签包裹并去除首尾空白', () => {
    const result = appendGlobalSystemPrompt(
      'base prompt',
      '\n  始终使用中文回答。  \n',
    );

    expect(result).toBe(
      `base prompt\n\n<${GLOBAL_INSTRUCTIONS_TAG}>\n始终使用中文回答。\n</${GLOBAL_INSTRUCTIONS_TAG}>`,
    );
  });

  it('保留多行内容', () => {
    const result = appendGlobalSystemPrompt('base', '第一行\n第二行');
    expect(result).toContain('第一行\n第二行');
  });
});
