import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setCurrentUiLanguage } from '@ui/i18n/ui-language-store';
import { MessageCompaction } from './message-compaction';

describe('MessageCompaction', () => {
  beforeEach(() => {
    setCurrentUiLanguage('en');
    vi.useFakeTimers();
  });
  afterEach(() => {
    setCurrentUiLanguage('zh-CN');
    vi.useRealTimers();
  });

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

  it('重新挂载时不再显示已过期的结果', () => {
    const { container } = render(
      <MessageCompaction
        compaction={{
          status: 'completed',
          trigger: 'auto',
          startedAt: Date.now() - 20_000,
          finishedAt: Date.now() - 10_000,
          compressedMessageCount: 3,
        }}
      />,
    );

    expect(container.textContent).toBe('');
  });

  it('中文界面下直接显示中文提示', () => {
    setCurrentUiLanguage('zh-CN');
    render(
      <MessageCompaction
        compaction={{
          status: 'completed',
          trigger: 'manual',
          startedAt: Date.now() - 1_000,
          finishedAt: Date.now(),
          compressedMessageCount: 4,
        }}
      />,
    );

    expect(screen.getByText('上下文已压缩：已折叠 4 条较早消息')).toBeTruthy();
  });
});
