import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import StatsPage from './StatsPage'
import { useAuth } from '../hooks/useAuth'
import { useAccounts } from '../hooks/useAccounts'
import { useInvestmentsHistory } from '../hooks/useInvestmentsHistory'
import { buildExportData } from '../lib/exportData'
import { generatePdfReport } from '../lib/pdfReport'
import { generateExcelWorkbook } from '../lib/excelExport'

vi.mock('../hooks/useAuth')
vi.mock('../hooks/useAccounts')
vi.mock('../hooks/useInvestmentsHistory')
vi.mock('../lib/exportData')
vi.mock('../lib/pdfReport')
vi.mock('../lib/excelExport')

function mockAccounts() {
  useAuth.mockReturnValue({ user: { id: 'u1' } })
  useAccounts.mockReturnValue({
    accounts: [{ id: 'a1', name: 'Main Account' }],
    activeAccount: { id: 'a1', name: 'Main Account' },
    activeAccountId: 'a1',
    switchAccount: vi.fn(),
    createAccount: vi.fn(),
    loading: false,
  })
}

const investments = [
  { id: 'i1', status: 'closed', assetType: 'Stock', symbol: 'AAPL', shares: 10, avgCost: 100, buyDate: '2025-12-01', sellPrice: 150, sellDate: '2026-01-10', strategy: '', strike: '', expiry: '' },
  { id: 'i2', status: 'open', assetType: 'Stock', symbol: 'MSFT', shares: 3, avgCost: 400, sellPrice: '', sellDate: '', buyDate: '2026-01-05', strategy: '', strike: '', expiry: '' },
  { id: 'i3', status: 'closed', assetType: 'Option', symbol: 'QQQ', shares: 2, avgCost: 1.5, sellPrice: 0.5, sellDate: '2026-01-12', strategy: 'cash_secured_put', strike: 380, expiry: '2026-01-17' },
]

