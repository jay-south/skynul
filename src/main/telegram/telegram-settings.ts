import { readFile, writeFile, mkdir } from 'fs/promises'
import { join, dirname } from 'path'
import { app } from 'electron'

export type TelegramSettings = {
  enabled: boolean
  pairedChatId: number | null
  pairingCode: string | null
}

const DEFAULT_SETTINGS: TelegramSettings = {
  enabled: false,
  pairedChatId: null,
  pairingCode: null
}

function settingsPath(): string {
  return join(app.getPath('userData'), 'telegram.json')
}

export async function loadTelegramSettings(): Promise<TelegramSettings> {
  try {
    const raw = await readFile(settingsPath(), 'utf8')
    const parsed = JSON.parse(raw) as Partial<TelegramSettings>
    return { ...DEFAULT_SETTINGS, ...parsed }
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

export async function saveTelegramSettings(settings: TelegramSettings): Promise<void> {
  const file = settingsPath()
  await mkdir(dirname(file), { recursive: true })
  await writeFile(file, JSON.stringify(settings, null, 2), 'utf8')
}
