import type { CapabilityId } from '@skynul/shared'
import { Button } from "../.../components/ui/Button"
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
        003cButton
          type="button"
          className={`cap ${policy?.taskMemoryEnabled ? 'on' : 'off'}`}
          onClick={handleToggleTaskMemory}
          disabled={!policy}
        >
          <div className="capLeft">
            <div className="capTitle">Learn from Tasks</div>
            <div className="capDesc">Remember past results to improve future tasks</div>
          </div>
          <div className="capToggle" aria-hidden="true">
            <div className="capKnob" />
          </div>
        003c/Button>
        003cButton
          type="button"
          className={`cap ${policy?.taskAutoApprove ? 'on' : 'off'}`}
          onClick={handleToggleAutoApprove}
          disabled={!policy}
        >
          <div className="capLeft">
            <div className="capTitle">Auto-Approve Tasks</div>
            <div className="capDesc">Skip capability confirmation and run immediately</div>
          </div>
          <div className="capToggle" aria-hidden="true">
            <div className="capKnob" />
          </div>
        003c/Button>
      </Section>

      {/* Capabilities */}
      <Section>
        <SectionLabel>{t(lang, 'settings_capabilities')}</SectionLabel>
        <div className="capList">
          {CAPABILITIES.map((c) => (
            003cButton
              key={c.id}
              type="button"
              className={`cap ${policy?.capabilities[c.id] ? 'on' : 'off'}`}
              onClick={() => handleToggleCapability(c.id)}
              disabled={!policy}
              title={c.desc}
            >
              <div className="capLeft">
                <div className="capTitle">{c.title}</div>
                <div className="capDesc">{c.id}</div>
              </div>
              <div className="capToggle" aria-hidden="true">
                <div className="capKnob" />
              </div>
            003c/Button>
          ))}
        </div>
      </Section>

      {/* Trading Options */}
      <Section>
        <SectionLabel>Trading Options</SectionLabel>
        <div className="settingsField" style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
          003cButton type="button" variant="filled" disabled>
            Polymarket
          003c/Button>
          003cButton type="button" variant="filled" disabled>
            Binance
          003c/Button>
        </div>
      </Section>
    </>
  )
}
