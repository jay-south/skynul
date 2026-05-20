import type { TaskAction } from '@skynul/shared'
import type { AppBridge } from '../app-bridge'

export async function handleAppScript(
  action: TaskAction,
  bridge: AppBridge
): Promise<string | undefined> {
  const raw = action as Record<string, unknown>
  const script = raw.script
  if (typeof raw.app !== 'string' || typeof script !== 'string') {
    return '[AppBridge error: app and script must be strings]'
  }
  const appName = bridge.getSupportedApps().find((n) => n === raw.app)
  if (!appName) return `[AppBridge error: unknown app ${raw.app}]`
  const result = await bridge.run(appName, script)
  return result.ok ? result.output : `[AppBridge error: ${result.error}]`
}
