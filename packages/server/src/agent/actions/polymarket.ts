import type { TaskAction } from '@skynul/shared'

// Polymarket actions. The underlying client runs in paper mode by default.
// Live trading requires env vars (POLYMARKET_PRIVATE_KEY, etc.) and the
// @polymarket/clob-client + ethers packages.

const $ = (a: TaskAction): Record<string, unknown> => a as unknown as Record<string, unknown>

export async function handlePolymarketAction(action: TaskAction): Promise<string> {
  const raw = $(action)
  const type = raw.type as string

  switch (type) {
    case 'polymarket_get_account_summary': {
      const { PolymarketClient } = await import('../tools/polymarket')
      const client = new PolymarketClient({ mode: 'paper' })
      const summary = await client.getAccountSummary()
      return `Balance: $${summary.balanceUsd.toFixed(2)}, ${summary.positions.length} positions.`
    }
    case 'polymarket_get_trader_leaderboard': {
      return 'Leaderboard data requires live mode with @polymarket/clob-client installed.'
    }
    case 'polymarket_search_markets': {
      return 'Market search requires live mode with @polymarket/clob-client installed.'
    }
    case 'polymarket_place_order': {
      return 'Live trading not available in sidecar mode. Use the desktop app to trade.'
    }
    case 'polymarket_close_position': {
      return 'Live trading not available in sidecar mode. Use the desktop app to trade.'
    }
    default:
      return ''
  }
}
