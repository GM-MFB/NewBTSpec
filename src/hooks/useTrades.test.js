import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { useTrades } from './useTrades'
import { supabase } from '../utils/supabase'

vi.mock('../utils/supabase', () => ({ supabase: { from: vi.fn() } }))

function mockSelectChain(data) {
  const order = vi.fn().mockResolvedValue({ data, error: null })
  const eq2 = vi.fn(() => ({ order }))
  const eq1 = vi.fn(() => ({ eq: eq2 }))
  return { select: vi.fn(() => ({ eq: eq1 })) }
}

describe('useTrades', () => {
  beforeEach(() => vi.clearAllMocks())

  it('loads only open trades for the account, mapped to camelCase', async () => {
    const rows = [{
      id: 't1', account_id: 'a1', user_id: 'u1', created_at: '2026-01-01',
      type: 'futures', symbol: 'ES', option_type: null, strike: null,
      expiry: null, direction: 'long', quantity: 1, entry_price: 4500,
      exit_price: null, entry_date: '2026-01-01', exit_date: null,
      status: 'open', fees: 0, notes: null, chart_link: null,
    }]
    supabase.from.mockReturnValue(mockSelectChain(rows))

    const { result } = renderHook(() => useTrades('a1'))

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.trades).toHaveLength(1)
    expect(result.current.trades[0].symbol).toBe('ES')
    expect(result.current.trades[0].entryPrice).toBe(4500)
    expect(supabase.from).toHaveBeenCalledWith('trades')
  })

  it('addTrade inserts a row with status open and refreshes the list', async () => {
    supabase.from.mockReturnValue(mockSelectChain([]))
    const { result } = renderHook(() => useTrades('a1'))
    await waitFor(() => expect(result.current.loading).toBe(false))

    const insertedRow = {
      id: 't2', account_id: 'a1', user_id: 'u1', created_at: '2026-01-02',
      type: 'futures', symbol: 'NQ', option_type: null, strike: null,
      expiry: null, direction: 'long', quantity: 1, entry_price: 15000,
      exit_price: null, entry_date: '2026-01-02', exit_date: null,
      status: 'open', fees: 0, notes: null, chart_link: null,
    }
    const single = vi.fn().mockResolvedValue({ data: insertedRow, error: null })
    const select = vi.fn(() => ({ single }))
    const insert = vi.fn(() => ({ select }))
    supabase.from.mockReturnValue({ ...mockSelectChain([insertedRow]), insert })

    await act(async () => {
      await result.current.addTrade({
        type: 'futures', symbol: 'NQ', direction: 'long', quantity: 1,
        entryPrice: 15000, entryDate: '2026-01-02', status: 'open',
      }, 'u1')
    })

    expect(insert).toHaveBeenCalled()
    const insertArg = insert.mock.calls[0][0]
    expect(insertArg.account_id).toBe('a1')
    expect(insertArg.user_id).toBe('u1')
    expect(insertArg.symbol).toBe('NQ')
  })

  it('closeTrade preserves existing fields not included in the close payload', async () => {
    const rows = [{
      id: 't1', account_id: 'a1', user_id: 'u1', created_at: '2026-01-01',
      type: 'futures', symbol: 'ES', option_type: null, strike: null,
      expiry: null, direction: 'long', quantity: 1, entry_price: 4500,
      exit_price: null, entry_date: '2026-01-01', exit_date: null,
      status: 'open', fees: 0, notes: null, chart_link: null,
    }]
    const update = vi.fn(() => ({ eq: vi.fn().mockResolvedValue({ error: null }) }))
    supabase.from.mockReturnValue({ ...mockSelectChain(rows), update })

    const { result } = renderHook(() => useTrades('a1'))
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => {
      await result.current.closeTrade('t1', { exitPrice: '4600', exitDate: '2026-01-05' })
    })

    const updateArg = update.mock.calls[0][0]
    expect(updateArg.symbol).toBe('ES')
    expect(updateArg.quantity).toBe(1)
    expect(updateArg.status).toBe('closed')
    expect(updateArg.exit_price).toBe('4600')
  })
})
