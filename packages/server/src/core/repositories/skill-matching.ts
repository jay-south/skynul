import type { Skill } from '@skynul/shared'

const SKILL_SYNONYMS: Record<string, string[]> = {
  design: ['diseño', 'diseñ', 'diseña', 'diseñes', 'diseñar'],
  logo: ['logotipo', 'isotipo', 'marca', 'brand', 'branding'],
  graphic: ['gráfico', 'grafico', 'gráfica', 'grafica', 'visual'],
  vector: ['vectorial', 'vectores', 'svg'],
  illustrator: ['illustrator'],
  photoshop: ['photoshop'],
  blender: ['blender', '3d', 'render'],
  icon: ['icono', 'iconos', 'icons']
}

export function getActiveSkillPrompts(skills: Skill[], taskPrompt: string): string {
  const active = skills.filter((s) => s.enabled)
  if (active.length === 0) return ''

  const prompt = taskPrompt.toLowerCase()
  const relevant = active.filter((s) => {
    const words = `${s.tag} ${s.name} ${s.description}`.toLowerCase().split(/\s+/)
    return words.some((w) => {
      if (w.length <= 2) return false
      if (prompt.includes(w)) return true
      const syns = SKILL_SYNONYMS[w]
      if (syns) return syns.some((syn) => prompt.includes(syn))
      return false
    })
  })

  if (relevant.length === 0) return ''
  const lines = relevant.map((s) => `[${s.tag}/${s.name}]: ${s.prompt}`)
  return `\n## Active Skills:\n${lines.join('\n')}\n`
}
