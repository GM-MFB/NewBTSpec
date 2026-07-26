import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { useUserSettings } from './useUserSettings'
import { supabase } from '../utils/supabase'

vi.mock('../utils/supabase', () => ({ supabase: { from: vi.fn() } }))

describe('useUserSettings', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  it('loads the finnhub key from user_settings and mirrors it to localStorage', async () => {
    const maybeSingle = vi.fn().mockResolvedValue({ data: { finnhub_key: 'abc123' }, error: null })
    const eq = vi.fn(() => ({ maybeSingle }))
    const select = vi.fn(() => ({ eq }))
    supabase.from.mockReturnValue({ select })

    const { result } = renderHook(() => useUserSettings('u1'))

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.finnhubKey).toBe('abc123')
    expect(localStorage.getItem('bt_finnhub_key')).toBe('abc123')
  })

  it('falls back to localStorage when there is no user_settings row yet', async () => {
    localStorage.setItem('bt_finnhub_key', 'from-storage')
    const maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null })
    const eq = vi.fn(() => ({ maybeSingle }))
    const select = vi.fn(() => ({ eq }))
    supabase.from.mockReturnValue({ select })

    const { result } = renderHook(() => useUserSettings('u1'))

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.finnhubKey).toBe('from-storage')
  })

  it('saveFinnhubKey upserts user_settings and updates localStorage', async () => {
    const maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null })
    const eq = vi.fn(() => ({ maybeSingle }))
    const select = vi.fn(() => ({ eq }))
    const upsert = vi.fn().mockResolvedValue({ error: null })
    supabase.from.mockReturnValue({ select, upsert })

    const { result } = renderHook(() => useUserSettings('u1'))
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => {
      await result.current.saveFinnhubKey('new-key')
    })

    expect(upsert).toHaveBeenCalledWith({ user_id: 'u1', finnhub_key: 'new-key' }, { onConflict: 'user_id' })
    expect(result.current.finnhubKey).toBe('new-key')
    expect(localStorage.getItem('bt_finnhub_key')).toBe('new-key')
  })

  it('loads the display name from user_settings', async () => {
    const maybeSingle = vi.fn().mockResolvedValue({ data: { finnhub_key: '', display_name: 'Matt' }, error: null })
    const eq = vi.fn(() => ({ maybeSingle }))
    const select = vi.fn(() => ({ eq }))
    supabase.from.mockReturnValue({ select })

    const { result } = renderHook(() => useUserSettings('u1'))

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.displayName).toBe('Matt')
  })

  it('saveDisplayName upserts user_settings with the new display name', async () => {
    const maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null })
    const eq = vi.fn(() => ({ maybeSingle }))
    const select = vi.fn(() => ({ eq }))
    const upsert = vi.fn().mockResolvedValue({ error: null })
    supabase.from.mockReturnValue({ select, upsert })

    const { result } = renderHook(() => useUserSettings('u1'))
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => {
      await result.current.saveDisplayName('New Name')
    })

    expect(upsert).toHaveBeenCalledWith({ user_id: 'u1', display_name: 'New Name' }, { onConflict: 'user_id' })
    expect(result.current.displayName).toBe('New Name')
  })
})
