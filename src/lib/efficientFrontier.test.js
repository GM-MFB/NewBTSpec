import { describe, it, expect } from 'vitest'
import { getAssetParams, getCorrelation, setRealCorrelations, setComputedParams, getCorrVersion } from './efficientFrontier'

describe('getAssetParams', () => {
  it('returns the static table entry for a known ticker', () => {
    const params = getAssetParams('AAPL')
    expect(params.r).toBe(0.15)
    expect(params.s).toBe(0.27)
    expect(params.cat).toBe('tech')
  })

  it('returns the default for an unknown ticker', () => {
    const params = getAssetParams('ZZZZ')
    expect(params).toEqual({ r: 0.12, s: 0.28, cat: 'other' })
  })

  it('overrides r/s with computed params while keeping the static category', () => {
    setComputedParams({ AAPL: { r: 0.20, s: 0.30 } })
    const params = getAssetParams('AAPL')
    expect(params.r).toBe(0.20)
    expect(params.s).toBe(0.30)
    expect(params.cat).toBe('tech')
  })
})

describe('getCorrelation', () => {
  it('returns 1 for identical symbols', () => {
    expect(getCorrelation('AAPL', 'AAPL')).toBe(1)
  })

  it('returns 0 when either symbol is CASH', () => {
    expect(getCorrelation('AAPL', 'CASH')).toBe(0)
    expect(getCorrelation('CASH', 'AAPL')).toBe(0)
  })

  it('prefers a real correlation override when present', () => {
    setRealCorrelations({ AAPL: { MSFT: 0.99 } })
    expect(getCorrelation('AAPL', 'MSFT')).toBe(0.99)
    expect(getCorrelation('MSFT', 'AAPL')).toBe(0.99)
  })

  it('falls back to the category table when no real correlation exists', () => {
    expect(getCorrelation('AAPL', 'NVDA')).toBe(0.65)
  })

  it('defaults to 0.50 for an unknown category pair', () => {
    expect(getCorrelation('ZZZZ1', 'ZZZZ2')).toBe(0.50)
  })

  it('bumps corrVersion when setRealCorrelations or setComputedParams is called', () => {
    const before = getCorrVersion()
    setRealCorrelations({ AAPL: { QQQ: 0.5 } })
    expect(getCorrVersion()).toBe(before + 1)
    setComputedParams({ AAPL: { r: 0.1, s: 0.2 } })
    expect(getCorrVersion()).toBe(before + 2)
  })
})
