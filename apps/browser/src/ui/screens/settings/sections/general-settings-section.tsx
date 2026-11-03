import { useEffect, useState } from 'react';
import { Button } from '@stagewise/stage-ui/components/button';
import { OverlayScrollbar } from '@stagewise/stage-ui/components/overlay-scrollbar';
import { Select } from '@stagewise/stage-ui/components/select';
import { Slider } from '@stagewise/stage-ui/components/slider';
import { Switch } from '@stagewise/stage-ui/components/switch';
import { toast } from '@stagewise/stage-ui/components/toaster';
import { useKartonState, useKartonProcedure } from '@ui/hooks/use-karton';
import {
  useSoundSettings,
  NOTIFICATION_LOUDNESS_OPTIONS,
} from '@ui/hooks/use-sound-settings';
import type { Patch } from '@shared/karton-contracts/ui/shared-types';
import { PlayIcon, TriangleAlertIcon, UploadIcon } from 'lucide-react';

// =============================================================================
// Power Save Blocker Setting Component
// =============================================================================

function PowerSaveBlockerSetting() {
  const globalConfig = useKartonState((s) => s.globalConfig);
  const isMacOs = useKartonState((s) => s.appInfo.platform === 'darwin');
  const setGlobalConfig = useKartonProcedure((p) => p.config.set);

  const isEnabled = globalConfig.blockAppSuspensionWhenAgentsActive ?? true;

  const handleChange = async (checked: boolean) => {
    await setGlobalConfig({
      blockAppSuspensionWhenAgentsActive: checked,
    });
  };

  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0 flex-1">
        <label htmlFor="agent-power-save-blocker">
          <h3 className="font-medium text-base text-foreground">
            Keep app awake while agents work
          </h3>
          <p className="text-muted-foreground text-sm">
            Prevent app suspension while agents run tool loops or other active
            work. Waiting for questions or tool approval still counts as idle.
          </p>
        </label>

        {isMacOs && (
          <div className="mt-2 flex items-start gap-1.5 rounded-md bg-warning-background/45 p-2 text-warning-foreground text-xs leading-snug ring-1 ring-warning-solid/20">
            <TriangleAlertIcon className="mt-0.5 size-3.5 shrink-0 text-warning-foreground" />
            <p>
              To prevent sleep in battery mode on macOS devices, including when
              the lid is closed, you must enable “Keep awake” mode in the
              bottom-right corner of the sidebar.
            </p>
          </div>
        )}
      </div>

      <Switch
        id="agent-power-save-blocker"
        checked={isEnabled}
        onCheckedChange={handleChange}
        size="xs"
        className="mt-1 shrink-0"
      />
    </div>
  );
}

// =============================================================================
// Interface Language / Text Size / Default Tool Approval Settings
// =============================================================================

const LANGUAGE_OPTIONS = [
  { value: 'zh-CN', label: '简体中文' },
  { value: 'en', label: 'English' },
];

const TEXT_SIZE_OPTIONS = [
  { value: 's', label: 'S' },
  { value: 'm', label: 'M' },
  { value: 'l', label: 'L' },
  { value: 'xl', label: 'XL' },
  { value: 'xxl', label: 'XXL' },
];

const TOOL_APPROVAL_OPTIONS = [
  { value: 'alwaysAsk', label: 'Always ask' },
  { value: 'smart', label: 'Smart approval' },
  { value: 'alwaysAllow', label: 'Always allow' },
];

function SettingSelectRow({
  id,
  title,
  description,
  value,
  options,
  onChange,
  widthClassName = 'w-40',
}: {
  id: string;
  title: string;
  description: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
  widthClassName?: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0 flex-1">
        <label htmlFor={id}>
          <h3 className="font-medium text-base text-foreground">{title}</h3>
          <p className="text-muted-foreground text-sm">{description}</p>
        </label>
      </div>
      <Select
        value={value}
        onValueChange={onChange}
        items={options}
        size="sm"
        triggerVariant="secondary"
        triggerClassName={`${widthClassName} mt-1 shrink-0`}
        side="bottom"
      />
    </div>
  );
}

