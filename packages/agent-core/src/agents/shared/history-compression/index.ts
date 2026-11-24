import { generateText, type UITools } from 'ai';
import type { AgentMessage } from '../../../types/agent';
import type { AgentHost } from '../../../host/host';
import {
  PROVIDER_INSTANCE_ID_METADATA_KEY,
  UTILITY_THINKING_OVERRIDE_METADATA_KEY,
  type HostModels,
  type UtilityModelEntry,
} from '../../../host/models';

/**
 * Wide AgentMessage type accepting any tool set and any metadata shape.
 * See `serialization.ts` for the rationale — this module mirrors the
 * same widening so host-side message shapes (browser, CLI) can be
 * passed in without TypeScript variance issues.
 */
type WideAgentMessage = AgentMessage<UITools, any>;

// Import for local use + re-export so existing imports keep working.
import {
  convertAgentMessagesToCompactMessageHistoryString,
  estimateMessageTokens,
} from './serialization';
export {
  convertAgentMessagesToCompactMessageHistoryString,
  estimateMessageTokens,
};

// Re-export prompt pieces so existing imports from this module keep working.
import {
  COMPRESSION_SYSTEM_PROMPT,
  COMPRESSION_TARGET_CHARS,
  buildCompressionUserMessage,
} from './prompt';
export {
  COMPRESSION_SYSTEM_PROMPT,
  COMPRESSION_TARGET_CHARS,
  buildCompressionUserMessage,
};

// Typed builder for host-side tool part serializer registries.
export {
  defineToolPartSerializers,
  type TypedToolPartSerializers,
} from './define-tool-part-serializers';

/**
 * Ordered list of model IDs to try for history compression.
 * The first model is the primary; subsequent entries are fallbacks
 * tried in order when the previous one fails or times out.
 */
export const HISTORY_COMPRESSION_MODELS = [
  'default',
  'deepseek-v4-flash',
  'gpt-5.6-luna',
  'gemini-3.1-flash-lite',
  'claude-haiku-4.5',
] as const;

/** Maximum time (ms) allowed for a single history compression attempt. */
const HISTORY_COMPRESSION_TIMEOUT_MS = 180_000;

/**
 * 单次压缩调用允许的最大序列化字符数。
 *
 * 大模型（例如 1M 上下文）的历史在 40%-80% 占用时可能有数百万字符，
 * 一次性塞给压缩模型会超出其上下文或超时。这里按块切分，逐块总结后拼接。
 * 约 200k 字符 ≈ 50k token，可兼容 64k 上下文的本地模型。
 */
const MAX_COMPRESSION_CHUNK_CHARS = 200_000;

/** 单块压缩的最大并发数，避免触发模型商限流。 */
const COMPRESSION_CHUNK_CONCURRENCY = 2;

/** 压缩块的最小输出预算，避免块数过多时每块摘要过短。 */
const MIN_CHUNK_TARGET_CHARS = 3_000;

/**
 * 单次（不分块）压缩的输出 token 上限，与上游保持一致。
 *
 * @note 摘要目标约 30k 字符；中文等 CJK 文本接近 1 字符 ≈ 1 token，
 *       开启思考的模型还会把推理 token 计入该上限。上限过低会让摘要
 *       被截断（finishReason=length），压缩后静默丢失上下文。
 */
const SINGLE_PASS_MAX_OUTPUT_TOKENS = 20_000;

/** 分块压缩时单块输出 token 的下限，避免块数很多时摘要被截得过短。 */
const MIN_CHUNK_MAX_OUTPUT_TOKENS = 4_000;

/**
 * 计算一次压缩调用的输出 token 上限。
 *
 * - 不分块：沿用上游的 20k 上限；
 * - 分块：按单块目标字符数折算（约 2 字符/token），保证单块输入 +
 *   输出仍能放进 64k 上下文的本地模型。
 */
function resolveCompressionMaxOutputTokens(
  chunkCount: number,
  targetChars: number,
): number {
  if (chunkCount <= 1) return SINGLE_PASS_MAX_OUTPUT_TOKENS;
  return Math.min(
    SINGLE_PASS_MAX_OUTPUT_TOKENS,
    Math.max(MIN_CHUNK_MAX_OUTPUT_TOKENS, Math.ceil(targetChars / 2)),
  );
}

