import { useCallback } from 'react';
import { toast } from '@stagewise/stage-ui/components/toaster';
import { useKartonProcedure } from './use-karton';
import { useOpenAgent } from './use-open-chat';

/**
 * 聊天输入框 `/compact` 斜杠命令的落地实现。
 *
 * 压缩可能持续数秒（内部会按模型级联重试），因此先展示进行中的提示，
 * 拿到结果后用同一个 toast id 覆盖为最终状态，避免同时堆叠多条提示。
 */
const COMPACT_TOAST_ID = 'compact-context';

export function useCompactContext() {
  const [agentId] = useOpenAgent();
  const compactHistory = useKartonProcedure((p) => p.agents.compactHistory);

  return useCallback(async () => {
    if (!agentId) return;

    toast({
      id: COMPACT_TOAST_ID,
      title: 'Compressing context',
      message: 'Summarizing earlier messages. This can take a few seconds.',
      type: 'info',
      actions: [],
    });

    try {
      const result = await compactHistory(agentId);

      if (result.status === 'compressed') {
        const folded = result.compressedMessageCount ?? 0;
        toast({
          id: COMPACT_TOAST_ID,
          title: 'Context compressed',
          message: `Folded ${folded} earlier message${folded === 1 ? '' : 's'} into a summary.`,
          type: 'info',
          duration: 5000,
          actions: [],
        });
        return;
      }

      if (result.status === 'failed') {
        console.error(
          '[useCompactContext] Context compression failed:',
          result.errorMessage,
        );
        toast({
          id: COMPACT_TOAST_ID,
          title: 'Context compression failed',
          message:
            'The conversation history could not be summarized. Please try again later.',
          type: 'error',
          duration: 8000,
          actions: [],
        });
        return;
      }

      if (result.status === 'unsupported') {
        toast({
          id: COMPACT_TOAST_ID,
          title: 'Context compression unavailable',
          message:
            'This chat runs on an external agent that manages its own context.',
          type: 'warning',
          duration: 8000,
          actions: [],
        });
        return;
      }

      // status === 'skipped'
      if (result.reason === 'busy') {
        toast({
          id: COMPACT_TOAST_ID,
          title: 'Compression already running',
          message: 'Wait for the current compression to finish and try again.',
          type: 'info',
          duration: 5000,
          actions: [],
        });
        return;
      }

      toast({
        id: COMPACT_TOAST_ID,
        title: 'Nothing to compress',
        message: 'This chat is still short enough to keep in full.',
        type: 'info',
        duration: 5000,
        actions: [],
      });
    } catch (error) {
      console.error('[useCompactContext] Failed to compact context:', error);
      toast({
        id: COMPACT_TOAST_ID,
        title: 'Context compression failed',
        message: 'Could not start context compression. Please try again.',
        type: 'error',
        duration: 8000,
        actions: [],
      });
    }
  }, [agentId, compactHistory]);
}
