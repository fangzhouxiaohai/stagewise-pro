import { translateUiString } from './dictionary';

/** 需要翻译的文本属性。 */
const TRANSLATABLE_ATTRIBUTES = [
  'placeholder',
  'title',
  'aria-label',
  'alt',
  'data-placeholder',
] as const;

/** 不翻译的节点selector：用户内容、代码、编辑器、富文本消息体。 */
const SKIP_SELECTOR = [
  '[data-i18n-skip]',
  'script',
  'style',
  'code',
  'pre',
  'textarea',
  'input',
  'select',
  'option',
  '[contenteditable="true"]',
  '.ProseMirror',
  '.monaco-editor',
  '.xterm',
].join(',');

/** 弹层节点：右键菜单、下拉框、对话框等。 */
const POPUP_SELECTOR = [
  '[role="menu"]',
  '[role="listbox"]',
  '[role="dialog"]',
  '[role="alertdialog"]',
].join(',');

export interface UiTranslator {
  start: () => void;
  stop: () => void;
  /** 立即同步扫描整个文档，供路由切换等布局阶段调用。 */
  translateNow: () => void;
  /** 同步翻译某个子树，供聊天工具卡片等局部区域使用。 */
  translateSubtree: (root: Element) => void;
  isActive: () => boolean;
}

/**
 * 创建一个基于 DOM 的界面翻译器。
 *
 * 设计原因：应用此前没有任何 i18n 基础设施，逐组件改造需要触碰数百个文件。
 * 这里在渲染层之上建立“原文 → 译文”的本地化层：
 * - 文本节点：命中词典时替换，保留首尾空白；
 * - 属性：placeholder / title / aria-label / alt / data-placeholder；
 * - 跳过用户内容（聊天消息、代码、输入框、编辑器）；
 * - `stop()` 时按保存的原文恢复英文。
 */
