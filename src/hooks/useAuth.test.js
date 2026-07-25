import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useAuth } from './useAuth'
import { supabase } from '../utils/supabase'

vi.mock('../utils/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn(),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
      signOut: vi.fn(),
    },
  },
}))

describe('useAuth', () => {
  beforeEach(() => vi.clearAllMocks())

  it('loads the current session on mount', async () => {
    const fakeUser = { id: 'u1', email: 'a@b.com' }
    supabase.auth.getSession.mockResolvedValue({ data: { session: { user: fakeUser } } })

    const { result } = renderHook(() => useAuth())

    expect(result.current.loading).toBe(true)
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.user).toEqual(fakeUser)
  })

  it('returns null user when there is no session', async () => {
    supabase.auth.getSession.mockResolvedValue({ data: { session: null } })

    const { result } = renderHook(() => useAuth())

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.user).toBeNull()
  })
})
