/**
 * 单步生成的吞吐量统计工具。
 *
 * 生成速度只统计模型真正输出内容的窗口（首次出现文本/推理增量到最后一次
 * 增量），不把工具执行、审批等待等时间算进去，否则工具密集的步骤会被
 * 严重低估。
 */

/** 结构兼容的 UI 消息 part 投影，避免依赖具体工具集泛型。 */
export interface StreamedContentPartLike {
  type?: string;
  text?: unknown;
}

/**
 * 统计消息中文本与推理内容的总字符数，用于判断流是否仍在产出内容。
 */
export function countStreamedContentChars(
  parts: ReadonlyArray<StreamedContentPartLike> | undefined,
): number {
  if (!parts || parts.length === 0) return 0;

  let total = 0;
  for (const part of parts) {
    if (!part) continue;
    if (part.type !== 'text' && part.type !== 'reasoning') continue;
    if (typeof part.text === 'string') total += part.text.length;
  }
  return total;
}

/**
 * 计算生成速度（token/秒）。
 *
 * @returns 合法的速度值；缺少有效时长或没有输出时返回 `undefined`。
 */
export function computeTokensPerSecond(
  outputTokens: number | undefined,
  startedAt: number,
  endedAt: number,
): number | undefined {
  if (typeof outputTokens !== 'number' || !Number.isFinite(outputTokens)) {
    return undefined;
  }
  if (outputTokens <= 0) return undefined;

  const durationMs = endedAt - startedAt;
  if (!Number.isFinite(durationMs) || durationMs <= 0) return undefined;

  const tokensPerSecond = outputTokens / (durationMs / 1000);
  if (!Number.isFinite(tokensPerSecond) || tokensPerSecond <= 0) {
    return undefined;
  }
  return Math.round(tokensPerSecond);
}

/** 流式阶段用字符数估算 token 的粗略比例（约 4 字符 / token）。 */
const STREAM_CHARS_PER_TOKEN = 4;

/**
 * 流式生成过程中估算实时速度（token/秒）。
 *
 * 流式阶段拿不到最终 usage，只能按已输出字符数折算 token；最终速度会在
 * 步骤结束时用真实 usage 覆盖。
 */
export function estimateLiveTokensPerSecond(
  streamedChars: number,
  startedAt: number,
  now: number,
): number | undefined {
  if (!Number.isFinite(streamedChars) || streamedChars <= 0) {
    return undefined;
  }
  const estimatedTokens = Math.max(
    1,
    Math.round(streamedChars / STREAM_CHARS_PER_TOKEN),
  );
  return computeTokensPerSecond(estimatedTokens, startedAt, now);
}
