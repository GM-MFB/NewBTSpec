import { describe, it, expect } from 'vitest'
import { buildLeaderboard } from './watchlistLeaderboard'

describe('buildLeaderboard', () => {
  it('groups entries by symbol and counts distinct users', () => {
    const entries = [
      { userId: 'u1', displayName: 'Alice', symbol: 'AAPL' },
      { userId: 'u2', displayName: 'Bob', symbol: 'AAPL' },
      { userId: 'u1', displayName: 'Alice', symbol: 'TSLA' },
    ]
    const result = buildLeaderboard(entries)
    expect(result[0]).toEqual({ symbol: 'AAPL', count: 2, people: ['Alice', 'Bob'] })
    expect(result[1]).toEqual({ symbol: 'TSLA', count: 1, people: ['Alice'] })
  })

  it('counts a user once per symbol even with duplicate rows', () => {
    const entries = [
      { userId: 'u1', displayName: 'Alice', symbol: 'AAPL' },
      { userId: 'u1', displayName: 'Alice', symbol: 'AAPL' },
    ]
    const result = buildLeaderboard(entries)
    expect(result).toEqual([{ symbol: 'AAPL', count: 1, people: ['Alice'] }])
  })

  it('sorts by count descending, then symbol alphabetically as a tiebreak', () => {
    const entries = [
      { userId: 'u1', displayName: 'Alice', symbol: 'TSLA' },
      { userId: 'u1', displayName: 'Alice', symbol: 'AAPL' },
      { userId: 'u2', displayName: 'Bob', symbol: 'MSFT' },
      { userId: 'u3', displayName: 'Carol', symbol: 'MSFT' },
    ]
    const result = buildLeaderboard(entries)
    expect(result.map((r) => r.symbol)).toEqual(['MSFT', 'AAPL', 'TSLA'])
  })

  it('returns an empty array for no entries', () => {
    expect(buildLeaderboard([])).toEqual([])
  })
})
