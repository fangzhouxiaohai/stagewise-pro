/**
 * 界面文字尺寸到根字号（px）的映射。
 *
 * 应用使用 rem 驱动的 Tailwind 排版，调整根字号即可整体缩放文字；
 * 间距同样基于 rem，会按比例一起缩放。
 */
export type UiTextSize = 's' | 'm' | 'l' | 'xl' | 'xxl';

export const UI_TEXT_SIZE_SCALES: Record<UiTextSize, number> = {
  s: 0.9,
  m: 1,
  l: 1.08,
  xl: 1.16,
  xxl: 1.25,
};

export const DEFAULT_ROOT_FONT_SIZE_PX = 16;

/** 计算某个文字尺寸对应的根字号（px）。 */
export function textSizeToRootFontSize(size: UiTextSize): number {
  const scale = UI_TEXT_SIZE_SCALES[size] ?? 1;
  return Math.round(DEFAULT_ROOT_FONT_SIZE_PX * scale * 100) / 100;
}
