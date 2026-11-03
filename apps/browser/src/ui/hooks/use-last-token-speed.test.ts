import { describe, expect, it } from 'vitest';
import {
  readLastTokenSpeed,
  writeLastTokenSpeed,
} from './use-last-token-speed';

function createStorage(): Storage {
  const data = new Map<string, string>();
  return {
    get length() {
      return data.size;
    },
    clear: () => data.clear(),
    getItem: (key) => data.get(key) ?? null,
    key: (index) => Array.from(data.keys())[index] ?? null,
    removeItem: (key) => {
      data.delete(key);
    },
    setItem: (key, value) => {
      data.set(key, value);
    },
  } as Storage;
}

describe('last token speed storage', () => {
  it('按智能体读写速度', () => {
    const storage = createStorage();
    writeLastTokenSpeed(storage, 'agent-a', 217.4);
    writeLastTokenSpeed(storage, 'agent-b', 180);

    expect(readLastTokenSpeed(storage, 'agent-a')).toBe(217);
    expect(readLastTokenSpeed(storage, 'agent-b')).toBe(180);
    expect(readLastTokenSpeed(storage, 'agent-c')).toBeUndefined();
  });

  it('忽略非法速度与空智能体', () => {
    const storage = createStorage();
    writeLastTokenSpeed(storage, 'agent-a', 0);
    writeLastTokenSpeed(storage, 'agent-a', Number.NaN);
    writeLastTokenSpeed(storage, undefined, 100);

    expect(readLastTokenSpeed(storage, 'agent-a')).toBeUndefined();
    expect(readLastTokenSpeed(storage, undefined)).toBeUndefined();
  });
});
