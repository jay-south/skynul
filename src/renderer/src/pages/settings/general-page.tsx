import type { LanguageCode, ThemeMode } from '@shared'
import { THEME_MODES } from '@shared'
import {
  SegmentedControl,
  SettingsPageHeader,
  SettingsRow,
  SettingsSection,
  SettingsStack
} from '@/components/feature/settings'
import { UpdateSettings } from '@/components/feature/settings/update-settings'
import { t, type MessageKey } from '@/i18n'
import { useGeneralSettings, useSetAgentPromptAppend, useSetLanguage, useSetTheme } from '@/queries'
import { useEffect, useState } from 'react'

const THEME_LABEL_KEYS: Record<ThemeMode, MessageKey> = {
  system: 'theme_system',
  light: 'theme_light',
  dark: 'theme_dark',
  midnight: 'theme_midnight',
  forest: 'theme_forest'
}

export function GeneralPage(): React.JSX.Element {
  const { data: settings } = useGeneralSettings()
  const setLanguageMutation = useSetLanguage()
  const setThemeMutation = useSetTheme()
  const setAppendMutation = useSetAgentPromptAppend()
  const [appendDraft, setAppendDraft] = useState('')

  const lang: LanguageCode = settings?.language ?? 'en'

  useEffect(() => {
    setAppendDraft(settings?.agentPromptAppend ?? '')
  }, [settings?.agentPromptAppend])

  return (
    <>
      <SettingsPageHeader
        title="General"
        description="Language, appearance, agent instructions, and app updates."
      />

      <SettingsStack>
        <SettingsSection title="Appearance">
          <SettingsRow title={t(lang, 'settings_language')} description="Interface language">
            <SegmentedControl
              value={lang}
              options={[
                { value: 'en', label: 'English' },
                { value: 'es', label: 'Español' }
              ]}
              onChange={(l) => setLanguageMutation.mutate(l)}
            />
          </SettingsRow>
          <SettingsRow title={t(lang, 'settings_theme')} description="Color scheme">
            <SegmentedControl
              value={settings?.themeMode ?? 'dark'}
              options={THEME_MODES.map((value) => ({
                value,
                label: t(lang, THEME_LABEL_KEYS[value])
              }))}
              onChange={(m) => setThemeMutation.mutate(m)}
              disabled={!settings}
            />
          </SettingsRow>
        </SettingsSection>

        <SettingsSection title="Agent">
          <SettingsRow
            title="Prompt append"
            description="Extra instructions appended to the agent system prompt. SYSTEM.md in ~/.config/skynul/ is also loaded if present."
          >
            <textarea
              value={appendDraft}
              onChange={(e) => setAppendDraft(e.target.value)}
              onBlur={() => {
                if (appendDraft !== (settings?.agentPromptAppend ?? '')) {
                  setAppendMutation.mutate(appendDraft)
                }
              }}
              rows={5}
              className="min-w-[min(420px,70vw)] rounded-md border border-nb-border bg-nb-panel px-3 py-2 text-sm text-nb-text"
              placeholder="Optional instructions for every agent task…"
            />
          </SettingsRow>
        </SettingsSection>

        <SettingsSection title="Updates">
          <UpdateSettings />
        </SettingsSection>
      </SettingsStack>
    </>
  )
}
