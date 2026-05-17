import type { TaskAction } from '@skynul/shared'
import type { AppBridge } from '../app-bridge'

export async function handleAppScript(action: TaskAction, bridge: AppBridge): Promise<string | undefined> {
  const raw = action as Record<string, unknown>
  const result = await bridge.run(raw.app as any, raw.script as string)
  return result.ok ? result.output : `[AppBridge error: ${result.error}]`
}
