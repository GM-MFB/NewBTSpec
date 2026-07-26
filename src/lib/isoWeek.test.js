import { describe, it, expect } from 'vitest'
import { weekRangeFromValue, currentWeekValue, isDateInRange } from './isoWeek'

describe('weekRangeFromValue', () => {
  it('returns Monday-Sunday for a mid-year ISO week', () => {
    const { start, end } = weekRangeFromValue('2026-W05')
    expect(start.toISOString().slice(0, 10)).toBe('2026-01-26')
    expect(end.toISOString().slice(0, 10)).toBe('2026-02-01')
  })
})

describe('currentWeekValue', () => {
  it('returns a value in YYYY-Www format', () => {
    expect(currentWeekValue()).toMatch(/^\d{4}-W\d{2}$/)
  })
})

describe('isDateInRange', () => {
  it('returns true for a date within the range', () => {
    const { start, end } = weekRangeFromValue('2026-W05')
    expect(isDateInRange('2026-01-28', start, end)).toBe(true)
  })

  it('returns false for a date outside the range', () => {
    const { start, end } = weekRangeFromValue('2026-W05')
    expect(isDateInRange('2026-02-10', start, end)).toBe(false)
  })

  it('returns false for a blank date', () => {
    const { start, end } = weekRangeFromValue('2026-W05')
    expect(isDateInRange('', start, end)).toBe(false)
  })
})
