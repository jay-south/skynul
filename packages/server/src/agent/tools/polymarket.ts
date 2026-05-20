export type PolymarketPosition = {
  marketId: string
  marketTitle: string
  outcome: string
  sizeShares: number
  avgPriceUsd: number
  pnlUsd: number
}

export type PolymarketAccountSummary = {
  balanceUsd: number
  positions: PolymarketPosition[]
}

export type PolymarketTrader = {
  rank: number
  userName: string
  wallet: string
  pnlUsd: number
  volumeUsd: number
}

export type PolymarketTradingMode = 'paper' | 'live'

export type PolymarketClientOpts = {
  mode?: PolymarketTradingMode
}

function getEnv(key: string): string | undefined {
  return process.env[key]
}

export class PolymarketClient {
  private readonly mode: PolymarketTradingMode

  constructor(opts: PolymarketClientOpts = {}) {
    this.mode = opts.mode ?? 'paper'
  }

  async getAccountSummary(): Promise<PolymarketAccountSummary> {
    if (this.mode === 'paper') {
      return { balanceUsd: 0, positions: [] }
    }

    const funder = getEnv('POLYMARKET_FUNDER_ADDRESS')
    if (!funder) throw new Error('POLYMARKET_FUNDER_ADDRESS is not set.')

    // ... rest of live implementation
    return { balanceUsd: 0, positions: [] }
  }
}
