import { useState } from 'react'
import './RiskTab.css'
import { getPortfolioRiskMetrics, getStressTests, getRiskContribution } from '../../lib/efficientFrontier'
import { optionsCapitalAtRisk } from '../../lib/optionMath'
import { effectiveStrategyDef } from '../../lib/optionStrategies'
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
  const [expandedScenario, setExpandedScenario] = useState(null)
  const stockPositions = investments
    .filter((i) => ['Stock', 'ETF', 'Crypto'].includes(i.assetType))
    .map((i) => {
      const marketValue = i.shares * i.currentPrice
      return { symbol: i.symbol, assetType: i.assetType, marketValue, currentPrice: i.currentPrice, stopLoss: i.stopLoss || null, shares: i.shares }
    })

  const optionPositions = investments
    .filter((i) => i.assetType === 'Option')
    .map((i) => {
      const strategyDef = effectiveStrategyDef(i)
      const capitalAtRisk = optionsCapitalAtRisk(i, strategyDef)
      return {
        symbol: i.symbol,
        assetType: 'Option',
        strategyLabel: strategyDef?.label ?? 'Option',
        optionType: strategyDef?.optionType,
        optionDirection: strategyDef?.optionDirection,
        contracts: i.shares,
        capitalAtRisk,
        marketValue: capitalAtRisk,
      }
    })

  const positions = [...stockPositions, ...optionPositions]
  const totalMV = positions.reduce((sum, p) => sum + p.marketValue, 0)
  const withWeights = positions.map((p) => ({ ...p, weight: totalMV > 0 ? p.marketValue / totalMV : 0 }))

  const metrics = getPortfolioRiskMetrics(withWeights)
  const largestWeight = Math.max(...withWeights.map((p) => p.weight), 0)
  const stressTests = getStressTests(
    withWeights.filter((p) => p.assetType !== 'Option'),
    withWeights.filter((p) => p.assetType === 'Option'),
  )
  const riskContributions = getRiskContribution(withWeights)

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
        <p>{stockPositions.filter((p) => p.stopLoss).length} / {stockPositions.length} positions have a stop set</p>
        <p>$ at risk if all stops hit: {formatCurrency(metrics.dollarAtRisk)}</p>
        {metrics.stopCoveragePct < 80 && (
          <p className="risk-warning">Stop coverage is below 80% — consider setting stops on more positions.</p>
        )}
        <p className="risk-caption">Options have a defined max loss instead of a stop — see Options Risk below.</p>
      </section>

      <section className="risk-options">
        <h2>Options Risk</h2>
        {optionPositions.length === 0 ? (
          <p>No open option positions.</p>
        ) : (
          <>
            <table className="risk-table">
              <thead>
                <tr><th>Symbol</th><th>Strategy</th><th>Contracts</th><th>Capital at Risk</th><th>% of Portfolio</th></tr>
              </thead>
              <tbody>
                {optionPositions.map((p, idx) => (
                  <tr key={`${p.symbol}-${idx}`}>
                    <th scope="row">{p.symbol}</th>
                    <td className="mono">{p.strategyLabel}</td>
                    <td className="mono">{p.contracts}</td>
                    <td className="mono">{p.strategyLabel === 'Covered Call' ? 'Covered' : formatCurrency(p.capitalAtRisk)}</td>
                    <td className="mono">{(metrics.totalMV > 0 ? (p.capitalAtRisk / metrics.totalMV) * 100 : 0).toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p data-testid="options-total-risk">
              Total Options Capital at Risk: {formatCurrency(optionPositions.reduce((sum, p) => sum + p.capitalAtRisk, 0))}
              {' '}({(metrics.totalMV > 0 ? (optionPositions.reduce((sum, p) => sum + p.capitalAtRisk, 0) / metrics.totalMV) * 100 : 0).toFixed(1)}% of portfolio)
            </p>
          </>
        )}
      </section>

      <section className="risk-stress">
        <h2>Stress Tests</h2>
        <p className="risk-caption">Stock impacts are beta-scaled; option impacts show full max loss in the adverse direction only — a simplified bound, not a priced options model.</p>
        {stressTests.map((scenario) => (
          <div key={scenario.name} className="risk-stress-row">
            <button type="button" onClick={() => setExpandedScenario(expandedScenario === scenario.name ? null : scenario.name)}>
              {scenario.name} ({(scenario.portfolioMove * 100).toFixed(1)}%, {formatCurrency(scenario.totalImpact)})
            </button>
            {expandedScenario === scenario.name && (
              <table className="risk-table" data-testid="stress-scenario-table">
                <thead><tr><th>Symbol</th><th>Beta</th><th>Move %</th><th>$ Impact</th></tr></thead>
                <tbody>
                  {scenario.perPosition.map((p, idx) => (
                    <tr key={`${p.symbol}-${idx}`}>
                      <th scope="row">{p.symbol}</th>
                      <td className="mono">{p.beta === null ? '—' : p.beta.toFixed(2)}</td>
                      <td className="mono">{p.move === null ? '—' : `${(p.move * 100).toFixed(1)}%`}</td>
                      <td className="mono">{formatCurrency(p.impact)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        ))}
      </section>

      <section className="risk-contribution">
        <h2>Risk Contribution</h2>
        <table className="risk-table">
          <thead><tr><th>Symbol</th><th>Weight %</th><th>Risk %</th><th>Flag</th></tr></thead>
          <tbody>
            {riskContributions.map((c, idx) => (
              <tr key={`${c.symbol}-${idx}`}>
                <th scope="row">{c.symbol}</th>
                <td className="mono">{c.weightPct.toFixed(1)}%</td>
                <td className="mono">{c.riskPct.toFixed(1)}%</td>
                <td className={c.flag === 'outsized' ? 'risk-flag-outsized' : c.flag === 'efficient' ? 'risk-flag-efficient' : ''}>
                  {c.flag ?? '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  )
}
