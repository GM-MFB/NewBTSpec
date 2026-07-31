import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import TradeCalendar from './TradeCalendar'

function pad2(n) {
  return String(n).padStart(2, '0')
}

describe('TradeCalendar', () => {
  it('opens to the current month and renders 42 day cells', () => {
    render(<TradeCalendar trades={[]} />)
    expect(screen.getAllByTestId('trade-calendar-day')).toHaveLength(42)
  })

  it('shows the current month/year in the title', () => {
    const now = new Date()
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
    render(<TradeCalendar trades={[]} />)
    expect(screen.getByText(`${monthNames[now.getMonth()]} ${now.getFullYear()}`)).toBeInTheDocument()
  })

  it('shows the summed P&L for a day with trades, colored positive', () => {
    const now = new Date()
    const exitDate = `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-01`
    const trades = [
      { type: 'stock', direction: 'long', quantity: 10, entryPrice: 100, exitPrice: 110, exitDate, fees: 0 },
    ]
    render(<TradeCalendar trades={trades} />)
    expect(screen.getByText('$100.00')).toBeInTheDocument()
  })

  it('also renders an abbreviated amount, so a ~44px phone cell has something that fits', () => {
    const now = new Date()
    const exitDate = `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-01`
    const trades = [
      { type: 'stock', direction: 'long', quantity: 100, entryPrice: 100, exitPrice: 112.05, exitDate, fees: 0 },
    ]
    render(<TradeCalendar trades={trades} />)

    // Full amount for desktop, abbreviated for mobile; CSS picks one.
    expect(screen.getByText('$1,205.00')).toBeInTheDocument()
    expect(screen.getByText('+1.2k')).toBeInTheDocument()
  })

  it('shows no P&L line for a day with no trades', () => {
    render(<TradeCalendar trades={[]} />)
    const dayCells = screen.getAllByTestId('trade-calendar-day')
    for (const cell of dayCells) {
      expect(cell.querySelector('.trade-calendar-pnl')).toBeNull()
    }
  })

  it('navigates to the previous and next month', async () => {
    const now = new Date()
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
    render(<TradeCalendar trades={[]} />)

    await userEvent.click(screen.getByRole('button', { name: /previous month/i }))
    const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    expect(screen.getByText(`${monthNames[prevMonth.getMonth()]} ${prevMonth.getFullYear()}`)).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /next month/i }))
    expect(screen.getByText(`${monthNames[now.getMonth()]} ${now.getFullYear()}`)).toBeInTheDocument()
  })

  it('returns to the current month when Today is clicked', async () => {
    const now = new Date()
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
    render(<TradeCalendar trades={[]} />)

    await userEvent.click(screen.getByRole('button', { name: /previous month/i }))
    await userEvent.click(screen.getByRole('button', { name: /^today$/i }))
    expect(screen.getByText(`${monthNames[now.getMonth()]} ${now.getFullYear()}`)).toBeInTheDocument()
  })
})
