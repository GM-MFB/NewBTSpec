import { describe, it, expect } from 'vitest'
import { formatCurrency, formatCurrencyWhole, formatCurrencyAuto, formatLarge, formatDecimal, formatCompactCurrency, formatAxisCurrency } from './format'

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

describe('formatDecimal', () => {
  it('rounds to exactly 2 decimal places', () => {
    expect(formatDecimal(28.456789)).toBe('28.46')
  })

  it('pads a whole number with two zero decimals', () => {
    expect(formatDecimal(28)).toBe('28.00')
  })

  it('rounds a value that already has fewer than 2 decimals', () => {
    expect(formatDecimal(1.2)).toBe('1.20')
  })

  it('returns blank for blank/undefined/null/NaN input', () => {
    expect(formatDecimal('')).toBe('')
    expect(formatDecimal(undefined)).toBe('')
    expect(formatDecimal(null)).toBe('')
    expect(formatDecimal('abc')).toBe('')
  })
})

describe('formatCompactCurrency', () => {
  it('abbreviates thousands with one decimal', () => {
    expect(formatCompactCurrency(1205)).toBe('+1.2k')
    expect(formatCompactCurrency(-1460)).toBe('-1.5k')
  })

  it('abbreviates millions with one decimal', () => {
    expect(formatCompactCurrency(1250000)).toBe('+1.3M')
  })

  it('leaves values under a thousand whole, with an explicit sign', () => {
    expect(formatCompactCurrency(45)).toBe('+45')
    expect(formatCompactCurrency(-320)).toBe('-320')
    expect(formatCompactCurrency(-45.6)).toBe('-46')
  })

  it('renders exactly zero without a sign', () => {
    expect(formatCompactCurrency(0)).toBe('0')
  })

  it('returns blank for blank/undefined/null/NaN input', () => {
    expect(formatCompactCurrency('')).toBe('')
    expect(formatCompactCurrency(undefined)).toBe('')
    expect(formatCompactCurrency(null)).toBe('')
    expect(formatCompactCurrency('abc')).toBe('')
  })
})

describe('formatAxisCurrency', () => {
  it('abbreviates like the compact form but without a plus, per axis convention', () => {
    expect(formatAxisCurrency(1205)).toBe('1.2k')
    expect(formatAxisCurrency(-1460)).toBe('-1.5k')
    expect(formatAxisCurrency(1250000)).toBe('1.3M')
    expect(formatAxisCurrency(45)).toBe('45')
    expect(formatAxisCurrency(-320)).toBe('-320')
  })

  it('renders zero plainly', () => {
    expect(formatAxisCurrency(0)).toBe('0')
  })

  it('returns blank for blank/undefined/null/NaN input', () => {
    expect(formatAxisCurrency('')).toBe('')
    expect(formatAxisCurrency(null)).toBe('')
    expect(formatAxisCurrency('abc')).toBe('')
  })
})
