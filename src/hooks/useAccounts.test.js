import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { useAccounts } from './useAccounts'
import { supabase } from '../utils/supabase'

function mockFrom({ ownAccounts = [], mattCapAccounts = [], inserted = null }) {
  return {
    select: () => ({
      eq: (col, val) => ({
        order: () => Promise.resolve({
          data: col === 'name' && val === 'Matt Cap' ? mattCapAccounts : ownAccounts,
          error: null,
        }),
      }),
    }),
    insert: () => ({
      select: () => ({ single: () => Promise.resolve({ data: inserted, error: null }) }),
    }),
  }
}

vi.mock('../utils/supabase', () => ({ supabase: { from: vi.fn() } }))

describe('useAccounts', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  it('loads existing accounts and selects the first as active', async () => {
    const accounts = [{ id: 'a1', name: 'Main Account' }, { id: 'a2', name: 'Second' }]
    supabase.from.mockReturnValue(mockFrom({ ownAccounts: accounts }))

    const { result } = renderHook(() => useAccounts('u1'))

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.accounts).toEqual(accounts)
    expect(result.current.activeAccountId).toBe('a1')
  })

  it('auto-creates a Main Account when the user has zero accounts', async () => {
    const created = { id: 'a1', name: 'Main Account' }
    supabase.from.mockReturnValue(mockFrom({ ownAccounts: [], inserted: created }))

    const { result } = renderHook(() => useAccounts('u1'))

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.accounts).toEqual([created])
    expect(result.current.activeAccountId).toBe('a1')
  })

  it('switchAccount updates activeAccountId and localStorage', async () => {
    const accounts = [{ id: 'a1', name: 'Main' }, { id: 'a2', name: 'Second' }]
    supabase.from.mockReturnValue(mockFrom({ ownAccounts: accounts }))

    const { result } = renderHook(() => useAccounts('u1'))
    await waitFor(() => expect(result.current.loading).toBe(false))

    act(() => result.current.switchAccount('a2'))

    expect(result.current.activeAccountId).toBe('a2')
    expect(localStorage.getItem('bt_active_account')).toBe('a2')
  })

  it('includes the shared Matt Cap account alongside owned accounts', async () => {
    const owned = [{ id: 'a1', name: 'Main Account' }]
    const mattCap = [{ id: 'mc1', name: 'Matt Cap' }]
    supabase.from.mockReturnValue(mockFrom({ ownAccounts: owned, mattCapAccounts: mattCap }))

    const { result } = renderHook(() => useAccounts('u1'))

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.accounts.map((a) => a.id)).toEqual(['a1', 'mc1'])
  })

  it('does not include Matt Cap when the query returns no rows (RLS blocked)', async () => {
    const owned = [{ id: 'a1', name: 'Main Account' }]
    supabase.from.mockReturnValue(mockFrom({ ownAccounts: owned, mattCapAccounts: [] }))

    const { result } = renderHook(() => useAccounts('u1'))

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.accounts.map((a) => a.id)).toEqual(['a1'])
  })

  it('dedupes when the current user owns the Matt Cap account', async () => {
    const owned = [{ id: 'a1', name: 'Main Account' }, { id: 'mc1', name: 'Matt Cap' }]
    const mattCap = [{ id: 'mc1', name: 'Matt Cap' }]
    supabase.from.mockReturnValue(mockFrom({ ownAccounts: owned, mattCapAccounts: mattCap }))

    const { result } = renderHook(() => useAccounts('u1'))

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.accounts.map((a) => a.id)).toEqual(['a1', 'mc1'])
  })
})
