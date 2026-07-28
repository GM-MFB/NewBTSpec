import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { useInvestments } from './useInvestments'
import { supabase } from '../utils/supabase'

vi.mock('../utils/supabase', () => ({ supabase: { from: vi.fn() } }))

function mockSelectChain(data) {
  const order = vi.fn().mockResolvedValue({ data, error: null })
  const eq2 = vi.fn(() => ({ order }))
  const eq1 = vi.fn(() => ({ eq: eq2 }))
  return { select: vi.fn(() => ({ eq: eq1 })) }
}

describe('useInvestments', () => {
  beforeEach(() => vi.clearAllMocks())

  it('loads only open investments for the account, mapped to camelCase', async () => {
    const rows = [{
      id: 'i1', account_id: 'a1', user_id: 'u1', created_at: '2026-01-01',
      symbol: 'AAPL', name: 'Apple', asset_type: 'Stock', sector: 'Tech',
      shares: 10, avg_cost: 150, current_price: null, buy_date: '2026-01-01',
      status: 'open', sell_price: null, sell_date: null, stop_loss: null,
      target_price: null, chart_link: null, notes: null,
      option_type: null, option_direction: null, strike: null, expiry: null,
      strategy: null, strike_2: null,
    }]
    supabase.from.mockReturnValue(mockSelectChain(rows))

    const { result } = renderHook(() => useInvestments('a1'))

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.investments).toHaveLength(1)
    expect(result.current.investments[0].symbol).toBe('AAPL')
    expect(supabase.from).toHaveBeenCalledWith('investments')
  })

  it('addInvestment inserts a row with status open and refreshes the list', async () => {
    supabase.from.mockReturnValue(mockSelectChain([]))
    const { result } = renderHook(() => useInvestments('a1'))
    await waitFor(() => expect(result.current.loading).toBe(false))

    const insertedRow = {
      id: 'i2', account_id: 'a1', user_id: 'u1', created_at: '2026-01-02',
      symbol: 'TSLA', name: '', asset_type: 'Stock', sector: '',
      shares: 5, avg_cost: 200, current_price: null, buy_date: '2026-01-02',
      status: 'open', sell_price: null, sell_date: null, stop_loss: null,
      target_price: null, chart_link: null, notes: null,
      option_type: null, option_direction: null, strike: null, expiry: null,
      strategy: null, strike_2: null,
    }
    const single = vi.fn().mockResolvedValue({ data: insertedRow, error: null })
    const select = vi.fn(() => ({ single }))
    const insert = vi.fn(() => ({ select }))
    supabase.from.mockReturnValue({ ...mockSelectChain([insertedRow]), insert })

    await act(async () => {
      await result.current.addInvestment({
        symbol: 'TSLA', assetType: 'Stock', shares: 5, avgCost: 200,
        buyDate: '2026-01-02', status: 'open',
      }, 'u1')
    })

    expect(insert).toHaveBeenCalled()
    const insertArg = insert.mock.calls[0][0]
    expect(insertArg.account_id).toBe('a1')
    expect(insertArg.user_id).toBe('u1')
    expect(insertArg.symbol).toBe('TSLA')
  })

  it('updateInvestment preserves existing fields not included in the patch', async () => {
    const rows = [{
      id: 'i1', account_id: 'a1', user_id: 'u1', created_at: '2026-01-01',
      symbol: 'AAPL', name: 'Apple', asset_type: 'Stock', sector: 'Tech',
      shares: 10, avg_cost: 150, current_price: null, buy_date: '2026-01-01',
      status: 'open', sell_price: null, sell_date: null, stop_loss: null,
      target_price: null, chart_link: null, notes: null,
      option_type: null, option_direction: null, strike: null, expiry: null,
      strategy: null, strike_2: null,
    }]
    const update = vi.fn(() => ({ eq: vi.fn().mockResolvedValue({ error: null }) }))
    supabase.from.mockReturnValue({ ...mockSelectChain(rows), update })

    const { result } = renderHook(() => useInvestments('a1'))
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => {
      await result.current.updateInvestment('i1', { currentPrice: 165 })
    })

    const updateArg = update.mock.calls[0][0]
    expect(updateArg.symbol).toBe('AAPL')
    expect(updateArg.shares).toBe(10)
    expect(updateArg.avg_cost).toBe(150)
    expect(updateArg.current_price).toBe(165)
  })

  it('closeInvestment preserves existing fields not included in the close payload', async () => {
    const rows = [{
      id: 'i1', account_id: 'a1', user_id: 'u1', created_at: '2026-01-01',
      symbol: 'AAPL', name: 'Apple', asset_type: 'Stock', sector: 'Tech',
      shares: 10, avg_cost: 150, current_price: null, buy_date: '2026-01-01',
      status: 'open', sell_price: null, sell_date: null, stop_loss: null,
      target_price: null, chart_link: null, notes: null,
      option_type: null, option_direction: null, strike: null, expiry: null,
      strategy: null, strike_2: null,
    }]
    const update = vi.fn(() => ({ eq: vi.fn().mockResolvedValue({ error: null }) }))
    supabase.from.mockReturnValue({ ...mockSelectChain(rows), update })

    const { result } = renderHook(() => useInvestments('a1'))
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => {
      await result.current.closeInvestment('i1', { sellPrice: '180', sellDate: '2026-02-01' })
    })

    const updateArg = update.mock.calls[0][0]
    expect(updateArg.symbol).toBe('AAPL')
    expect(updateArg.shares).toBe(10)
    expect(updateArg.status).toBe('closed')
    expect(updateArg.sell_price).toBe('180')
  })

  it('rollInvestment closes the current leg and opens a new one with the roll fields', async () => {
    const rows = [{
      id: 'i1', account_id: 'a1', user_id: 'u1', created_at: '2026-01-01',
      symbol: 'SPY', name: '', asset_type: 'Option', sector: '',
      shares: 2, avg_cost: 3.5, current_price: null, buy_date: '2026-01-01',
      status: 'open', sell_price: null, sell_date: null, stop_loss: null,
      target_price: null, chart_link: null, notes: null,
      option_type: 'call', option_direction: 'short', strike: 560, expiry: '2026-07-18',
      strategy: 'covered_call', strike_2: null,
    }]
    const update = vi.fn(() => ({ eq: vi.fn().mockResolvedValue({ error: null }) }))
    const insertedRow = { ...rows[0], id: 'i2' }
    const single = vi.fn().mockResolvedValue({ data: insertedRow, error: null })
    const select = vi.fn(() => ({ single }))
    const insert = vi.fn(() => ({ select }))
    supabase.from.mockReturnValue({ ...mockSelectChain(rows), update, insert })

    const { result } = renderHook(() => useInvestments('a1'))
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => {
      await result.current.rollInvestment('i1', {
        closePrice: '1.10', closeDate: '2026-07-10',
        newCredit: '2.40', newExpiry: '2026-08-15', newStrike: '570',
      }, 'u1')
    })

    const updateArg = update.mock.calls[0][0]
    expect(updateArg.status).toBe('closed')
    expect(updateArg.sell_price).toBe('1.10')
    expect(updateArg.sell_date).toBe('2026-07-10')
    expect(updateArg.strike).toBe(560)

    expect(insert).toHaveBeenCalled()
    const insertArg = insert.mock.calls[0][0]
    expect(insertArg.account_id).toBe('a1')
    expect(insertArg.user_id).toBe('u1')
    expect(insertArg.symbol).toBe('SPY')
    expect(insertArg.status).toBe('open')
    expect(insertArg.avg_cost).toBe('2.40')
    expect(insertArg.strike).toBe('570')
    expect(insertArg.expiry).toBe('2026-08-15')
    expect(insertArg.buy_date).toBe('2026-07-10')
    expect(insertArg.strategy).toBe('covered_call')
  })
})
