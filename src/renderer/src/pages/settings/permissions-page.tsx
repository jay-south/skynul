import type { PermissionKey } from '@shared'
import { PermissionLevel } from '@shared'
import {
  SettingsPageHeader,
  SettingsRow,
  SettingsSection
} from '@/components/feature/settings'
import { t } from '@/i18n'
import { useGeneralSettings, usePermissionsSettings, useSetPermission } from '@/queries'

const PERMISSIONS: Array<{
  key: PermissionKey
  titleKey: 'cap_fs_read_title' | 'cap_fs_write_title' | 'cap_cmd_run_title' | 'cap_net_http_title'
  descKey: 'cap_fs_read_desc' | 'cap_fs_write_desc' | 'cap_cmd_run_desc' | 'cap_net_http_desc'
}> = [
  { key: 'fsRead', titleKey: 'cap_fs_read_title', descKey: 'cap_fs_read_desc' },
  { key: 'fsWrite', titleKey: 'cap_fs_write_title', descKey: 'cap_fs_write_desc' },
  { key: 'cmdRun', titleKey: 'cap_cmd_run_title', descKey: 'cap_cmd_run_desc' },
  { key: 'netHttp', titleKey: 'cap_net_http_title', descKey: 'cap_net_http_desc' }
]

const LEVELS = [PermissionLevel.Deny, PermissionLevel.Ask, PermissionLevel.Allow] as const

const LEVEL_LABELS: Record<PermissionLevel, string> = {
  [PermissionLevel.Deny]: 'Denied',
  [PermissionLevel.Ask]: 'Ask first',
  [PermissionLevel.Allow]: 'Allowed'
}

export function PermissionsPage(): React.JSX.Element {
  const { data: general } = useGeneralSettings()
  const { data: permissions } = usePermissionsSettings()
  const setPermissionMutation = useSetPermission()
  const lang = general?.language ?? 'en'

  const handleChange = (key: PermissionKey, level: PermissionLevel) => {
    if (!permissions) return
    setPermissionMutation.mutate({ key, level })
  }

  return (
    <>
      <SettingsPageHeader
        title="Permissions"
        description="What the agent may do on your computer. Ask first pauses destructive actions until you approve in chat."
      />

      <SettingsSection title="System access">
        {PERMISSIONS.map((p) => (
          <SettingsRow
            key={p.key}
            title={t(lang, p.titleKey)}
            description={t(lang, p.descKey)}
            mono
          >
            <select
              value={permissions?.[p.key] ?? PermissionLevel.Deny}
              disabled={!permissions || setPermissionMutation.isPending}
              onChange={(e) => handleChange(p.key, e.target.value as PermissionLevel)}
              className="rounded-md border border-nb-border bg-nb-panel px-2 py-1.5 text-xs text-nb-text"
              aria-label={t(lang, p.titleKey)}
            >
              {LEVELS.map((level) => (
                <option key={level} value={level}>
                  {LEVEL_LABELS[level]}
                </option>
              ))}
            </select>
          </SettingsRow>
        ))}
      </SettingsSection>
    </>
  )
}
