import { beforeEach, describe, expect, it } from 'vitest';
import {
  querySlashItems,
  resetSlashExpansion,
  slashCompactContextRef,
  slashCompactEnabledRef,
  slashSideChatEnabledRef,
  slashSkillsRef,
} from './provider';

/**
 * 斜杠命令列表的单元测试。
 *
 * 重点校验内置命令的组装顺序、按关键字检索，以及开关关闭时
 * 压缩上下文命令不会出现在候选列表中。
 */
describe('querySlashItems', () => {
  beforeEach(() => {
    slashSkillsRef.current = [];
    slashSideChatEnabledRef.current = true;
    slashCompactEnabledRef.current = true;
    slashCompactContextRef.current = null;
    resetSlashExpansion();
  });

  it('内置命令列表包含压缩上下文命令', () => {
    const ids = querySlashItems('').map((item) => item.id);

    expect(ids).toEqual(['command:side', 'command:compact']);
  });

  it('可以通过 compact 关键字检索到压缩上下文命令', () => {
    const items = querySlashItems('compact');

    expect(items.map((item) => item.id)).toEqual(['command:compact']);
  });

  it('压缩功能关闭时列表中不包含压缩上下文命令', () => {
    slashCompactEnabledRef.current = false;

    expect(querySlashItems('').map((item) => item.id)).toEqual([
      'command:side',
    ]);
    expect(querySlashItems('compact')).toHaveLength(0);
  });

  it('内置命令与技能命令按分组顺序合并', () => {
    slashSkillsRef.current = [
      {
        id: 'skill:demo',
        displayName: 'Demo',
        description: '演示技能',
        source: 'workspace',
      },
    ] as typeof slashSkillsRef.current;

    const ids = querySlashItems('').map((item) => item.id);

    expect(ids).toEqual(['command:side', 'command:compact', 'skill:demo']);
  });
});