export function createUiTranslator(
  translate: (text: string) => string,
): UiTranslator {
  const originalTexts = new WeakMap<Text, string>();
  const writtenTexts = new WeakMap<Text, string>();
  const originalAttributes = new WeakMap<Element, Map<string, string>>();
  const writtenAttributes = new WeakMap<Element, Map<string, string>>();
  let active = false;

  function skipNode(node: Node, forceRoot?: Element): boolean {
    const element =
      node.nodeType === Node.TEXT_NODE ? node.parentElement : (node as Element);
    const skip = element?.closest(SKIP_SELECTOR);
    if (!skip) return false;
    // 工具卡片等局部翻译：聊天内容的整块 skip 祖先不应阻止卡片内部翻译，
    // 但卡片内部的 code/pre/编辑器仍需跳过。
    if (forceRoot && !forceRoot.contains(skip)) return false;
    return true;
  }

  function skipAttributeNode(element: Element, forceRoot?: Element): boolean {
    const skip = element.closest('[data-i18n-skip], script, style');
    if (!skip) return false;
    if (forceRoot && !forceRoot.contains(skip)) return false;
    return true;
  }

  function translateTextNode(node: Text, forceRoot?: Element) {
    if (!active || skipNode(node, forceRoot)) return;
    const current = node.nodeValue;
    if (current === null) return;
    const trimmed = current.trim();
    if (!trimmed || !/[A-Za-z]/.test(trimmed)) return;

    // 当底层英文变化时（例如 "Saving..." → "Save"），刷新保存的原文；
    // 我们自己写入的译文不会覆盖原文。
    if (writtenTexts.get(node) !== current) {
      originalTexts.set(node, current);
    }
    const source = originalTexts.get(node) ?? current;
    const sourceTrimmed = source.trim();
    const translated = translate(sourceTrimmed);
    if (translated === sourceTrimmed) return;

    const leading = source.match(/^\s*/)?.[0] ?? '';
    const trailing = source.match(/\s*$/)?.[0] ?? '';
    const next = `${leading}${translated}${trailing}`;
    if (current !== next) {
      node.nodeValue = next;
      writtenTexts.set(node, next);
    }
  }

  function translateAttribute(
    element: Element,
    name: string,
    forceRoot?: Element,
  ) {
    if (!active || skipAttributeNode(element, forceRoot)) return;
    const current = element.getAttribute(name);
    if (!current) return;
    const trimmed = current.trim();
    if (!trimmed || !/[A-Za-z]/.test(trimmed)) return;

    let store = originalAttributes.get(element);
    if (!store) {
      store = new Map();
      originalAttributes.set(element, store);
    }
    let written = writtenAttributes.get(element);
    if (!written) {
      written = new Map();
      writtenAttributes.set(element, written);
    }
    if (written.get(name) !== current) store.set(name, current);
    const source = store.get(name) ?? current;
    const translated = translate(source.trim());
    if (translated === source.trim()) return;
    if (current !== translated) {
      element.setAttribute(name, translated);
      written.set(name, translated);
    }
  }

  function translateElementAttributes(element: Element, forceRoot?: Element) {
    for (const name of TRANSLATABLE_ATTRIBUTES) {
      if (element.hasAttribute(name)) {
        translateAttribute(element, name, forceRoot);
      }
    }
  }

  function walk(root: Node, forceRoot?: Element) {
    if (root.nodeType === Node.TEXT_NODE) {
      translateTextNode(root as Text, forceRoot);
      return;
    }
    if (root.nodeType !== Node.ELEMENT_NODE) return;

    const element = root as Element;
    translateElementAttributes(element, forceRoot);
    if (element.matches(SKIP_SELECTOR)) return;

    const elementWalker = document.createTreeWalker(
      element,
      NodeFilter.SHOW_ELEMENT,
    );
    let descendant = elementWalker.nextNode();
    while (descendant) {
      translateElementAttributes(descendant as Element, forceRoot);
      descendant = elementWalker.nextNode();
    }

    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    let textNode = walker.nextNode();
    while (textNode) {
      translateTextNode(textNode as Text, forceRoot);
      textNode = walker.nextNode();
    }
  }

  function restoreAll() {
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT,
    );
    let node: Node | null = walker.nextNode();
    while (node) {
      if (node.nodeType === Node.TEXT_NODE) {
        const original = originalTexts.get(node as Text);
        if (original !== undefined) (node as Text).nodeValue = original;
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        const store = originalAttributes.get(node as Element);
        if (store) {
          store.forEach((value, name) => {
            (node as Element).setAttribute(name, value);
          });
        }
      }
      node = walker.nextNode();
    }
  }

  let scanTimer: ReturnType<typeof setTimeout> | null = null;
  let lastScanAt = 0;
  let listenersAttached = false;
  let popupObserver: MutationObserver | null = null;
  const startupScanTimers: Array<ReturnType<typeof setTimeout>> = [];

  function translateToolParts() {
    Array.from(document.querySelectorAll('[data-tool-ui]')).forEach((el) => {
      walk(el, el);
    });
  }

  function runScan() {
    if (!active) return;
    lastScanAt = Date.now();
    walk(document.body);
    translateToolParts();
  }

  /**
   * 交互后延迟重扫。
   *
   * 不使用 MutationObserver：翻译会改变文本宽度，触发 Virtuoso/ResizeObserver
   * 重新布局与渲染，后者又产生新的 DOM 变更，形成“翻译 → 重排 → 重渲染 →
   * 再翻译”的反馈环（实测渲染进程满载）。改为仅在用户交互（点击、按键、
   * 焦点移动）后合并重扫一次，既能把新页面/弹窗翻译成中文，又不会在空闲时
   * 持续抖动。
   */
  function scheduleScan(delay = 250) {
    if (!active || scanTimer) return;
    const wait = Math.max(delay, 900 - (Date.now() - lastScanAt));
    scanTimer = setTimeout(() => {
      scanTimer = null;
      runScan();
    }, wait);
  }

  function handleInteraction() {
    scheduleScan(250);
  }

  return {
    start() {
      if (active) return;
      active = true;
      runScan();
      // 首屏通常先渲染加载页，主界面稍后才挂载；补两次一次性扫描，
      // 让启动后的聊天/侧栏也进入中文，而不是等到用户第一次点击。
      startupScanTimers.push(
        setTimeout(runScan, 800),
        setTimeout(runScan, 2_500),
      );
      if (!listenersAttached) {
        listenersAttached = true;
        document.addEventListener('click', handleInteraction, true);
        document.addEventListener('keydown', handleInteraction, true);
        document.addEventListener('focusin', handleInteraction, true);
        document.addEventListener('contextmenu', handleInteraction, true);
        // 悬浮提示（Tooltip）是悬停时才挂载到 portal 的文本，补一个指针
        // 移入触发，保证新按钮的提示也能翻译。
        document.addEventListener('pointerover', handleInteraction, true);
      }

      // 右键菜单、下拉框、对话框在打开后才挂载到 portal。只观察这类弹层，
      // 在 MutationObserver 回调（绘制前）里同步翻译，避免先显示英文再替换；
      // 不观察整页，避免 Virtuoso 布局反馈环。
      popupObserver = new MutationObserver((records) => {
        if (!active) return;
        for (const record of records) {
          for (const node of Array.from(record.addedNodes)) {
            if (!(node instanceof Element)) continue;
            if (node.matches(POPUP_SELECTOR)) {
              walk(node);
              continue;
            }
            const popup = node.querySelector(POPUP_SELECTOR);
            if (popup) walk(popup);
          }
        }
      });
      popupObserver.observe(document.body, {
        childList: true,
        subtree: true,
      });
    },
    stop() {
      if (!active) return;
      active = false;
      if (scanTimer) {
        clearTimeout(scanTimer);
        scanTimer = null;
      }
      popupObserver?.disconnect();
      popupObserver = null;
      while (startupScanTimers.length > 0) {
        clearTimeout(startupScanTimers.pop());
      }
      if (listenersAttached) {
        listenersAttached = false;
        document.removeEventListener('click', handleInteraction, true);
        document.removeEventListener('keydown', handleInteraction, true);
        document.removeEventListener('focusin', handleInteraction, true);
        document.removeEventListener('contextmenu', handleInteraction, true);
        document.removeEventListener('pointerover', handleInteraction, true);
      }
      restoreAll();
    },
    isActive: () => active,
    translateNow() {
      if (!active) return;
      lastScanAt = Date.now();
      walk(document.body);
      translateToolParts();
    },
    translateSubtree(root: Element) {
      if (!active) return;
      walk(root, root);
    },
  };
}

/** 应用全局共享的翻译器（简体中文）。 */
export const uiTranslator = createUiTranslator(translateUiString);
