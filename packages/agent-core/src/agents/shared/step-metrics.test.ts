import { describe, expect, it } from 'vitest';
import {
  computeTokensPerSecond,
  countStreamedContentChars,
} from './step-metrics';

describe('countStreamedContentChars', () => {
  it('累加文本与推理内容的字符数', () => {
    expect(
      countStreamedContentChars([
        { type: 'text', text: 'hello' },
        { type: 'reasoning', text: '思考' },
        { type: 'tool-read', text: 'ignored' },
      ]),
    ).toBe(7);
  });

  it('忽略无文本内容与非内容 part', () => {
    expect(
      countStreamedContentChars([
        { type: 'tool-write' },
        { type: 'text' },
        { type: 'reasoning', text: 123 as unknown as string },
      ]),
    ).toBe(0);
  });

  it('空数组与 undefined 返回 0', () => {
    expect(countStreamedContentChars([])).toBe(0);
    expect(countStreamedContentChars(undefined)).toBe(0);
  });
});

describe('computeTokensPerSecond', () => {
  it('按生成窗口计算并四舍五入', () => {
    expect(computeTokensPerSecond(500, 1_000, 3_500)).toBe(200);
    expect(computeTokensPerSecond(100, 0, 3_000)).toBe(33);
  });

  it('没有输出 token 或输出非法时返回 undefined', () => {
    expect(computeTokensPerSecond(0, 0, 1_000)).toBeUndefined();
    expect(computeTokensPerSecond(Number.NaN, 0, 1_000)).toBeUndefined();
    expect(computeTokensPerSecond(undefined, 0, 1_000)).toBeUndefined();
  });

  it('时长非法时返回 undefined', () => {
    expect(computeTokensPerSecond(100, 0, 0)).toBeUndefined();
    expect(computeTokensPerSecond(100, 2_000, 1_000)).toBeUndefined();
    expect(
      computeTokensPerSecond(100, 0, Number.POSITIVE_INFINITY),
    ).toBeUndefined();
  });
});
