import { useState } from 'react'
import { Link } from 'react-router-dom'
import './InvestmentRow.css'
import { effectiveStrategyDef } from '../lib/optionStrategies'
import { formatCurrency, formatCurrencyWhole, formatCurrencyAuto } from '../lib/format'
import { collateralFor, potentialPnlFor } from '../lib/optionMath'
import { realizedPnlFor, unrealizedPnlFor } from '../lib/investmentStats'
import { abbreviateUrl, normalizeUrl } from '../lib/url'

function daysLeftLabel(expiry) {
  if (!expiry) return ''
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const exp = new Date(expiry)
  if (Number.isNaN(exp.getTime())) return ''
  const diff = Math.round((exp - today) / 86400000)
  return diff < 0 ? 'Expired' : `${diff}d`
}

function isBlank(value) {
  return value === '' || value === undefined || value === null
}

function priceFavorability(investment, strategyDef) {
  if (isBlank(investment.currentPrice) || !strategyDef) return null
  const strike = Number(investment.strike)
  const currentPrice = Number(investment.currentPrice)
  const wantsAbove = (strategyDef.optionType === 'call') === (strategyDef.optionDirection === 'long')
  const favorable = wantsAbove ? currentPrice > strike : currentPrice < strike
  return favorable ? 'price-favorable' : 'price-unfavorable'
}

function MetaItem({ field, label, value, colorClass }) {
  if (isBlank(value)) return null
  return (
    <span className={`meta-item meta-item--${field}`}>
      <span className="meta-label">{label}:</span>
      <span className={`meta-value ${colorClass ?? ''}`}>{value}</span>
    </span>
  )
}

function StrikeMeta({ investment, strategyDef, strikeDisplay }) {
  const currentPriceDisplay = formatCurrency(investment.currentPrice)
  const favorability = priceFavorability(investment, strategyDef)

  return (
    <span className="meta-item meta-item--strike">
      <span className="meta-label">Strike:</span>
      <span className="meta-value">{strikeDisplay}</span>
      {currentPriceDisplay && (
        <>
          <span className="meta-separator">|</span>
          <span className={`meta-value ${favorability}`}>{currentPriceDisplay}</span>
        </>
      )}
    </span>
  )
}

