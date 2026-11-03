import { useEffect } from 'react';

/** 按智能体保存最后一次有效速度，应用重启后仍可显示。 */
const STORAGE_KEY_PREFIX = 'stagewise:last-token-speed:';

export function readLastTokenSpeed(
  storage: Storage | undefined,
  agentId: string | undefined,
): number | undefined {
  if (!storage || !agentId) return undefined;
  const raw = storage.getItem(`${STORAGE_KEY_PREFIX}${agentId}`);
  if (!raw) return undefined;
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? value : undefined;
}

export function writeLastTokenSpeed(
  storage: Storage | undefined,
  agentId: string | undefined,
  value: number | undefined,
): void {
  if (!storage || !agentId || value === undefined) return;
  if (!Number.isFinite(value) || value <= 0) return;
  storage.setItem(`${STORAGE_KEY_PREFIX}${agentId}`, String(Math.round(value)));
}

/**
 * 返回当前智能体应显示的速度：
 * - 有新的真实速度时更新并持久化；
 * - 没有时回退到上一次持久化的速度，避免每次重新显示 `--`；
 * - 全新会话从未产生速度时返回 undefined，由界面显示 `-- tok/s`。
 */
export function useLastTokenSpeed(
  agentId: string | undefined,
  current: number | undefined,
): number | undefined {
  const storage =
    typeof window !== 'undefined' ? window.localStorage : undefined;
  const persisted = readLastTokenSpeed(storage, agentId);

  useEffect(() => {
    if (current !== undefined) {
      writeLastTokenSpeed(storage, agentId, current);
    }
  }, [agentId, current, storage]);

  return current ?? persisted;
}
