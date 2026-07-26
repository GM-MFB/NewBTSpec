import { describe, it, expect } from 'vitest'
import { pctChange } from './pctChange'

describe('pctChange', () => {
  it('computes percent change between two values', () => {
    expect(pctChange(120, 100)).toBe(20)
    expect(pctChange(80, 100)).toBe(-20)
  })

  it('returns null when either value is null', () => {
    expect(pctChange(null, 100)).toBeNull()
    expect(pctChange(120, null)).toBeNull()
  })

  it('returns null when the previous value is 0 (divide-by-zero guard)', () => {
    expect(pctChange(50, 0)).toBeNull()
  })
})
