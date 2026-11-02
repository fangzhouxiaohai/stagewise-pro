/**
 * 自动压缩上下文的触发策略。
 *
 * 压缩的触发点此前由智能体配置（`historyCompressionThreshold`）决定，
 * 并且被一个绝对 token 上限截断。引入宿主策略后，用户可以在设置中
 * 打开或关闭“自动压缩上下文”，并在打开时按固定的上下文占用比例
 * 精确触发（默认 80%）。
 */

/**
 * 宿主在运行时注入的自动压缩策略。
 *
 * @note 策略以“取用函数”的形式注入，保证设置开关对已经存在的会话
 *       立即生效，无需重启智能体。
 */
export interface AutoCompactionPolicy {
  /** 是否启用自动压缩 */
  enabled: boolean;
  /**
   * 触发自动压缩的上下文占用比例，取值区间为 (0, 1]。
   * 例如 `0.8` 表示已用 token 超过上下文窗口的 80% 时触发压缩。
   */
  threshold: number;
}

/** 自动压缩的默认触发比例：上下文占用达到 80% 时压缩。 */
export const DEFAULT_AUTO_COMPACTION_THRESHOLD = 0.8;

/** {@link resolveAutoCompactionTriggerTokens} 的入参。 */
export interface ResolveAutoCompactionTriggerArgs {
  /**
   * 宿主注入的策略。未注入时回退到智能体自身的配置，
   * 以兼容 CLI 等不读取用户偏好的宿主。
   */
  policy?: AutoCompactionPolicy;
  /** 智能体配置中的压缩阈值（历史字段，0 到 1 之间，负数表示禁用）。 */
  configThreshold?: number;
  /** 当前模型的上下文窗口大小（token）。 */
  contextWindowSize: number;
  /**
   * 历史字段路径下生效的绝对触发上限（token）。
   *
   * @note 仅在未注入宿主策略时使用。用户显式打开自动压缩后，
   *       触发点严格按比例计算，不再被该上限截断。
   */
  hardCapTokens: number;
}

/**
 * 计算自动压缩的触发 token 数。
 *
 * @returns 触发阈值（token）；返回 `null` 表示当前不应触发自动压缩。
 */
export function resolveAutoCompactionTriggerTokens(
  args: ResolveAutoCompactionTriggerArgs,
): number | null {
  const { policy, configThreshold, contextWindowSize, hardCapTokens } = args;

  if (!Number.isFinite(contextWindowSize) || contextWindowSize <= 0) {
    return null;
  }

  // 宿主策略优先：用户设置是唯一事实来源。
  if (policy) {
    if (!policy.enabled) return null;
    if (!Number.isFinite(policy.threshold) || policy.threshold <= 0) {
      return null;
    }
    const ratio = Math.min(policy.threshold, 1);
    return Math.floor(ratio * contextWindowSize);
  }

  // 兼容路径：沿用智能体配置阈值，并受绝对上限约束。
  const threshold = configThreshold ?? 0.65;
  if (!Number.isFinite(threshold) || threshold < 0) return null;

  return Math.floor(Math.min(threshold * contextWindowSize, hardCapTokens));
}
