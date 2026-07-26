import { describe, it, expect } from 'vitest'
import { KNOWN_ETFS } from './knownEtfs'

describe('KNOWN_ETFS', () => {
  it('includes common ETF tickers', () => {
    expect(KNOWN_ETFS.has('SPY')).toBe(true)
    expect(KNOWN_ETFS.has('QQQ')).toBe(true)
    expect(KNOWN_ETFS.has('GLD')).toBe(true)
  })

  it('does not include ordinary stock tickers', () => {
    expect(KNOWN_ETFS.has('AAPL')).toBe(false)
  })
})