function splitIntoCompressionChunks(text: string): string[] {
  if (text.length <= MAX_COMPRESSION_CHUNK_CHARS) return [text];

  const chunks: string[] = [];
  let start = 0;
  while (start < text.length) {
    let end = Math.min(start + MAX_COMPRESSION_CHUNK_CHARS, text.length);
    if (end < text.length) {
      const paragraphBreak = text.lastIndexOf('\n\n', end);
      if (paragraphBreak > start + MAX_COMPRESSION_CHUNK_CHARS / 2) {
        end = paragraphBreak;
      }
    }
    chunks.push(text.slice(start, end));
    start = end;
  }
  return chunks;
}

/**
 * 以有限并发依次处理每一项。
 *
 * 任意一项失败后立即停止派发新任务：整体结果已注定失败，继续调用模型
 * 只会白白计费（并且可能与超时未结束的请求重叠）。已在进行中的任务
 * 会自然结束，但不再启动后续任务。
 */
async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  mapper: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let nextIndex = 0;
  let failed = false;
  const workerCount = Math.min(limit, items.length);

  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      while (!failed) {
        const index = nextIndex;
        nextIndex += 1;
        if (index >= items.length) return;
        try {
          results[index] = await mapper(items[index] as T, index);
        } catch (error) {
          failed = true;
          throw error;
        }
      }
    }),
  );

  return results;
}

/**
 * Grace period after aborting a timed-out compression request.
 *
 * If the provider/SDK does not settle the original request within this
 * window, stop the cascade instead of starting overlapping fallback
 * requests that can continue billing in the background.
 */
const HISTORY_COMPRESSION_ABORT_GRACE_MS = 2_000;

/** Minimum acceptable compression length; shorter results trigger a fallback. */
const COMPRESSION_MIN_LENGTH = 30;

class HistoryCompressionUnsettledTimeoutError extends Error {
  constructor(modelId: string) {
    super(
      `History compression request for ${modelId} timed out and did not settle after abort`,
    );
    this.name = 'HistoryCompressionUnsettledTimeoutError';
  }
}

/**
 * Attempts a single compression call against the given model.
 * Returns the compressed text on success, or throws on failure.
 */
