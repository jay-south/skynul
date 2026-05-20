import type { TaskAction } from '@skynul/shared'
import type { AppBridge } from '../app-bridge'
import { handleAppScript } from './app-script'
import {
  handleClick,
  handleEvaluate,
  handleNavigate,
  handlePressKey,
  handleScroll,
  handleScrollIntoView,
  handleType,
  handleUploadFile
} from './browser'
import {
  handleFileEdit,
  handleFileList,
  handleFileRead,
  handleFileSearch,
  handleFileWrite,
  handleLaunch,
  handleSaveToExcel,
  handleShell,
  handleWait,
  handleWebScrape
} from './code'
import { handleGenerateImage } from './image'
import { handlePolymarketAction } from './polymarket'
import type { ActionContext, BrowserContext, CodeContext } from './types'

export type ActionRouterContext = {
  mode: 'browser' | 'cdp' | 'sandbox'
  base: ActionContext
  browser?: BrowserContext
  code?: CodeContext
  taskId: string
  appBridge: AppBridge
  lastScrapeData: string
  setLastScrapeData: (data: string) => void
}

function requireBrowser(b: BrowserContext | undefined): BrowserContext {
  if (!b) throw new Error('Browser context is not available for this action.')
  return b
}

function requireCode(c: CodeContext | undefined): CodeContext {
  if (!c) throw new Error('Code context is not available for this action.')
  return c
}

export async function routeAction(
  action: TaskAction,
  ctx: ActionRouterContext
): Promise<string | undefined> {
  const type = (action as Record<string, unknown>).type as string

  switch (type) {
    // ── Browser-only ──────────────────────────────────────────────
    case 'navigate':
      return handleNavigate(action, requireBrowser(ctx.browser))
    case 'click':
      return handleClick(action, requireBrowser(ctx.browser))
    case 'type':
      return handleType(action, requireBrowser(ctx.browser))
    case 'pressKey':
      return handlePressKey(action, requireBrowser(ctx.browser))
    case 'key':
      return handlePressKey(action, requireBrowser(ctx.browser))
    case 'evaluate':
      return handleEvaluate(action, requireBrowser(ctx.browser))
    case 'upload_file':
      return handleUploadFile(action, requireBrowser(ctx.browser))
    case 'scroll':
      return handleScroll(action, requireBrowser(ctx.browser))
    case 'scrollIntoView':
      return handleScrollIntoView(action, requireBrowser(ctx.browser))
    case 'screenshot':
      return '[BLOCKED] screenshot action is disabled — use the page snapshot text instead.'

    // ── Code-only ─────────────────────────────────────────────────
    case 'shell':
      return handleShell(action, requireCode(ctx.code))
    case 'web_scrape': {
      const data = await handleWebScrape(action)
      ctx.setLastScrapeData(ctx.lastScrapeData + (ctx.lastScrapeData ? '\n' : '') + data)
      return data
    }
    case 'save_to_excel':
      return handleSaveToExcel(action, requireCode(ctx.code))
    case 'launch':
      return handleLaunch(action, requireCode(ctx.code))
    case 'file_read':
      return handleFileRead(action)
    case 'file_write':
      return handleFileWrite(action)
    case 'file_edit':
      return handleFileEdit(action)
    case 'file_list':
      return handleFileList(action)
    case 'file_search':
      return handleFileSearch(action)

    // ── Cross-cutting ─────────────────────────────────────────────
    case 'app_script':
      return handleAppScript(action, ctx.appBridge)
    case 'wait':
      return handleWait(action)
    case 'generate_image':
      return handleGenerateImage(action, ctx.base)

    // ── Polymarket ────────────────────────────────────────────────
    case 'polymarket_get_account_summary':
    case 'polymarket_get_trader_leaderboard':
    case 'polymarket_search_markets':
    case 'polymarket_place_order':
    case 'polymarket_close_position':
      return handlePolymarketAction(action)

    default:
      if (ctx.mode === 'browser') throw new Error(`Unknown action type: ${action.type}`)
      if (ctx.mode === 'cdp')
        return `[Error: "${action.type}" is not available in API-only mode. Use polymarket_* actions.]`
      return `[Action "${action.type}" not supported in code mode]`
  }
}
