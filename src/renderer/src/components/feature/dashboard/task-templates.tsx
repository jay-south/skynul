import type { LanguageCode } from '@skynul/shared'
import { t } from '@/i18n'
import styles from './task-templates.module.css'

export type TaskTemplateId = 'daily' | 'trading' | 'chat' | 'custom'

function TemplateIcon(props: { id: TaskTemplateId }): React.JSX.Element {
  const common = {
    viewBox: '0 0 24 24',
    width: 22,
    height: 22,
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.6,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const
  }

  switch (props.id) {
    case 'daily':
      return (
        <svg {...common} aria-hidden="true">
          <path d="M8 3v3" />
          <path d="M16 3v3" />
          <path d="M4 7h16" />
          <path d="M6.5 21h11A2.5 2.5 0 0 0 20 18.5V8.5A2.5 2.5 0 0 0 17.5 6h-11A2.5 2.5 0 0 0 4 8.5v10A2.5 2.5 0 0 0 6.5 21Z" />
          <path d="M8 12l1.2 1.2L12 10.5" />
          <path d="M8 16l1.2 1.2L12 14.5" />
        </svg>
      )
    case 'trading':
      return (
        <svg {...common} aria-hidden="true">
          <path d="M4 19V5" />
          <path d="M4 19h16" />
          <path d="M7 14l3-3 3 2 4-5" />
          <path d="M17 8h2v2" />
        </svg>
      )
    case 'chat':
      return (
        <svg {...common} aria-hidden="true">
          <path d="M8 18l-3 3v-3" />
          <path d="M6 18h9a5 5 0 0 0 0-10H9a5 5 0 0 0-3 9" />
          <path d="M9 12h6" />
          <path d="M9 15h4" />
        </svg>
      )
    case 'custom':
      return (
        <svg {...common} aria-hidden="true">
          <path d="M6 7h12" />
          <path d="M6 12h12" />
          <path d="M6 17h12" />
          <path d="M9 7v0" />
          <path d="M15 12v0" />
          <path d="M11 17v0" />
          <path d="M9 7a1.5 1.5 0 1 0 0 .01" />
          <path d="M15 12a1.5 1.5 0 1 0 0 .01" />
          <path d="M11 17a1.5 1.5 0 1 0 0 .01" />
        </svg>
      )
  }
}

export type TaskMode = 'screen' | 'code'

export function TaskTemplates(props: {
  lang: LanguageCode
  onPick: (id: TaskTemplateId) => void
  mode: TaskMode
  onModeChange: (mode: TaskMode) => void
}): React.JSX.Element {
  const { lang, mode, onModeChange } = props

  const templates: Array<{
    id: TaskTemplateId
    titleKey: Parameters<typeof t>[1]
    descKey: Parameters<typeof t>[1]
  }> = [
    { id: 'daily', titleKey: 'task_template_daily_title', descKey: 'task_template_daily_desc' },
    {
      id: 'trading',
      titleKey: 'task_template_trading_title',
      descKey: 'task_template_trading_desc'
    },
    { id: 'chat', titleKey: 'task_template_chat_title', descKey: 'task_template_chat_desc' },
    { id: 'custom', titleKey: 'task_template_custom_title', descKey: 'task_template_custom_desc' }
  ]

  return (
    <div className={styles.taskTemplatesWrap}>
      <div className={styles.taskTemplatesHeader}>
        <div className={styles.taskTemplatesTitle}>{t(lang, 'tasks_templates_title')}</div>
        <div className={styles.taskTemplatesSubtitle}>{t(lang, 'tasks_templates_subtitle')}</div>
      </div>

      <div className="seg seg--2col" style={{ marginBottom: 4 }}>
        <button
          type="button"
          className={`segBtn ${mode === 'screen' ? 'active' : ''}`}
          onClick={() => onModeChange('screen')}
        >
          Screen Mode
        </button>
        <button
          type="button"
          className={`segBtn ${mode === 'code' ? 'active' : ''}`}
          onClick={() => onModeChange('code')}
        >
          Headless Mode
        </button>
      </div>
      <div className={styles.settingsFieldHint} style={{ textAlign: 'center', marginBottom: 8 }}>
        {mode === 'screen'
          ? 'The agent sees your screen via screenshots and interacts visually'
          : 'The agent works in the background — commands only, no screen needed'}
      </div>

      <div className={styles.taskTemplatesGrid}>
        {templates.map((tpl) => (
          <button
            type="button"
            key={tpl.id}
            className={styles.taskTemplateCard}
            onClick={() => props.onPick(tpl.id)}
          >
            <div className={styles.taskTemplateCardHeader}>
              <div className={styles.taskTemplateIcon} aria-hidden="true">
                <TemplateIcon id={tpl.id} />
              </div>
              <div className={styles.taskTemplateCardTitle}>{t(lang, tpl.titleKey)}</div>
            </div>
            <div className={styles.taskTemplateCardDesc}>{t(lang, tpl.descKey)}</div>
          </button>
        ))}
      </div>
    </div>
  )
}
