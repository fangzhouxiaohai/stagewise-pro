import { app, Menu } from 'electron';
import path from 'node:path';
import type { Logger } from './logger';
import type { WindowLayoutService } from './window-layout';
import type { AuthService } from './auth';
import { fileURLToPath } from 'node:url';
import { DisposableService } from './disposable';
import { tMenu } from '@shared/ui-language';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export class AppMenuService extends DisposableService {
  private readonly logger: Logger;
  private readonly authService: AuthService;
  private readonly windowLayoutService: WindowLayoutService;

  // Store bound callback reference for proper unregistration
  private readonly boundUpdateApplicationMenu: () => void;

  constructor(
    logger: Logger,
    authService: AuthService,
    windowLayoutService: WindowLayoutService,
  ) {
    super();
    this.logger = logger;
    this.authService = authService;
    this.windowLayoutService = windowLayoutService;

    // Bind once and store reference for later unregistration
    this.boundUpdateApplicationMenu = this.updateApplicationMenu.bind(this);

    this.logger.debug('[AppMenuService] Initializing service');

    this.authService.registerAuthStateChangeCallback(
      this.boundUpdateApplicationMenu,
    );

    this.updateApplicationMenu();

    this.logger.debug('[AppMenuService] Service initialized');
  }

  protected onTeardown(): void {
    this.logger.debug('[AppMenuService] Teardown called');

    this.authService.unregisterAuthStateChangeCallback(
      this.boundUpdateApplicationMenu,
    );

    app.applicationMenu = null;

    this.logger.debug('[AppMenuService] Teardown complete');
  }
  /**
   * 界面语言切换后重建原生应用菜单。
   */
  public refresh(): void {
    this.updateApplicationMenu();
  }

  private updateApplicationMenu() {
    app.applicationMenu = Menu.buildFromTemplate([
      {
        label: app.name,
        id: 'about_menu',
        submenu: [
          { role: 'about', label: tMenu('About stagewise', '关于 stagewise') },
          { type: 'separator' },
          {
            label: tMenu('Settings', '设置'),
            accelerator: 'CmdOrCtrl+,',
            click: () => {
              this.windowLayoutService.openSettings();
            },
          },
          { type: 'separator' },
          {
            label: tMenu(
              'Open our GitHub repository',
              '打开我们的 GitHub 仓库',
            ),
            click: () => {
              void this.windowLayoutService.openUrl(
                'https://github.com/stagewise-io/stagewise',
              );
            },
          },
          {
            label: tMenu(
              'Open our Discord server',
              '加入我们的 Discord 服务器',
            ),
            click: () => {
              void this.windowLayoutService.openUrl(
                'https://ade.stagewise.io/socials/discord',
              );
            },
          },
          { type: 'separator' },
          { role: 'quit', label: tMenu('Quit stagewise', '退出 stagewise') },
        ],
      },
      {
        label: tMenu('Edit', '编辑'),
        submenu: [
          { role: 'undo', label: tMenu('Undo', '撤销') },
          { role: 'redo', label: tMenu('Redo', '重做') },
          { type: 'separator' },
          { role: 'cut', label: tMenu('Cut', '剪切') },
          { role: 'copy', label: tMenu('Copy', '复制') },
          { role: 'paste', label: tMenu('Paste', '粘贴') },
          { role: 'delete', label: tMenu('Delete', '删除') },
          { type: 'separator' },
          { role: 'selectAll', label: tMenu('Select All', '全选') },
        ],
      },
      {
        label: tMenu('User', '用户'),
        id: 'user_menu',
        submenu: (() => {
          switch (this.authService.authState.status) {
            case 'authenticated':
            case 'server_unreachable':
              return [
                {
                  id: 'user_menu_open_console',
                  label: tMenu('Open console', '打开控制台'),
                  click: () => {
                    void this.windowLayoutService.openUrl(
                      'https://console.stagewise.io',
                    );
                  },
                },
                { type: 'separator', id: 'user_menu_separator', visible: true },
                {
                  id: 'user_menu_logout',
                  label: tMenu('Logout', '退出登录'),
                  click: () => {
                    void this.authService.logout();
                  },
                },
              ];
            case 'unauthenticated':
            case 'authentication_invalid':
              return [];
            default:
              return [
                {
                  id: 'user_menu_loading',
                  label: tMenu('Loading...', '加载中…'),
                  visible: true,
                },
              ];
          }
        })(),
      },
      {
        label: tMenu('Help', '帮助'),
        id: 'help_menu',
        submenu: [
          {
            id: 'help_menu_report_issue',
            label: tMenu('Report an issue', '报告问题'),
            click: () => {},
            visible: true,
          },
          { type: 'separator' },
          {
            id: 'help_menu_toggle_dev_tools',
            label: tMenu('Toggle developer tools', '切换开发者工具'),
            click: () => {
              this.windowLayoutService.toggleUIDevTools();
            },
            visible: true,
          },
        ],
      },
    ]);
  }
}
