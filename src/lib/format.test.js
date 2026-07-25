import { describe, it, expect } from 'vitest'
import { formatCurrency, formatCurrencyWhole } from './format'

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