export default function InvestmentRow({ investment, onClosePosition, onDelete, onEdit, coveredShares }) {
  const [expanded, setExpanded] = useState(false)
  const isOption = investment.assetType === 'Option'
  const isClosed = investment.status === 'closed'
  const strategyDef = effectiveStrategyDef(investment)
  const strikeDisplay = investment.strike2
    ? `${formatCurrencyAuto(investment.strike)}/${formatCurrencyAuto(investment.strike2)}`
    : formatCurrencyAuto(investment.strike)
  const collateral = isOption ? formatCurrencyWhole(collateralFor(investment, strategyDef)) : ''
  const potentialPnl = isOption ? formatCurrency(potentialPnlFor(investment, strategyDef)) : ''
  const sharesDisplay = coveredShares ? `${investment.shares}/${coveredShares}` : investment.shares
  const marketValue = !isOption && !isBlank(investment.currentPrice)
    ? formatCurrency(Number(investment.currentPrice) * Number(investment.shares))
    : ''

  const currentPriceClass = !isBlank(investment.currentPrice)
    ? (Number(investment.currentPrice) > Number(investment.avgCost) ? 'price-favorable' : 'price-unfavorable')
    : ''
  const unrealizedPnlRaw = unrealizedPnlFor(investment)
  const unrealizedPnlClass = !isBlank(unrealizedPnlRaw) ? (unrealizedPnlRaw >= 0 ? 'price-favorable' : 'price-unfavorable') : ''

  const realizedPnlRaw = isClosed ? realizedPnlFor(investment) : null
  const realizedPnlClass = realizedPnlRaw !== null ? (realizedPnlRaw >= 0 ? 'price-favorable' : 'price-unfavorable') : ''

  async function handleDelete() {
    try {
      await onDelete(investment.id)
    } catch (err) {
      window.alert(err.message)
    }
  }

  return (
    <li className={`investment-row${isClosed ? ' investment-row--closed' : ''}${expanded ? ' investment-row--expanded' : ''}`} data-testid="investment-row">
      <div
        className="investment-row-clickable"
        data-testid="investment-row-clickable"
        role="button"
        tabIndex={0}
        aria-expanded={expanded}
        onClick={() => setExpanded((v) => !v)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            setExpanded((v) => !v)
          }
        }}
      >
        <div className="investment-row-top">
          <span className="mono investment-symbol">{investment.symbol}</span>
        </div>
        <div className="investment-row-meta mono">
          {isOption ? (
            <>
              <MetaItem field="contracts" label="Contracts" value={investment.shares} />
              <StrikeMeta investment={investment} strategyDef={strategyDef} strikeDisplay={strikeDisplay} />
              <MetaItem field="expires" label="Expires" value={investment.expiry} />
              {!isClosed && <MetaItem field="days-left" label="Days Left" value={daysLeftLabel(investment.expiry)} />}
              <MetaItem field="avg-price" label="Avg Price" value={formatCurrency(investment.avgCost)} />
              {isClosed ? (
                <>
                  <MetaItem field="sell-price" label="Sell Price" value={formatCurrency(investment.sellPrice)} />
                  <MetaItem field="realized-pnl" label="Realized P&L" value={formatCurrency(realizedPnlRaw)} colorClass={realizedPnlClass} />
                </>
              ) : (
                <>
                  <MetaItem field="collateral" label="Collateral" value={collateral} />
                  <MetaItem field="pnl" label="P&L" value={potentialPnl} />
                </>
              )}
            </>
          ) : (
            <>
              <MetaItem field="shares" label="Shares" value={sharesDisplay} />
              <MetaItem field="market-value" label="Market Value" value={marketValue} />
              <MetaItem field="avg-cost" label="Avg Cost" value={formatCurrency(investment.avgCost)} />
              {isClosed ? (
                <>
                  <MetaItem field="sell-price" label="Sell Price" value={formatCurrency(investment.sellPrice)} />
                  <MetaItem field="realized-pnl" label="Realized P&L" value={formatCurrency(realizedPnlRaw)} colorClass={realizedPnlClass} />
                </>
              ) : (
                <>
                  <MetaItem field="current-price" label="Current Price" value={formatCurrency(investment.currentPrice)} colorClass={currentPriceClass} />
                  <MetaItem field="unrealized-pnl" label="Unrealized P&L" value={formatCurrency(unrealizedPnlRaw)} colorClass={unrealizedPnlClass} />
                </>
              )}
            </>
          )}
        </div>
      </div>

      <div className="investment-row-actions">
        <Link className="investment-chart-btn" to={`/charts?symbol=${encodeURIComponent(investment.symbol)}`}>Chart</Link>
        {onEdit && <button type="button" onClick={() => onEdit(investment)}>Edit</button>}
        {onClosePosition && <button type="button" onClick={() => onClosePosition(investment.id)}>Close</button>}
        {onDelete && <button type="button" className="danger" onClick={handleDelete}>Delete</button>}
      </div>

      {expanded && (
        <div className="investment-row-details">
          {investment.chartLink ? (
            <a
              className="investment-chart-link"
              href={normalizeUrl(investment.chartLink)}
              target="_blank"
              rel="noopener noreferrer"
            >
              {abbreviateUrl(investment.chartLink)} ↗
            </a>
          ) : (
            <span className="investment-row-details-empty">No chart link added.</span>
          )}
          {investment.notes ? (
            <p className="investment-row-notes">{investment.notes}</p>
          ) : (
            <span className="investment-row-details-empty">No notes added.</span>
          )}
        </div>
      )}
    </li>
  )
}
