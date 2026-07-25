import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { useAccounts } from './useAccounts'
import { supabase } from '../utils/supabase'

function mockFrom(returnData) {
  const single = vi.fn().mockResolvedValue({ data: returnData.inserted, error: null })
  const select2 = vi.fn(() => ({ single }))
  const insert = vi.fn(() => ({ select: select2 }))
  const order = vi.fn().mockResolvedValue({ data: returnData.list, error: null })
  const eq = vi.fn(() => ({ order }))
  const select1 = vi.fn(() => ({ eq }))
  return { select: select1, insert }
}

vi.mock('../utils/supabase', () => ({ supabase: { from: vi.fn() } }))

describe('useAccounts', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  it('loads existing accounts and selects the first as active', async () => {
    const accounts = [{ id: 'a1', name: 'Main Account' }, { id: 'a2', name: 'Second' }]
    supabase.from.mockReturnValue(mockFrom({ list: accounts, inserted: null }))

    const { result } = renderHook(() => useAccounts('u1'))

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.accounts).toEqual(accounts)
    expect(result.current.activeAccountId).toBe('a1')
  })

  it('auto-creates a Main Account when the user has zero accounts', async () => {
    const created = { id: 'a1', name: 'Main Account' }
    supabase.from.mockReturnValue(mockFrom({ list: [], inserted: created }))

    const { result } = renderHook(() => useAccounts('u1'))

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.accounts).toEqual([created])
    expect(result.current.activeAccountId).toBe('a1')
  })

  it('switchAccount updates activeAccountId and localStorage', async () => {
    const accounts = [{ id: 'a1', name: 'Main' }, { id: 'a2', name: 'Second' }]
    supabase.from.mockReturnValue(mockFrom({ list: accounts, inserted: null }))

    const { result } = renderHook(() => useAccounts('u1'))
    await waitFor(() => expect(result.current.loading).toBe(false))

    act(() => result.current.switchAccount('a2'))

    expect(result.current.activeAccountId).toBe('a2')
    expect(localStorage.getItem('bt_active_account')).toBe('a2')
  })
})
