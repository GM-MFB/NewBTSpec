import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import Header from './Header'

const accounts = [{ id: 'a1', name: 'Main Account' }, { id: 'a2', name: 'Swing' }]

function setup(props = {}) {
  const defaults = {
    accounts,
    activeAccount: accounts[0],
    switchAccount: vi.fn(),
    createAccount: vi.fn(),
    onAddTrade: vi.fn(),
  }
  return render(<MemoryRouter><Header {...defaults} {...props} /></MemoryRouter>)
}

describe('Header', () => {
  it('shows the active account name as the title', () => {
    setup()
    expect(screen.getByText('Main Account')).toBeInTheDocument()
  })

  it('opens a dropdown listing other accounts and switches on click', async () => {
    const switchAccount = vi.fn()
    setup({ switchAccount })
    await userEvent.click(screen.getByText('Main Account'))
    await userEvent.click(screen.getByText('Swing'))
    expect(switchAccount).toHaveBeenCalledWith('a2')
  })

  it('renders Home, Trades, Stats, Analyze, Matt Cap nav links and an Add button', () => {
    setup()
    expect(screen.getByRole('link', { name: /^home$/i })).toHaveAttribute('href', '/')
    expect(screen.getByRole('link', { name: /trades/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /stats/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /analyze/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /matt cap/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /add trade/i })).toBeInTheDocument()
  })

  it('calls onAddTrade when the Add button is clicked', async () => {
    const onAddTrade = vi.fn()
    setup({ onAddTrade })
    await userEvent.click(screen.getByRole('button', { name: /add trade/i }))
    expect(onAddTrade).toHaveBeenCalled()
  })

  it('uses a custom addLabel when provided', () => {
    setup({ addLabel: '+ Add Investment' })
    expect(screen.getByRole('button', { name: /add investment/i })).toBeInTheDocument()
  })

  it('always renders a link to Settings', () => {
    setup()
    expect(screen.getByRole('link', { name: /settings/i })).toHaveAttribute('href', '/settings')
  })

  it('does not render a Refresh button when onRefresh is not provided', () => {
    setup()
    expect(screen.queryByRole('button', { name: /refresh/i })).not.toBeInTheDocument()
  })

  it('renders and calls onRefresh when provided', async () => {
    const onRefresh = vi.fn()
    setup({ onRefresh })
    await userEvent.click(screen.getByRole('button', { name: /^↻ refresh$/i }))
    expect(onRefresh).toHaveBeenCalled()
  })

  it('disables the Refresh button and shows Refreshing… while refreshing', () => {
    setup({ onRefresh: vi.fn(), refreshing: true })
    expect(screen.getByRole('button', { name: /refreshing/i })).toBeDisabled()
  })
})
