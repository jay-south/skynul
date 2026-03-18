import type { CapabilityId } from '@skynul/shared'
import { CapabilityList, CapabilityToggle } from '../../components/CapabilityToggle'
import { Section, SectionLabel } from '../../components/layout'
import { t } from '../../i18n'
import { usePolicy, useSetAutoApprove, useSetCapability, useSetTaskMemory } from '../../queries'

const CAPABILITIES: Array<{ id: CapabilityId; title: string; desc: string }> = [
  {
    id: 'fs.read',
    title: 'Read Files',
    desc: 'Allow reading text files inside the workspace.'
  },
  {
    id: 'fs.write',
    title: 'Write Files',
    desc: 'Allow writing text files inside the workspace.'
  },
  {
    id: 'cmd.run',
    title: 'Run Commands',
    desc: 'Allow running approved commands (not wired yet).'
  },
  {
    id: 'net.http',
    title: 'Network Access',
    desc: 'Allow outbound HTTP requests (not wired yet).'
  }
]

export function ComputerSettingsPage(): React.JSX.Element {
  // Queries
  const { data: policy } = usePolicy()

  // Mutations
  const setCapabilityMutation = useSetCapability()
  const setTaskMemoryMutation = useSetTaskMemory()
  const setAutoApproveMutation = useSetAutoApprove()

  const lang = policy?.language ?? 'en'

  const handleToggleCapability = (id: CapabilityId) => {
    if (!policy) return
    setCapabilityMutation.mutate({
      capability: id,
      enabled: !policy.capabilities[id]
    })
  }

  const handleToggleTaskMemory = () => {
    if (!policy) return
    setTaskMemoryMutation.mutate(!policy.taskMemoryEnabled)
  }

  const handleToggleAutoApprove = () => {
    if (!policy) return
    setAutoApproveMutation.mutate(!policy.taskAutoApprove)
  }

  return (
    <>
      {/* Task Memory */}
      <Section>
        <SectionLabel>Task Memory</SectionLabel>
        <CapabilityToggle
          title="Learn from Tasks"
          description="Remember past results to improve future tasks"
          enabled={!!policy?.taskMemoryEnabled}
          onToggle={handleToggleTaskMemory}
          disabled={!policy}
        />
        <CapabilityToggle
          title="Auto-Approve Tasks"
          description="Skip capability confirmation and run immediately"
          enabled={!!policy?.taskAutoApprove}
          onToggle={handleToggleAutoApprove}
          disabled={!policy}
        />
      </Section>

      {/* Capabilities */}
      <Section>
        <SectionLabel>{t(lang, 'settings_capabilities')}</SectionLabel>
        <CapabilityList>
          {CAPABILITIES.map((c) => (
            <CapabilityToggle
              key={c.id}
              title={c.title}
              description={c.id}
              enabled={!!policy?.capabilities[c.id]}
              onToggle={() => handleToggleCapability(c.id)}
              disabled={!policy}
            />
          ))}
        </CapabilityList>
      </Section>

      {/* Trading Options */}
      <Section>
        <SectionLabel>Trading Options</SectionLabel>
        <div className="settingsField" style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
          <button type="button" className="btn" disabled>
            Polymarket
          </button>
          <button type="button" className="btn" disabled>
            Binance
          </button>
        </div>
      </Section>
    </>
  )
}
