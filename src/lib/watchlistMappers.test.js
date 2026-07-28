import { describe, it, expect } from 'vitest'
import { fromRow, toRow } from './watchlistMappers'

describe('watchlistMappers', () => {
  it('fromRow maps snake_case DB columns to camelCase', () => {
    const row = {
      id: 'w1', user_id: 'u1', display_name: 'Alice', symbol: 'AAPL',
      rank: 0, note: 'strong earnings', created_at: '2026-01-01T00:00:00Z',
    }
    expect(fromRow(row)).toEqual({
      id: 'w1', userId: 'u1', displayName: 'Alice', symbol: 'AAPL',
      note: 'strong earnings', createdAt: '2026-01-01T00:00:00Z',
    })
  })

  it('toRow maps a new entry to snake_case columns with rank always 0', () => {
    expect(toRow({ userId: 'u1', displayName: 'Alice', symbol: 'aapl', note: 'watching' })).toEqual({
      user_id: 'u1', display_name: 'Alice', symbol: 'AAPL', note: 'watching', rank: 0,
    })
  })

  it('toRow defaults a blank note to null', () => {
    expect(toRow({ userId: 'u1', displayName: 'Alice', symbol: 'AAPL', note: '' })).toEqual({
      user_id: 'u1', display_name: 'Alice', symbol: 'AAPL', note: null, rank: 0,
    })
  })
})
