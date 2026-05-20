import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { WelcomeAnimation } from '@/components/welcome-animation'

const USER_NAME_KEY = 'skynul-user-name'

function getUserName(): string | null {
  try {
    return localStorage.getItem(USER_NAME_KEY)
  } catch {
    return null
  }
}

function saveUserName(name: string): void {
  try {
    localStorage.setItem(USER_NAME_KEY, name)
  } catch {
    /* ignore */
  }
}

export function WelcomePage(): React.JSX.Element {
  const navigate = useNavigate()
  const existingName = getUserName()
  const [name, setName] = useState(existingName ?? '')
  const [phase, setPhase] = useState<'input' | 'greeting'>(existingName ? 'greeting' : 'input')

  const handleSubmit = () => {
    const trimmed = name.trim()
    if (!trimmed && !existingName) return
    if (trimmed) saveUserName(trimmed)
    setPhase('greeting')
  }

  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center overflow-hidden bg-nb-bg">
      {/* Animation background — full viewport */}
      <div className="absolute inset-0 pointer-events-none select-none overflow-hidden">
        <WelcomeAnimation />
      </div>

      {/* Card with blur backdrop */}
      <div className="relative z-10 backdrop-blur-2xl bg-nb-bg/20 border border-nb-border/10 rounded-3xl px-10 py-9 max-w-sm w-full mx-4">
        <div className="flex flex-col items-center gap-4 text-center">
          {phase === 'greeting' ? (
            <>
              <h1 className="text-2xl font-light text-nb-text m-0 tracking-wide">
                Welcome back{existingName ? `, ${existingName}` : ''}
              </h1>
              <p className="text-sm text-nb-muted/70 m-0 leading-relaxed font-light">
                {existingName ? 'Ready to pick up where you left off?' : 'Glad to have you here.'}
              </p>
              <button
                type="button"
                onClick={() => navigate('/dashboard')}
                className="mt-2 rounded-full border border-nb-border/30 text-nb-text/80 px-6 py-2 text-xs font-light cursor-pointer bg-transparent hover:bg-nb-bg/20 hover:border-nb-border/50 transition-all duration-300 tracking-wider"
              >
                Let's go
              </button>
            </>
          ) : (
            <>
              <h1 className="text-2xl font-light text-nb-text m-0 tracking-wide">
                First time here?
              </h1>
              <p className="text-sm text-nb-muted/70 m-0 leading-relaxed max-w-xs font-light">
                Tell me your name so I know who's in charge.
              </p>

              <div className="flex flex-col gap-3 w-full max-w-[260px] mt-2">
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && name.trim()) handleSubmit()
                  }}
                  placeholder="Your name..."
                  className="w-full px-4 py-2.5 rounded-xl border border-nb-border/20 bg-nb-bg/15 text-sm text-nb-text outline-none placeholder:text-nb-muted/30 text-center font-light tracking-wide focus:border-nb-border/40 transition-colors"
                />
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={!name.trim()}
                  className="rounded-full border border-nb-border/30 text-nb-text/80 px-6 py-2 text-xs font-light cursor-pointer bg-transparent hover:bg-nb-bg/20 hover:border-nb-border/50 transition-all duration-300 tracking-wider disabled:opacity-30 disabled:cursor-default"
                >
                  Continue
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
