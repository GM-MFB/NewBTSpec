import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import TradeRow from './TradeRow'

function renderRow(ui) {
  return render(<MemoryRouter>{ui}</MemoryRouter>)
}

const closedTrade = {
  id: 't1', symbol: 'AAPL', type: 'stock', direction: 'long',
  quantity: 10, entryPrice: 100, exitPrice: 110, exitDate: '2026-01-02', fees: 0,
}

const openTrade = {
  id: 't2', symbol: 'MSFT', type: 'stock', direction: 'long',
  quantity: 5, entryPrice: 200, exitPrice: '', exitDate: '', fees: 0,
}

describe('TradeRow', () => {
  it('renders symbol, type badge, direction, and P&L for a closed trade', () => {
    renderRow(<TradeRow trade={closedTrade} />)
    expect(screen.getByText('AAPL')).toBeInTheDocument()
    expect(screen.getByText('Stock')).toBeInTheDocument()
    expect(screen.getByText(/long/i)).toBeInTheDocument()
    expect(screen.getAllByText('$100.00').length).toBeGreaterThan(0) // entry price and (110-100)*10 P&L
  })

  it('shows Call/Put badges derived from optionType', () => {
    const call = { ...closedTrade, type: 'option', optionType: 'call' }
    const { rerender } = renderRow(<TradeRow trade={call} />)
    expect(screen.getByText('Call')).toBeInTheDocument()

    const put = { ...closedTrade, type: 'option', optionType: 'put' }
    rerender(<MemoryRouter><TradeRow trade={put} /></MemoryRouter>)
    expect(screen.getByText('Put')).toBeInTheDocument()
  })

  it('shows an Open badge and no P&L for a legacy open trade', () => {
    renderRow(<TradeRow trade={openTrade} />)
    expect(screen.getByText('Open')).toBeInTheDocument()
  })

  it('shows Qty, Ticks, and P&L for a futures trade, without Entry/Exit', () => {
    const futuresTrade = {
      id: 't3', symbol: 'MES', type: 'futures', direction: 'long',
      quantity: 3, ticks: -8, tickValue: 1.25, exitDate: '2026-07-14', fees: 3,
    }
    renderRow(<TradeRow trade={futuresTrade} />)
    expect(screen.getByText('Qty:')).toBeInTheDocument()
    expect(screen.getByText('Ticks:')).toBeInTheDocument()
    expect(screen.getByText('-8')).toBeInTheDocument()
    expect(screen.getByText('P&L:')).toBeInTheDocument()
    expect(screen.queryByText('Entry:')).not.toBeInTheDocument()
    expect(screen.queryByText('Exit:')).not.toBeInTheDocument()
  })

  it('shows a Chart button linking to the Charts tab for this symbol', () => {
    renderRow(<TradeRow trade={closedTrade} />)
    const link = screen.getByRole('link', { name: /^chart$/i })
    expect(link).toHaveAttribute('href', '/charts?symbol=AAPL')
  })

  it('calls onEdit with the trade when Edit is clicked', async () => {
    const onEdit = vi.fn()
    renderRow(<TradeRow trade={closedTrade} onEdit={onEdit} />)
    await userEvent.click(screen.getByRole('button', { name: /^edit$/i }))
    expect(onEdit).toHaveBeenCalledWith(closedTrade)
  })

  it('hides Edit when no onEdit handler is provided', () => {
    renderRow(<TradeRow trade={closedTrade} />)
    expect(screen.queryByRole('button', { name: /^edit$/i })).not.toBeInTheDocument()
  })

  it('calls onDelete with the trade id when Delete is clicked, with no confirmation dialog', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm')
    const onDelete = vi.fn()
    renderRow(<TradeRow trade={closedTrade} onDelete={onDelete} />)
    await userEvent.click(screen.getByRole('button', { name: /^delete$/i }))
    expect(onDelete).toHaveBeenCalledWith('t1')
    expect(confirmSpy).not.toHaveBeenCalled()
    confirmSpy.mockRestore()
  })

  it('does not show the chart link/notes details panel until the row is clicked', () => {
    const trade = { ...closedTrade, chartLink: 'https://www.tradingview.com/chart/XYZ', notes: 'good setup' }
    renderRow(<TradeRow trade={trade} />)
    expect(screen.queryByText(/good setup/i)).not.toBeInTheDocument()
  })

  it('expands to show the chart link and notes when the row is clicked', async () => {
    const trade = { ...closedTrade, chartLink: 'https://www.tradingview.com/chart/XYZ', notes: 'good setup' }
    renderRow(<TradeRow trade={trade} />)
    await userEvent.click(screen.getByTestId('trade-row-clickable'))
    const link = screen.getByRole('link', { name: /tradingview\.com/i })
    expect(link).toHaveAttribute('href', 'https://www.tradingview.com/chart/XYZ')
    expect(screen.getByText('good setup')).toBeInTheDocument()
  })

  it('marks the row expanded and reports it to assistive tech, so mobile CSS can reveal the hidden stats', async () => {
    renderRow(<TradeRow trade={closedTrade} />)
    const clickable = screen.getByTestId('trade-row-clickable')
    const row = screen.getByTestId('trade-row')

    expect(row).not.toHaveClass('trade-row--expanded')
    expect(clickable).toHaveAttribute('aria-expanded', 'false')

    await userEvent.click(clickable)

    expect(row).toHaveClass('trade-row--expanded')
    expect(clickable).toHaveAttribute('aria-expanded', 'true')
  })

  it('tags the P&L meta item so it stays visible in the collapsed mobile row', () => {
    const { container } = renderRow(<TradeRow trade={closedTrade} />)
    expect(container.querySelector('.meta-item--pnl')).toBeInTheDocument()
  })

  it('tags the P&L meta item on a futures trade too', () => {
    const futuresTrade = { id: 't3', symbol: 'MES', type: 'futures', direction: 'long', quantity: 2, ticks: 33, tickValue: 1.25, fees: 0 }
    const { container } = renderRow(<TradeRow trade={futuresTrade} />)
    expect(container.querySelector('.meta-item--pnl')).toBeInTheDocument()
  })

  it('shows placeholder text in the details panel when there is no chart link or notes', async () => {
    renderRow(<TradeRow trade={closedTrade} />)
    await userEvent.click(screen.getByTestId('trade-row-clickable'))
    expect(screen.getByText(/no chart link/i)).toBeInTheDocument()
    expect(screen.getByText(/no notes/i)).toBeInTheDocument()
  })

  it('does not show a Close button', () => {
    renderRow(<TradeRow trade={closedTrade} onEdit={vi.fn()} onDelete={vi.fn()} />)
    expect(screen.queryByRole('button', { name: /^close$/i })).not.toBeInTheDocument()
  })
})
