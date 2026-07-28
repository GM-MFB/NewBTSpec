export function fromRow(row) {
  return {
    id: row.id,
    accountId: row.account_id,
    userId: row.user_id,
    createdAt: row.created_at,
    type: row.type ?? '',
    symbol: row.symbol ?? '',
    optionType: row.option_type ?? '',
    strike: row.strike ?? '',
    expiry: row.expiry ?? '',
    direction: row.direction ?? '',
    quantity: row.quantity ?? '',
    entryPrice: row.entry_price ?? '',
    exitPrice: row.exit_price ?? '',
    entryDate: row.entry_date ?? '',
    exitDate: row.exit_date ?? '',
    status: row.status ?? '',
    fees: row.fees ?? '',
    notes: row.notes ?? '',
    chartLink: row.chart_link ?? '',
    pointValue: row.point_value ?? '',
  }
}

function blankToNull(value) {
  return value === '' || value === undefined ? null : value
}

export function toRow(trade) {
  return {
    type: blankToNull(trade.type),
    symbol: blankToNull(trade.symbol ? trade.symbol.toUpperCase() : trade.symbol),
    option_type: blankToNull(trade.optionType),
    strike: blankToNull(trade.strike),
    expiry: blankToNull(trade.expiry),
    direction: blankToNull(trade.direction),
    quantity: blankToNull(trade.quantity),
    entry_price: blankToNull(trade.entryPrice),
    exit_price: blankToNull(trade.exitPrice),
    entry_date: blankToNull(trade.entryDate),
    exit_date: blankToNull(trade.exitDate),
    status: blankToNull(trade.status),
    fees: blankToNull(trade.fees),
    notes: blankToNull(trade.notes),
    chart_link: blankToNull(trade.chartLink),
    point_value: blankToNull(trade.pointValue),
  }
}
