import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { useScreenerSaves } from './useScreenerSaves'
import { supabase } from '../utils/supabase'

vi.mock('../utils/supabase', () => ({ supabase: { from: vi.fn() } }))

function mockScreenerFrom({ ownSaves = [], defaultSaves = [] }) {
  let selectCallCount = 0
  return vi.fn(() => ({
    select: () => ({
      eq: () => ({
        order: () => {
          selectCallCount += 1
          return Promise.resolve({ data: selectCallCount === 1 ? ownSaves : defaultSaves, error: null })
        },
      }),
    }),
    insert: (row) => ({
      select: () => ({ single: () => Promise.resolve({ data: { id: 'new1', ...row }, error: null }) }),
    }),
    delete: () => ({
      eq: () => Promise.resolve({ error: null }),
    }),
  }))
}

describe('useScreenerSaves', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('loads own-account saves', async () => {
    const ownSaves = [{ id: 's1', name: 'Cheap Tech', filters: { sector: 'sec_technology' } }]
    supabase.from.mockImplementation(mockScreenerFrom({ ownSaves }))

    const { result } = renderHook(() => useScreenerSaves('a1', 'u1'))

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.saves).toEqual(ownSaves)
  })

  it('merges in default-account saves when accountId is not "default"', async () => {
    const ownSaves = [{ id: 's1', name: 'Own', filters: {} }]
    const defaultSaves = [{ id: 's2', name: 'Shared', filters: {} }]
    supabase.from.mockImplementation(mockScreenerFrom({ ownSaves, defaultSaves }))

    const { result } = renderHook(() => useScreenerSaves('a1', 'u1'))

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.saves.map((s) => s.id)).toEqual(['s1', 's2'])
  })

  it('does not double-fetch default saves when accountId is already "default"', async () => {
    const ownSaves = [{ id: 's1', name: 'Global', filters: {} }]
    const fromSpy = vi.fn(mockScreenerFrom({ ownSaves }))
    supabase.from = fromSpy

    const { result } = renderHook(() => useScreenerSaves('default', 'u1'))

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.saves).toEqual(ownSaves)
  })

  it('savePreset inserts and reloads', async () => {
    const ownSaves = [{ id: 's1', name: 'Existing', filters: {} }]
    supabase.from.mockImplementation(mockScreenerFrom({ ownSaves }))

    const { result } = renderHook(() => useScreenerSaves('a1', 'u1'))
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => {
      await result.current.savePreset('New Preset', { price: 'sh_price_u10' })
    })

    expect(supabase.from).toHaveBeenCalledWith('screener_saves')
  })

  it('deletePreset deletes and reloads', async () => {
    const ownSaves = [{ id: 's1', name: 'Existing', filters: {} }]
    supabase.from.mockImplementation(mockScreenerFrom({ ownSaves }))

    const { result } = renderHook(() => useScreenerSaves('a1', 'u1'))
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => {
      await result.current.deletePreset('s1')
    })

    expect(result.current.loading).toBe(false)
  })
})
