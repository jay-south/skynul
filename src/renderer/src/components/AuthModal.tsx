import type { LanguageCode } from '@skynul/shared'
import { useEffect, useId, useRef } from 'react'
import { t } from '../i18n'

export const AUTH_PROVIDER = {
  GOOGLE: 'google',
  GITHUB: 'github'
} as const

export type AuthProvider = (typeof AUTH_PROVIDER)[keyof typeof AUTH_PROVIDER]

function GoogleIcon(): React.JSX.Element {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false">
      <path
        fill="currentColor"
        d="M12 10.2v3.9h5.4c-.7 2.1-2.6 3.9-5.4 3.9a6 6 0 1 1 0-12c1.7 0 3 .7 4 1.6l2.7-2.7A9.8 9.8 0 0 0 12 2.2 9.8 9.8 0 1 0 12 22c5.6 0 9.4-3.9 9.4-9.4 0-.6-.1-1.1-.2-1.6H12Z"
      />
    </svg>
  )
}

function GitHubIcon(): React.JSX.Element {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false">
      <path
        fill="currentColor"
        d="M12 2.2c-5.5 0-10 4.5-10 10 0 4.4 2.9 8.1 6.9 9.4.5.1.7-.2.7-.5v-1.7c-2.8.6-3.4-1.2-3.4-1.2-.4-1.1-1-1.4-1-1.4-.9-.6.1-.6.1-.6 1 0 1.6 1.1 1.6 1.1.9 1.6 2.4 1.1 3 .8.1-.6.4-1.1.7-1.3-2.2-.3-4.5-1.1-4.5-5 0-1.1.4-2.1 1.1-2.8-.1-.3-.5-1.3.1-2.8 0 0 .9-.3 2.9 1.1.8-.2 1.7-.3 2.6-.3s1.8.1 2.6.3c2-1.4 2.9-1.1 2.9-1.1.6 1.5.2 2.5.1 2.8.7.7 1.1 1.7 1.1 2.8 0 3.9-2.3 4.7-4.5 5 .4.3.8 1 .8 2v3c0 .3.2.6.7.5A10 10 0 0 0 22 12.2c0-5.5-4.5-10-10-10Z"
      />
    </svg>
  )
}

export function AuthModal(props: {
  open: boolean
  lang: LanguageCode
  supabaseConfigured: boolean
  busy: boolean
  error: string
  onClose: () => void
  onClearError: () => void
  onSignIn: (provider: AuthProvider) => void
}): React.JSX.Element | null {
  if (!props.open) return null

  const providersDisabled = !props.supabaseConfigured || props.busy
  const titleId = useId()
  const descId = useId()
  const closeBtnRef = useRef<HTMLButtonElement | null>(null)

  useEffect(() => {
    closeBtnRef.current?.focus()
  }, [])

  return (
    <div className="modalBackdrop authModalBackdrop" onClick={props.onClose}>
      <div
        className="modal authModal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        aria-busy={props.busy ? 'true' : undefined}
        data-busy={props.busy ? 'true' : undefined}
      >
        <div className="modalHeader authModalHeader">
          <div className="authModalHeaderText">
            <div className="modalTitle authModalTitle" id={titleId}>
              {t(props.lang, 'auth_login')}
            </div>
            <div className="authModalSubtitle" id={descId}>
              {t(props.lang, 'auth_choose_provider')}
            </div>
          </div>
          <button
            ref={closeBtnRef}
            type="button"
            className="modalClose authModalClose"
            onClick={props.onClose}
            aria-label={t(props.lang, 'common_close')}
          >
            &times;
          </button>
        </div>

        <div className="modalBody authModalBody">
          {!props.supabaseConfigured ? (
            <div className="authModalHint" role="note">
              {t(props.lang, 'auth_supabase_not_configured_hint')}
            </div>
          ) : null}

          {props.error ? (
            <div className="modalError authModalError" role="alert">
              {props.error}
            </div>
          ) : null}

          <div
            className="authModalProviders"
            role="group"
            aria-label={t(props.lang, 'auth_choose_provider')}
          >
            <button
              type="button"
              className="authModalProviderBtn"
              disabled={providersDisabled}
              onClick={() => {
                props.onClearError()
                props.onSignIn(AUTH_PROVIDER.GOOGLE)
              }}
            >
              <span className="authModalProviderIcon" aria-hidden="true">
                <GoogleIcon />
              </span>
              <span className="authModalProviderLabel">
                {t(props.lang, 'account_sign_in_google')}
              </span>
            </button>
            <button
              type="button"
              className="authModalProviderBtn"
              disabled={providersDisabled}
              onClick={() => {
                props.onClearError()
                props.onSignIn(AUTH_PROVIDER.GITHUB)
              }}
            >
              <span className="authModalProviderIcon" aria-hidden="true">
                <GitHubIcon />
              </span>
              <span className="authModalProviderLabel">
                {t(props.lang, 'account_sign_in_github')}
              </span>
            </button>
          </div>
        </div>

        <div className="modalFooter authModalFooter">
          <button type="button" className="btnSecondary authModalCancelBtn" onClick={props.onClose}>
            {t(props.lang, 'common_cancel')}
          </button>
        </div>
      </div>
    </div>
  )
}
