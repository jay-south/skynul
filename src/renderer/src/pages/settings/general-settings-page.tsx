import type { LanguageCode, ThemeMode } from '@skynul/shared'
import { PathBox, Section, SectionLabel } from '@/components/common'
import { UpdateSettings } from '@/components/feature/settings'
import { Button } from '@/components/ui/button'
import { t } from '@/i18n'
import { usePickWorkspace, usePolicy, useSetLanguage, useSetTheme } from '@/queries'

export function GeneralSettingsPage(): React.JSX.Element {
  const { data: policy } = usePolicy()

  const setLanguageMutation = useSetLanguage()
  const setThemeMutation = useSetTheme()
  const pickWorkspaceMutation = usePickWorkspace()

  const lang: LanguageCode = policy?.language ?? 'en'
  const workspaceLabel = policy?.workspaceRoot ?? 'No workspace'

  const handleSetLanguage = (language: LanguageCode) => {
    setLanguageMutation.mutate(language)
  }

  const handleSetTheme = (themeMode: ThemeMode) => {
    setThemeMutation.mutate(themeMode)
  }

  const handlePickWorkspace = () => {
    pickWorkspaceMutation.mutate()
  }

  return (
    <>
      <Section>
        <SectionLabel>{t(lang, 'settings_language')}</SectionLabel>
        <div className="seg seg--2col">
          {(['en', 'es'] as const).map((l) => (
            <button
              key={l}
              type="button"
              className={`segBtn ${lang === l ? 'active' : ''}`}
              onClick={() => handleSetLanguage(l)}
              aria-pressed={lang === l}
            >
              {l === 'en' ? 'English' : 'Espanol'}
            </button>
          ))}
        </div>
      </Section>

      <Section>
        <SectionLabel>{t(lang, 'settings_theme')}</SectionLabel>
        <div className="seg">
          {(['system', 'light', 'dark'] as const).map((m) => (
            <button
              key={m}
              type="button"
              className={`segBtn ${policy?.themeMode === m ? 'active' : ''}`}
              onClick={() => handleSetTheme(m)}
              disabled={!policy}
              aria-pressed={policy?.themeMode === m}
            >
              {t(lang, `theme_${m}` as 'theme_system' | 'theme_light' | 'theme_dark')}
            </button>
          ))}
        </div>
      </Section>

      <Section>
        <SectionLabel>{t(lang, 'settings_workspace')}</SectionLabel>
        <PathBox title={workspaceLabel}>{workspaceLabel}</PathBox>
        <Button onClick={handlePickWorkspace}>{t(lang, 'settings_pick_workspace')}</Button>
      </Section>

      <UpdateSettings />
    </>
  )
}
