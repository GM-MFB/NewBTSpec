import { describe, it, expect } from 'vitest'
import { FILTER_GROUPS } from './finvizFilters'

describe('FILTER_GROUPS', () => {
  it('has at least 18 filter categories', () => {
    expect(FILTER_GROUPS.length).toBeGreaterThanOrEqual(18)
  })

  it('every group has a unique key and starts with an Any option', () => {
    const keys = FILTER_GROUPS.map((g) => g.key)
    expect(new Set(keys).size).toBe(keys.length)
    for (const group of FILTER_GROUPS) {
      expect(group.options[0]).toEqual({ value: '', label: 'Any' })
    }
  })

  it('every non-Any option has a non-empty value and label', () => {
    for (const group of FILTER_GROUPS) {
      for (const opt of group.options.slice(1)) {
        expect(opt.value.length).toBeGreaterThan(0)
        expect(opt.label.length).toBeGreaterThan(0)
      }
    }
  })
})
