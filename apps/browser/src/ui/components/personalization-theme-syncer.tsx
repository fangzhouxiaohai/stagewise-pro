import { useEffect, useLayoutEffect, useRef } from 'react';
import { getPersonalizationTheme } from '@shared/personalization-themes';
import { useKartonState } from '@ui/hooks/use-karton';
import {
  COLOR_SCHEME_TRANSITION_CLASS,
  COLOR_SCHEME_TRANSITION_DURATION_MS,
  shouldAnimateColorSchemeChange,
} from '@shared/color-scheme';
import { syncThemeColorsToMain } from '@ui/utils/theme-color-sync';

const THEME_TRANSITION_CLASS = 'theme-transitions-enabled';
const THEME_TRANSITION_DURATION_MS = 500;
const THEME_TRANSITION_HALF_DURATION_MS = THEME_TRANSITION_DURATION_MS / 2;

const SCHEME_TRANSITION_CLASS = COLOR_SCHEME_TRANSITION_CLASS;
const SCHEME_TRANSITION_DURATION_MS = COLOR_SCHEME_TRANSITION_DURATION_MS;

let schemeTransitionTimeoutId: number | undefined;

function clearSchemeTransitionTimeout() {
  if (schemeTransitionTimeoutId !== undefined) {
    window.clearTimeout(schemeTransitionTimeoutId);
    schemeTransitionTimeoutId = undefined;
  }
}

type PersonalizationThemeId = Parameters<typeof getPersonalizationTheme>[0];
type PersonalizationTheme = ReturnType<typeof getPersonalizationTheme>;

let themeTransitionMidpointTimeoutId: number | undefined;
let themeTransitionCleanupTimeoutId: number | undefined;
let themeTransitionTargetThemeId: PersonalizationThemeId | undefined;

function setThemeProperties(root: HTMLElement, theme: PersonalizationTheme) {
  root.style.setProperty('--H-base', String(theme.baseHue));
  root.style.setProperty('--base-chroma-scale', String(theme.baseChromaScale));
  root.style.setProperty('--H-primary', String(theme.primaryHue));
  root.style.setProperty(
    '--primary-chroma-scale',
    String(theme.primaryChromaScale),
  );
  root.style.setProperty('--H', String(theme.primaryHue));
  root.dataset.personalizationTheme = theme.id;
}

function clearThemeTransitionTimeouts() {
  if (themeTransitionMidpointTimeoutId !== undefined) {
    window.clearTimeout(themeTransitionMidpointTimeoutId);
    themeTransitionMidpointTimeoutId = undefined;
  }

  if (themeTransitionCleanupTimeoutId !== undefined) {
    window.clearTimeout(themeTransitionCleanupTimeoutId);
    themeTransitionCleanupTimeoutId = undefined;
  }

  themeTransitionTargetThemeId = undefined;
}

export function applyPersonalizationThemeToRoot(
  themeId: PersonalizationThemeId,
  options: { transition?: boolean } = {},
) {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return;
  }

  const root = document.documentElement;
  const theme = getPersonalizationTheme(themeId);

  if (options.transition) {
    clearThemeTransitionTimeouts();

    themeTransitionTargetThemeId = theme.id;
    root.dataset.personalizationTheme = theme.id;
    root.classList.add(THEME_TRANSITION_CLASS);
    root.style.setProperty('--base-chroma-scale', '0');
    root.style.setProperty('--primary-chroma-scale', '0');

    themeTransitionMidpointTimeoutId = window.setTimeout(() => {
      setThemeProperties(root, theme);
      themeTransitionMidpointTimeoutId = undefined;
      window.requestAnimationFrame(syncThemeColorsToMain);
    }, THEME_TRANSITION_HALF_DURATION_MS);

    themeTransitionCleanupTimeoutId = window.setTimeout(() => {
      root.classList.remove(THEME_TRANSITION_CLASS);
      themeTransitionCleanupTimeoutId = undefined;
      themeTransitionTargetThemeId = undefined;
      window.requestAnimationFrame(syncThemeColorsToMain);
    }, THEME_TRANSITION_DURATION_MS);

    window.requestAnimationFrame(syncThemeColorsToMain);
    return;
  }

  if (themeTransitionTargetThemeId !== undefined) {
    window.requestAnimationFrame(syncThemeColorsToMain);
    return;
  }

  clearThemeTransitionTimeouts();
  root.classList.remove(THEME_TRANSITION_CLASS);
  setThemeProperties(root, theme);
  window.requestAnimationFrame(syncThemeColorsToMain);
}

export function PersonalizationThemeSyncer() {
  const themeId = useKartonState((s) => s.globalConfig.personalizationThemeId);
  const systemTheme = useKartonState((s) => s.systemTheme);
  const previousSystemThemeRef = useRef<'light' | 'dark' | undefined>(
    undefined,
  );

  useLayoutEffect(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      return;
    }

    const root = document.documentElement;
    const previous = previousSystemThemeRef.current;
    const changed = shouldAnimateColorSchemeChange(previous, systemTheme);
    previousSystemThemeRef.current = systemTheme;

    if (changed) {
      // 使用 View Transitions 圆形扩散时，颜色由快照动画接管；
      // 此时不能再叠加 CSS 颜色过渡，否则扩散边缘会出现颜色拖影。
      const viewTransitionActive =
        root.dataset.colorSchemeViewTransition === 'true';
      if (!viewTransitionActive) {
        // 先挂上过渡 class 并强制一次样式计算，再切换 dark class，
        // 否则同一帧内完成两件事可能导致过渡不生效。
        root.classList.add(SCHEME_TRANSITION_CLASS);
        void root.offsetWidth;
        clearSchemeTransitionTimeout();
        schemeTransitionTimeoutId = window.setTimeout(() => {
          root.classList.remove(SCHEME_TRANSITION_CLASS);
          schemeTransitionTimeoutId = undefined;
        }, SCHEME_TRANSITION_DURATION_MS);
      }
    }

    root.classList.toggle('dark', systemTheme === 'dark');
    window.requestAnimationFrame(syncThemeColorsToMain);
  }, [systemTheme]);

  useEffect(() => {
    return () => {
      clearSchemeTransitionTimeout();
      document.documentElement.classList.remove(SCHEME_TRANSITION_CLASS);
    };
  }, []);

  useLayoutEffect(() => {
    applyPersonalizationThemeToRoot(themeId);
  }, [themeId]);

  return null;
}
