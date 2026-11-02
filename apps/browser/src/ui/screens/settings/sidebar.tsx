import {
  useCallback,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { cn } from '@ui/utils';
import { useKartonProcedure, useKartonState } from '@ui/hooks/use-karton';
import { useUiZoomCounterScale } from '@ui/hooks/use-ui-zoom-counter-scale';
import {
  TITLEBAR_HEIGHT,
  TITLEBAR_ICON_OPTICAL_OFFSET,
} from '@shared/titlebar';
import { SidebarTitlebarRow } from '../main/_components/sidebar-titlebar-row';
import { SidebarAuthFooter } from '../main/_components/sidebar-auth-footer';
import {
  SETTINGS_NAV_GROUPS,
  getSettingsSectionLabel,
  isSectionActive,
} from './settings-route';
import type { SettingsRootSection } from './settings-route';

interface BackRipple {
  id: number;
  x: number;
  y: number;
  size: number;
}

function SettingsBackButton({
  onClick,
  style,
}: {
  onClick: () => void;
  style?: CSSProperties;
}) {
  const [ripples, setRipples] = useState<BackRipple[]>([]);
  const [isLeaving, setIsLeaving] = useState(false);
  const rippleId = useRef(0);

  const handlePointerEnter = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    event.currentTarget.style.setProperty(
      '--back-hover-x',
      `${event.clientX - rect.left}px`,
    );
    event.currentTarget.style.setProperty(
      '--back-hover-y',
      `${event.clientY - rect.top}px`,
    );
    event.currentTarget.classList.add('is-hovered');
  };

  const handlePointerLeave = (event: ReactPointerEvent<HTMLButtonElement>) => {
    event.currentTarget.classList.remove('is-hovered');
  };

  const handleClick = (event: ReactMouseEvent<HTMLButtonElement>) => {
    if (isLeaving) return;
    setIsLeaving(true);

    const rect = event.currentTarget.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height) * 2;
    const ripple: BackRipple = {
      id: ++rippleId.current,
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
      size,
    };
    setRipples((previous) => [...previous, ripple]);

    // 先播放水波，再关闭设置页；立即关闭会导致按钮被卸载、动画看不到。
    window.setTimeout(() => onClick(), 260);
  };

  return (
    <button
      type="button"
      aria-label="Back"
      aria-busy={isLeaving}
      disabled={isLeaving}
      className="settings-back-button app-no-drag flex h-8 w-full cursor-pointer items-center gap-2 rounded-xl border border-border/70 bg-transparent px-3 text-left font-medium text-muted-foreground text-sm transition-colors hover:text-foreground focus-visible:outline-1 focus-visible:outline-muted-foreground/40 disabled:cursor-default"
      style={style}
      onPointerEnter={handlePointerEnter}
      onPointerLeave={handlePointerLeave}
      onClick={handleClick}
    >
      <span aria-hidden="true" className="relative z-10">
        ←
      </span>
      <span className="relative z-10">Back</span>
      {ripples.map((ripple) => (
        <span
          key={ripple.id}
          aria-hidden="true"
          className="settings-back-ripple"
          style={{
            left: ripple.x,
            top: ripple.y,
            width: ripple.size,
            height: ripple.size,
          }}
        />
      ))}
    </button>
  );
}

export function SettingsSidebar() {
  const counterScale = useUiZoomCounterScale();
  const isMacOs = useKartonState((s) => s.appInfo.platform === 'darwin');
  const activeRoute = useKartonState((s) => s.appScreen.settingsRoute);
  const setSettingsRoute = useKartonProcedure(
    (p) => p.appScreen.setSettingsRoute,
  );
  const closeSettings = useKartonProcedure((p) => p.appScreen.closeSettings);

  const handleSelectSection = useCallback(
    (section: SettingsRootSection) => {
      setSettingsRoute({ section });
    },
    [setSettingsRoute],
  );

  return (
    <div className="flex h-full flex-col items-stretch">
      <SidebarTitlebarRow absolute showSidebarToggle={false}>
        <div className="ml-2 min-w-0 flex-1 pr-2">
          <SettingsBackButton
            style={
              isMacOs ? { marginTop: TITLEBAR_ICON_OPTICAL_OFFSET } : undefined
            }
            onClick={() => closeSettings()}
          />
        </div>
      </SidebarTitlebarRow>
      <div
        className="flex h-full min-h-0 flex-col items-stretch p-2"
        style={{ paddingTop: (TITLEBAR_HEIGHT + 8) * counterScale }}
      >
        {/* Navigation groups */}
        <nav className="scrollbar-subtle flex min-h-0 flex-1 flex-col gap-px overflow-y-auto pt-2 pr-1.5 pb-3.5 pl-0.5">
          {SETTINGS_NAV_GROUPS.map((group, gi) => (
            <div key={gi} className="flex flex-col gap-px pt-4 first:pt-0">
              {group.label && (
                <div className="shrink-0 px-1.5 pb-1 font-normal text-sidebar-foreground text-xs">
                  {group.label}
                </div>
              )}
              {group.items.map((item) => {
                const active = isSectionActive(item.section, activeRoute);
                return (
                  <button
                    key={item.section}
                    type="button"
                    className={cn(
                      'app-no-drag flex h-8 w-full cursor-pointer flex-row items-center gap-2 rounded-lg px-1.5 text-left text-sm transition-colors',
                      active
                        ? 'bg-foreground/5 text-foreground'
                        : 'text-muted-foreground hover:bg-foreground/8 hover:text-foreground',
                    )}
                    onClick={() => handleSelectSection(item.section)}
                  >
                    {item.icon}
                    <span className="truncate">
                      {getSettingsSectionLabel(item.section)}
                    </span>
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        <SidebarAuthFooter />
      </div>
    </div>
  );
}
