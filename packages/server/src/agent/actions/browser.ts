import type { TaskAction } from '@skynul/shared'
import type { BrowserContext } from './types'

const IMAGE_GEN_SITES = [
  { domains: ['pollinations.ai'] },
  { domains: ['bing.com/images/create', 'bing.com/create'] },
  { domains: ['craiyon.com'] },
  { domains: ['nightcafe.studio'] },
  { domains: ['leonardo.ai'] },
  { domains: ['ideogram.ai'] },
  { domains: ['adobe.com/firefly'] },
  { domains: ['dream.ai'] }
]

export async function handleNavigate(
  action: TaskAction,
  ctx: BrowserContext
): Promise<string | undefined> {
  const url = String((action as Record<string, unknown>).url ?? '')
  const isImgSite = IMAGE_GEN_SITES.some((s) => s.domains.some((d) => url.includes(d)))
  if (isImgSite) {
    const promptLower = ctx.task.prompt.toLowerCase()
    // If the prompt doesn't explicitly mention this site, block it
    const matchedSite = IMAGE_GEN_SITES.find((s) => s.domains.some((d) => url.includes(d)))
    if (matchedSite) {
      const isExplicit =
        promptLower.includes('bing') ||
        promptLower.includes('image') ||
        promptLower.includes('create')
      if (!isExplicit) {
        return `[BLOCKED] Do not navigate to image generation websites. Use the generate_image action instead: {"type":"generate_image","prompt":"..."}`
      }
    }
  }
  await ctx.engine.navigate(url)
  return undefined
}

export async function handleClick(
  action: TaskAction,
  ctx: BrowserContext
): Promise<string | undefined> {
  await ctx.engine.click(
    (action as Record<string, unknown>).selector as string,
    (action as Record<string, unknown>).frameId as string | undefined
  )
  return undefined
}

export async function handleType(
  action: TaskAction,
  ctx: BrowserContext
): Promise<string | undefined> {
  const raw = action as Record<string, unknown>
  await ctx.engine.type(
    raw.selector as string,
    raw.text as string,
    raw.frameId as string | undefined
  )
  return undefined
}

export async function handlePressKey(
  action: TaskAction,
  ctx: BrowserContext
): Promise<string | undefined> {
  await ctx.engine.pressKey((action as Record<string, unknown>).key as string)
  return undefined
}

export async function handleEvaluate(
  action: TaskAction,
  ctx: BrowserContext
): Promise<string | undefined> {
  const result = await ctx.engine.evaluate(
    (action as Record<string, unknown>).script as string,
    (action as Record<string, unknown>).frameId as string | undefined
  )
  return result || undefined
}

export async function handleUploadFile(
  action: TaskAction,
  ctx: BrowserContext
): Promise<string | undefined> {
  const raw = action as Record<string, unknown>
  const selector = raw.selector as string
  const filePaths = raw.filePaths as string[]
  if (!selector || !Array.isArray(filePaths) || filePaths.length === 0) {
    throw new Error('upload_file requires selector + filePaths[]')
  }
  await ctx.engine.uploadFile(selector, filePaths, raw.frameId as string | undefined)
  return undefined
}

export async function handleScroll(
  action: TaskAction,
  ctx: BrowserContext
): Promise<string | undefined> {
  const dir = (action as Record<string, unknown>).direction as string
  await ctx.engine.evaluate(`window.scrollBy(0, ${dir === 'up' ? -400 : 400})`)
  return undefined
}

export async function handleScrollIntoView(
  action: TaskAction,
  ctx: BrowserContext
): Promise<string | undefined> {
  const raw = action as Record<string, unknown>
  const sel = (raw.selector as string).replace(/'/g, "\\'")
  await ctx.engine.evaluate(
    `document.querySelector('${sel}')?.scrollIntoView({block:'center',behavior:'instant'})`,
    raw.frameId as string | undefined
  )
  return undefined
}
