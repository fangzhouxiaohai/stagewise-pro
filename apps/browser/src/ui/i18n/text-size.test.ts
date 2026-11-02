import { describe, expect, it } from 'vitest';
import { textSizeToRootFontSize } from './text-size';

describe('textSizeToRootFontSize', () => {
  it('M 保持默认 16px', () => {
    expect(textSizeToRootFontSize('m')).toBe(16);
  });

  it('尺寸按 S < M < L < XL < XXL 递增', () => {
    const sizes = ['s', 'm', 'l', 'xl', 'xxl'] as const;
    const values = sizes.map(textSizeToRootFontSize);
    for (let i = 1; i < values.length; i++) {
      expect(values[i]).toBeGreaterThan(values[i - 1]!);
    }
  });

  it('输出两位小数以内', () => {
    expect(textSizeToRootFontSize('l')).toBe(17.28);
    expect(textSizeToRootFontSize('xxl')).toBe(20);
  });
});
