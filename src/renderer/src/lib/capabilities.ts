import type { TaskCapabilityId } from '@skynul/shared'

const BROWSER_WORDS = ['browser', 'webpage', 'website', 'scrape', 'navigate', 'url', 'search', 'google']
const APP_WORDS = ['launch', 'whatsapp', 'telegram', 'discord', 'slack', 'spotify']
const CODE_WORDS = ['command', 'script', 'headless', 'fetch', 'curl', 'code', 'git', 'build', 'deploy']

export function detectCapabilities(prompt: string): TaskCapabilityId[] {
  const lower = prompt.toLowerCase()
  const detected = new Set<TaskCapabilityId>()

  if (BROWSER_WORDS.some((w) => lower.includes(w))) detected.add('browser.cdp')
  if (APP_WORDS.some((w) => lower.includes(w))) detected.add('app.launch')

  if (detected.size === 0) detected.add('browser.cdp')

  return [...detected]
}

export function detectMode(prompt: string): 'browser' | 'code' {
  if (CODE_WORDS.some((w) => prompt.toLowerCase().includes(w))) return 'code'
  return 'browser'
}
