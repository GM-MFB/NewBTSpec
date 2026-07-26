import './FundamentalsTab.css'
import { unrealizedPnlFor } from '../../lib/investmentStats'
import { formatCurrency, formatCurrencyAuto, formatLarge, formatDecimal } from '../../lib/format'

function toneFor(value, { greenAbove, redAbove, greenBelow, redBelow } = {}) {
  if (value === undefined || value === null) return ''
  if (redAbove !== undefined && value > redAbove) return 'negative'
  if (greenAbove !== undefined && value > greenAbove) return 'positive'
  if (redBelow !== undefined && value < redBelow) return 'negative'
  if (greenBelow !== undefined && value < greenBelow) return 'positive'
  return ''
}

function StatTile({ label, value, tone }) {
  if (value === undefined || value === null || value === '') return null
  return (
    <div className="fund-stat-tile">
      <span className="fund-stat-label">{label}</span>
      <span className={`fund-stat-value mono ${tone ? `fund-stat-value--${tone}` : ''}`}>{value}</span>
    </div>
  )
}

export default function SymbolPanels({ symbol, result, investment, peers, onResearchPeer }) {
  return (
    <div className="fund-panels">
      <div className="fund-header">
        <span className="fund-symbol">{symbol}</span>
        <span>{result.profile?.name}</span>
        <span className="fund-meta">{result.profile?.exchange} · {result.profile?.finnhubIndustry}</span>
        {result.quote?.c !== undefined && (
          <span className="mono">
            {formatCurrency(result.quote.c)}
            {result.quote.pc ? ` (${(((result.quote.c - result.quote.pc) / result.quote.pc) * 100).toFixed(2)}%)` : ''}
          </span>
        )}
      </div>

      {investment && (
        <section className="fund-section">
          <h2>Your Position</h2>
          <div className="fund-stat-grid">
            <StatTile label="Shares" value={investment.shares} />
            <StatTile label="Avg Cost" value={formatCurrency(investment.avgCost)} />
            <StatTile label="Market Value" value={formatCurrency(Number(investment.currentPrice) * Number(investment.shares))} />
            <StatTile
              label="Unrealized P&L"
              value={formatCurrency(unrealizedPnlFor(investment))}
              tone={unrealizedPnlFor(investment) >= 0 ? 'positive' : 'negative'}
            />
          </div>
        </section>
      )}

      {peers?.length > 0 && (
        <section className="fund-section">
          <h2>Similar Stocks</h2>
          <div className="fund-symbol-picker">
            {peers.map((peer) => (
              <button key={peer} type="button" className="fund-chip" onClick={() => onResearchPeer(peer)}>{peer}</button>
            ))}
          </div>
        </section>
      )}

      <section className="fund-section">
        <h2>Valuation</h2>
        <div className="fund-stat-grid">
          <StatTile label="Market Cap" value={result.metrics?.marketCapitalization ? formatLarge(result.metrics.marketCapitalization * 1e6) : null} />
          <StatTile label="P/E" value={formatDecimal(result.metrics?.peBasicExclExtraTTM)} tone={toneFor(result.metrics?.peBasicExclExtraTTM, { redAbove: 30, greenBelow: 15 })} />
          <StatTile label="Forward P/E" value={formatDecimal(result.metrics?.peTTM)} />
          <StatTile label="P/S" value={formatDecimal(result.metrics?.psTTM)} />
          <StatTile label="P/B" value={formatDecimal(result.metrics?.pbQuarterly)} />
          <StatTile label="EV/EBITDA" value={formatDecimal(result.metrics?.evEbitdaTTM)} />
          <StatTile label="EPS TTM" value={formatDecimal(result.metrics?.epsTTM)} />
          <StatTile label="Div Yield" value={formatDecimal(result.metrics?.dividendYieldIndicatedAnnual)} />
        </div>
      </section>

      <section className="fund-section">
        <h2>Growth & Profitability</h2>
        <div className="fund-stat-grid">
          <StatTile label="Rev/Share" value={formatDecimal(result.metrics?.revenuePerShareTTM)} />
          <StatTile label="ROE" value={formatDecimal(result.metrics?.roeTTM)} tone={toneFor(result.metrics?.roeTTM, { greenAbove: 15, redBelow: 0 })} />
          <StatTile label="ROA" value={formatDecimal(result.metrics?.roaTTM)} tone={toneFor(result.metrics?.roaTTM, { greenAbove: 5 })} />
          <StatTile label="Net Margin" value={formatDecimal(result.metrics?.netProfitMarginTTM)} />
          <StatTile label="Gross Margin" value={formatDecimal(result.metrics?.grossMarginTTM)} />
          <StatTile label="Rev Growth YoY" value={formatDecimal(result.metrics?.revenueGrowthTTMYoy)} />
          <StatTile label="EPS Growth YoY" value={formatDecimal(result.metrics?.epsGrowthTTMYoy)} />
        </div>
      </section>

      <section className="fund-section">
        <h2>Risk & Price Range</h2>
        <div className="fund-stat-grid">
          <StatTile label="Beta" value={formatDecimal(result.metrics?.beta)} tone={toneFor(result.metrics?.beta, { redAbove: 1.5, greenBelow: 0.8 })} />
          <StatTile label="Debt/Equity" value={formatDecimal(result.metrics?.['totalDebt/totalEquityQuarterly'])} tone={toneFor(result.metrics?.['totalDebt/totalEquityQuarterly'], { redAbove: 2 })} />
          <StatTile label="Current Ratio" value={formatDecimal(result.metrics?.currentRatioQuarterly)} tone={toneFor(result.metrics?.currentRatioQuarterly, { greenAbove: 1.5, redBelow: 1 })} />
          <StatTile label="52W High" value={formatCurrencyAuto(result.metrics?.['52WeekHigh'])} />
          <StatTile label="52W Low" value={formatCurrencyAuto(result.metrics?.['52WeekLow'])} />
          <StatTile label="Shares Outstanding" value={result.metrics?.marketCapitalization && result.quote?.c ? Math.round((result.metrics.marketCapitalization * 1e6) / result.quote.c).toLocaleString() : null} />
        </div>
      </section>

      {result.earnings?.earnings?.length > 0 && (
        <section className="fund-section">
          <h2>Earnings History</h2>
          <table className="fund-table">
            <thead>
              <tr><th>Period</th><th>Actual</th><th>Estimate</th></tr>
            </thead>
            <tbody>
              {[...result.earnings.earnings].slice(0, 8).reverse().map((e, idx) => (
                <tr key={idx}>
                  <td>{e.period}</td>
                  <td className="mono">{formatDecimal(e.actual)}</td>
                  <td className="mono">{formatDecimal(e.estimate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {result.news?.length > 0 && (
        <section className="fund-section">
          <h2>Recent News</h2>
          <ul className="fund-news-list">
            {result.news.map((item) => (
              <li key={item.id}>
                <a href={item.url} target="_blank" rel="noreferrer">{item.headline}</a>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
