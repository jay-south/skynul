import type { Skill } from '@skynul/shared'
import { useRef, useState } from 'react'
import { CapabilityList, CapabilityToggle } from '../../components/CapabilityToggle'
import { Section, SectionLabel } from '../../components/layout'
import { SkillGraph } from '../../components/SkillGraph'
import { useDeleteSkill, useSaveSkill, useSkills, useToggleSkill } from '../../queries'

export function SkillsSettingsPage(): React.JSX.Element {
  const [skillModal, setSkillModal] = useState<Skill | 'new' | null>(null)
  const [skillDraft, setSkillDraft] = useState({
    name: '',
    tag: '',
    description: '',
    prompt: ''
  })
  const [error, setError] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Queries
  const { data: skills = [] } = useSkills()

  // Mutations
  const saveSkillMutation = useSaveSkill()
  const toggleSkillMutation = useToggleSkill()
  const deleteSkillMutation = useDeleteSkill()

  const handleCreateSkill = () => {
    setSkillDraft({ name: '', tag: '', description: '', prompt: '' })
    setSkillModal('new')
  }

  const handleImportClick = () => {
    fileInputRef.current?.click()
  }

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    try {
      for (const file of Array.from(files)) {
        // Read file content
        const content = await file.text()

        // Try to parse as JSON first
        let skillData: Partial<Skill>
        try {
          skillData = JSON.parse(content)
        } catch {
          // If not JSON, try to parse as Markdown with YAML frontmatter
          const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/)
          if (frontmatterMatch) {
            const yamlContent = frontmatterMatch[1]
            const prompt = frontmatterMatch[2].trim()

            // Simple YAML parser
            const lines = yamlContent.split('\n')
            skillData = { prompt }
            for (const line of lines) {
              const [key, ...valueParts] = line.split(':')
              if (key && valueParts.length > 0) {
                const value = valueParts.join(':').trim()
                if (key.trim() === 'name') skillData.name = value
                if (key.trim() === 'tag') skillData.tag = value
                if (key.trim() === 'description') skillData.description = value
              }
            }
          } else {
            throw new Error('Invalid file format. Expected JSON or Markdown with YAML frontmatter')
          }
        }

        // Save the skill
        await saveSkillMutation.mutateAsync({
          ...skillData,
          enabled: true
        })
      }
    } catch (e) {
      setError(`Import failed: ${e instanceof Error ? e.message : String(e)}`)
    }

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleToggleSkill = (skillId: string) => {
    toggleSkillMutation.mutate(skillId)
  }

  const handleEditSkill = (skill: Skill) => {
    setSkillDraft({
      name: skill.name,
      tag: skill.tag,
      description: skill.description,
      prompt: skill.prompt
    })
    setSkillModal(skill)
  }

  const handleDeleteSkill = (skillId: string) => {
    deleteSkillMutation.mutate(skillId)
  }

  const handleSaveSkill = () => {
    const payload = {
      ...skillDraft,
      enabled: true,
      ...(skillModal !== 'new' && skillModal ? { id: skillModal.id } : {})
    }
    saveSkillMutation.mutate(payload, {
      onSuccess: () => setSkillModal(null),
      onError: (e) => setError(`Save failed: ${e instanceof Error ? e.message : String(e)}`)
    })
  }

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept=".json,.md"
        multiple
        style={{ display: 'none' }}
        onChange={handleFileSelect}
      />

      <Section>
        <SectionLabel>Skill Graph</SectionLabel>
        <SkillGraph skills={skills} />
      </Section>

      <Section>
        <SectionLabel>Manage Skills</SectionLabel>
        <div style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
          <button type="button" className="btn" onClick={handleCreateSkill}>
            Create Skill
          </button>
          <button type="button" className="btn" onClick={handleImportClick}>
            Import Skill
          </button>
        </div>
        <div className="settingsFieldHint">Supports .json and .md (with YAML frontmatter)</div>

        {error && <div style={{ color: '#ff6b6b', fontSize: 12, marginTop: 8 }}>{error}</div>}

        {skills.length > 0 && (
          <CapabilityList>
            {skills.map((s) => (
              <div
                key={s.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '8px 0'
                }}
              >
                <div style={{ flex: 1 }}>
                  <CapabilityToggle
                    title={s.name}
                    description={s.tag}
                    enabled={s.enabled}
                    onToggle={() => handleToggleSkill(s.id)}
                  />
                </div>
                <button type="button" className="btnSecondary" onClick={() => handleEditSkill(s)}>
                  Edit
                </button>
                <button
                  type="button"
                  className="btnSecondary"
                  onClick={() => handleDeleteSkill(s.id)}
                >
                  Del
                </button>
              </div>
            ))}
          </CapabilityList>
        )}
      </Section>

      {/* Skill Modal */}
      {skillModal && (
        <div className="modalBackdrop" onMouseDown={() => setSkillModal(null)}>
          <div className="modal" onMouseDown={(e) => e.stopPropagation()} style={{ maxWidth: 500 }}>
            <div className="modalHeader">
              <div className="modalTitle">{skillModal === 'new' ? 'New Skill' : 'Edit Skill'}</div>
              <button
                type="button"
                className="modalClose"
                onClick={() => setSkillModal(null)}
                aria-label="Close"
              >
                ×
              </button>
            </div>
            <div className="modalBody" style={{ gridTemplateColumns: '1fr' }}>
              <div className="modalSection">
                <div className="modalLabel">Name</div>
                <input
                  className="apiKeyInput"
                  value={skillDraft.name}
                  onChange={(e) => setSkillDraft((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g. Polymarket Trader"
                />
              </div>
              <div className="modalSection">
                <div className="modalLabel">Tag</div>
                <input
                  className="apiKeyInput"
                  value={skillDraft.tag}
                  onChange={(e) => setSkillDraft((prev) => ({ ...prev, tag: e.target.value }))}
                  placeholder="e.g. trading, excel, research"
                />
              </div>
              <div className="modalSection">
                <div className="modalLabel">Description</div>
                <input
                  className="apiKeyInput"
                  value={skillDraft.description}
                  onChange={(e) =>
                    setSkillDraft((prev) => ({
                      ...prev,
                      description: e.target.value
                    }))
                  }
                  placeholder="Short description"
                />
              </div>
              <div className="modalSection">
                <div className="modalLabel">Prompt / Instructions</div>
                <textarea
                  className="apiKeyInput"
                  style={{
                    minHeight: 120,
                    resize: 'vertical',
                    fontFamily: 'inherit'
                  }}
                  value={skillDraft.prompt}
                  onChange={(e) => setSkillDraft((prev) => ({ ...prev, prompt: e.target.value }))}
                  placeholder="Instructions the agent should follow for this skill..."
                />
              </div>
            </div>
            <div className="modalFooter">
              <button
                type="button"
                className="btn"
                disabled={!skillDraft.name.trim() || !skillDraft.prompt.trim()}
                onClick={() => void handleSaveSkill()}
              >
                {skillModal === 'new' ? 'Create' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
