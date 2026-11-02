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

export type ColorSchemeRevealDirection = 'expand' | 'retract';

/**
 * 切到暗色：新主题从按钮位置向外扩散（expand）；
 * 切到浅色：旧暗色主题向按钮位置回缩（retract），形成从右上向左下收拢的效果。
 */
export function resolveColorSchemeRevealDirection(
  nextIsDark: boolean,
): ColorSchemeRevealDirection {
  return nextIsDark ? 'expand' : 'retract';
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
  nextIsDark: boolean;
  apply: () => void;
}

const REVEAL_DURATION_MS = 720;
const REVEAL_EASING_EXPAND = 'cubic-bezier(0.22, 1, 0.36, 1)';
const REVEAL_EASING_RETRACT = 'cubic-bezier(0.65, 0, 0.35, 1)';
const GLOW_CLASS = 'theme-reveal-glow';

let activeRevealCleanup: (() => void) | null = null;

/**
 * 以圆形扩散/回缩的方式播放明暗切换（View Transitions API）。
 *
 * - 切到暗色：新暗色快照以按钮为圆心向外扩散；
 * - 切到浅色：旧暗色快照以按钮为圆心向内回缩，露出浅色主题；
 * - 边缘附带一圈流动的高光，由 `theme-reveal-glow` 覆盖层绘制。
 *
 * 返回 false 表示环境不支持或用户要求减少动态效果，由调用方走降级方案。
 */
export function playColorSchemeRevealTransition(
  options: ColorSchemeRevealOptions,
): boolean {
  if (!supportsColorSchemeViewTransition()) return false;

  // 快速连续切换时，先结束上一轮动画，避免旧的清理逻辑误删新一轮的
  // 覆盖层与根节点 class。
  activeRevealCleanup?.();

  const doc = document as ViewTransitionDocument;
  const root = document.documentElement;
  const { x, y } = options.origin;
  const radius = getCircleRevealRadius(
    x,
    y,
    window.innerWidth,
    window.innerHeight,
  );
  const direction = resolveColorSchemeRevealDirection(options.nextIsDark);
  const expanding = direction === 'expand';

  root.dataset.colorSchemeViewTransition = 'true';
  root.classList.add(
    expanding ? 'theme-reveal-expand' : 'theme-reveal-retract',
  );
  root.style.setProperty('--theme-reveal-x', `${x}px`);
  root.style.setProperty('--theme-reveal-y', `${y}px`);
  root.style.setProperty(
    '--theme-reveal-radius',
    `${expanding ? 0 : radius}px`,
  );
  root.style.setProperty('--theme-reveal-angle', '0deg');

  const glow = document.createElement('div');
  glow.className = GLOW_CLASS;
  document.body.appendChild(glow);

  let rafId: number | null = null;
  let fallbackTimerId: number | null = null;
  let cleaned = false;

  const cleanup = () => {
    if (cleaned) return;
    cleaned = true;
    if (rafId !== null) cancelAnimationFrame(rafId);
    if (fallbackTimerId !== null) window.clearTimeout(fallbackTimerId);
    glow.remove();
    root.classList.remove('theme-reveal-expand', 'theme-reveal-retract');
    root.style.removeProperty('--theme-reveal-x');
    root.style.removeProperty('--theme-reveal-y');
    root.style.removeProperty('--theme-reveal-radius');
    root.style.removeProperty('--theme-reveal-angle');
    delete root.dataset.colorSchemeViewTransition;
    if (activeRevealCleanup === cleanup) activeRevealCleanup = null;
  };
  activeRevealCleanup = cleanup;

  const transition = doc.startViewTransition!(options.apply);

  const startReveal = () => {
    const pseudo = expanding
      ? '::view-transition-new(root)'
      : '::view-transition-old(root)';
    const from = `circle(${expanding ? 0 : radius}px at ${x}px ${y}px)`;
    const to = `circle(${expanding ? radius : 0}px at ${x}px ${y}px)`;

    const clipAnimation = root.animate(
      { clipPath: [from, to] },
      {
        duration: REVEAL_DURATION_MS,
        easing: expanding ? REVEAL_EASING_EXPAND : REVEAL_EASING_RETRACT,
        pseudoElement: pseudo,
      },
    );

    const tick = () => {
      const timing = clipAnimation.effect?.getComputedTiming();
      const rawProgress = timing?.progress;
      const progress =
        typeof rawProgress === 'number' && Number.isFinite(rawProgress)
          ? rawProgress
          : 0;
      const currentRadius = expanding
        ? radius * progress
        : radius * (1 - progress);

      root.style.setProperty('--theme-reveal-radius', `${currentRadius}px`);
      root.style.setProperty('--theme-reveal-angle', `${progress * 110}deg`);

      const fadeIn = Math.min(1, progress / 0.14);
      const fadeOut = Math.min(1, (1 - progress) / 0.2);
      glow.style.opacity = String(Math.max(0, Math.min(fadeIn, fadeOut)) * 1);

      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);

    clipAnimation.finished.then(cleanup).catch(cleanup);
  };

  transition.ready.then(startReveal).catch(cleanup);
  transition.finished.then(cleanup).catch(cleanup);
  // 兜底：异常情况下避免覆盖层与标记长期残留。
  fallbackTimerId = window.setTimeout(cleanup, REVEAL_DURATION_MS + 1_200);

  return true;
}

export { COLOR_SCHEME_TRANSITION_CLASS, COLOR_SCHEME_TRANSITION_DURATION_MS };
