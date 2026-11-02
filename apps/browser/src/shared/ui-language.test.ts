import { afterEach, describe, expect, it } from 'vitest';
import { getUiLanguage, setUiLanguage, tMenu } from './ui-language';

describe('ui-language', () => {
  afterEach(() => setUiLanguage('zh-CN'));

  it('默认界面语言为简体中文', () => {
    setUiLanguage('zh-CN');
    expect(getUiLanguage()).toBe('zh-CN');
    expect(tMenu('Edit', '编辑')).toBe('编辑');
  });

  it('英文模式返回英文菜单文案', () => {
    setUiLanguage('en');
    expect(tMenu('Edit', '编辑')).toBe('Edit');
    expect(tMenu('Help', '帮助')).toBe('Help');
  });
});
