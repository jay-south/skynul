import type { TaskAction } from '@skynul/shared'
import { generateImage } from '../../providers/image-gen'
import type { ActionContext } from './types'

const $ = (a: TaskAction): Record<string, unknown> => a as unknown as Record<string, unknown>

export async function handleGenerateImage(action: TaskAction, ctx: ActionContext): Promise<string> {
  const raw = $(action)
  const prompt = String(raw.prompt ?? '')
  if (!prompt) return 'generate_image requires a prompt'
  const size = (raw.size as '1024x1024' | '1792x1024' | '1024x1792') ?? '1024x1024'
  const filePath = await generateImage(prompt, size)
  if (!ctx.task.attachments) ctx.task.attachments = []
  ctx.task.attachments.push(filePath)
  ctx.pushUpdate()
  return `Image generated and saved to: ${filePath}`
}
