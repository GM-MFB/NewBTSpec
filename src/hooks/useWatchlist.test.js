import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { useWatchlist } from './useWatchlist'
import { supabase } from '../utils/supabase'

vi.mock('../utils/supabase', () => ({ supabase: { from: vi.fn() } }))

function mockFrom({ rows = [], inserted = null }) {
  return {
    select: () => ({
      order: () => Promise.resolve({ data: rows, error: null }),
    }),
    insert: () => ({
      select: () => ({ single: () => Promise.resolve({ data: inserted, error: null }) }),
    }),
    delete: () => ({
      eq: () => Promise.resolve({ error: null }),
    }),
  }
}

describe('useWatchlist', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('loads all entries, not filtered by user', async () => {
    const rows = [
      { id: 'w1', user_id: 'u1', display_name: 'Alice', symbol: 'AAPL', rank: 0, note: null, created_at: '2026-01-01' },
      { id: 'w2', user_id: 'u2', display_name: 'Bob', symbol: 'TSLA', rank: 0, note: null, created_at: '2026-01-02' },
    ]
    supabase.from.mockReturnValue(mockFrom({ rows }))

    const { result } = renderHook(() => useWatchlist('u1'))

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.entries).toHaveLength(2)
    expect(result.current.entries[0].symbol).toBe('AAPL')
  })

  it('addEntry inserts and reloads', async () => {
    supabase.from.mockReturnValue(mockFrom({ rows: [], inserted: { id: 'w3', user_id: 'u1', display_name: 'Alice', symbol: 'MSFT', rank: 0, note: null, created_at: '2026-01-03' } }))

    const { result } = renderHook(() => useWatchlist('u1'))
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => {
      await result.current.addEntry('msft', '', 'Alice')
    })

    expect(supabase.from).toHaveBeenCalledWith('fund_watchlist')
  })

  it('removeEntry deletes and reloads', async () => {
    const rows = [{ id: 'w1', user_id: 'u1', display_name: 'Alice', symbol: 'AAPL', rank: 0, note: null, created_at: '2026-01-01' }]
    supabase.from.mockReturnValue(mockFrom({ rows }))

    const { result } = renderHook(() => useWatchlist('u1'))
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => {
      await result.current.removeEntry('w1')
    })

    expect(supabase.from).toHaveBeenCalledWith('fund_watchlist')
  })
})
