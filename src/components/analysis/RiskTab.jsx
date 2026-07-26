import './RiskTab.css'
import { getPortfolioRiskMetrics } from '../../lib/efficientFrontier'
import { formatCurrency } from '../../lib/format'

function betaBand(beta) {
  if (beta > 1.5) return 'risk-red'
  if (beta > 1.1) return 'risk-yellow'
  if (beta < 0.8) return 'risk-green'
  return 'risk-neutral'
}

function scoreBand(score) {
  if (score > 70) return 'risk-green'
  if (score > 50) return 'risk-yellow'
  return 'risk-red'
}

function coverageBand(pct) {
  if (pct >= 80) return 'risk-green'
  if (pct >= 50) return 'risk-yellow'
  return 'risk-red'
}

export default function RiskTab({ investments }) {
  const positions = investments
    .filter((i) => ['Stock', 'ETF', 'Crypto'].includes(i.assetType))
    .map((i) => {
      const marketValue = i.shares * i.currentPrice
      return { symbol: i.symbol, marketValue, currentPrice: i.currentPrice, stopLoss: i.stopLoss || null, shares: i.shares }
    })

  const totalMV = positions.reduce((sum, p) => sum + p.marketValue, 0)
  const withWeights = positions.map((p) => ({ ...p, weight: totalMV > 0 ? p.marketValue / totalMV : 0 }))

  const metrics = getPortfolioRiskMetrics(withWeights)
  const largestWeight = Math.max(...withWeights.map((p) => p.weight), 0)

  return (
    <div className="risk-tab">
      <div className="risk-hero">
        <div className={`risk-tile ${betaBand(metrics.beta)}`}>
          <span className="risk-tile-label">Portfolio Beta</span>
          <span className="risk-tile-value">{metrics.beta.toFixed(2)}</span>
        </div>
        <div className="risk-tile">
          <span className="risk-tile-label">1-Day 95% VaR</span>
          <span className="risk-tile-value">{formatCurrency(metrics.var95)}</span>
        </div>
        <div className={`risk-tile ${scoreBand(metrics.diversificationScore)}`}>
          <span className="risk-tile-label">Diversification Score</span>
          <span className="risk-tile-value">{metrics.diversificationScore}/100</span>
        </div>
        <div className={`risk-tile ${coverageBand(metrics.stopCoveragePct)}`}>
          <span className="risk-tile-label">Stop Coverage</span>
          <span className="risk-tile-value">{metrics.stopCoveragePct.toFixed(0)}%</span>
        </div>
      </div>

      <section className="risk-concentration">
        <h2>Concentration Risk</h2>
        <p>Largest position: {(largestWeight * 100).toFixed(1)}%</p>
        <p>HHI: {metrics.hhi.toFixed(3)}</p>
        <p>Total Portfolio: {formatCurrency(metrics.totalMV)}</p>
        <p>Expected Return: {(metrics.expectedReturn * 100).toFixed(1)}%</p>
        <p>Volatility: {(metrics.volatility * 100).toFixed(1)}%</p>
      </section>

      <section className="risk-stoploss">
        <h2>Stop Loss Protection</h2>
        <p>{withWeights.filter((p) => p.stopLoss).length} / {withWeights.length} positions have a stop set</p>
        <p>$ at risk if all stops hit: {formatCurrency(metrics.dollarAtRisk)}</p>
        {metrics.stopCoveragePct < 80 && (
          <p className="risk-warning">Stop coverage is below 80% — consider setting stops on more positions.</p>
        )}
      </section>
    </div>
  )
}
