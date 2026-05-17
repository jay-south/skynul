import type { TaskAction } from '@skynul/shared'
import type { BrowserContext, CodeContext, ActionContext } from './types'
import type { InterTaskAPI } from './inter-task'
import type { AppBridge } from '../app-bridge'
import {
  handleNavigate, handleClick, handleType, handlePressKey,
  handleEvaluate, handleUploadFile, handleScroll, handleScrollIntoView
} from './browser'
import { handleShell, handleWait, handleWebScrape, handleSaveToExcel, handleLaunch, handleFileRead, handleFileWrite, handleFileEdit, handleFileList, handleFileSearch } from './code'
import { handlePolymarketAction } from './polymarket'
import { handleInterTaskAction } from './inter-task'
import { handleFactAction } from './fact'
import { handleGenerateImage } from './image'
import { handleSetIdentity } from './identity'
import { handleAppScript } from './app-script'

export type ActionRouterContext = {
  mode: 'browser' | 'cdp' | 'code'
  base: ActionContext
  browser?: BrowserContext
  code?: CodeContext
  interTask: InterTaskAPI
  taskId: string
  appBridge: AppBridge
  lastScrapeData: string
  setLastScrapeData: (data: string) => void
}

export async function routeAction(action: TaskAction, ctx: ActionRouterContext): Promise<string | undefined> {
  const type = (action as Record<string, unknown>).type as string

  switch (type) {
    // ── Browser-only ──────────────────────────────────────────────
    case 'navigate': return handleNavigate(action, ctx.browser!)
    case 'click': return handleClick(action, ctx.browser!)
    case 'type': return handleType(action, ctx.browser!)
    case 'pressKey': return handlePressKey(action, ctx.browser!)
    case 'key': return handlePressKey(action, ctx.browser!)
    case 'evaluate': return handleEvaluate(action, ctx.browser!)
    case 'upload_file': return handleUploadFile(action, ctx.browser!)
    case 'scroll': return handleScroll(action, ctx.browser!)
    case 'scrollIntoView': return handleScrollIntoView(action, ctx.browser!)
    case 'screenshot': return '[BLOCKED] screenshot action is disabled — use the page snapshot text instead.'

    // ── Code-only ─────────────────────────────────────────────────
    case 'shell': return handleShell(action, ctx.code!)
    case 'web_scrape': {
      const data = await handleWebScrape(action)
      ctx.setLastScrapeData(ctx.lastScrapeData + (ctx.lastScrapeData ? '\n' : '') + data)
      return data
    }
    case 'save_to_excel': return handleSaveToExcel(action, ctx.code!)
    case 'launch': return handleLaunch(action, ctx.code!)
    case 'file_read': return handleFileRead(action)
    case 'file_write': return handleFileWrite(action)
    case 'file_edit': return handleFileEdit(action)
    case 'file_list': return handleFileList(action)
    case 'file_search': return handleFileSearch(action)

    // ── Cross-cutting ─────────────────────────────────────────────
    case 'app_script': return handleAppScript(action, ctx.appBridge)
    case 'wait': return handleWait(action)
    case 'remember_fact':
    case 'forget_fact': return handleFactAction(action)
    case 'set_identity': return handleSetIdentity(action, ctx.base)
    case 'generate_image': return handleGenerateImage(action, ctx.base)

    // ── Inter-task ────────────────────────────────────────────────
    case 'task_list_peers':
    case 'task_send':
    case 'task_read':
    case 'task_message': return handleInterTaskAction(action, ctx.interTask, ctx.taskId)

    // ── Polymarket ────────────────────────────────────────────────
    case 'polymarket_get_account_summary':
    case 'polymarket_get_trader_leaderboard':
    case 'polymarket_search_markets':
    case 'polymarket_place_order':
    case 'polymarket_close_position': return handlePolymarketAction(action)

    default:
      if (ctx.mode === 'browser') throw new Error(`Unknown action type: ${action.type}`)
      if (ctx.mode === 'cdp') return `[Error: "${action.type}" is not available in API-only mode. Use polymarket_* actions.]`
      return `[Action "${action.type}" not supported in code mode]`
  }
}
