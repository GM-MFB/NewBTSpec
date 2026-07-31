import { collateralFor } from './optionMath'
import { effectiveStrategyDef } from './optionStrategies'
import { realizedPnlFor } from './investmentStats'

const MS_PER_DAY = 86400000

// The capital a position actually ties up, which is what a return should be
// measured against. For a short put or credit spread that is the collateral,
// not the premium — earning $150 against $38,000 of committed cash is a very
// different trade from earning it against $150.
export function capitalDeployedFor(investment) {
  if (investment.assetType === 'Option') {
    const strategyDef = effectiveStrategyDef(investment)
    if (strategyDef?.optionDirection === 'short') {
      return Number(collateralFor(investment, strategyDef)) || 0
    }
    return (Number(investment.avgCost) || 0) * 100 * (Number(investment.shares) || 0)
  }
  return (Number(investment.avgCost) || 0) * (Number(investment.shares) || 0)
}

export function daysHeldFor(investment) {
  if (!investment.buyDate || !investment.sellDate) return null

  const opened = new Date(`${investment.buyDate}T00:00:00`)
  const closed = new Date(`${investment.sellDate}T00:00:00`)
  if (Number.isNaN(opened.getTime()) || Number.isNaN(closed.getTime())) return null

  const days = Math.round((closed - opened) / MS_PER_DAY)
  return days < 0 ? null : days
}

// Simple annualization — the period return scaled by how many such periods fit
// in a year — rather than compounding. Compounding assumes the trade could be
// repeated back to back all year, which turns a good three-day trade into a
// fantasy number.
//
// Returns a fraction (0.26 for 26%), or null when there is nothing honest to
// report: an open position, missing dates, or a covered call, whose deployed
// capital is the underlying shares rather than cash the app can see.
export function annualizedReturnFor(investment) {
  const pnl = realizedPnlFor(investment)
  if (pnl === null) return null

  const capital = capitalDeployedFor(investment)
  if (!capital || capital <= 0) return null

  const days = daysHeldFor(investment)
  if (days === null) return null

  // A same-day close still commits the capital for a day; without the floor
  // this divides by zero.
  return (pnl / capital) * (365 / Math.max(days, 1))
}
