import {
  type ContextMenuParams,
  type WebContents,
  type Event,
  Menu,
  clipboard,
  nativeImage,
  type MenuItem as ElectronMenuItem,
  type MenuItemConstructorOptions as ElectronMenuItemConstructorOptions,
  type BaseWindow,
} from 'electron';
import type { SearchUtils } from './search-utils';
import { isChineseUi, tMenu } from '@shared/ui-language';

type MenuItem = ElectronMenuItem | ElectronMenuItemConstructorOptions;

// Utilities for context menu that aren't accessible through the webContents API directly.
export interface ContextMenuUtils {
  openInNewTab: (url: string) => void; // Opens a new tab with the given URL
  searchFor: (query: string, searchEngineId?: number) => void; // Triggers search with configured search engine in new tab
  inspectElement: (x: number, y: number) => void; // Opens the dev tools to inspect the element at the given coordinate
  searchUtils: SearchUtils; // Search utilities for building search URLs and getting engine info
}

export class ContextMenuWebContent {
  private webContents: WebContents;
  private window: BaseWindow;
  private utils: ContextMenuUtils;

  constructor(
    webContents: WebContents,
    window: BaseWindow,
    utils: ContextMenuUtils,
  ) {
    this.webContents = webContents;
    this.window = window;
    this.utils = utils;

    webContents.on('context-menu', this.handleContextMenu);
  }

  private handleContextMenu = (_event: Event, params: ContextMenuParams) => {
    const menu = this.buildMenu(params);

    menu.popup({
      window: this.window,

      // On macOS, we want to show wiritng tools etc. if the context is editable
      ...(process.platform === 'darwin' && params.isEditable
        ? {
            frame: this.webContents.mainFrame,
          }
        : {}),
    });
  };

  private buildMenu(params: ContextMenuParams): Menu {
    // 2D-array of all shown elements.
    const allItems2D: MenuItem[][] = [
      this.buildUrlMenuItems(params),
      this.buildMediaRelatedMenuItems(params),
      this.buildBasicEditMenuItems(params),
      this.buildSpellcheckMenuItems(params),
      this.buildStagewiseFeaturesMenuItems(params),
      this.buildSystemMenuItems(params),
      this.buildDevToolsItems(params),
    ];

    const allItems: MenuItem[] = allItems2D.reduce((acc, curr) => {
      const visibleItems = curr.filter((item) => item.visible !== false);
      if (visibleItems.at(-1)?.type === 'separator') visibleItems.pop();
      if (visibleItems.length === 0) return acc;
      if (acc.length > 0) acc.push({ type: 'separator' });
      acc.push(...visibleItems);
      return acc;
    }, [] as MenuItem[]);

    return Menu.buildFromTemplate(allItems);
  }

  private buildSpellcheckMenuItems = (
    params: ContextMenuParams,
  ): MenuItem[] => {
    if (!params.isEditable) return [];

    const items: MenuItem[] = [
      ...(params.misspelledWord
        ? [
            {
              label: tMenu('Add to Dictionary', '添加到词典'),
              click: () => {
                this.webContents.session.addWordToSpellCheckerDictionary(
                  params.misspelledWord,
                );
              },
            },
          ]
        : []),
      {
        type: 'header',
        label: isChineseUi()
          ? params.dictionarySuggestions.length === 0
            ? '无拼写建议'
            : '拼写建议'
          : `${params.dictionarySuggestions.length === 0 ? 'No ' : ''}Suggestion${params.dictionarySuggestions.length > 1 ? 's' : ''}`,
        enabled: false,
        visible: !!params.misspelledWord,
      },
      ...params.dictionarySuggestions.slice(0, 3).map((suggestion) => ({
        label: suggestion,
        click: () => {
          this.webContents.replaceMisspelling(suggestion);
        },
      })),
    ];

    return items;
  };

  private buildBasicEditMenuItems = (params: ContextMenuParams): MenuItem[] => {
    const items: MenuItem[] = [
      {
        label: tMenu('Undo', '撤销'),
        visible: params.isEditable,
        enabled: params.editFlags.canUndo,
        click: () => {
          this.webContents.undo();
        },
      },
      {
        label: tMenu('Redo', '重做'),
        visible: params.editFlags.canRedo,
        click: () => {
          this.webContents.redo();
        },
      },
      {
        type: 'separator',
        visible: params.isEditable,
      },
      {
        label: tMenu('Paste', '粘贴'),
        visible: params.editFlags.canPaste && clipboard.readText().length > 0,
        click: () => {
          this.webContents.paste();
        },
      },
      {
        label: tMenu('Select All', '全选'),
        visible: params.editFlags.canSelectAll,
        click: () => {
          this.webContents.selectAll();
        },
      },
      {
        label: tMenu('Cut', '剪切'),
        visible: params.editFlags.canCut,
        click: () => {
          clipboard.writeText(params.selectionText);
          this.webContents.cut();
        },
      },
      {
        label: tMenu('Copy', '复制'),
        visible: params.editFlags.canCopy && params.linkURL.length === 0,
        click: () => {
          clipboard.writeText(params.selectionText);
        },
      },
    ];

    return items;
  };