describe('StatsPage', () => {
  it('shows the Numbers view by default with overview stat tiles', () => {
    mockAccounts()
    useInvestmentsHistory.mockReturnValue({ investments, loading: false, error: null, reload: vi.fn(), deleteInvestment: vi.fn() })

    render(<MemoryRouter><StatsPage /></MemoryRouter>)

    expect(screen.getByText('Total Realized P&L')).toBeInTheDocument()
    expect(screen.getAllByText('$500.00').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Win Rate').length).toBeGreaterThan(0)
    expect(screen.getByText('Closed Positions')).toBeInTheDocument()
    expect(screen.getByText('Open Positions')).toBeInTheDocument()
  })

  it('wraps every table in a horizontal scroll container so it cannot overflow the page on mobile', () => {
    mockAccounts()
    useInvestmentsHistory.mockReturnValue({ investments, loading: false, error: null, reload: vi.fn(), deleteInvestment: vi.fn() })

    const { container } = render(<MemoryRouter><StatsPage /></MemoryRouter>)

    const tables = container.querySelectorAll('table')
    expect(tables.length).toBeGreaterThan(0)
    for (const table of tables) {
      expect(table.parentElement).toHaveClass('stats-table-wrap')
    }
  })

  it('switches to the Charts view when toggled', async () => {
    mockAccounts()
    useInvestmentsHistory.mockReturnValue({ investments, loading: false, error: null, reload: vi.fn(), deleteInvestment: vi.fn() })

    render(<MemoryRouter><StatsPage /></MemoryRouter>)

    await userEvent.click(screen.getByRole('button', { name: /^charts$/i }))

    expect(screen.queryByText('Total Realized P&L')).not.toBeInTheDocument()
    expect(screen.getByTestId('stats-charts')).toBeInTheDocument()
  })

  it('shows all closed investments below the stats, grouped like the main page, in both views', async () => {
    mockAccounts()
    useInvestmentsHistory.mockReturnValue({ investments, loading: false, error: null, reload: vi.fn(), deleteInvestment: vi.fn() })

    render(<MemoryRouter><StatsPage /></MemoryRouter>)

    expect(screen.getByText('Closed Investments')).toBeInTheDocument()
    expect(screen.getAllByText('AAPL').length).toBeGreaterThan(0)
    expect(screen.getAllByText('QQQ').length).toBeGreaterThan(0)
    expect(screen.queryByText('MSFT')).not.toBeInTheDocument()
    expect(screen.getAllByText('Sell Price:').length).toBeGreaterThan(0)
    expect(screen.queryByRole('button', { name: /^close$/i })).not.toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /^delete$/i }).length).toBeGreaterThan(0)

    await userEvent.click(screen.getByRole('button', { name: /^charts$/i }))
    expect(screen.getByText('Closed Investments')).toBeInTheDocument()
    expect(screen.getAllByText('AAPL').length).toBeGreaterThan(0)
  })

  it('groups closed positions by close date, most recent first, with strategy inside each day', () => {
    mockAccounts()
    useInvestmentsHistory.mockReturnValue({ investments, loading: false, error: null, reload: vi.fn(), deleteInvestment: vi.fn() })

    const { container } = render(<MemoryRouter><StatsPage /></MemoryRouter>)

    const dayHeadings = [...container.querySelectorAll('.closed-day-group > .group-title')].map((el) => el.textContent)
    expect(dayHeadings[0]).toMatch(/Jan 12, 2026/)
    expect(dayHeadings[1]).toMatch(/Jan 10, 2026/)

    // The QQQ cash secured put closed on the 12th, the AAPL stock on the 10th.
    const firstDay = container.querySelectorAll('.closed-day-group')[0]
    expect(within(firstDay).getByText('Cash Secured Put')).toBeInTheDocument()
    expect(within(firstDay).queryByText('Stock')).not.toBeInTheDocument()
  })

  it('shows realized P&L for each close date', () => {
    mockAccounts()
    useInvestmentsHistory.mockReturnValue({ investments, loading: false, error: null, reload: vi.fn(), deleteInvestment: vi.fn() })

    const { container } = render(<MemoryRouter><StatsPage /></MemoryRouter>)

    // AAPL closed on the 10th for (150 - 100) x 10.
    const days = container.querySelectorAll('.closed-day-group')
    expect(days[1].querySelector('.closed-day-pnl')).toHaveTextContent('$500.00')
  })

  it('renders each closed-investment group as an expanded, collapsible dropdown', () => {
    mockAccounts()
    useInvestmentsHistory.mockReturnValue({ investments, loading: false, error: null, reload: vi.fn(), deleteInvestment: vi.fn() })

    render(<MemoryRouter><StatsPage /></MemoryRouter>)

    const stockDetails = screen.getByText('Stock').closest('details')
    expect(stockDetails).toHaveAttribute('open')
    const optionSummary = screen.getAllByText('Cash Secured Put').find((el) => el.closest('details'))
    expect(optionSummary.closest('details')).toHaveAttribute('open')
  })

  it('hides a group\'s trades when its dropdown arrow is clicked to collapse it', () => {
    mockAccounts()
    useInvestmentsHistory.mockReturnValue({ investments, loading: false, error: null, reload: vi.fn(), deleteInvestment: vi.fn() })

    render(<MemoryRouter><StatsPage /></MemoryRouter>)

    const stockSummary = screen.getByText('Stock')
    fireEvent.click(stockSummary)

    expect(stockSummary.closest('details')).not.toHaveAttribute('open')
  })

  it('calls deleteInvestment with the row id when Delete is clicked on a closed investment', async () => {
    mockAccounts()
    const deleteInvestment = vi.fn()
    useInvestmentsHistory.mockReturnValue({ investments, loading: false, error: null, reload: vi.fn(), deleteInvestment })

    const { container } = render(<MemoryRouter><StatsPage /></MemoryRouter>)

    // Scoped to the AAPL row rather than an index: closed positions are now
    // ordered by close date, so render position is not a stable identifier.
    // Scoped to the section too, since AAPL also appears in the Best Trade tile.
    const closed = container.querySelector('.closed-investments-section')
    const aaplRow = within(closed).getByText('AAPL').closest('.investment-row')
    await userEvent.click(within(aaplRow).getByRole('button', { name: /^delete$/i }))
    expect(deleteInvestment).toHaveBeenCalledWith('i1')
  })

  it('opens the edit modal pre-filled and calls updateInvestment on save for a closed investment', async () => {
    mockAccounts()
    const updateInvestment = vi.fn()
    useInvestmentsHistory.mockReturnValue({ investments, loading: false, error: null, reload: vi.fn(), deleteInvestment: vi.fn(), updateInvestment })

    const { container } = render(<MemoryRouter><StatsPage /></MemoryRouter>)

    const closed = container.querySelector('.closed-investments-section')
    const aaplRow = within(closed).getByText('AAPL').closest('.investment-row')
    await userEvent.click(within(aaplRow).getByRole('button', { name: /^edit$/i }))
    expect(screen.getByLabelText(/symbol/i)).toHaveValue('AAPL')

    const sharesInput = screen.getByLabelText(/shares/i)
    await userEvent.clear(sharesInput)
    await userEvent.type(sharesInput, '20')
    await userEvent.click(screen.getByRole('button', { name: /save/i }))

    expect(updateInvestment).toHaveBeenCalledWith('i1', expect.objectContaining({ shares: '20' }))
  })

  it('groups a closed option with no strategy under a category derived from option_type/option_direction, not Other', () => {
    mockAccounts()
    const legacyOption = {
      id: 'i4', status: 'closed', assetType: 'Option', symbol: 'TSLA',
      shares: 1, avgCost: 5, sellPrice: 2, sellDate: '2026-01-15',
      strategy: '', optionType: 'put', optionDirection: 'short', strike: 200, expiry: '2026-01-17',
    }
    useInvestmentsHistory.mockReturnValue({ investments: [...investments, legacyOption], loading: false, error: null, reload: vi.fn() })

    render(<MemoryRouter><StatsPage /></MemoryRouter>)

    expect(screen.getAllByText('Short Put').length).toBeGreaterThan(0)
    expect(screen.getAllByText('TSLA').length).toBeGreaterThan(0)
    expect(screen.queryByText('Strategy:')).not.toBeInTheDocument()
  })

  it('filters everything by sell date when a start date is set', () => {
    mockAccounts()
    useInvestmentsHistory.mockReturnValue({ investments, loading: false, error: null, reload: vi.fn(), deleteInvestment: vi.fn() })

    render(<MemoryRouter><StatsPage /></MemoryRouter>)

    fireEvent.change(screen.getByLabelText(/from/i), { target: { value: '2026-01-11' } })

    expect(screen.queryByText('AAPL')).not.toBeInTheDocument()
    expect(screen.getAllByText('QQQ').length).toBeGreaterThan(0)
    expect(screen.getByText('Closed Positions').closest('.stat-tile').querySelector('.stat-tile-value')).toHaveTextContent('1')
  })

  it('filters everything by sell date when an end date is set', () => {
    mockAccounts()
    useInvestmentsHistory.mockReturnValue({ investments, loading: false, error: null, reload: vi.fn(), deleteInvestment: vi.fn() })

    render(<MemoryRouter><StatsPage /></MemoryRouter>)

    fireEvent.change(screen.getByLabelText(/to/i), { target: { value: '2026-01-11' } })

    expect(screen.getAllByText('AAPL').length).toBeGreaterThan(0)
    expect(screen.queryByText('QQQ')).not.toBeInTheDocument()
  })

  it('filters open positions by buy date too, so the Open Positions count reflects the filter', () => {
    mockAccounts()
    useInvestmentsHistory.mockReturnValue({ investments, loading: false, error: null, reload: vi.fn(), deleteInvestment: vi.fn() })

    render(<MemoryRouter><StatsPage /></MemoryRouter>)

    fireEvent.change(screen.getByLabelText(/from/i), { target: { value: '2026-01-11' } })

    expect(screen.getByText('Open Positions').closest('.stat-tile').querySelector('.stat-tile-value')).toHaveTextContent('0')
  })

  it('clears the date range filter when Clear is clicked', () => {
    mockAccounts()
    useInvestmentsHistory.mockReturnValue({ investments, loading: false, error: null, reload: vi.fn(), deleteInvestment: vi.fn() })

    render(<MemoryRouter><StatsPage /></MemoryRouter>)

    fireEvent.change(screen.getByLabelText(/from/i), { target: { value: '2026-01-11' } })
    expect(screen.queryByText('AAPL')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /^clear$/i }))

    expect(screen.getAllByText('AAPL').length).toBeGreaterThan(0)
    expect(screen.getByLabelText(/from/i)).toHaveValue('')
  })

  it('keeps StatsCharts mounted (hidden) even in Numbers view, for PDF chart capture', () => {
    mockAccounts()
    useInvestmentsHistory.mockReturnValue({ investments, loading: false, error: null, reload: vi.fn(), deleteInvestment: vi.fn() })

    render(<MemoryRouter><StatsPage /></MemoryRouter>)

    expect(screen.getByTestId('stats-charts')).toBeInTheDocument()
  })

  it('calls buildExportData and generatePdfReport when Export PDF is clicked', async () => {
    mockAccounts()
    useInvestmentsHistory.mockReturnValue({ investments, loading: false, error: null, reload: vi.fn(), deleteInvestment: vi.fn() })
    buildExportData.mockReturnValue({ meta: {}, closedRows: [], openRows: [] })

    render(<MemoryRouter><StatsPage /></MemoryRouter>)

    await userEvent.click(screen.getByRole('button', { name: /export pdf/i }))

    expect(buildExportData).toHaveBeenCalled()
    expect(generatePdfReport).toHaveBeenCalled()
  })

  it('calls buildExportData and generateExcelWorkbook when Export Excel is clicked', async () => {
    mockAccounts()
    useInvestmentsHistory.mockReturnValue({ investments, loading: false, error: null, reload: vi.fn(), deleteInvestment: vi.fn() })
    buildExportData.mockReturnValue({ meta: {}, closedRows: [], openRows: [] })

    render(<MemoryRouter><StatsPage /></MemoryRouter>)

    await userEvent.click(screen.getByRole('button', { name: /export excel/i }))

    expect(buildExportData).toHaveBeenCalled()
    expect(generateExcelWorkbook).toHaveBeenCalled()
  })

  it('disables the export buttons while loading', () => {
    mockAccounts()
    useInvestmentsHistory.mockReturnValue({ investments: [], loading: true, error: null, reload: vi.fn(), deleteInvestment: vi.fn() })

    render(<MemoryRouter><StatsPage /></MemoryRouter>)

    expect(screen.getByRole('button', { name: /export pdf/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /export excel/i })).toBeDisabled()
  })

  it('shows an error banner with retry when loading fails', async () => {
    mockAccounts()
    const reload = vi.fn()
    useInvestmentsHistory.mockReturnValue({ investments: [], loading: false, error: { message: 'fail' }, reload })

    render(<MemoryRouter><StatsPage /></MemoryRouter>)

    expect(screen.getByText(/couldn.t load stats/i)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /retry/i }))
    expect(reload).toHaveBeenCalled()
  })
})
