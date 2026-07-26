import { realizedPnlFor, unrealizedPnlFor } from './investmentStats'
import { effectiveStrategyDef } from './optionStrategies'

function toNum(value) {
  return value === '' || value === undefined || value === null ? 0 : Number(value)
}

function dateRangeLabel(startDate, endDate) {
  if (startDate && endDate) return `${startDate} – ${endDate}`
  if (startDate) return `From ${startDate}`
  if (endDate) return `Through ${endDate}`
  return 'All time'
}

function strategyLabelFor(investment) {
  const def = effectiveStrategyDef(investment)
  return def ? def.label : ''
}

export function buildExportData({ stats, closedInvestments, openInvestments, accountName, startDate, endDate }) {
  const closedRows = closedInvestments.map((investment) => ({
    symbol: investment.symbol,
    assetType: investment.assetType,
    strategyLabel: investment.assetType === 'Option' ? strategyLabelFor(investment) : '',
    avgCost: toNum(investment.avgCost),
    sellPrice: toNum(investment.sellPrice),
    sellDate: investment.sellDate,
    realizedPnl: realizedPnlFor(investment),
  }))

  const openRows = openInvestments.map((investment) => ({
    symbol: investment.symbol,
    assetType: investment.assetType,
    strategyLabel: investment.assetType === 'Option' ? strategyLabelFor(investment) : '',
    shares: toNum(investment.shares),
    avgCost: toNum(investment.avgCost),
    currentPrice: investment.currentPrice === '' ? '' : toNum(investment.currentPrice),
    unrealizedPnl: unrealizedPnlFor(investment),
  }))

  return {
    meta: {
      accountName,
      generatedAt: new Date().toISOString(),
      dateRangeLabel: dateRangeLabel(startDate, endDate),
    },
    overview: {
      totalRealizedPnl: stats.totalRealizedPnl,
      winRate: stats.winRate,
      totalClosed: stats.totalClosed,
      totalOpen: stats.totalOpen,
      avgWin: stats.avgWin,
      avgLoss: stats.avgLoss,
      bestTradeSymbol: stats.bestTrade ? stats.bestTrade.symbol : '',
      worstTradeSymbol: stats.worstTrade ? stats.worstTrade.symbol : '',
    },
    stock: stats.stock,
    options: stats.options,
    byStrategy: stats.byStrategy,
    bySymbol: stats.bySymbol,
    closedRows,
    openRows,
  }
}