  private buildMediaRelatedMenuItems = (
    params: ContextMenuParams,
  ): MenuItem[] => {
    if (!['image', 'video', 'audio'].includes(params.mediaType)) return [];

    let label = '';
    switch (params.mediaType) {
      case 'image':
        label = 'image';
        break;
      case 'video':
        label = 'video';
        break;
      case 'audio':
        label = 'audio';
        break;
      default:
        label = 'media';
        break;
    }
    label = label.charAt(0).toUpperCase() + label.slice(1);

    const mediaName = isChineseUi()
      ? params.mediaType === 'image'
        ? '图片'
        : params.mediaType === 'video'
          ? '视频'
          : '音频'
      : label;

    const items: MenuItem[] = [
      {
        label: isChineseUi()
          ? `在新标签页中打开${mediaName}`
          : `Open ${label} in New Tab`,
        click: () => {
          this.utils.openInNewTab(params.srcURL);
        },
      },
      {
        label: isChineseUi() ? `将${mediaName}另存为…` : `Save ${label} as...`,
        click: () => {
          this.webContents.downloadURL(params.srcURL);
        },
      },
      {
        label: isChineseUi() ? `复制${mediaName}地址` : `Copy ${label} URL`,
        click: () => {
          clipboard.writeText(params.srcURL);
        },
      },
      {
        label: isChineseUi()
          ? `复制${mediaName}到剪贴板`
          : `Copy ${label} to Clipboard`,
        click: () => {
          fetch(params.srcURL)
            .then((res) => res.arrayBuffer())
            .then((buffer) => nativeImage.createFromBuffer(Buffer.from(buffer)))
            .catch(() => null)
            .then((image) => {
              if (image) {
                clipboard.writeImage(image);
              }
            });
        },
        visible: params.mediaType === 'image',
      },
    ];

    return items;
  };

  private buildUrlMenuItems = (params: ContextMenuParams): MenuItem[] => {
    if (params.linkURL.length === 0) return [];

    const items: MenuItem[] = [
      {
        label: tMenu('Open in new tab', '在新标签页中打开'),
        click: () => {
          this.utils.openInNewTab(params.linkURL);
        },
      },
      {
        type: 'separator',
      },
      {
        label: tMenu('Copy URL', '复制链接地址'),
        click: () => {
          clipboard.writeText(params.linkURL);
        },
      },
      {
        label: tMenu('Copy Text', '复制文本'),
        click: () => {
          clipboard.writeText(params.selectionText);
        },
        visible: params.selectionText.length > 0,
      },
    ];

    return items;
  };

  private buildStagewiseFeaturesMenuItems = (
    params: ContextMenuParams,
  ): MenuItem[] => {
    const defaultEngine = this.utils.searchUtils.getDefaultEngine();
    const engineName = defaultEngine?.shortName ?? 'Google';

    const items: MenuItem[] = [
      {
        visible:
          params.selectionText.length > 0 && params.selectionText.length < 512,
        label: isChineseUi()
          ? params.selectionText.length < 20
            ? `用 ${engineName} 搜索“${params.selectionText}”`
            : `使用 ${engineName} 搜索`
          : params.selectionText.length < 20
            ? `Search ${engineName} for "${params.selectionText}"`
            : `Search with ${engineName}`,
        click: () => {
          this.utils.searchFor(params.selectionText);
        },
      },
    ];

    return items;
  };

  private buildSystemMenuItems = (_params: ContextMenuParams): MenuItem[] => {
    const items: MenuItem[] = [
      {
        label: tMenu('Print/Save page', '打印/保存页面'),
        click: () => {
          this.webContents.print();
        },
      },
    ];

    return items;
  };

  private buildDevToolsItems = (params: ContextMenuParams): MenuItem[] => {
    const items: MenuItem[] = [
      {
        label: tMenu('Inspect Element', '检查元素'),
        click: () => {
          this.utils.inspectElement(params.x, params.y);
        },
      },
    ];

    return items;
  };
}
