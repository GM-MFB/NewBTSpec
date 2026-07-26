import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useInvestmentsHistory } from './useInvestmentsHistory'
import { supabase } from '../utils/supabase'

vi.mock('../utils/supabase', () => ({ supabase: { from: vi.fn() } }))

describe('useInvestmentsHistory', () => {
  beforeEach(() => vi.clearAllMocks())

  it('loads both open and closed investments for the account, mapped to camelCase', async () => {
    const rows = [
      {
        id: 'i1', account_id: 'a1', user_id: 'u1', created_at: '2026-01-01',
        symbol: 'AAPL', name: '', asset_type: 'Stock', sector: '',
        shares: 10, avg_cost: 150, current_price: null, buy_date: '2026-01-01',
        status: 'open', sell_price: null, sell_date: null, stop_loss: null,
        target_price: null, chart_link: null, notes: null,
        option_type: null, option_direction: null, strike: null, expiry: null,
        strategy: null, strike_2: null,
      },
      {
        id: 'i2', account_id: 'a1', user_id: 'u1', created_at: '2026-01-02',
        symbol: 'TSLA', name: '', asset_type: 'Stock', sector: '',
        shares: 5, avg_cost: 200, current_price: null, buy_date: '2026-01-02',
        status: 'closed', sell_price: 250, sell_date: '2026-01-10', stop_loss: null,
        target_price: null, chart_link: null, notes: null,
        option_type: null, option_direction: null, strike: null, expiry: null,
        strategy: null, strike_2: null,
      },
    ]
    const order = vi.fn().mockResolvedValue({ data: rows, error: null })
    const eq = vi.fn(() => ({ order }))
    const select = vi.fn(() => ({ eq }))
    supabase.from.mockReturnValue({ select })

    const { result } = renderHook(() => useInvestmentsHistory('a1'))

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.investments).toHaveLength(2)
    expect(result.current.investments.map((i) => i.status)).toEqual(['open', 'closed'])
    expect(supabase.from).toHaveBeenCalledWith('investments')
    expect(eq).toHaveBeenCalledWith('account_id', 'a1')
  })
})
