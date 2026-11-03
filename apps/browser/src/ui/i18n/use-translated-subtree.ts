import { useLayoutEffect, useRef } from 'react';
import { uiTranslator } from './translator';

/**
 * 在布局阶段翻译某个子树，供聊天工具卡片等无法依赖整页扫描的区域使用。
 * 返回的 ref 需要挂到容器元素上。
 */
export function useTranslatedSubtree<T extends HTMLElement>() {
  const ref = useRef<T>(null);

  useLayoutEffect(() => {
    if (ref.current) uiTranslator.translateSubtree(ref.current);
  });

  return ref;
}
