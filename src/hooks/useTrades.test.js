import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { useTrades } from './useTrades'
import { supabase } from '../utils/supabase'

vi.mock('../utils/supabase', () => ({ supabase: { from: vi.fn() } }))

function mockSelectChain(data) {
  const order = vi.fn().mockResolvedValue({ data, error: null })
  const eq = vi.fn(() => ({ order }))
  return { select: vi.fn(() => ({ eq })) }
}

describe('useTrades', () => {
  beforeEach(() => vi.clearAllMocks())

  it('loads all trades for the account regardless of status, mapped to camelCase', async () => {
    const rows = [{
      id: 't1', account_id: 'a1', user_id: 'u1', created_at: '2026-01-01',
      type: 'futures', symbol: 'ES', option_type: null, strike: null,
      expiry: null, direction: 'long', quantity: 1, entry_price: 4500,
      exit_price: 4550, entry_date: '2026-01-01', exit_date: '2026-01-01',
      status: 'closed', fees: 0, notes: null, chart_link: null, point_value: 50,
    }]
    supabase.from.mockReturnValue(mockSelectChain(rows))

    const { result } = renderHook(() => useTrades('a1'))

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.trades).toHaveLength(1)
    expect(result.current.trades[0].symbol).toBe('ES')
    expect(result.current.trades[0].entryPrice).toBe(4500)
    expect(supabase.from).toHaveBeenCalledWith('trades')
  })

  it('addTrade inserts a row with status closed and the exit fields, then refreshes', async () => {
    supabase.from.mockReturnValue(mockSelectChain([]))
    const { result } = renderHook(() => useTrades('a1'))
    await waitFor(() => expect(result.current.loading).toBe(false))

    const insertedRow = {
      id: 't2', account_id: 'a1', user_id: 'u1', created_at: '2026-01-02',
      type: 'stock', symbol: 'AAPL', option_type: null, strike: null,
      expiry: null, direction: 'long', quantity: 10, entry_price: 100,
      exit_price: 110, entry_date: '2026-01-02', exit_date: '2026-01-02',
      status: 'closed', fees: 0, notes: null, chart_link: null, point_value: null,
    }
    const single = vi.fn().mockResolvedValue({ data: insertedRow, error: null })
    const select = vi.fn(() => ({ single }))
    const insert = vi.fn(() => ({ select }))
    supabase.from.mockReturnValue({ ...mockSelectChain([insertedRow]), insert })

    await act(async () => {
      await result.current.addTrade({
        type: 'stock', symbol: 'AAPL', direction: 'long', quantity: 10,
        entryPrice: 100, entryDate: '2026-01-02', exitPrice: 110, exitDate: '2026-01-02',
      }, 'u1')
    })

    expect(insert).toHaveBeenCalled()
    const insertArg = insert.mock.calls[0][0]
    expect(insertArg.account_id).toBe('a1')
    expect(insertArg.user_id).toBe('u1')
    expect(insertArg.status).toBe('closed')
    expect(insertArg.exit_price).toBe(110)
  })

  it('updateTrade merges the patch over the current trade and writes it', async () => {
    const rows = [{
      id: 't1', account_id: 'a1', user_id: 'u1', created_at: '2026-01-01',
      type: 'stock', symbol: 'AAPL', option_type: null, strike: null,
      expiry: null, direction: 'long', quantity: 10, entry_price: 100,
      exit_price: 110, entry_date: '2026-01-01', exit_date: '2026-01-01',
      status: 'closed', fees: 0, notes: null, chart_link: null, point_value: null,
    }]
    const update = vi.fn(() => ({ eq: vi.fn().mockResolvedValue({ error: null }) }))
    supabase.from.mockReturnValue({ ...mockSelectChain(rows), update })

    const { result } = renderHook(() => useTrades('a1'))
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => {
      await result.current.updateTrade('t1', { exitPrice: 120 })
    })

    const updateArg = update.mock.calls[0][0]
    expect(updateArg.symbol).toBe('AAPL')
    expect(updateArg.exit_price).toBe(120)
  })

  it('deleteTrade removes the row and refreshes', async () => {
    const deleteEq = vi.fn().mockResolvedValue({ error: null })
    const del = vi.fn(() => ({ eq: deleteEq }))
    supabase.from.mockReturnValue({ ...mockSelectChain([]), delete: del })

    const { result } = renderHook(() => useTrades('a1'))
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => {
      await result.current.deleteTrade('t1')
    })

    expect(del).toHaveBeenCalled()
    expect(deleteEq).toHaveBeenCalledWith('id', 't1')
  })

  it('does not expose closeTrade', async () => {
    supabase.from.mockReturnValue(mockSelectChain([]))
    const { result } = renderHook(() => useTrades('a1'))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.closeTrade).toBeUndefined()
  })
})
