import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { formatTokenSpeed, MessageCompaction } from './message-compaction';

describe('formatTokenSpeed', () => {
  it('格式化有效速度并四舍五入', () => {
    expect(formatTokenSpeed(18)).toBe('18 tok/s');
    expect(formatTokenSpeed(18.6)).toBe('19 tok/s');
  });

  it('缺失或非法速度返回 null', () => {
    expect(formatTokenSpeed(undefined)).toBeNull();
    expect(formatTokenSpeed(0)).toBeNull();
    expect(formatTokenSpeed(-1)).toBeNull();
    expect(formatTokenSpeed(Number.NaN)).toBeNull();
  });
});

describe('MessageCompaction', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('压缩进行中显示动画提示', () => {
    render(
      <MessageCompaction
        compaction={{
          status: 'running',
          trigger: 'auto',
          startedAt: Date.now(),
        }}
      />,
    );

    expect(screen.getByText('Compressing context...')).toBeTruthy();
  });

  it('压缩完成后显示折叠消息数量并在 8 秒后收起', () => {
    render(
      <MessageCompaction
        compaction={{
          status: 'completed',
          trigger: 'auto',
          startedAt: Date.now() - 2_000,
          finishedAt: Date.now(),
          compressedMessageCount: 7,
          keptMessageCount: 12,
        }}
      />,
    );

    expect(
      screen.getByText(/Context compressed - 7 messages summarized/),
    ).toBeTruthy();

    act(() => vi.advanceTimersByTime(7_999));
    expect(
      screen.getByText(/Context compressed - 7 messages summarized/),
    ).toBeTruthy();

    act(() => vi.advanceTimersByTime(1));
    expect(
      screen.queryByText(/Context compressed - 7 messages summarized/),
    ).toBeNull();
  });

  it('压缩失败时显示失败提示', () => {
    render(
      <MessageCompaction
        compaction={{
          status: 'failed',
          trigger: 'auto',
          startedAt: Date.now() - 1_000,
          finishedAt: Date.now(),
          errorMessage: 'timeout',
        }}
      />,
    );

    expect(screen.getByText('Context compression failed')).toBeTruthy();
  });
});