/**
 * 界面语言选择。默认简体中文；切换后立即生效，无需重启。
 */
function InterfaceLanguageSetting() {
  const language = useKartonState((s) => s.preferences.general.language);
  const updatePreferences = useKartonProcedure((p) => p.preferences.update);

  const handleChange = async (value: string) => {
    const patch: Patch = {
      op: 'replace',
      path: ['general', 'language'],
      value,
    };
    await updatePreferences([patch]);
  };

  return (
    <SettingSelectRow
      id="general-language"
      title="Interface language"
      description="Language used for buttons, settings, and status messages. Takes effect immediately."
      value={language}
      options={LANGUAGE_OPTIONS}
      onChange={handleChange}
      widthClassName="w-36"
    />
  );
}

/**
 * 界面文字尺寸选择（S / M / L / XL / XXL）。
 */
function TextSizeSetting() {
  const uiTextSize = useKartonState((s) => s.preferences.general.uiTextSize);
  const updatePreferences = useKartonProcedure((p) => p.preferences.update);

  const handleChange = async (value: string) => {
    const patch: Patch = {
      op: 'replace',
      path: ['general', 'uiTextSize'],
      value,
    };
    await updatePreferences([patch]);
  };

  return (
    <SettingSelectRow
      id="general-text-size"
      title="Text size"
      description="Scale interface text from small to extra-extra-large. Layout spacing scales with it."
      value={uiTextSize}
      options={TEXT_SIZE_OPTIONS}
      onChange={handleChange}
      widthClassName="w-24"
    />
  );
}

/**
 * 新建会话的默认工具审批模式。默认 Always allow。
 */
function DefaultToolApprovalSetting() {
  const defaultToolApprovalMode = useKartonState(
    (s) => s.preferences.agent.defaultToolApprovalMode,
  );
  const updatePreferences = useKartonProcedure((p) => p.preferences.update);

  const handleChange = async (value: string) => {
    const patch: Patch = {
      op: 'replace',
      path: ['agent', 'defaultToolApprovalMode'],
      value,
    };
    await updatePreferences([patch]);
  };

  return (
    <SettingSelectRow
      id="agent-default-tool-approval"
      title="Default tool approval"
      description="Approval mode applied to every new chat. Existing chats keep their own setting; you can still switch it per chat from the input bar."
      value={defaultToolApprovalMode}
      options={TOOL_APPROVAL_OPTIONS}
      onChange={handleChange}
      widthClassName="w-44"
    />
  );
}

// =============================================================================
// Global System Prompt Setting Component
// =============================================================================

/**
 * 全局提示词：追加到每个会话系统提示词末尾的额外指令。
 *
 * 使用本地草稿 + 保存按钮，避免每次按键都写偏好文件；保存后对下一个
 * 步骤立即生效。
 */
function GlobalSystemPromptSetting() {
  const savedPrompt = useKartonState(
    (s) => s.preferences.agent.globalSystemPrompt,
  );
  const updatePreferences = useKartonProcedure((p) => p.preferences.update);
  const [draft, setDraft] = useState(savedPrompt);
  const dirty = draft !== savedPrompt;

  useEffect(() => {
    setDraft(savedPrompt);
  }, [savedPrompt]);

  const handleSave = async () => {
    const patch: Patch = {
      op: 'replace',
      path: ['agent', 'globalSystemPrompt'],
      value: draft,
    };
    await updatePreferences([patch]);
  };

  return (
    <div className="space-y-2">
      <div>
        <label htmlFor="agent-global-system-prompt">
          <h3 className="font-medium text-base text-foreground">
            Global instructions
          </h3>
          <p className="text-muted-foreground text-sm">
            Extra instructions appended to the system prompt of every chat, for
            example preferred language, coding conventions, or things the agent
            should always avoid.
          </p>
        </label>
      </div>
      <textarea
        id="agent-global-system-prompt"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        spellCheck={false}
        rows={6}
        placeholder="e.g. Always answer in Chinese. Prefer minimal diffs and run tests before finishing."
        className="scrollbar-subtle w-full resize-y rounded-lg border border-derived bg-surface-1 p-3 text-foreground text-sm outline-none ring-0 transition-colors placeholder:text-subtle-foreground focus:border-derived-strong"
      />
      <div className="flex items-center justify-end gap-2">
        <span className="text-muted-foreground text-xs">
          Applies to the next step of every chat.
        </span>
        <Button size="sm" onClick={() => void handleSave()} disabled={!dirty}>
          Save
        </Button>
      </div>
    </div>
  );
}

