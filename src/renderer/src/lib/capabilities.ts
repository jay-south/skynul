import type { TaskCapabilityId, TaskMode } from '@skynul/shared'
import { DEFAULT_CAPABILITIES } from '@skynul/shared'

const BROWSER_WORDS = [
  'browser',
  'webpage',
  'website',
  'scrape',
  'navigate',
  'url',
  'search',
  'google',
  'click',
  'type',
  'login'
]
const SANDBOX_WORDS = [
  'command',
  'script',
  'headless',
  'fetch',
  'curl',
  'code',
  'git',
  'build',
  'deploy',
  'shell',
  'terminal',
  'run'
]

export function detectMode(prompt: string): TaskMode {
  const lower = prompt.toLowerCase()
  if (SANDBOX_WORDS.some((w) => lower.includes(w))) return 'sandbox'
  if (BROWSER_WORDS.some((w) => lower.includes(w))) return 'browser'
  return 'browser'
}

export function getDefaultCapabilities(mode: TaskMode): TaskCapabilityId[] {
  return DEFAULT_CAPABILITIES[mode] ?? []
}
