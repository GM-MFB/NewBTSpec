import { useState } from 'react'
import { Link } from 'react-router-dom'
import './TradeRow.css'
import { pnlFor, tradeTypeLabel } from '../lib/tradeStats'
import { formatCurrency } from '../lib/format'
import { abbreviateUrl, normalizeUrl } from '../lib/url'

export default function TradeRow({ trade, onEdit, onDelete }) {
  const [expanded, setExpanded] = useState(false)
  const pnl = pnlFor(trade)
  const isOpen = pnl === null
  const pnlClass = pnl !== null ? (pnl >= 0 ? 'price-favorable' : 'price-unfavorable') : ''

  async function handleDelete() {
    try {
      await onDelete(trade.id)
    } catch (err) {
      window.alert(err.message)
    }
  }

  return (
    <li className="trade-row" data-testid="trade-row">
      <div
        className="trade-row-clickable"
        data-testid="trade-row-clickable"
        role="button"
        tabIndex={0}
        onClick={() => setExpanded((v) => !v)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            setExpanded((v) => !v)
          }
        }}
      >
        <div className="trade-row-top">
          <span className="mono trade-symbol">{trade.symbol}</span>
          <span className="trade-badge">{tradeTypeLabel(trade)}</span>
          <span className={`trade-direction trade-direction--${trade.direction}`}>{trade.direction}</span>
        </div>
        <div className="trade-row-meta mono">
          <span className="meta-item"><span className="meta-label">Qty:</span><span className="meta-value">{trade.quantity}</span></span>
          <span className="meta-item"><span className="meta-label">Entry:</span><span className="meta-value">{formatCurrency(trade.entryPrice)}</span></span>
          {isOpen ? (
            <span className="trade-open-badge">Open</span>
          ) : (
            <>
              <span className="meta-item"><span className="meta-label">Exit:</span><span className="meta-value">{formatCurrency(trade.exitPrice)}</span></span>
              <span className="meta-item"><span className="meta-label">P&L:</span><span className={`meta-value ${pnlClass}`}>{formatCurrency(pnl)}</span></span>
            </>
          )}
        </div>
      </div>

      <div className="trade-row-actions">
        <Link className="trade-chart-btn" to={`/charts?symbol=${encodeURIComponent(trade.symbol)}`}>Chart</Link>
        {onEdit && <button type="button" onClick={() => onEdit(trade)}>Edit</button>}
        {onDelete && <button type="button" className="danger" onClick={handleDelete}>Delete</button>}
      </div>

      {expanded && (
        <div className="trade-row-details">
          {trade.chartLink ? (
            <a className="trade-chart-link" href={normalizeUrl(trade.chartLink)} target="_blank" rel="noopener noreferrer">
              {abbreviateUrl(trade.chartLink)} ↗
            </a>
          ) : (
            <span className="trade-row-details-empty">No chart link added.</span>
          )}
          {trade.notes ? (
            <p className="trade-row-notes">{trade.notes}</p>
          ) : (
            <span className="trade-row-details-empty">No notes added.</span>
          )}
        </div>
      )}
    </li>
  )
}
