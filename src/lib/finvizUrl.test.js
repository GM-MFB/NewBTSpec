import { describe, it, expect } from 'vitest'
import { buildFinvizUrl } from './finvizUrl'

describe('buildFinvizUrl', () => {
  it('returns the bare screener URL when no filters are set', () => {
    expect(buildFinvizUrl({})).toBe('https://finviz.com/screener.ashx')
  })

  it('returns the bare screener URL when all filter values are empty strings', () => {
    expect(buildFinvizUrl({ price: '', marketCap: '' })).toBe('https://finviz.com/screener.ashx')
  })

  it('appends a single filter code as the f= param', () => {
    expect(buildFinvizUrl({ price: 'sh_price_u10' })).toBe('https://finviz.com/screener.ashx?f=sh_price_u10')
  })

  it('joins multiple filter codes with commas, dropping empty ones', () => {
    const filters = { price: 'sh_price_u10', marketCap: '', pe: 'fa_pe_u15' }
    expect(buildFinvizUrl(filters)).toBe('https://finviz.com/screener.ashx?f=sh_price_u10,fa_pe_u15')
  })
})
