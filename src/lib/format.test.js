import { describe, it, expect } from 'vitest'
import { formatCurrency, formatCurrencyWhole, formatCurrencyAuto, formatLarge } from './format'

describe('formatCurrency', () => {
  it('formats a whole number as USD with two decimals', () => {
    expect(formatCurrency(76000)).toBe('$76,000.00')
  })

  it('formats a decimal number as USD', () => {
    expect(formatCurrency(3.5)).toBe('$3.50')
  })

  it('returns an empty string for blank/undefined/null/NaN input', () => {
    expect(formatCurrency('')).toBe('')
    expect(formatCurrency(undefined)).toBe('')
    expect(formatCurrency(null)).toBe('')
    expect(formatCurrency('abc')).toBe('')
  })
})

describe('formatCurrencyWhole', () => {
  it('formats a number as USD with no decimal points', () => {
    expect(formatCurrencyWhole(76000)).toBe('$76,000')
  })

  it('rounds a decimal number to the nearest whole dollar', () => {
    expect(formatCurrencyWhole(120.4)).toBe('$120')
  })

  it('returns an empty string for blank/undefined/null/NaN input', () => {
    expect(formatCurrencyWhole('')).toBe('')
    expect(formatCurrencyWhole(undefined)).toBe('')
  })
})

describe('formatCurrencyAuto', () => {
  it('omits decimals for a whole number', () => {
    expect(formatCurrencyAuto(36)).toBe('$36')
  })

  it('keeps decimals when the value has them', () => {
    expect(formatCurrencyAuto(36.5)).toBe('$36.5')
  })

  it('returns an empty string for blank/undefined/null/NaN input', () => {
    expect(formatCurrencyAuto('')).toBe('')
    expect(formatCurrencyAuto(undefined)).toBe('')
  })
})

describe('formatLarge', () => {
  it('formats trillions with a T suffix', () => {
    expect(formatLarge(2_400_000_000_000)).toBe('$2.40T')
  })

  it('formats billions with a B suffix', () => {
    expect(formatLarge(850_000_000)).toBe('$850.00M')
  })

  it('formats millions with an M suffix', () => {
    expect(formatLarge(4_200_000)).toBe('$4.20M')
  })

  it('formats sub-million values as plain currency', () => {
    expect(formatLarge(4200)).toBe('$4,200.00')
  })

  it('returns blank for blank input', () => {
    expect(formatLarge('')).toBe('')
  })
})
