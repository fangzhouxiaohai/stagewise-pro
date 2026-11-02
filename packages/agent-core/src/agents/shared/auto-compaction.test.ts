import { describe, expect, it } from 'vitest';
import {
  DEFAULT_AUTO_COMPACTION_THRESHOLD,
  resolveAutoCompactionTriggerTokens,
} from './auto-compaction';

/**
 * 自动压缩触发阈值解析的单元测试。
 *
 * 覆盖两条路径：
 * 1. 宿主注入策略（用户设置开关打开/关闭，按比例精确触发）；
 * 2. 宿主未注入策略时的历史兼容路径（智能体配置阈值 + 绝对上限）。
 */
describe('resolveAutoCompactionTriggerTokens', () => {
  it('自动压缩开启时按上下文窗口的 80% 触发，且不受历史绝对上限限制', () => {
    const trigger = resolveAutoCompactionTriggerTokens({
      policy: { enabled: true, threshold: DEFAULT_AUTO_COMPACTION_THRESHOLD },
      configThreshold: 0.5,
      contextWindowSize: 200_000,
      hardCapTokens: 100_000,
    });

    expect(trigger).toBe(160_000);
  });

  it('大上下文模型的触发点按同一比例放大', () => {
    const trigger = resolveAutoCompactionTriggerTokens({
      policy: { enabled: true, threshold: DEFAULT_AUTO_COMPACTION_THRESHOLD },
      contextWindowSize: 1_000_000,
      hardCapTokens: 100_000,
    });

    expect(trigger).toBe(800_000);
  });

  it('开关关闭时不触发自动压缩', () => {
    const trigger = resolveAutoCompactionTriggerTokens({
      policy: { enabled: false, threshold: DEFAULT_AUTO_COMPACTION_THRESHOLD },
      configThreshold: 0.5,
      contextWindowSize: 200_000,
      hardCapTokens: 100_000,
    });

    expect(trigger).toBeNull();
  });

  it('策略阈值为非正数时不触发自动压缩', () => {
    for (const threshold of [0, -0.2, Number.NaN]) {
      const trigger = resolveAutoCompactionTriggerTokens({
        policy: { enabled: true, threshold },
        contextWindowSize: 200_000,
        hardCapTokens: 100_000,
      });

      expect(trigger).toBeNull();
    }
  });

  it('策略阈值超过 1 时按 100% 处理', () => {
    const trigger = resolveAutoCompactionTriggerTokens({
      policy: { enabled: true, threshold: 1.5 },
      contextWindowSize: 100_000,
      hardCapTokens: 100_000,
    });

    expect(trigger).toBe(100_000);
  });

  it('未注入宿主策略时沿用智能体配置阈值并受绝对上限约束', () => {
    const trigger = resolveAutoCompactionTriggerTokens({
      configThreshold: 0.5,
      contextWindowSize: 200_000,
      hardCapTokens: 100_000,
    });

    expect(trigger).toBe(100_000);
  });

  it('未注入宿主策略且配置为负数时禁用自动压缩', () => {
    const trigger = resolveAutoCompactionTriggerTokens({
      configThreshold: -1,
      contextWindowSize: 200_000,
      hardCapTokens: 100_000,
    });

    expect(trigger).toBeNull();
  });

  it('未注入宿主策略且未配置阈值时使用 0.65 默认值', () => {
    const trigger = resolveAutoCompactionTriggerTokens({
      contextWindowSize: 100_000,
      hardCapTokens: 1_000_000,
    });

    expect(trigger).toBe(65_000);
  });

  it('上下文窗口大小非法时不触发自动压缩', () => {
    for (const contextWindowSize of [0, -1, Number.NaN]) {
      const trigger = resolveAutoCompactionTriggerTokens({
        policy: { enabled: true, threshold: DEFAULT_AUTO_COMPACTION_THRESHOLD },
        contextWindowSize,
        hardCapTokens: 100_000,
      });

      expect(trigger).toBeNull();
    }
  });
});
