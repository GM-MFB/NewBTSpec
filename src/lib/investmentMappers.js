import { strategyByValue } from './optionStrategies'

export function fromRow(row) {
  return {
    id: row.id,
    accountId: row.account_id,
    userId: row.user_id,
    createdAt: row.created_at,
    symbol: row.symbol ?? '',
    name: row.name ?? '',
    assetType: row.asset_type ?? '',
    sector: row.sector ?? '',
    shares: row.shares ?? '',
    avgCost: row.avg_cost ?? '',
    currentPrice: row.current_price ?? '',
    buyDate: row.buy_date ?? '',
    status: row.status ?? '',
    sellPrice: row.sell_price ?? '',
    sellDate: row.sell_date ?? '',
    stopLoss: row.stop_loss ?? '',
    targetPrice: row.target_price ?? '',
    chartLink: row.chart_link ?? '',
    notes: row.notes ?? '',
    optionType: row.option_type ?? '',
    optionDirection: row.option_direction ?? '',
    strike: row.strike ?? '',
    expiry: row.expiry ?? '',
    strategy: row.strategy ?? '',
    strike2: row.strike_2 ?? '',
  }
}

function blankToNull(value) {
  return value === '' || value === undefined ? null : value
}

export function toRow(investment) {
  const strategyDef = strategyByValue(investment.strategy)

  return {
    symbol: blankToNull(investment.symbol ? investment.symbol.toUpperCase() : investment.symbol),
    name: blankToNull(investment.name),
    asset_type: blankToNull(investment.assetType),
    sector: blankToNull(investment.sector),
    shares: blankToNull(investment.shares),
    avg_cost: blankToNull(investment.avgCost),
    current_price: blankToNull(investment.currentPrice),
    buy_date: blankToNull(investment.buyDate),
    status: blankToNull(investment.status),
    sell_price: blankToNull(investment.sellPrice),
    sell_date: blankToNull(investment.sellDate),
    stop_loss: blankToNull(investment.stopLoss),
    target_price: blankToNull(investment.targetPrice),
    chart_link: blankToNull(investment.chartLink),
    notes: blankToNull(investment.notes),
    option_type: strategyDef ? strategyDef.optionType : blankToNull(investment.optionType),
    option_direction: strategyDef ? strategyDef.optionDirection : blankToNull(investment.optionDirection),
    strike: blankToNull(investment.strike),
    expiry: blankToNull(investment.expiry),
    strategy: blankToNull(investment.strategy),
    strike_2: strategyDef?.isSpread ? blankToNull(investment.strike2) : null,
  }
}
