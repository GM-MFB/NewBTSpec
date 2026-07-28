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
    deleteAccount: vi.fn(),
    renameAccount: vi.fn(),
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

  it('renders Home, Day Trading, Stats, Analyze nav links and an Add button', () => {
    setup()
    expect(screen.getByRole('link', { name: /^home$/i })).toHaveAttribute('href', '/')
    expect(screen.getByRole('link', { name: /day trading/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /stats/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /analyze/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /add trade/i })).toBeInTheDocument()
  })

  it('does not render Sign Out when onSignOut is not provided', async () => {
    setup()
    await userEvent.click(screen.getByText('Main Account'))
    expect(screen.queryByRole('button', { name: /sign out/i })).not.toBeInTheDocument()
  })

  it('deletes an account after the user confirms the prompt', async () => {
    const deleteAccount = vi.fn()
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    setup({ deleteAccount })
    await userEvent.click(screen.getByText('Main Account'))
    await userEvent.click(screen.getByRole('button', { name: /delete swing/i }))

    expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining('Swing'))
    expect(deleteAccount).toHaveBeenCalledWith('a2')
  })

  it('does not delete an account when the user cancels the prompt', async () => {
    const deleteAccount = vi.fn()
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    setup({ deleteAccount })
    await userEvent.click(screen.getByText('Main Account'))
    await userEvent.click(screen.getByRole('button', { name: /delete swing/i }))

    expect(deleteAccount).not.toHaveBeenCalled()
  })

  it('does not show a delete button for the active account', async () => {
    setup()
    await userEvent.click(screen.getByText('Main Account'))
    expect(screen.queryByRole('button', { name: /delete main account/i })).not.toBeInTheDocument()
  })

  it('does not show a delete button for the shared Matt Cap account', async () => {
    setup({ accounts: [...accounts, { id: 'mc1', name: 'Matt Cap' }] })
    await userEvent.click(screen.getByText('Main Account'))
    expect(screen.getByText('Matt Cap')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /delete matt cap/i })).not.toBeInTheDocument()
  })

  it('renames the active account via the pencil button next to the title', async () => {
    const renameAccount = vi.fn()
    vi.spyOn(window, 'prompt').mockReturnValue('New Name')
    setup({ renameAccount })
    await userEvent.click(screen.getByRole('button', { name: /rename main account/i }))

    expect(window.prompt).toHaveBeenCalledWith('Rename account', 'Main Account')
    expect(renameAccount).toHaveBeenCalledWith('a1', 'New Name')
  })

  it('does not rename the active account when the prompt is cancelled', async () => {
    const renameAccount = vi.fn()
    vi.spyOn(window, 'prompt').mockReturnValue(null)
    setup({ renameAccount })
    await userEvent.click(screen.getByRole('button', { name: /rename main account/i }))

    expect(renameAccount).not.toHaveBeenCalled()
  })

  it('renames a non-active account from the dropdown', async () => {
    const renameAccount = vi.fn()
    vi.spyOn(window, 'prompt').mockReturnValue('Swing Trades')
    setup({ renameAccount })
    await userEvent.click(screen.getByText('Main Account'))
    await userEvent.click(screen.getByRole('button', { name: /rename swing/i }))

    expect(window.prompt).toHaveBeenCalledWith('Rename account', 'Swing')
    expect(renameAccount).toHaveBeenCalledWith('a2', 'Swing Trades')
  })

  it('does not show a rename button for the shared Matt Cap account', async () => {
    setup({ accounts: [...accounts, { id: 'mc1', name: 'Matt Cap' }] })
    await userEvent.click(screen.getByText('Main Account'))
    expect(screen.queryByRole('button', { name: /rename matt cap/i })).not.toBeInTheDocument()
  })

  it('does not show a rename pencil for the active account when it is Matt Cap', () => {
    setup({ activeAccount: { id: 'mc1', name: 'Matt Cap' } })
    expect(screen.queryByRole('button', { name: /rename matt cap/i })).not.toBeInTheDocument()
  })

  it('renders Sign Out in the dropdown and calls onSignOut when clicked', async () => {
    const onSignOut = vi.fn()
    setup({ onSignOut })
    await userEvent.click(screen.getByText('Main Account'))
    await userEvent.click(screen.getByRole('button', { name: /sign out/i }))
    expect(onSignOut).toHaveBeenCalled()
  })

  it('renders a Watchlist nav link', () => {
    setup()
    expect(screen.getByRole('link', { name: /watchlist/i })).toHaveAttribute('href', '/watchlist')
  })

  it('renders a Charts nav link', () => {
    setup()
    expect(screen.getByRole('link', { name: /charts/i })).toHaveAttribute('href', '/charts')
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
