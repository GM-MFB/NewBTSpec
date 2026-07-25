import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import App from './App'
import { useAuth } from './hooks/useAuth'

vi.mock('./hooks/useAuth')

describe('App', () => {
  it('redirects to login when signed out', async () => {
    useAuth.mockReturnValue({ user: null, session: null, loading: false, signOut: vi.fn() })
    render(<MemoryRouter initialEntries={['/']}><App /></MemoryRouter>)
    await waitFor(() => expect(screen.getByTestId('login-page')).toBeInTheDocument())
  })
})
