import { useEffect, useState } from 'react';
import { CheckIcon, Loader2Icon, TriangleAlertIcon } from 'lucide-react';
import type { AgentState } from '@shared/karton-contracts/ui/agent';

/** 压缩完成后结果在对话里保留的时长。 */
const RESULT_VISIBLE_MS = 8_000;

export type CompactionState = NonNullable<AgentState['compaction']>;

/**
 * 对话内的上下文压缩状态提示。
 *
 * - 进行中：展示脉冲动画，让用户知道压缩已经触发；
 * - 完成：展示折叠了多少条较早消息，8 秒后自动收起；
 * - 失败：提示压缩失败，智能体仍会以未压缩历史继续。
 */
export function MessageCompaction({
  compaction,
}: {
  compaction: CompactionState;
}) {
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    setHidden(false);
    if (compaction.status === 'running') return;

    const finishedAt = compaction.finishedAt ?? Date.now();
    const remaining = Math.max(
      0,
      RESULT_VISIBLE_MS - (Date.now() - finishedAt),
    );
    const timer = setTimeout(() => setHidden(true), remaining);
    return () => clearTimeout(timer);
  }, [compaction.status, compaction.finishedAt]);

  if (hidden) return null;

  return (
    <div
      key={compaction.status}
      className="pointer-events-none flex items-center gap-1.5 rounded-full bg-background/95 px-2.5 py-1 text-xs shadow-elevation-1 ring-1 ring-derived-strong backdrop-blur-sm"
    >
      {compaction.status === 'running' && (
        <>
          <Loader2Icon className="size-3 shrink-0 animate-spin text-primary-foreground" />
          <span className="shimmer-text-primary w-fit">
            Compressing context...
          </span>
        </>
      )}
      {compaction.status === 'completed' && (
        <>
          <CheckIcon className="size-3 shrink-0 text-success-foreground" />
          <span className="text-muted-foreground">
            {`Context compressed - ${compaction.compressedMessageCount ?? 0} ${
              (compaction.compressedMessageCount ?? 0) === 1
                ? 'message'
                : 'messages'
            } summarized`}
          </span>
        </>
      )}
      {compaction.status === 'failed' && (
        <>
          <TriangleAlertIcon className="size-3 shrink-0 text-warning-foreground" />
          <span className="text-warning-foreground">
            Context compression failed
          </span>
        </>
      )}
    </div>
  );
}
