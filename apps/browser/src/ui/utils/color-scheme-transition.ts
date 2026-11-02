import {
  COLOR_SCHEME_TRANSITION_CLASS,
  COLOR_SCHEME_TRANSITION_DURATION_MS,
} from '@shared/color-scheme';

/** 视口内以 (x, y) 为圆心、覆盖到最远角的半径。 */
export function getCircleRevealRadius(
  x: number,
  y: number,
  width: number,
  height: number,
): number {
  return Math.hypot(Math.max(x, width - x), Math.max(y, height - y));
}

type ViewTransitionDocument = Document & {
  startViewTransition?: (callback: () => void) => {
    ready: Promise<void>;
    finished: Promise<void>;
  };
};

export function supportsColorSchemeViewTransition(): boolean {
  if (typeof document === 'undefined' || typeof window === 'undefined') {
    return false;
  }
  if (!('startViewTransition' in document)) return false;
  return !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export interface ColorSchemeRevealOptions {
  origin: { x: number; y: number };
  apply: () => void;
}

/**
 * 以圆形扩散的方式播放明暗切换（View Transitions API）。
 *
 * 新主题从点击位置向外扩散到整个视口，呈现由左下角向右上角扫过的效果。
 * 返回 false 表示当前环境不支持或用户要求减少动态效果，由调用方走降级方案。
 */
export function playColorSchemeRevealTransition(
  options: ColorSchemeRevealOptions,
): boolean {
  if (!supportsColorSchemeViewTransition()) return false;

  const doc = document as ViewTransitionDocument;
  const root = document.documentElement;
  const { x, y } = options.origin;
  const radius = getCircleRevealRadius(
    x,
    y,
    window.innerWidth,
    window.innerHeight,
  );

  root.dataset.colorSchemeViewTransition = 'true';
  const transition = doc.startViewTransition!(options.apply);

  transition.ready
    .then(() => {
      root.animate(
        {
          clipPath: [
            `circle(0px at ${x}px ${y}px)`,
            `circle(${radius}px at ${x}px ${y}px)`,
          ],
        },
        {
          duration: 480,
          easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
          pseudoElement: '::view-transition-new(root)',
        },
      );
    })
    .catch(() => {});

  const clear = () => {
    delete root.dataset.colorSchemeViewTransition;
  };
  transition.finished.then(clear).catch(clear);
  // 兜底：避免异常情况下标记长期残留导致后续切换没有过渡。
  window.setTimeout(clear, 1_500);

  return true;
}

export { COLOR_SCHEME_TRANSITION_CLASS, COLOR_SCHEME_TRANSITION_DURATION_MS };
