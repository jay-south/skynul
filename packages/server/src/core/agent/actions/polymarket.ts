import type { TaskAction } from '@skynul/shared'
import { PolymarketClient } from '../tools/polymarket'

const client = new PolymarketClient({ mode: 'live' })
const $ = (a: TaskAction): Record<string, unknown> => a as unknown as Record<string, unknown>

export async function handlePolymarketAction(action: TaskAction): Promise<string> {
  const raw = $(action)
  const type = raw.type as string

  switch (type) {
    case 'polymarket_get_account_summary': {
      const summary = await client.getAccountSummary()
      return `Balance: $${summary.balanceUsd.toFixed(2)}, ${summary.positions.length} positions.` +
        (summary.positions.length > 0 ? '\n' + summary.positions.map((p) =>
          `  ${p.marketTitle} [${p.outcome}] ${p.sizeShares} shares @ $${p.avgPriceUsd.toFixed(2)}, PnL $${p.pnlUsd.toFixed(2)}`
        ).join('\n') : '')
    }
    case 'polymarket_get_trader_leaderboard': {
      const traders = await client.getTopTraders({ limit: 10, timePeriod: 'MONTH', category: 'OVERALL' })
      const top = traders.slice(0, 5).map((t) =>
        `#${t.rank} ${t.userName || t.wallet.slice(0, 8)} PnL $${t.pnlUsd.toFixed(2)}`
      ).join('; ')
      return `Leaderboard (MONTH): ${top || 'no traders found'}.`
    }
    case 'polymarket_search_markets': {
      const markets = await client.searchMarkets(raw.query as string, (raw.limit as number) ?? 5)
      if (markets.length === 0) return 'No markets found.'
      return markets.map((m) => {
        const tokens = m.tokens.map((t) => `${t.outcome}: ${t.tokenId} @ $${t.price.toFixed(3)}`).join(', ')
        return `${m.title} | vol: $${m.volume.toFixed(0)} | tokens: [${tokens}]`
      }).join('\n')
    }
    case 'polymarket_place_order': {
      await client.placeOrder({
        tokenId: raw.tokenId as string, side: raw.side as 'buy' | 'sell', price: raw.price as number,
        size: raw.size as number, tickSize: raw.tickSize as string | undefined, negRisk: raw.negRisk as boolean | undefined,
      })
      return `Order placed (GTC): ${raw.side} ${raw.size} @ $${raw.price} on ${(raw.tokenId as string).slice(0, 10)}... — order stays in book until filled.`
    }
    case 'polymarket_close_position': {
      if (!raw.tokenId) return '[Error: tokenId is required. Use polymarket_get_account_summary to find your position tokenId first.]'
      await client.closePosition({ tokenId: raw.tokenId as string, size: raw.size as number | undefined })
      return `Position closed: ${(raw.tokenId as string).slice(0, 10)}... size=${raw.size ?? 'full'}`
    }
    default:
      return ''
  }
}
