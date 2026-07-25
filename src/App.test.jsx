import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import App from './App'
import { useAuth } from './hooks/useAuth'
import { useAccounts } from './hooks/useAccounts'
import { useInvestments } from './hooks/useInvestments'
import { useUserSettings } from './hooks/useUserSettings'

vi.mock('./hooks/useAuth')
vi.mock('./hooks/useAccounts')
vi.mock('./hooks/useInvestments')
vi.mock('./hooks/useUserSettings')

describe('App', () => {
  it('redirects to login when signed out', async () => {
    useAuth.mockReturnValue({ user: null, session: null, loading: false, signOut: vi.fn() })
    render(<MemoryRouter initialEntries={['/']}><App /></MemoryRouter>)
    await waitFor(() => expect(screen.getByTestId('login-page')).toBeInTheDocument())
  })

  it('redirects away from login to home (Investments) when already signed in', async () => {
    useAuth.mockReturnValue({ user: { id: 'u1' }, session: {}, loading: false, signOut: vi.fn() })
    useAccounts.mockReturnValue({
      accounts: [{ id: 'a1', name: 'Main Account' }],
      activeAccount: { id: 'a1', name: 'Main Account' },
      activeAccountId: 'a1',
      switchAccount: vi.fn(),
      createAccount: vi.fn(),
      loading: false,
    })
    useInvestments.mockReturnValue({ investments: [], loading: false, error: null, reload: vi.fn(), addInvestment: vi.fn(), closeInvestment: vi.fn(), updateInvestment: vi.fn(), deleteInvestment: vi.fn() })
    useUserSettings.mockReturnValue({ finnhubKey: '', loading: false, saveFinnhubKey: vi.fn() })

    render(<MemoryRouter initialEntries={['/login']}><App /></MemoryRouter>)
    await waitFor(() => expect(screen.getByTestId('investments-page')).toBeInTheDocument())
  })

  it('renders SettingsPage at /settings', async () => {
    useAuth.mockReturnValue({ user: { id: 'u1' }, session: {}, loading: false, signOut: vi.fn() })
    useAccounts.mockReturnValue({
      accounts: [{ id: 'a1', name: 'Main Account' }],
      activeAccount: { id: 'a1', name: 'Main Account' },
      activeAccountId: 'a1',
      switchAccount: vi.fn(),
      createAccount: vi.fn(),
      loading: false,
    })
    useUserSettings.mockReturnValue({ finnhubKey: '', loading: false, saveFinnhubKey: vi.fn() })

    render(<MemoryRouter initialEntries={['/settings']}><App /></MemoryRouter>)
    await waitFor(() => expect(screen.getByTestId('settings-page')).toBeInTheDocument())
  })
})
