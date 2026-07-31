import { useState } from 'react'
import './TradeCalendar.css'
import { buildMonthGrid } from '../lib/tradeCalendar'
import { formatCurrency, formatCompactCurrency } from '../lib/format'

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTH_LABELS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

export default function TradeCalendar({ trades }) {
  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())

  const rows = buildMonthGrid(trades, year, month)

  function goToPrevMonth() {
    if (month === 0) {
      setYear((y) => y - 1)
      setMonth(11)
    } else {
      setMonth((m) => m - 1)
    }
  }

  function goToNextMonth() {
    if (month === 11) {
      setYear((y) => y + 1)
      setMonth(0)
    } else {
      setMonth((m) => m + 1)
    }
  }

  function goToToday() {
    setYear(today.getFullYear())
    setMonth(today.getMonth())
  }

  return (
    <div className="trade-calendar" data-testid="trade-calendar">
      <div className="trade-calendar-header">
        <button type="button" aria-label="Previous month" onClick={goToPrevMonth}>‹</button>
        <span className="trade-calendar-title">{MONTH_LABELS[month]} {year}</span>
        <button type="button" aria-label="Next month" onClick={goToNextMonth}>›</button>
        <button type="button" className="trade-calendar-today" onClick={goToToday}>Today</button>
      </div>

      <div className="trade-calendar-weekdays">
        {WEEKDAY_LABELS.map((d) => (
          <span key={d}>{d}</span>
        ))}
      </div>

      <div className="trade-calendar-grid">
        {rows.map((row, i) => (
          <div key={i} className="trade-calendar-row">
            {row.map((cell, j) => (
              <div
                key={j}
                data-testid="trade-calendar-day"
                className={`trade-calendar-day${cell.inMonth ? '' : ' trade-calendar-day--outside'}${cell.pnl != null ? (cell.pnl >= 0 ? ' trade-calendar-day--positive' : ' trade-calendar-day--negative') : ''}`}
              >
                <span className="trade-calendar-daynum">{cell.dayNum}</span>
                {cell.pnl != null && (
                  <>
                    {/* Both are rendered and the media query picks one — a phone
                        cell is ~44px wide, far too narrow for "+$1,205.00". */}
                    <span className="trade-calendar-pnl">{formatCurrency(cell.pnl)}</span>
                    <span className="trade-calendar-pnl trade-calendar-pnl--compact" aria-hidden="true">
                      {formatCompactCurrency(cell.pnl)}
                    </span>
                  </>
                )}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
