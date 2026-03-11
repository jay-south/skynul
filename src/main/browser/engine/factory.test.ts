import { describe, expect, it, vi } from 'vitest'

vi.mock('./playwright-engine', () => ({
  acquirePlaywrightBrowserEngine: vi.fn()
}))

describe('acquireBrowserEngine', () => {
  it('defaults to the Playwright adapter', async () => {
    vi.resetModules()
    vi.clearAllMocks()
    process.env.SKYNUL_BROWSER_ENGINE = ''

    const { acquirePlaywrightBrowserEngine } = await import('./playwright-engine')
    const mockedAcquire = vi.mocked(acquirePlaywrightBrowserEngine)
    mockedAcquire.mockResolvedValue({
      engineId: 'playwright',
      engine: {
        snapshot: async () => ({ url: '', title: '', snapshot: '' }),
        navigate: async () => {},
        click: async () => {},
        type: async () => {},
        pressKey: async () => {},
        evaluate: async () => '',
        uploadFile: async () => {},
        screenshot: async () => '',
        getPageInfo: async () => ({ url: '', title: '' })
      },
      release: async () => {}
    })

    const { acquireBrowserEngine } = await import('./factory')
    const acquired = await acquireBrowserEngine()

    expect(acquirePlaywrightBrowserEngine).toHaveBeenCalledTimes(1)
    expect(acquired.engineId).toBe('playwright')
  })

  it('warns and falls back on unknown engine IDs', async () => {
    vi.resetModules()
    vi.clearAllMocks()
    process.env.SKYNUL_BROWSER_ENGINE = 'does-not-exist'

    const { acquirePlaywrightBrowserEngine } = await import('./playwright-engine')
    const mockedAcquire = vi.mocked(acquirePlaywrightBrowserEngine)
    mockedAcquire.mockResolvedValue({
      engineId: 'playwright',
      engine: {
        snapshot: async () => ({ url: '', title: '', snapshot: '' }),
        navigate: async () => {},
        click: async () => {},
        type: async () => {},
        pressKey: async () => {},
        evaluate: async () => '',
        uploadFile: async () => {},
        screenshot: async () => '',
        getPageInfo: async () => ({ url: '', title: '' })
      },
      release: async () => {}
    })

    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { acquireBrowserEngine } = await import('./factory')
    await acquireBrowserEngine()

    expect(warn).toHaveBeenCalledTimes(1)
    expect(acquirePlaywrightBrowserEngine).toHaveBeenCalledTimes(1)

    warn.mockRestore()
  })
})
