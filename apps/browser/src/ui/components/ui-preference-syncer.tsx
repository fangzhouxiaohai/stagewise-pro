import { useEffect, useLayoutEffect } from 'react';
import { useKartonState } from '@ui/hooks/use-karton';
import { uiTranslator } from '../i18n/translator';
import { textSizeToRootFontSize } from '../i18n/text-size';

/**
 * 把界面偏好应用到 DOM。
 *
 * - 语言为简体中文时启动翻译层；在布局阶段同步扫描，避免进入新页面时先显示英文；
 * - 文字尺寸通过根字号缩放生效。
 */
export function UiPreferenceSyncer() {
  const language = useKartonState((s) => s.preferences.general.language);
  const uiTextSize = useKartonState((s) => s.preferences.general.uiTextSize);
  const appScreenMode = useKartonState((s) => s.appScreen.mode);
  const settingsSection = useKartonState(
    (s) => s.appScreen.settingsRoute.section,
  );

  useEffect(() => {
    document.documentElement.style.fontSize = `${textSizeToRootFontSize(uiTextSize)}px`;
  }, [uiTextSize]);

  useLayoutEffect(() => {
    document.documentElement.lang = language === 'en' ? 'en' : 'zh-CN';

    if (language === 'en') {
      uiTranslator.stop();
      return;
    }

    uiTranslator.start();
    // 路由/设置分区切换后在浏览器绘制前完成翻译。
    uiTranslator.translateNow();

    return () => uiTranslator.stop();
  }, [language, appScreenMode, settingsSection]);

  return null;
}
