import { describe, it, expect } from 'vitest'
import { isWithinDateRange } from './dateRange'

describe('isWithinDateRange', () => {
  it('returns true when both bounds are empty', () => {
    expect(isWithinDateRange('2026-01-10', '', '')).toBe(true)
  })

  it('returns false for a blank date when a bound is set', () => {
    expect(isWithinDateRange('', '2026-01-01', '')).toBe(false)
  })

  it('returns false when the date is before the start bound', () => {
    expect(isWithinDateRange('2026-01-05', '2026-01-10', '')).toBe(false)
  })

  it('returns true when the date is on the start bound', () => {
    expect(isWithinDateRange('2026-01-10', '2026-01-10', '')).toBe(true)
  })

  it('returns false when the date is after the end bound', () => {
    expect(isWithinDateRange('2026-01-20', '', '2026-01-15')).toBe(false)
  })

  it('returns true when the date is on the end bound', () => {
    expect(isWithinDateRange('2026-01-15', '', '2026-01-15')).toBe(true)
  })

  it('returns true when the date is within both bounds', () => {
    expect(isWithinDateRange('2026-01-12', '2026-01-10', '2026-01-15')).toBe(true)
  })
})
