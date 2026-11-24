import { useEffect, useState } from 'react';
import { CheckIcon, Loader2Icon, TriangleAlertIcon } from 'lucide-react';
import type { AgentState } from '@shared/karton-contracts/ui/agent';
import { useUiText } from '@ui/i18n/ui-language-store';

/** 压缩完成后结果在对话里保留的时长。 */
const RESULT_VISIBLE_MS = 8_000;

export type CompactionState = NonNullable<AgentState['compaction']>;

function getResultKey(compaction: CompactionState): string {
  return `${compaction.status}:${compaction.startedAt}:${compaction.finishedAt ?? ''}`;
}

function getRemainingVisibleMs(compaction: CompactionState): number {
  const finishedAt = compaction.finishedAt ?? Date.now();
  return Math.max(0, RESULT_VISIBLE_MS - (Date.now() - finishedAt));
}

/**
 * 对话内的上下文压缩状态提示。
 *
 * - 进行中：展示脉冲动画，让用户知道压缩已经触发；
 * - 完成：展示折叠了多少条较早消息，8 秒后自动收起；
 * - 失败：提示压缩失败，智能体仍会以未压缩历史继续。
 *
 * @note 文案通过 `useUiText` 直接翻译：整页翻译层只在用户交互后重扫，
 *       自动压缩发生时用户往往没有操作，依赖它会先显示英文。
 */
export function MessageCompaction({
  compaction,
}: {
  compaction: CompactionState;
}) {
  const t = useUiText();
  const resultKey = getResultKey(compaction);
  // 已收起的结果；切换回该对话（组件重新挂载）时，已过期的结果直接
  // 不渲染，避免闪现一帧。
  const [expiredKey, setExpiredKey] = useState<string | null>(null);

  useEffect(() => {
    if (compaction.status === 'running') return;
    const timer = setTimeout(
      () => setExpiredKey(resultKey),
      getRemainingVisibleMs(compaction),
    );
    return () => clearTimeout(timer);
  }, [compaction, resultKey]);

  const expired =
    compaction.status !== 'running' &&
    (expiredKey === resultKey || getRemainingVisibleMs(compaction) === 0);
  if (expired) return null;

  const compressedCount = compaction.compressedMessageCount ?? 0;

  return (
    <div
      key={compaction.status}
      className="pointer-events-none flex items-center gap-1.5 rounded-full bg-background/95 px-2.5 py-1 text-xs shadow-elevation-1 ring-1 ring-derived-strong backdrop-blur-sm"
    >
      {compaction.status === 'running' && (
        <>
          <Loader2Icon className="size-3 shrink-0 animate-spin text-primary-foreground" />
          <span className="shimmer-text-primary w-fit">
            {t('Compressing context...')}
          </span>
        </>
      )}
      {compaction.status === 'completed' && (
        <>
          <CheckIcon className="size-3 shrink-0 text-success-foreground" />
          <span className="text-muted-foreground">
            {t(
              `Context compressed - ${compressedCount} ${
                compressedCount === 1 ? 'message' : 'messages'
              } summarized`,
            )}
          </span>
        </>
      )}
      {compaction.status === 'failed' && (
        <>
          <TriangleAlertIcon className="size-3 shrink-0 text-warning-foreground" />
          <span className="text-warning-foreground">
            {t('Context compression failed')}
          </span>
        </>
      )}
    </div>
  );
}