const tryCompressWithModel = async (
  entry: UtilityModelEntry,
  hostModels: HostModels,
  agentInstanceId: string,
  compactHistory: string,
  previousBriefingChars: number,
  targetChars: number,
  maxOutputTokens: number,
  host?: AgentHost,
): Promise<string> => {
  const metadata: Record<string, unknown> = {
    $ai_span_name: 'history-compression',
    $ai_parent_id: `${agentInstanceId}`,
  };
  if (entry.providerInstanceId) {
    metadata[PROVIDER_INSTANCE_ID_METADATA_KEY] = entry.providerInstanceId;
  }
  if (entry.thinkingOverride) {
    metadata[UTILITY_THINKING_OVERRIDE_METADATA_KEY] = entry.thinkingOverride;
  }
  const modelWithOptions = await hostModels.getWithOptions(
    entry.modelId,
    `${agentInstanceId}`,
    metadata,
  );

  host?.logger.debug(
    `[history-compression] Attempting model "${entry.modelId}"` +
      ` (instance="${entry.providerInstanceId ?? 'default'}")` +
      ` for agent ${agentInstanceId}.`,
  );

  const abortController = new AbortController();
  let timeout: ReturnType<typeof setTimeout> | undefined;
  let abortGraceTimeout: ReturnType<typeof setTimeout> | undefined;

  try {
    const generationPromise = generateText({
      model: modelWithOptions.model,
      providerOptions: modelWithOptions.providerOptions,
      headers: modelWithOptions.headers,
      abortSignal: abortController.signal,
      messages: [
        {
          role: 'system',
          content: COMPRESSION_SYSTEM_PROMPT,
        },
        {
          role: 'user',
          content: buildCompressionUserMessage(
            compactHistory,
            previousBriefingChars,
            targetChars,
          ),
        },
      ],
      temperature: 0.1,
      maxOutputTokens,
    }).then((result) => {
      if (result.finishReason === 'length') {
        host?.logger.warn(
          `[history-compression] Model "${entry.modelId}" hit maxOutputTokens (${maxOutputTokens}); the briefing may be truncated.`,
        );
      }
      return result.text.trim();
    });

    const timeoutResult = Symbol('history-compression-timeout');
    const timeoutPromise = new Promise<typeof timeoutResult>((resolve) => {
      timeout = setTimeout(() => {
        abortController.abort();
        resolve(timeoutResult);
      }, HISTORY_COMPRESSION_TIMEOUT_MS);
    });

    const racedResult = await Promise.race([generationPromise, timeoutPromise]);

    const compactionResult =
      racedResult === timeoutResult
        ? await Promise.race([
            generationPromise.then(
              (result) => ({ status: 'fulfilled' as const, result }),
              (error) => ({ status: 'rejected' as const, error }),
            ),
            new Promise<{ status: 'pending' }>((resolve) => {
              abortGraceTimeout = setTimeout(
                () => resolve({ status: 'pending' }),
                HISTORY_COMPRESSION_ABORT_GRACE_MS,
              );
            }),
          ]).then((settled) => {
            if (settled.status === 'fulfilled') return settled.result;
            if (settled.status === 'rejected') throw settled.error;
            throw new HistoryCompressionUnsettledTimeoutError(entry.modelId);
          })
        : racedResult;

    if (compactionResult.length < COMPRESSION_MIN_LENGTH) {
      throw new Error(
        `Compression too short (${compactionResult.length} chars)`,
      );
    }

    host?.logger.debug(
      `[history-compression] Success with model "${entry.modelId}"` +
        ` (instance="${entry.providerInstanceId ?? 'default'}")` +
        ` — ${compactionResult.length} chars.`,
    );
    return compactionResult;
  } finally {
    if (timeout) clearTimeout(timeout);
    if (abortGraceTimeout) clearTimeout(abortGraceTimeout);
  }
};

