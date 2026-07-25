import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import LoginPage from './LoginPage'
import { supabase } from '../utils/supabase'

vi.mock('../utils/supabase', () => ({
  supabase: { auth: { signInWithPassword: vi.fn(), signUp: vi.fn() } },
}))

describe('LoginPage', () => {
  beforeEach(() => vi.clearAllMocks())

  it('submits sign-in with email and password', async () => {
    supabase.auth.signInWithPassword.mockResolvedValue({ error: null })
    render(<LoginPage />)

    await userEvent.type(screen.getByLabelText(/email/i), 'a@b.com')
    await userEvent.type(screen.getByLabelText(/password/i), 'secret123')
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }))

    expect(supabase.auth.signInWithPassword).toHaveBeenCalledWith({ email: 'a@b.com', password: 'secret123' })
  })

  it('shows an inline error on failed sign-in', async () => {
    supabase.auth.signInWithPassword.mockResolvedValue({ error: { message: 'Invalid login credentials' } })
    render(<LoginPage />)

    await userEvent.type(screen.getByLabelText(/email/i), 'a@b.com')
    await userEvent.type(screen.getByLabelText(/password/i), 'wrong')
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }))

    expect(await screen.findByText(/invalid login credentials/i)).toBeInTheDocument()
  })

  it('toggles to sign-up mode and calls signUp', async () => {
    supabase.auth.signUp.mockResolvedValue({ error: null })
    render(<LoginPage />)

    await userEvent.click(screen.getByRole('button', { name: /create an account/i }))
    await userEvent.type(screen.getByLabelText(/email/i), 'new@b.com')
    await userEvent.type(screen.getByLabelText(/password/i), 'secret123')
    await userEvent.click(screen.getByRole('button', { name: /sign up/i }))

    expect(supabase.auth.signUp).toHaveBeenCalledWith({ email: 'new@b.com', password: 'secret123' })
  })
})
