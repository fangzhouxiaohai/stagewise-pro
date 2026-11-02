import { describe, expect, it } from 'vitest';
import { translateUiString } from './dictionary';

describe('translateUiString', () => {
  it('命中词典的精确文案返回中文', () => {
    expect(translateUiString('Always allow')).toBe('始终允许');
    expect(translateUiString('Interface language')).toBe('界面语言');
  });

  it('归一化多余空白后仍能命中词典', () => {
    expect(translateUiString('  Always   allow  ')).toBe('始终允许');
  });

  it('动态压缩结果按模式翻译', () => {
    expect(
      translateUiString('Context compressed - 7 messages summarized'),
    ).toBe('上下文已压缩：已折叠 7 条较早消息');
    expect(translateUiString('Context compressed - 1 message summarized')).toBe(
      '上下文已压缩：已折叠 1 条较早消息',
    );
  });

  it('未命中词典时返回原文', () => {
    expect(translateUiString('A completely unknown string')).toBe(
      'A completely unknown string',
    );
  });
});
