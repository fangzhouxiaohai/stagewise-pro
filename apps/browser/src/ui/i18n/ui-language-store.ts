import { useSyncExternalStore } from 'react';
import { translateUiString } from './dictionary';

type UiLanguage = 'zh-CN' | 'en';

let currentLanguage: UiLanguage = 'zh-CN';
const listeners = new Set<() => void>();

export function setCurrentUiLanguage(language: UiLanguage): void {
  if (language === currentLanguage) return;
  currentLanguage = language;
  listeners.forEach((listener) => listener());
}

export function getCurrentUiLanguage(): UiLanguage {
  return currentLanguage;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** 组件内订阅当前界面语言，语言切换时立即重渲染。 */
export function useUiLanguage(): UiLanguage {
  return useSyncExternalStore(
    subscribe,
    getCurrentUiLanguage,
    getCurrentUiLanguage,
  );
}

/** 返回一个按当前语言翻译文案的函数。 */
export function useUiText(): (text: string) => string {
  const language = useUiLanguage();
  return (text: string) => (language === 'en' ? text : translateUiString(text));
}
