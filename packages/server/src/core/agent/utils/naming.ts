function hash32(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) }
  return h >>> 0
}

const ROLE_PATTERNS: Array<[RegExp, string]> = [
  [/(\bcopy\b|caption|cta|hashtags|post copy|copywriter)/, 'Copy'],
  [/(\bimage\b|imagen|meme|design|visual|thumbnail|banner)/, 'Design'],
  [/(\bbrowser\b|navigate|open\s+x\b|open\s+twitter\b|x\.com|instagram|draft|borrador)/, 'Browser'],
  [/(\bresearch\b|investigate|find\b|lookup|look up|buscar|averigua|averigu[aá])/i, 'Research'],
  [/(\bqa\b|review|verify|checklist|proofread)/, 'QA'],
]

const NAME_POOLS: Record<string, string[]> = {
  manager: ['Atlas', 'Kernel', 'Director', 'Control'],
  browser: ['Orbit', 'Navigator', 'Relay', 'Pilot'],
  copy: ['Quill', 'Copydesk', 'Scribe', 'Draft'],
  design: ['Prism', 'Vector', 'Canvas', 'Studio'],
  research: ['Glyph', 'Index', 'Scout', 'Signal'],
  qa: ['Aegis', 'Verifier', 'Audit', 'Gate'],
  code: ['Forge', 'Compiler', 'Builder', 'Refactor'],
  agent: ['Node', 'Module', 'Echo', 'Nova'],
}

const ROLE_TO_POOL: Record<string, string> = {
  manager: 'manager', orchestrator: 'manager',
  browser: 'browser', navigator: 'browser',
  copy: 'copy', copywriter: 'copy',
  design: 'design', image: 'design', imagen: 'design',
  research: 'research', investigator: 'research',
  qa: 'qa', review: 'qa',
  code: 'code', dev: 'code',
}

export function inferAgentRole(prompt: string): string | undefined {
  for (const [regex, role] of ROLE_PATTERNS) {
    if (regex.test(prompt)) return role
  }
  return undefined
}

export function pickAgentName(role: string, seed: string): string {
  const poolKey = ROLE_TO_POOL[role.trim().toLowerCase()] ?? 'agent'
  const pool = NAME_POOLS[poolKey]!
  return pool[hash32(seed) % pool.length]!
}