export const generateSimpleCompressedHistory = async (
  messages: WideAgentMessage[],
  hostModels: HostModels,
  agentInstanceId: string,
  fallbackModelId?: string,
  fallbackProviderInstanceId?: string,
  host?: AgentHost,
): Promise<string> => {
  const compactConvertedChatHistory =
    convertAgentMessagesToCompactMessageHistoryString(messages, host);

  // Find the previous briefing length (if any) so we can inject a dynamic
  // budget hint into the user message.
  const previousBriefingChars =
    [...messages].reverse().find((m) => m.metadata?.compressedHistory)?.metadata
      ?.compressedHistory?.length ?? 0;

  // Use user-configured utility models when available.
  // - undefined: not configured → use built-in defaults
  // - []: explicitly cleared → use main chat model as fallback
  // - [...items]: user-configured list
  const configuredEntries = hostModels.getUtilityModelEntries?.(
    'context-compression',
  );
  const configuredModels = hostModels.getUtilityModelIds?.(
    'context-compression',
  );

  // Build a unified list of entries (with thinking overrides) from
  // whichever method the host implements.
  const fallbackEntry: UtilityModelEntry | null = fallbackModelId
    ? {
        modelId: fallbackModelId,
        ...(fallbackProviderInstanceId
          ? { providerInstanceId: fallbackProviderInstanceId }
          : {}),
      }
    : null;

  let entries: UtilityModelEntry[];
  if (configuredEntries !== undefined) {
    entries =
      configuredEntries.length > 0
        ? configuredEntries
        : fallbackEntry
          ? [fallbackEntry]
          : (HISTORY_COMPRESSION_MODELS as readonly string[]).map((id) => ({
              modelId: id,
            }));
  } else if (configuredModels !== undefined) {
    entries =
      configuredModels.length > 0
        ? configuredModels.map((id) => ({ modelId: id }))
        : fallbackEntry
          ? [fallbackEntry]
          : (HISTORY_COMPRESSION_MODELS as readonly string[]).map((id) => ({
              modelId: id,
            }));
  } else {
    entries = (HISTORY_COMPRESSION_MODELS as readonly string[]).map((id) => ({
      modelId: id,
    }));
  }

  // Append the active preset's model list (main model + fallbacks) so
  // the main chat models serve as ordered fallbacks after all utility
  // models are exhausted. Dedup by (modelId, providerInstanceId) in the
  // loop below prevents double-attempts of models that appear in both
  // lists.
  const presetModels = hostModels.getActivePresetModels?.();
  if (presetModels && presetModels.length > 0) {
    entries = [...entries, ...presetModels];
  }

  const chunks = splitIntoCompressionChunks(compactConvertedChatHistory);
  const targetPerChunk =
    chunks.length === 1
      ? COMPRESSION_TARGET_CHARS
      : Math.max(
          MIN_CHUNK_TARGET_CHARS,
          Math.floor(COMPRESSION_TARGET_CHARS / chunks.length),
        );

  const maxOutputTokens = resolveCompressionMaxOutputTokens(
    chunks.length,
    targetPerChunk,
  );

  if (chunks.length > 1) {
    host?.logger.debug(
      `[history-compression] Splitting ${compactConvertedChatHistory.length} chars into ${chunks.length} chunks.`,
    );
  }

  const compressChunk = async (
    chunk: string,
    chunkIndex: number,
  ): Promise<string> => {
    let lastError: Error | undefined;
    const attemptedKeys = new Set<string>();

    for (const entry of entries) {
      if (hostModels.supportsUtilityCalls?.(entry) === false) continue;
      // Skip models that are no longer available (deleted provider, etc.)
      // Pass `providerInstanceId` so discovered models (which only exist
      // on a specific instance) are not falsely rejected.
      if (!hostModels.has(entry.modelId, entry.providerInstanceId)) continue;
      // Deduplicate by (modelId, providerInstanceId) so the active
      // fallback remains available even if a failed entry shared the
      // same model ID on a different instance.
      const key = `${entry.modelId}::${entry.providerInstanceId ?? ''}`;
      if (attemptedKeys.has(key)) continue;
      attemptedKeys.add(key);
      try {
        return await tryCompressWithModel(
          entry,
          hostModels,
          agentInstanceId,
          chunk,
          chunkIndex === 0 ? previousBriefingChars : 0,
          targetPerChunk,
          maxOutputTokens,
          host,
        );
      } catch (e) {
        lastError = e as Error;
        if (lastError instanceof HistoryCompressionUnsettledTimeoutError) {
          throw lastError;
        }
        // Continue to the next fallback model
      }
    }

    // Last resort: try the active chat model if it wasn't already
    // attempted (e.g. when no preset models were available).
    const fallbackKey = `${fallbackModelId}::${fallbackProviderInstanceId ?? ''}`;
    if (
      fallbackModelId &&
      !attemptedKeys.has(fallbackKey) &&
      hostModels.supportsUtilityCalls?.(
        fallbackEntry ?? { modelId: fallbackModelId },
      ) !== false
    ) {
      host?.logger.warn(
        `History compression: all preferred models failed, falling back to active model: ${fallbackModelId}`,
      );
      try {
        return await tryCompressWithModel(
          fallbackEntry ?? { modelId: fallbackModelId },
          hostModels,
          agentInstanceId,
          chunk,
          chunkIndex === 0 ? previousBriefingChars : 0,
          targetPerChunk,
          maxOutputTokens,
          host,
        );
      } catch (e) {
        lastError = e as Error;
        if (lastError instanceof HistoryCompressionUnsettledTimeoutError) {
          throw lastError;
        }
      }
    }

    // All models failed for this chunk — fail the whole compression so the
    // caller can surface the error instead of silently dropping context.
    throw lastError ?? new Error('All history compression models failed');
  };

  const summaries = await mapWithConcurrency(
    chunks,
    COMPRESSION_CHUNK_CONCURRENCY,
    compressChunk,
  );
  const combined = summaries.join('\n\n').trim();
  if (combined.length < COMPRESSION_MIN_LENGTH) {
    throw new Error(`Compression too short (${combined.length} chars)`);
  }

  return combined;
};
