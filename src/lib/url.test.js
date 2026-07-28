import { describe, it, expect } from 'vitest'
import { abbreviateUrl, normalizeUrl } from './url'

describe('abbreviateUrl', () => {
  it('returns the bare hostname for a full URL', () => {
    expect(abbreviateUrl('https://www.tradingview.com/chart/XYZ')).toBe('tradingview.com')
  })

  it('strips www. but keeps other subdomains', () => {
    expect(abbreviateUrl('https://charts.example.com/foo')).toBe('charts.example.com')
  })

  it('adds an implicit https scheme when parsing a bare host', () => {
    expect(abbreviateUrl('tradingview.com/chart/XYZ')).toBe('tradingview.com')
  })

  it('falls back to a truncated raw string for unparseable input', () => {
    const junk = 'not a url at all, just some very long free text notes here'
    expect(abbreviateUrl(junk)).toBe(`${junk.slice(0, 30)}…`)
  })

  it('returns an empty string for empty input', () => {
    expect(abbreviateUrl('')).toBe('')
    expect(abbreviateUrl(null)).toBe('')
    expect(abbreviateUrl(undefined)).toBe('')
  })
})

describe('normalizeUrl', () => {
  it('leaves a URL with a scheme untouched', () => {
    expect(normalizeUrl('https://tradingview.com/x')).toBe('https://tradingview.com/x')
  })

  it('adds https:// to a bare host', () => {
    expect(normalizeUrl('tradingview.com/x')).toBe('https://tradingview.com/x')
  })

  it('returns an empty string for empty input', () => {
    expect(normalizeUrl('')).toBe('')
  })
})
