import { app } from 'electron'
import { mkdir, readFile, writeFile } from 'fs/promises'
import { dirname, join } from 'path'
import { DEFAULT_POLICY, type ProviderId, PolicyState } from '../shared/policy'

const POLICY_FILE = 'policy.json'

function policyPath(): string {
  return join(app.getPath('userData'), POLICY_FILE)
}

export async function loadPolicy(): Promise<PolicyState> {
  try {
    const raw = await readFile(policyPath(), 'utf8')
    const parsed = JSON.parse(raw) as PolicyState
    // Migrate old 'openai' provider to 'chatgpt'
    let activeProvider = (parsed.provider?.active ?? DEFAULT_POLICY.provider.active) as string
    if (activeProvider === 'openai') activeProvider = 'chatgpt'

    return {
      workspaceRoot: parsed.workspaceRoot ?? null,
      capabilities: {
        ...DEFAULT_POLICY.capabilities,
        ...(parsed.capabilities ?? {})
      },
      themeMode: parsed.themeMode ?? DEFAULT_POLICY.themeMode,
      language: parsed.language ?? DEFAULT_POLICY.language,
      provider: {
        active: activeProvider as ProviderId,
        openaiModel: parsed.provider?.openaiModel ?? DEFAULT_POLICY.provider.openaiModel
      }
    }
  } catch {
    return DEFAULT_POLICY
  }
}

export async function savePolicy(next: PolicyState): Promise<void> {
  const file = policyPath()
  await mkdir(dirname(file), { recursive: true })
  await writeFile(file, JSON.stringify(next, null, 2) + '\n', 'utf8')
}
