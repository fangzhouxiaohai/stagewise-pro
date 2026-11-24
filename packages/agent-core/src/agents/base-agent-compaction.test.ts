import { describe, expect, it, vi } from 'vitest';
import { ChatAgent } from './chat/chat';

/**
 * 上下文压缩的回归测试：只发布真正发生的压缩状态、不重复总结已压缩的
 * 内容，以及自动压缩在无效场景下不会每步重复触发。
 */

type TestMessage = {
  id: string;
  role: 'user' | 'assistant';
  parts: Array<{ type: 'text'; text: string }>;
  metadata: Record<string, unknown>;
};

function makeHistory(count: number): TestMessage[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `msg-${i}`,
    role: i % 2 === 0 ? 'user' : 'assistant',
    parts: [{ type: 'text', text: `Message ${i}` }],
    metadata: { createdAt: new Date(0), partsMetadata: [] },
  }));
}

function createAgent(options: {
  history: TestMessage[];
  usedTokens?: number;
  compressHistory?: () => Promise<string>;
}) {
  const agentState = {
    history: options.history,
    usedTokens: options.usedTokens ?? 0,
    activeModelId: 'model-1',
    activeProviderInstanceId: undefined,
  };
  const agent = Object.create(ChatAgent.prototype) as any;
  agent._isCompressingHistory = false;
  agent._compactionCompletedAt = null;
  agent._postCompactionUsageFloor = null;
  agent._lastUnproductiveAutoCompactionTokens = null;
  agent._stepStartTime = 0;
  agent.instanceId = 'agent-1';
  // `config` is a prototype getter that reads the subclass' static config.
  Object.defineProperty(agent, 'config', {
    value: { minUncompressedMessages: 5 },
  });
  agent.host = {
    logger: { debug: vi.fn(), warn: vi.fn(), error: vi.fn() },
    models: {
      getWithOptions: vi.fn(async () => ({ contextWindowSize: 100_000 })),
    },
  };
  agent.state = {
    get: () => agentState,
    commands: {
      setCompactionState: vi.fn(),
      storeCompressedHistory: vi.fn(
        ({
          boundaryMessageId,
          compressedHistory,
        }: {
          boundaryMessageId: string;
          compressedHistory: string;
        }) => {
          const message = agentState.history.find(
            (m) => m.id === boundaryMessageId,
          );
          if (!message) return 'missing';
          message.metadata.compressedHistory = compressedHistory;
          return 'stored';
        },
      ),
      recordUsage: vi.fn(({ totalTokens }: { totalTokens: number }) => {
        agentState.usedTokens = totalTokens;
      }),
    },
  };
  agent.compressHistory = vi.fn(
    options.compressHistory ?? (async () => 'Summary of earlier messages.'),
  );
  agent.saveState = vi.fn(async () => undefined);
  agent.scheduleMemorySnapshotWrite = vi.fn();
  agent.report = vi.fn();
  return { agent, agentState };
}

describe('BaseAgent history compaction', () => {
  it('does not publish a running state when there is nothing to compact', async () => {
    const { agent } = createAgent({ history: makeHistory(3) });

    const result = await agent.compressHistoryInternal('auto');

    expect(result).toEqual({ status: 'skipped', reason: 'nothing-to-compact' });
    expect(agent.state.commands.setCompactionState).not.toHaveBeenCalled();
    expect(agent.compressHistory).not.toHaveBeenCalled();
  });

  it('publishes running then completed around a real compaction', async () => {
    const { agent, agentState } = createAgent({ history: makeHistory(12) });

    const result = await agent.compressHistoryInternal('manual');

    expect(result).toMatchObject({
      status: 'compressed',
      compressedMessageCount: 7,
      keptMessageCount: 5,
    });
    const statuses = agent.state.commands.setCompactionState.mock.calls.map(
      ([args]: [{ compaction?: { status: string } }]) =>
        args.compaction?.status,
    );
    expect(statuses).toEqual(['running', 'completed']);
    expect(agentState.history[7]?.metadata.compressedHistory).toBe(
      'Summary of earlier messages.',
    );
  });

  it('skips when the new boundary does not advance past the existing summary', async () => {
    const history = makeHistory(12);
    history[8]!.metadata.compressedHistory = 'Existing summary.';
    const { agent } = createAgent({ history });

    const result = await agent.compressHistoryInternal('auto');

    expect(result).toEqual({ status: 'skipped', reason: 'nothing-to-compact' });
    expect(agent.compressHistory).not.toHaveBeenCalled();
    expect(agent.state.commands.setCompactionState).not.toHaveBeenCalled();
  });

  it('waits for real usage after a compaction before auto-compacting again', async () => {
    const { agent, agentState } = createAgent({ history: makeHistory(12) });

    await agent.compressHistoryInternal('auto');
    // The kept-history estimate is written to usedTokens; even if it is
    // above the trigger, the next pre-step check must not compact again.
    agentState.usedTokens = 90_000;
    expect(agent.shouldAutoCompact(50_000, 100_000)).toBe(false);

    // A step that started after the compaction reports real usage.
    agent._stepStartTime = Date.now() + 1;
    agent.recordPostCompactionUsage(30_000);
    agentState.usedTokens = 60_000;
    expect(agent.shouldAutoCompact(50_000, 100_000)).toBe(true);
  });

  it('ignores usage from a step that was already running during compaction', async () => {
    const { agent } = createAgent({ history: makeHistory(12) });
    agent._stepStartTime = Date.now() - 10_000;

    await agent.compressHistoryInternal('manual');
    agent.recordPostCompactionUsage(95_000);

    expect(agent._postCompactionUsageFloor).toBeNull();
    expect(agent._compactionCompletedAt).not.toBeNull();
  });

  it('requires growth when the compacted context already exceeds the trigger', () => {
    const { agent, agentState } = createAgent({ history: makeHistory(12) });
    agent._postCompactionUsageFloor = 40_000;

    agentState.usedTokens = 42_000;
    expect(agent.shouldAutoCompact(32_000, 64_000)).toBe(false);

    // floor + min(25% of trigger, half the remaining window) = 48_000
    agentState.usedTokens = 48_000;
    expect(agent.shouldAutoCompact(32_000, 64_000)).toBe(true);
  });

  it('does not retry a failed auto-compaction until usage changes', async () => {
    const { agent, agentState } = createAgent({
      history: makeHistory(12),
      usedTokens: 70_000,
      compressHistory: async () => {
        throw new Error('model unavailable');
      },
    });

    expect(agent.shouldAutoCompact(50_000, 100_000)).toBe(true);
    await agent.runAutoCompaction();
    expect(agent.compressHistory).toHaveBeenCalledTimes(1);

    expect(agent.shouldAutoCompact(50_000, 100_000)).toBe(false);
    agentState.usedTokens = 71_000;
    expect(agent.shouldAutoCompact(50_000, 100_000)).toBe(true);
  });
});
