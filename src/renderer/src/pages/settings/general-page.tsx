import type { LanguageCode, ThemeMode } from '@skynul/shared'
import { ContentCard } from '@/components/content-card'
import { UpdateSettings } from '@/components/feature/settings'
import { Button } from '@/components/ui/button'
import { t } from '@/i18n'
import { usePickWorkspace, usePolicy, useSetLanguage, useSetTheme } from '@/queries'

export function GeneralPage(): React.JSX.Element {
  const { data: policy } = usePolicy()
  const setLanguageMutation = useSetLanguage()
  const setThemeMutation = useSetTheme()
  const pickWorkspaceMutation = usePickWorkspace()

  const lang: LanguageCode = policy?.language ?? 'en'

  const handleSetLanguage = (language: LanguageCode) => setLanguageMutation.mutate(language)
  const handleSetTheme = (themeMode: ThemeMode) => setThemeMutation.mutate(themeMode)
  const handlePickWorkspace = () => pickWorkspaceMutation.mutate()

  return (
    <div className="flex flex-col gap-4">
      <ContentCard title="Language">
        <div className="flex gap-1 rounded-lg bg-nb-panel-2 border border-nb-border p-1 w-fit">
          {(['en', 'es'] as const).map((l) => (
            <button
              key={l}
              type="button"
              onClick={() => handleSetLanguage(l)}
              aria-pressed={lang === l}
              className={`rounded-md px-3 py-1.5 text-xs font-medium cursor-pointer transition-all border-none
                ${
                  lang === l
                    ? 'bg-nb-panel text-nb-text shadow-sm'
                    : 'bg-transparent text-nb-muted hover:text-nb-text'
                }`}
            >
              {l === 'en' ? 'English' : 'Español'}
            </button>
          ))}
        </div>
      </ContentCard>

      <ContentCard title="Theme">
        <div className="flex gap-1 rounded-lg bg-nb-panel-2 border border-nb-border p-1 w-fit">
          {(['system', 'light', 'dark'] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => handleSetTheme(m)}
              disabled={!policy}
              aria-pressed={policy?.themeMode === m}
              className={`rounded-md px-3 py-1.5 text-xs font-medium cursor-pointer transition-all border-none disabled:opacity-40 disabled:cursor-default
                ${
                  policy?.themeMode === m
                    ? 'bg-nb-panel text-nb-text shadow-sm'
                    : 'bg-transparent text-nb-muted hover:text-nb-text'
                }`}
            >
              {t(lang, `theme_${m}` as 'theme_system' | 'theme_light' | 'theme_dark')}
            </button>
          ))}
        </div>
      </ContentCard>

      <ContentCard title="Workspace">
        <div className="flex items-center gap-2">
          <span className="text-xs text-nb-muted font-mono truncate flex-1 bg-nb-panel-2 border border-nb-border rounded-lg px-2.5 py-2">
            {policy?.workspaceRoot ?? 'No workspace'}
          </span>
          <Button onClick={handlePickWorkspace}>{t(lang, 'settings_pick_workspace')}</Button>
        </div>
      </ContentCard>

      <ContentCard title="Updates">
        <UpdateSettings />
      </ContentCard>
    </div>
  )
}
