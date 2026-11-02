import { describe, expect, it } from 'vitest';
import {
  isDarkColorScheme,
  resolveNextColorScheme,
  shouldAnimateColorSchemeChange,
} from './color-scheme';

describe('color-scheme', () => {
  it('暗色时切换为浅色', () => {
    expect(resolveNextColorScheme(true)).toBe('light');
  });

  it('浅色时切换为暗色', () => {
    expect(resolveNextColorScheme(false)).toBe('dark');
  });

  it('system 模式按系统主题判定', () => {
    expect(isDarkColorScheme('system', 'dark')).toBe(true);
    expect(isDarkColorScheme('system', 'light')).toBe(false);
    expect(isDarkColorScheme('dark', 'light')).toBe(true);
    expect(isDarkColorScheme('light', 'dark')).toBe(false);
  });

  it('仅在主题真正变化时播放过渡', () => {
    expect(shouldAnimateColorSchemeChange(undefined, 'dark')).toBe(false);
    expect(shouldAnimateColorSchemeChange('light', 'dark')).toBe(true);
    expect(shouldAnimateColorSchemeChange('dark', 'dark')).toBe(false);
  });
});