// =============================================================================
// Auto Compact Context Setting Component
// =============================================================================

/**
 * 自动压缩上下文开关。
 *
 * 打开后所有会话在已用 token 超过模型上下文窗口的 80% 时自动生成摘要；
 * 关闭后仍可在聊天输入框用 `/compact` 手动压缩。
 */
function AutoCompactContextSetting() {
  const autoCompactContext = useKartonState(
    (s) => s.preferences.agent.autoCompactContext,
  );
  const updatePreferences = useKartonProcedure((p) => p.preferences.update);

  const handleChange = async (checked: boolean) => {
    const patch: Patch = {
      op: 'replace',
      path: ['agent', 'autoCompactContext'],
      value: checked,
    };
    await updatePreferences([patch]);
  };

  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0 flex-1">
        <label htmlFor="agent-auto-compact-context">
          <h3 className="font-medium text-base text-foreground">
            Auto-compact context
          </h3>
          <p className="text-muted-foreground text-sm">
            Summarize the conversation automatically once a session reaches 80%
            of the model's context window. When disabled, compress manually from
            the chat input with /compact.
          </p>
        </label>
      </div>

      <Switch
        id="agent-auto-compact-context"
        checked={autoCompactContext}
        onCheckedChange={handleChange}
        size="xs"
        className="mt-1 shrink-0"
      />
    </div>
  );
}

// =============================================================================
// Context Stats Setting Component
// =============================================================================

/**
 * 上下文占用显示开关。
 *
 * 打开后在聊天输入框的模型选择器旁显示上下文占用百分比（例如 `42%`）。
 */
function ShowContextStatsSetting() {
  const showContextStats = useKartonState(
    (s) => s.preferences.agent.showContextStats,
  );
  const updatePreferences = useKartonProcedure((p) => p.preferences.update);

  const handleChange = async (checked: boolean) => {
    const patch: Patch = {
      op: 'replace',
      path: ['agent', 'showContextStats'],
      value: checked,
    };
    await updatePreferences([patch]);
  };

  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0 flex-1">
        <label htmlFor="agent-show-context-stats">
          <h3 className="font-medium text-base text-foreground">
            Show context usage
          </h3>
          <p className="text-muted-foreground text-sm">
            Show the context window usage next to the model selector.
          </p>
        </label>
      </div>

      <Switch
        id="agent-show-context-stats"
        checked={showContextStats}
        onCheckedChange={handleChange}
        size="xs"
        className="mt-1 shrink-0"
      />
    </div>
  );
}

// =============================================================================
// Notifications Setting Component
// =============================================================================

