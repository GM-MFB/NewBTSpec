import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { useAccounts } from './useAccounts'
import { supabase } from '../utils/supabase'

function mockFrom({
  ownAccounts = [],
  mattCapAccounts = [],
  inserted = null,
  deleteError = null,
  tradesDeleteError = null,
  investmentsDeleteError = null,
  deleteCalls = [],
}) {
  return (table) => ({
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
    delete: () => ({
      eq: (col, val) => {
        deleteCalls.push({ table, col, val })
        if (table === 'trades') return Promise.resolve({ error: tradesDeleteError })
        if (table === 'investments') return Promise.resolve({ error: investmentsDeleteError })
        return Promise.resolve({ error: deleteError })
      },
    }),
  })
}

vi.mock('../utils/supabase', () => ({ supabase: { from: vi.fn() } }))

describe('useAccounts', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  it('loads existing accounts and selects the first as active', async () => {
    const accounts = [{ id: 'a1', name: 'Main Account' }, { id: 'a2', name: 'Second' }]
    supabase.from.mockImplementation(mockFrom({ ownAccounts: accounts }))

    const { result } = renderHook(() => useAccounts('u1'))

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.accounts).toEqual(accounts)
    expect(result.current.activeAccountId).toBe('a1')
  })

  it('auto-creates a Main Account when the user has zero accounts', async () => {
    const created = { id: 'a1', name: 'Main Account' }
    supabase.from.mockImplementation(mockFrom({ ownAccounts: [], inserted: created }))

    const { result } = renderHook(() => useAccounts('u1'))

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.accounts).toEqual([created])
    expect(result.current.activeAccountId).toBe('a1')
  })

  it('switchAccount updates activeAccountId and localStorage', async () => {
    const accounts = [{ id: 'a1', name: 'Main' }, { id: 'a2', name: 'Second' }]
    supabase.from.mockImplementation(mockFrom({ ownAccounts: accounts }))

    const { result } = renderHook(() => useAccounts('u1'))
    await waitFor(() => expect(result.current.loading).toBe(false))

    act(() => result.current.switchAccount('a2'))

    expect(result.current.activeAccountId).toBe('a2')
    expect(localStorage.getItem('bt_active_account')).toBe('a2')
  })

  it('includes the shared Matt Cap account alongside owned accounts', async () => {
    const owned = [{ id: 'a1', name: 'Main Account' }]
    const mattCap = [{ id: 'mc1', name: 'Matt Cap' }]
    supabase.from.mockImplementation(mockFrom({ ownAccounts: owned, mattCapAccounts: mattCap }))

    const { result } = renderHook(() => useAccounts('u1'))

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.accounts.map((a) => a.id)).toEqual(['a1', 'mc1'])
  })

  it('does not include Matt Cap when the query returns no rows (RLS blocked)', async () => {
    const owned = [{ id: 'a1', name: 'Main Account' }]
    supabase.from.mockImplementation(mockFrom({ ownAccounts: owned, mattCapAccounts: [] }))

    const { result } = renderHook(() => useAccounts('u1'))

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.accounts.map((a) => a.id)).toEqual(['a1'])
  })

  it('dedupes when the current user owns the Matt Cap account', async () => {
    const owned = [{ id: 'a1', name: 'Main Account' }, { id: 'mc1', name: 'Matt Cap' }]
    const mattCap = [{ id: 'mc1', name: 'Matt Cap' }]
    supabase.from.mockImplementation(mockFrom({ ownAccounts: owned, mattCapAccounts: mattCap }))

    const { result } = renderHook(() => useAccounts('u1'))

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.accounts.map((a) => a.id)).toEqual(['a1', 'mc1'])
  })

  it('deleteAccount removes the account from the list', async () => {
    const accounts = [{ id: 'a1', name: 'Main' }, { id: 'a2', name: 'Second' }]
    supabase.from.mockImplementation(mockFrom({ ownAccounts: accounts }))

    const { result } = renderHook(() => useAccounts('u1'))
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(() => result.current.deleteAccount('a2'))

    expect(result.current.accounts.map((a) => a.id)).toEqual(['a1'])
  })

  it('deleteAccount switches the active account if the active one was deleted', async () => {
    const accounts = [{ id: 'a1', name: 'Main' }, { id: 'a2', name: 'Second' }]
    supabase.from.mockImplementation(mockFrom({ ownAccounts: accounts }))

    const { result } = renderHook(() => useAccounts('u1'))
    await waitFor(() => expect(result.current.loading).toBe(false))
    act(() => result.current.switchAccount('a2'))

    await act(() => result.current.deleteAccount('a2'))

    expect(result.current.activeAccountId).toBe('a1')
    expect(localStorage.getItem('bt_active_account')).toBe('a1')
  })

  it('deleteAccount throws and leaves accounts unchanged when the delete fails', async () => {
    const accounts = [{ id: 'a1', name: 'Main' }, { id: 'a2', name: 'Second' }]
    supabase.from.mockImplementation(mockFrom({ ownAccounts: accounts, deleteError: new Error('nope') }))

    const { result } = renderHook(() => useAccounts('u1'))
    await waitFor(() => expect(result.current.loading).toBe(false))

    await expect(act(() => result.current.deleteAccount('a2'))).rejects.toThrow('nope')
    expect(result.current.accounts.map((a) => a.id)).toEqual(['a1', 'a2'])
  })

  it('deleteAccount removes trades and investments for that account before the account itself', async () => {
    const accounts = [{ id: 'a1', name: 'Main' }, { id: 'a2', name: 'Second' }]
    const deleteCalls = []
    supabase.from.mockImplementation(mockFrom({ ownAccounts: accounts, deleteCalls }))

    const { result } = renderHook(() => useAccounts('u1'))
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(() => result.current.deleteAccount('a2'))

    expect(deleteCalls).toEqual([
      { table: 'trades', col: 'account_id', val: 'a2' },
      { table: 'investments', col: 'account_id', val: 'a2' },
      { table: 'accounts', col: 'id', val: 'a2' },
    ])
  })

  it('deleteAccount throws and does not delete the account when clearing trades fails', async () => {
    const accounts = [{ id: 'a1', name: 'Main' }, { id: 'a2', name: 'Second' }]
    const deleteCalls = []
    supabase.from.mockImplementation(
      mockFrom({ ownAccounts: accounts, tradesDeleteError: new Error('trades blocked'), deleteCalls })
    )

    const { result } = renderHook(() => useAccounts('u1'))
    await waitFor(() => expect(result.current.loading).toBe(false))

    await expect(act(() => result.current.deleteAccount('a2'))).rejects.toThrow('trades blocked')
    expect(deleteCalls).toEqual([{ table: 'trades', col: 'account_id', val: 'a2' }])
    expect(result.current.accounts.map((a) => a.id)).toEqual(['a1', 'a2'])
  })

  it('refuses to delete the shared Matt Cap account and makes no delete calls', async () => {
    const accounts = [{ id: 'a1', name: 'Main' }, { id: 'mc1', name: 'Matt Cap' }]
    const deleteCalls = []
    supabase.from.mockImplementation(mockFrom({ ownAccounts: accounts, deleteCalls }))

    const { result } = renderHook(() => useAccounts('u1'))
    await waitFor(() => expect(result.current.loading).toBe(false))

    await expect(act(() => result.current.deleteAccount('mc1'))).rejects.toThrow(/matt cap/i)
    expect(deleteCalls).toEqual([])
    expect(result.current.accounts.map((a) => a.id)).toEqual(['a1', 'mc1'])
  })
})
