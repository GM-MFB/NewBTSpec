import { STRATEGIES, effectiveStrategyDef } from './optionStrategies'
import { realizedPnlFor } from './investmentStats'

const NO_DATE = 'No Date'

// Sorts most recent first, matching the day-trading log. Undated positions
// collect at the bottom rather than jumping to the top of the list.
function byDateDesc(a, b) {
  if (a === b) return 0
  if (a === NO_DATE) return 1
  if (b === NO_DATE) return -1
  return a < b ? 1 : -1
}

function groupKeyFor(investment) {
  if (investment.assetType === 'Stock') return { key: 'stock', label: 'Stock' }
  if (investment.assetType !== 'Option') return { key: 'other', label: 'Other' }

  const strategyDef = effectiveStrategyDef(investment)
  if (!strategyDef) return { key: 'other', label: 'Other' }
  return { key: strategyDef.value ?? strategyDef.label, label: strategyDef.label }
}

// Stock first, then the known strategies in their canonical order, then any
// derived fallback labels, and Other last.
function rankFor(key) {
  if (key === 'stock') return -1
  if (key === 'other') return STRATEGIES.length + 1
  const index = STRATEGIES.findIndex((s) => s.value === key)
  return index === -1 ? STRATEGIES.length : index
}

function buildStrategyGroups(investments) {
  const groups = new Map()

  for (const investment of investments) {
    const { key, label } = groupKeyFor(investment)
    if (!groups.has(key)) groups.set(key, { key, label, items: [] })
    groups.get(key).items.push(investment)
  }

  return [...groups.values()].sort((a, b) => {
    const diff = rankFor(a.key) - rankFor(b.key)
    return diff !== 0 ? diff : a.label.localeCompare(b.label)
  })
}

export function groupClosedByDateAndStrategy(investments) {
  const byDate = new Map()

  for (const investment of investments) {
    const date = investment.sellDate || NO_DATE
    if (!byDate.has(date)) byDate.set(date, [])
    byDate.get(date).push(investment)
  }

  return [...byDate.entries()]
    .sort((a, b) => byDateDesc(a[0], b[0]))
    .map(([date, items]) => {
      const pnls = items.map(realizedPnlFor).filter((p) => p !== null && p !== '' && !Number.isNaN(p))
      return {
        date,
        count: items.length,
        totalPnl: pnls.length > 0 ? pnls.reduce((sum, p) => sum + p, 0) : null,
        groups: buildStrategyGroups(items),
      }
    })
}