export function NotificationsSetting() {
  const globalConfig = useKartonState((s) => s.globalConfig);
  const isMacOs = useKartonState((s) => s.appInfo.platform === 'darwin');
  const setGlobalConfig = useKartonProcedure((p) => p.config.set);
  const importSoundPack = useKartonProcedure((p) => p.config.importSoundPack);

  const {
    soundLoudness,
    currentPack,
    soundPackItems,
    loudnessIndex,
    previewSound,
    handleLoudnessChange,
    handleSoundPackChange,
  } = useSoundSettings();

  const handleImportSoundPack = async () => {
    try {
      const result = await importSoundPack();
      if ('error' in result) {
        if (result.error) {
          toast({
            id: `import-sound-pack-error-${Date.now()}`,
            title: 'Custom sound import failed',
            message: result.error,
            type: 'error',
            actions: [],
          });
        }
        return;
      }

      toast({
        id: `import-sound-pack-success-${Date.now()}`,
        title: 'Custom sound imported',
        message: `${result.name} is now selected for notifications.`,
        type: 'info',
        duration: 4000,
        actions: [],
      });
    } catch (err) {
      toast({
        id: `import-sound-pack-error-${Date.now()}`,
        title: 'Custom sound import failed',
        message:
          err instanceof Error ? err.message : 'Custom sound import failed.',
        type: 'error',
        actions: [],
      });
    }
  };

  const handleDockBounceChange = async (checked: boolean) => {
    await setGlobalConfig({
      dockBounceEnabled: checked,
    });
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-medium text-base text-foreground">
          Notification sounds
        </h3>
        <p className="text-muted-foreground text-sm">
          Play a sound when the agent finishes work, asks a question, or
          encounters an error.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <h4 className="font-medium text-foreground text-sm">Loudness</h4>
          <div className="w-32 space-y-0.5 pl-2">
            <Slider
              value={loudnessIndex}
              min={0}
              max={2}
              step={1}
              ariaLabel="Notification sound loudness"
              thickness="default"
              onValueChange={handleLoudnessChange}
            />
            <div className="relative h-3 text-[11px] text-muted-foreground">
              {NOTIFICATION_LOUDNESS_OPTIONS.map((option, index) => (
                <span
                  key={option.value}
                  className="absolute -translate-x-1/2"
                  style={{
                    left: `${
                      (index / (NOTIFICATION_LOUDNESS_OPTIONS.length - 1)) * 100
                    }%`,
                  }}
                >
                  {option.label}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <h4 className="font-medium text-foreground text-sm">Sound pack</h4>
          <div className="flex items-center gap-1">
            <Select
              value={currentPack}
              onValueChange={handleSoundPackChange}
              items={soundPackItems}
              size="sm"
              triggerClassName="w-40"
              side="bottom"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              disabled={soundLoudness === 'off'}
              onClick={() => previewSound()}
              aria-label="Preview sound"
            >
              <PlayIcon className="size-3.5" />
            </Button>
          </div>
          <button
            type="button"
            className="block text-muted-foreground text-xs underline transition-colors hover:text-foreground"
            onClick={handleImportSoundPack}
          >
            <span className="inline-flex items-center gap-1">
              <UploadIcon className="size-3" />
              Use custom sound…
            </span>
          </button>
        </div>
      </div>

      {isMacOs && (
        <div
          className="flex cursor-pointer items-center justify-between gap-4 pt-2"
          onClick={() =>
            handleDockBounceChange(!globalConfig.dockBounceEnabled)
          }
        >
          <div>
            <h3 className="font-medium text-base text-foreground">
              Dock icon bounce
            </h3>
            <p className="text-muted-foreground text-sm">
              Bounce the dock icon when the agent finishes, asks a question, or
              encounters an error while the window is not focused.
            </p>
          </div>
          <div onClick={(e) => e.stopPropagation()}>
            <Switch
              checked={globalConfig.dockBounceEnabled}
              onCheckedChange={handleDockBounceChange}
              size="xs"
            />
          </div>
        </div>
      )}
    </div>
  );
}

// =============================================================================
// Main Section Component
// =============================================================================

export function GeneralSettingsSection() {
  return (
    <div className="h-full w-full">
      <OverlayScrollbar className="h-full" contentClassName="px-6 pt-24 pb-24">
        <div className="mx-auto max-w-3xl space-y-8">
          {/* Header */}
          <div>
            <h1 className="font-semibold text-foreground text-xl">General</h1>
          </div>
          <section className="space-y-6">
            <InterfaceLanguageSetting />
            <TextSizeSetting />
            <DefaultToolApprovalSetting />
            <GlobalSystemPromptSetting />
            <PowerSaveBlockerSetting />
            <AutoCompactContextSetting />
            <ShowContextStatsSetting />
          </section>
        </div>
      </OverlayScrollbar>
    </div>
  );
}
