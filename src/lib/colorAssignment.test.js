import { describe, it, expect } from 'vitest'
import { assignColors } from './colorAssignment'

describe('assignColors', () => {
  it('assigns a color to each unique key in order of first appearance', () => {
    const result = assignColors(['AAPL', 'TSLA', 'MSFT'])
    expect(Object.keys(result)).toEqual(['AAPL', 'TSLA', 'MSFT'])
    expect(new Set(Object.values(result)).size).toBe(3)
  })

  it('gives the same key the same color even if it repeats', () => {
    const result = assignColors(['AAPL', 'AAPL', 'TSLA'])
    expect(Object.keys(result)).toEqual(['AAPL', 'TSLA'])
  })

  it('cycles through the palette when there are more keys than colors', () => {
    const keys = Array.from({ length: 10 }, (_, i) => `SYM${i}`)
    const result = assignColors(keys)
    expect(result.SYM0).toBe(result.SYM8)
  })

  it('returns an empty object for no keys', () => {
    expect(assignColors([])).toEqual({})
  })
})
