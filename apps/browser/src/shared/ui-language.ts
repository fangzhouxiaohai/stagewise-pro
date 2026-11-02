/**
 * 主进程内共享的界面语言状态。
 *
 * 原生菜单（应用菜单、网页右键菜单）在构建时读取该值；偏好变化时由主进程
 * 更新并触发应用菜单重建。渲染进程不依赖这里，而是使用 Karton 偏好状态。
 */
export type UiLanguage = 'zh-CN' | 'en';

let currentUiLanguage: UiLanguage = 'zh-CN';

export function setUiLanguage(language: UiLanguage): void {
  currentUiLanguage = language;
}

export function getUiLanguage(): UiLanguage {
  return currentUiLanguage;
}

export function isChineseUi(): boolean {
  return currentUiLanguage === 'zh-CN';
}

/** 原生菜单文案：中文模式返回 zh，否则返回 en。 */
export function tMenu(en: string, zh: string): string {
  return isChineseUi() ? zh : en;
}
