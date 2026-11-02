import { describe, expect, it } from 'vitest';
import { getCircleRevealRadius } from './color-scheme-transition';

describe('getCircleRevealRadius', () => {
  it('从左下角扩散时覆盖到右上角', () => {
    expect(getCircleRevealRadius(10, 790, 1200, 800)).toBeCloseTo(
      Math.hypot(1190, 790),
      5,
    );
  });

  it('从中心扩散时取最长边的一半', () => {
    expect(getCircleRevealRadius(600, 400, 1200, 800)).toBeCloseTo(
      Math.hypot(600, 400),
      5,
    );
  });

  it('从角落扩散时覆盖对角线', () => {
    expect(getCircleRevealRadius(0, 0, 1200, 800)).toBeCloseTo(
      Math.hypot(1200, 800),
      5,
    );
  });
});
