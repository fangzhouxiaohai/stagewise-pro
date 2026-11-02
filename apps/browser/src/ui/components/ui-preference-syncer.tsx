import { useEffect } from 'react';
import { useKartonState } from '@ui/hooks/use-karton';
import { uiTranslator } from '../i18n/translator';
import { textSizeToRootFontSize } from '../i18n/text-size';

/**
 * 把界面偏好（语言、文字尺寸）应用到 DOM。
 *
 * 挂在 KartonProvider 内部：
 * - 语言为简体中文时启动翻译层，切回英文时恢复原文；
 * - 文字尺寸通过根字号缩放生效。
 */
export function UiPreferenceSyncer() {
  const language = useKartonState((s) => s.preferences.general.language);
  const uiTextSize = useKartonState((s) => s.preferences.general.uiTextSize);

  useEffect(() => {
    document.documentElement.style.fontSize = `${textSizeToRootFontSize(uiTextSize)}px`;
  }, [uiTextSize]);

  useEffect(() => {
    document.documentElement.lang = language === 'en' ? 'en' : 'zh-CN';
    if (language === 'en') {
      uiTranslator.stop();
      return;
    }
    uiTranslator.start();
    return () => uiTranslator.stop();
  }, [language]);

  return null;
}
