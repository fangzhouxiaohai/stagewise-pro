import { Button } from '@stagewise/stage-ui/components/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@stagewise/stage-ui/components/tooltip';
import { cn } from '@stagewise/stage-ui/lib/utils';
import { useKartonProcedure, useKartonState } from '@ui/hooks/use-karton';
import { useTrack } from '@ui/hooks/use-track';
import {
  COLOR_SCHEME_TRANSITION_CLASS,
  COLOR_SCHEME_TRANSITION_DURATION_MS,
  isDarkColorScheme,
  resolveNextColorScheme,
} from '@shared/color-scheme';
import { playColorSchemeRevealTransition } from '@ui/utils/color-scheme-transition';
import { LoaderCircleIcon, MoonIcon, SunIcon } from 'lucide-react';
import {
  useCallback,
  useEffect,
  useRef,
  type MouseEvent as ReactMouseEvent,
} from 'react';
import {
  IconDownload4Outline18,
  IconGear3Outline18,
  IconHotDrinkOutline18,
} from '@stagewise/icons';

function getPlanLabel(plan: string | undefined): string {
  if (!plan) return 'Free';
  return plan.charAt(0).toUpperCase() + plan.slice(1).toLowerCase();
}

export function SidebarAuthFooter() {
  const track = useTrack();
  const openSettings = useKartonProcedure((p) => p.appScreen.openSettings);
  const closeSettings = useKartonProcedure((p) => p.appScreen.closeSettings);
  const toggleClosedLidSleep = useKartonProcedure(
    (p) => p.closedLidSleep.toggle,
  );
  const quitAndInstall = useKartonProcedure(
    (p) => p.autoUpdate.quitAndInstall.fire,
  );
  const setGlobalConfig = useKartonProcedure((p) => p.config.set);
  const colorSchemeTransitionTimeoutRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    return () => {
      if (colorSchemeTransitionTimeoutRef.current !== undefined) {
        window.clearTimeout(colorSchemeTransitionTimeoutRef.current);
      }
    };
  }, []);

  const appScreenMode = useKartonState((s) => s.appScreen.mode);
  const userAccount = useKartonState((s) => s.userAccount);
  const isMacOs = useKartonState((s) => s.appInfo.platform === 'darwin');
  const closedLidSleep = useKartonState((s) => s.closedLidSleep);
  const appColorScheme = useKartonState(
    (s) => s.globalConfig.appColorScheme ?? 'system',
  );
  const systemTheme = useKartonState((s) => s.systemTheme);
  const updateStatus = useKartonState((s) => s.autoUpdate.status);
  const updateVersion = useKartonState(
    (s) => s.autoUpdate.updateInfo?.releaseName,
  );

  const isAuthenticated =
    userAccount.status === 'authenticated' ||
    userAccount.status === 'server_unreachable';
  const email = userAccount.user?.email;
  const plan = userAccount.subscription?.plan;
  const avatarChar = email ? email[0]!.toUpperCase() : null;
  const isSettingsOpen = appScreenMode === 'settings';
  const isDark = isDarkColorScheme(appColorScheme, systemTheme);
  const isUpdateReady = updateStatus === 'ready';
  const updateVersionLabel = updateVersion ? ` ${updateVersion}` : '';
  const updateLabel = isUpdateReady
    ? `Update${updateVersionLabel} ready, restart and install`
    : `Downloading update${updateVersionLabel}...`;

  const handleToggleSettings = useCallback(() => {
    if (isSettingsOpen) {
      void closeSettings();
      return;
    }

    track('settings-opened');
    void openSettings({ section: 'models-providers' });
  }, [closeSettings, isSettingsOpen, openSettings, track]);

  const handleOpenAccount = useCallback(() => {
    track('account-opened');
    void openSettings({ section: 'account' });
  }, [openSettings, track]);

  /**
   * 快速切换明暗主题。
   *
   * 当前为 system 且系统是暗色时，切到 light；其余情况切到 dark。
   * 切换后会把 appColorScheme 固定为显式值（不再跟随系统），
   * 与设置 → 个性化中的主题选项保持一致。
   */
  const handleToggleColorScheme = useCallback(
    (event: ReactMouseEvent<HTMLButtonElement>) => {
      const nextScheme = resolveNextColorScheme(isDark);
      const root = document.documentElement;
      const apply = () => root.classList.toggle('dark', nextScheme === 'dark');

      const rect = event.currentTarget.getBoundingClientRect();
      const usedReveal = playColorSchemeRevealTransition({
        origin: {
          x: rect.left + rect.width / 2,
          y: rect.top + rect.height / 2,
        },
        nextIsDark: nextScheme === 'dark',
        apply,
      });

      if (!usedReveal) {
        // 不支持 View Transitions 或用户要求减少动态效果时，退化为颜色淡入。
        if (colorSchemeTransitionTimeoutRef.current !== undefined) {
          window.clearTimeout(colorSchemeTransitionTimeoutRef.current);
        }
        root.classList.add(COLOR_SCHEME_TRANSITION_CLASS);
        void root.offsetWidth;
        apply();
        colorSchemeTransitionTimeoutRef.current = window.setTimeout(() => {
          root.classList.remove(COLOR_SCHEME_TRANSITION_CLASS);
          colorSchemeTransitionTimeoutRef.current = undefined;
        }, COLOR_SCHEME_TRANSITION_DURATION_MS);
      }

      void setGlobalConfig({
        appColorScheme: nextScheme,
      });
    },
    [isDark, setGlobalConfig],
  );

  const handleToggleClosedLidSleep = useCallback(() => {
    if (closedLidSleep.isChanging) return;

    track('closed-lid-sleep-toggled', {
      enabled: !closedLidSleep.isSleepDisabled,
    });
    void toggleClosedLidSleep();
  }, [
    closedLidSleep.isChanging,
    closedLidSleep.isSleepDisabled,
    toggleClosedLidSleep,
    track,
  ]);

  return (
    <div className="mt-2 flex shrink-0 flex-col gap-2">
      <div className="flex flex-row items-center justify-between gap-2">
        {isAuthenticated ? (
          <button
            type="button"
            className="app-no-drag flex min-w-0 flex-1 flex-row items-center gap-2 rounded-lg px-1 py-1 hover:bg-foreground/8 active:bg-foreground/12"
            onClick={handleOpenAccount}
          >
            <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-surface-3 font-medium text-foreground text-sm">
              {avatarChar}
            </div>
            <div className="flex w-full min-w-0 flex-col items-start gap-px overflow-hidden">
              <span className="truncate font-medium text-foreground text-sm leading-tight">
                {getPlanLabel(plan)}
              </span>
              <span className="truncate text-muted-foreground text-xs leading-tight">
                {email ?? 'Unknown'}
              </span>
            </div>
          </button>
        ) : (
          // Not signed in — render nothing. Stagewise account sign-in stays
          // available through Settings > Account instead of being promoted
          // in the sidebar.
          <span className="min-w-0 flex-1" aria-hidden="true" />
        )}

        <div className="flex shrink-0 flex-row items-center gap-1">
          {(updateStatus === 'downloading' || isUpdateReady) && (
            <Tooltip>
              <TooltipTrigger>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={updateLabel}
                  aria-disabled={!isUpdateReady}
                  className="app-no-drag shrink-0"
                  onClick={
                    isUpdateReady ? () => void quitAndInstall() : undefined
                  }
                >
                  {isUpdateReady ? (
                    <IconDownload4Outline18 className="size-4 text-primary-foreground" />
                  ) : (
                    <LoaderCircleIcon className="size-4 animate-spin text-primary-foreground" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">{updateLabel}</TooltipContent>
            </Tooltip>
          )}

          {isMacOs && (
            <Tooltip>
              <TooltipTrigger>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={
                    closedLidSleep.isSleepDisabled
                      ? 'Re-enable sleep on closed lid'
                      : 'Prevent sleep on closed lid'
                  }
                  className="app-no-drag shrink-0"
                  aria-disabled={closedLidSleep.isChanging}
                  onClick={handleToggleClosedLidSleep}
                >
                  <IconHotDrinkOutline18
                    className={cn(
                      'size-4 transition-[color,filter] duration-150 ease-out',
                      closedLidSleep.isSleepDisabled
                        ? 'text-[oklch(0.66_0.169_var(--H-yellow))] drop-shadow-[0_0_1.5px_oklch(from_var(--color-warning-solid)_l_c_h_/_0.5)] group-hover/button:text-foreground group-focus-visible/button:text-foreground group-active/button:text-foreground/l-4_c-3 dark:text-[oklch(0.78_0.112_var(--H-yellow))]'
                        : 'text-muted-foreground drop-shadow-[0_0_1.5px_oklch(from_var(--color-warning-solid)_l_c_h_/_0)] group-hover/button:text-foreground group-focus-visible/button:text-foreground group-active/button:text-foreground/l-4_c-3',
                    )}
                  />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">
                <div className="flex max-w-64 flex-col gap-1">
                  <span>
                    {closedLidSleep.isSleepDisabled
                      ? 'Re-enable sleep on closed lid'
                      : 'Prevent sleep on closed lid'}
                  </span>
                  {closedLidSleep.persistenceWarning && (
                    <span className="text-muted-foreground text-xs">
                      {closedLidSleep.persistenceWarning}
                    </span>
                  )}
                </div>
              </TooltipContent>
            </Tooltip>
          )}

          <Tooltip>
            <TooltipTrigger>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={
                  isDark ? 'Switch to light mode' : 'Switch to dark mode'
                }
                className="app-no-drag shrink-0"
                onClick={handleToggleColorScheme}
              >
                {isDark ? (
                  <SunIcon className="size-4" />
                ) : (
                  <MoonIcon className="size-4" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">
              {isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={isSettingsOpen ? 'Close settings' : 'Settings'}
                className="app-no-drag shrink-0"
                onClick={handleToggleSettings}
                aria-pressed={isSettingsOpen}
              >
                <IconGear3Outline18
                  className={cn(
                    'size-4 transition-colors',
                    isSettingsOpen && 'text-primary-foreground',
                  )}
                />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">
              {isSettingsOpen ? 'Close settings' : 'Settings'}
            </TooltipContent>
          </Tooltip>
        </div>
      </div>
    </div>
  );
}
