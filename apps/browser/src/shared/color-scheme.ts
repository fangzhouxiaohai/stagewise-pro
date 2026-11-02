import type { AppColorScheme } from '@shared/karton-contracts/ui/shared-types';

/** 明暗切换过渡的根节点 class 与时长（与 browser-base.css 保持一致）。 */
export const COLOR_SCHEME_TRANSITION_CLASS = 'color-scheme-transition';
export const COLOR_SCHEME_TRANSITION_DURATION_MS = 260;

/**
 * 计算快速切换按钮的下一个配色方案。
 *
 * 当前实际为暗色（显式 dark，或 system 且系统为暗色）时切到 light；
 * 否则切到 dark。切换后固定为显式值，不再跟随系统。
 */
export function resolveNextColorScheme(isDark: boolean): AppColorScheme {
  return isDark ? 'light' : 'dark';
}

export function isDarkColorScheme(
  scheme: AppColorScheme,
  systemTheme: 'light' | 'dark',
): boolean {
  return scheme === 'dark' || (scheme === 'system' && systemTheme === 'dark');
}

/**
 * 是否需要在系统主题变化时播放颜色过渡。
 * 首次挂载（previous 为空）不播动画，避免启动时整页闪动。
 */
export function shouldAnimateColorSchemeChange(
  previous: 'light' | 'dark' | undefined,
  next: 'light' | 'dark',
): boolean {
  return previous !== undefined && previous !== next;
}
