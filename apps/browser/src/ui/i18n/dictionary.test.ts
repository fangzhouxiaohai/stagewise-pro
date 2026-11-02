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

  it('侧栏日期分组标签翻译', () => {
    expect(translateUiString('Today')).toBe('今天');
    expect(translateUiString('Yesterday')).toBe('昨天');
    expect(translateUiString('Last 7 days')).toBe('最近 7 天');
    expect(translateUiString('Last 30 days')).toBe('最近 30 天');
    expect(translateUiString('Older')).toBe('更早');
  });

  it('输入框占位符翻译', () => {
    expect(
      translateUiString('Use / to plan and run commands. Use @ for context.'),
    ).toBe('输入 / 运行命令，输入 @ 添加上下文。');
    expect(
      translateUiString(
        'Use / to plan and run commands. Use @ for context. Press ↵ to send now',
      ),
    ).toBe('输入 / 运行命令，输入 @ 添加上下文。按 ↵ 立即发送');
  });

  it('设置页按钮与空状态翻译', () => {
    expect(translateUiString('Clear last 24 hours')).toBe('清除最近 24 小时');
    expect(translateUiString('Clear all time')).toBe('清除全部时间');
    expect(translateUiString('View All')).toBe('查看全部');
    expect(translateUiString('Chats you archive will appear here.')).toBe(
      '归档的对话会显示在这里。',
    );
  });

  it('未命中词典时返回原文', () => {
    expect(translateUiString('A completely unknown string')).toBe(
      'A completely unknown string',
    );
  });
});
