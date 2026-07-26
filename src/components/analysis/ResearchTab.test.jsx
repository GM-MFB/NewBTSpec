import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import ResearchTab from './ResearchTab'
import { useAuth } from '../../hooks/useAuth'
import { useUserSettings } from '../../hooks/useUserSettings'
import { fetchFundamentals, fetchPeers } from '../../lib/fetchFundamentals'

vi.mock('../../hooks/useAuth')
vi.mock('../../hooks/useUserSettings')
vi.mock('../../lib/fetchFundamentals')

const investments = [
  { id: 'i1', assetType: 'Stock', symbol: 'AAPL', shares: 10, avgCost: 150, currentPrice: 165 },
]

function mockResult(name) {
  return {
    profile: { name }, quote: { c: 100, pc: 95 }, metrics: { peBasicExclExtraTTM: 20 },
    recs: null, targets: null, news: [], earnings: null,
  }
}

describe('ResearchTab', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useAuth.mockReturnValue({ user: { id: 'u1' } })
    fetchPeers.mockResolvedValue([])
  })

  it('shows a Key Required state when there is no Finnhub key', () => {
    useUserSettings.mockReturnValue({ finnhubKey: '', avKey: '', loading: false })
    render(<MemoryRouter><ResearchTab investments={investments} /></MemoryRouter>)
    expect(screen.getByText(/key required/i)).toBeInTheDocument()
  })

  it('auto-researches the first stock symbol on mount so content appears without a click', async () => {
    useUserSettings.mockReturnValue({ finnhubKey: 'key123', avKey: '', loading: false })
    fetchFundamentals.mockResolvedValue(mockResult('Apple Inc'))

    render(<MemoryRouter><ResearchTab investments={investments} /></MemoryRouter>)

    await waitFor(() => expect(screen.getByText('Apple Inc')).toBeInTheDocument())
    expect(screen.getByRole('button', { name: 'AAPL' })).toHaveClass('fund-chip--active')
  })

  it('does not auto-research anything when there are no stock investments', () => {
    useUserSettings.mockReturnValue({ finnhubKey: 'key123', avKey: '', loading: false })
    render(<MemoryRouter><ResearchTab investments={[]} /></MemoryRouter>)
    expect(fetchFundamentals).not.toHaveBeenCalled()
  })

  it('defaults to Single view and renders SymbolPanels for a researched symbol', async () => {
    useUserSettings.mockReturnValue({ finnhubKey: 'key123', avKey: '', loading: false })
    fetchFundamentals.mockResolvedValue(mockResult('Apple Inc'))

    render(<MemoryRouter><ResearchTab investments={investments} /></MemoryRouter>)
    await userEvent.click(screen.getByRole('button', { name: 'AAPL' }))

    await waitFor(() => expect(screen.getByText('Apple Inc')).toBeInTheDocument())
    expect(screen.queryByTestId('compare-view')).not.toBeInTheDocument()
  })

  it('accumulates researched symbols into Compare view instead of replacing', async () => {
    useUserSettings.mockReturnValue({ finnhubKey: 'key123', avKey: '', loading: false })
    fetchFundamentals.mockImplementation((symbol) => Promise.resolve(mockResult(symbol)))

    render(<MemoryRouter><ResearchTab investments={investments} /></MemoryRouter>)
    await userEvent.click(screen.getByRole('button', { name: /^compare$/i }))

    await userEvent.click(screen.getByRole('button', { name: 'AAPL' }))
    await waitFor(() => expect(screen.getByRole('columnheader', { name: /AAPL/ })).toBeInTheDocument())

    await userEvent.type(screen.getByLabelText(/add symbol/i), 'MSFT{enter}')
    await waitFor(() => expect(screen.getByRole('columnheader', { name: /MSFT/ })).toBeInTheDocument())

    expect(screen.getByRole('columnheader', { name: /AAPL/ })).toBeInTheDocument()
  })

  it('clears all compare symbols when Clear All is clicked', async () => {
    useUserSettings.mockReturnValue({ finnhubKey: 'key123', avKey: '', loading: false })
    fetchFundamentals.mockImplementation((symbol) => Promise.resolve(mockResult(symbol)))

    render(<MemoryRouter><ResearchTab investments={investments} /></MemoryRouter>)
    await userEvent.click(screen.getByRole('button', { name: /^compare$/i }))

    await userEvent.click(screen.getByRole('button', { name: 'AAPL' }))
    await waitFor(() => expect(screen.getByTestId('compare-view')).toBeInTheDocument())

    await userEvent.click(screen.getByRole('button', { name: /^clear all$/i }))

    expect(screen.queryByTestId('compare-view')).not.toBeInTheDocument()
  })

  it('does not show Clear All when compare is empty', () => {
    useUserSettings.mockReturnValue({ finnhubKey: 'key123', avKey: '', loading: false })
    render(<MemoryRouter><ResearchTab investments={investments} /></MemoryRouter>)
    expect(screen.queryByRole('button', { name: /^clear all$/i })).not.toBeInTheDocument()
  })

  it('highlights the symbol chip when added to compare in Compare view', async () => {
    useUserSettings.mockReturnValue({ finnhubKey: 'key123', avKey: '', loading: false })
    fetchFundamentals.mockImplementation((symbol) => Promise.resolve(mockResult(symbol)))

    render(<MemoryRouter><ResearchTab investments={investments} /></MemoryRouter>)
    await userEvent.click(screen.getByRole('button', { name: /^compare$/i }))

    const chip = screen.getByRole('button', { name: 'AAPL' })
    expect(chip).not.toHaveClass('fund-chip--active')

    await userEvent.click(chip)

    await waitFor(() => expect(chip).toHaveClass('fund-chip--active'))
  })

  it('feeds Sector Browser Add to Compare into the same compare list', async () => {
    useUserSettings.mockReturnValue({ finnhubKey: 'key123', avKey: '', loading: false })
    fetchFundamentals.mockImplementation((symbol) => Promise.resolve(mockResult(symbol)))

    render(<MemoryRouter><ResearchTab investments={investments} /></MemoryRouter>)
    await userEvent.click(screen.getByRole('button', { name: /^compare$/i }))
    await userEvent.click(screen.getByRole('button', { name: /browse by sector/i }))

    const firstCheckbox = screen.getAllByRole('checkbox')[0]
    await userEvent.click(firstCheckbox)
    await userEvent.click(screen.getByRole('button', { name: /add to compare/i }))

    await waitFor(() => expect(screen.getByTestId('compare-view')).toBeInTheDocument())
  })
})
