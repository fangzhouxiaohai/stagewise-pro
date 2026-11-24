import { useCallback, useRef } from 'react';
import { toast } from '@stagewise/stage-ui/components/toaster';
import { translateUiString } from '@ui/i18n/dictionary';
import { getCurrentUiLanguage } from '@ui/i18n/ui-language-store';
import { useKartonProcedure } from './use-karton';
import { useOpenAgent } from './use-open-chat';

/**
 * 聊天输入框 `/compact` 斜杠命令的落地实现。
 *
 * 压缩可能持续数秒（内部会按模型级联重试），因此先展示进行中的提示，
 * 拿到结果后用同一个 toast id 覆盖为最终状态，避免同时堆叠多条提示。
 */
const COMPACT_TOAST_ID = 'compact-context';

/**
 * 按当前界面语言翻译提示文案。
 *
 * @note toast 挂载在整页翻译层之外的时机（压缩结果返回时用户通常没有
 *       交互），因此这里直接翻译，而不是等待 DOM 重扫。
 */
function tr(text: string): string {
  return getCurrentUiLanguage() === 'en' ? text : translateUiString(text);
}

export function useCompactContext() {
  const [agentId] = useOpenAgent();
  const compactHistory = useKartonProcedure((p) => p.agents.compactHistory);
  // 斜杠命令在输入框获得焦点时才记录回调；读取 ref 保证切换对话后
  // 压缩的仍是当前打开的会话，而不是记录回调时的旧会话。
  const agentIdRef = useRef(agentId);
  agentIdRef.current = agentId;

  return useCallback(async () => {
    const targetAgentId = agentIdRef.current;
    if (!targetAgentId) return;

    toast({
      id: COMPACT_TOAST_ID,
      title: tr('Compressing context'),
      message: tr('Summarizing earlier messages. This can take a few seconds.'),
      type: 'info',
      actions: [],
    });

    try {
      const result = await compactHistory(targetAgentId);

      if (result.status === 'compressed') {
        const folded = result.compressedMessageCount ?? 0;
        toast({
          id: COMPACT_TOAST_ID,
          title: tr('Context compressed'),
          message: tr(
            `Folded ${folded} earlier message${folded === 1 ? '' : 's'} into a summary.`,
          ),
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
          title: tr('Context compression failed'),
          message: tr(
            'The conversation history could not be summarized. Please try again later.',
          ),
          type: 'error',
          duration: 8000,
          actions: [],
        });
        return;
      }

      if (result.status === 'unsupported') {
        toast({
          id: COMPACT_TOAST_ID,
          title: tr('Context compression unavailable'),
          message: tr(
            'This chat runs on an external agent that manages its own context.',
          ),
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
          title: tr('Compression already running'),
          message: tr(
            'Wait for the current compression to finish and try again.',
          ),
          type: 'info',
          duration: 5000,
          actions: [],
        });
        return;
      }

      toast({
        id: COMPACT_TOAST_ID,
        title: tr('Nothing to compress'),
        message: tr('This chat is still short enough to keep in full.'),
        type: 'info',
        duration: 5000,
        actions: [],
      });
    } catch (error) {
      console.error('[useCompactContext] Failed to compact context:', error);
      toast({
        id: COMPACT_TOAST_ID,
        title: tr('Context compression failed'),
        message: tr('Could not start context compression. Please try again.'),
        type: 'error',
        duration: 8000,
        actions: [],
      });
    }
  }, [compactHistory]);
}
