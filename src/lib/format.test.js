import { describe, it, expect } from 'vitest'
import { formatCurrency } from './format'

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
