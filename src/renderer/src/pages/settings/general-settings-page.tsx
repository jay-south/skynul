import type { LanguageCode, ThemeMode } from '@skynul/shared'
import { useEffect, useState } from 'react'
import { UpdateSettings } from '../../components/UpdateSettings'
import { t } from '../../i18n'
import { usePickWorkspace, usePolicy, useSetLanguage, useSetTheme } from '../../queries'
import { SUPABASE_CONFIGURED, supabase } from '../../supabase'

export function GeneralSettingsPage(): React.JSX.Element {
  const [accountEmail, setAccountEmail] = useState('')
  const [accountConnected, setAccountConnected] = useState(false)
  const [accountLoading, setAccountLoading] = useState(SUPABASE_CONFIGURED)
  const [accountBusy, setAccountBusy] = useState(false)

  // Queries
  const { data: policy } = usePolicy()

  // Mutations
  const setLanguageMutation = useSetLanguage()
  const setThemeMutation = useSetTheme()
  const pickWorkspaceMutation = usePickWorkspace()

  // Load account
  useEffect(() => {
    if (!SUPABASE_CONFIGURED || !supabase) return

    let alive = true
    setAccountLoading(true)
    void supabase.auth
      .getUser()
      .then(({ data, error }) => {
        if (!alive) return
        if (error || !data.user) {
          setAccountConnected(false)
          setAccountEmail('')
          return
        }
        setAccountConnected(true)
        setAccountEmail(data.user.email ?? '')
      })
      .finally(() => {
        if (alive) setAccountLoading(false)
      })

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!alive) return
      const email = session?.user?.email ?? ''
      setAccountConnected(Boolean(session))
      setAccountEmail(email)
      setAccountLoading(false)
    })

    return () => {
      alive = false
      data.subscription.unsubscribe()
    }
  }, [])

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

  const signOut = async () => {
    if (!SUPABASE_CONFIGURED || !supabase) return
    setAccountBusy(true)
    try {
      await supabase.auth.signOut()
    } finally {
      setAccountBusy(false)
    }
  }

  const openAuthModal = () => {
    // TODO: Implement auth modal
    console.log('Open auth modal')
  }

  return (
    <>
      {/* Language */}
      <div className="settingsSection">
        <div className="settingsLabel">{t(lang, 'settings_language')}</div>
        <div className="seg seg--2col">
          {(['en', 'es'] as const).map((l) => (
            <button
              key={l}
              className={`segBtn ${lang === l ? 'active' : ''}`}
              onClick={() => handleSetLanguage(l)}
              aria-pressed={lang === l}
            >
              {l === 'en' ? 'English' : 'Espanol'}
            </button>
          ))}
        </div>
      </div>

      {/* Theme */}
      <div className="settingsSection">
        <div className="settingsLabel">{t(lang, 'settings_theme')}</div>
        <div className="seg">
          {(['system', 'light', 'dark'] as const).map((m) => (
            <button
              key={m}
              className={`segBtn ${policy?.themeMode === m ? 'active' : ''}`}
              onClick={() => handleSetTheme(m)}
              disabled={!policy}
              aria-pressed={policy?.themeMode === m}
            >
              {t(lang, `theme_${m}` as 'theme_system' | 'theme_light' | 'theme_dark')}
            </button>
          ))}
        </div>
      </div>

      {/* Workspace */}
      <div className="settingsSection">
        <div className="settingsLabel">{t(lang, 'settings_workspace')}</div>
        <div className="pathBox" title={workspaceLabel}>
          {workspaceLabel}
        </div>
        <button className="btn" onClick={handlePickWorkspace}>
          {t(lang, 'settings_pick_workspace')}
        </button>
      </div>

      {/* Account */}
      <div className="settingsSection">
        <div className="settingsLabel">{t(lang, 'settings_account')}</div>
        <div className="settingsField">
          <div className="settingsFieldHint">
            {!SUPABASE_CONFIGURED
              ? t(lang, 'account_supabase_not_configured')
              : accountLoading
                ? t(lang, 'auth_loading_account')
                : accountConnected
                  ? accountEmail
                    ? t(lang, 'account_connected_as', { email: accountEmail })
                    : t(lang, 'account_connected')
                  : t(lang, 'account_not_connected')}
          </div>
          {accountConnected ? (
            <button className="btn" onClick={() => void signOut()} disabled={accountBusy}>
              {t(lang, 'account_sign_out')}
            </button>
          ) : (
            <button
              className="btn"
              onClick={openAuthModal}
              disabled={accountBusy || accountLoading}
            >
              {t(lang, 'auth_login')}
            </button>
          )}
        </div>
      </div>

      <UpdateSettings />
    </>
  )
}
