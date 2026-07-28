function toNum(value) {
  return value === '' || value === undefined || value === null ? 0 : Number(value)
}

function isBlank(value) {
  return value === '' || value === undefined || value === null
}

export function pnlFor(trade) {
  if (isBlank(trade.exitPrice) || isBlank(trade.entryPrice)) return null

  const sign = trade.direction === 'short' ? -1 : 1
  const rawMove = (toNum(trade.exitPrice) - toNum(trade.entryPrice)) * sign
  const quantity = toNum(trade.quantity)
  const fees = toNum(trade.fees)

  let gross
  if (trade.type === 'option') {
    gross = rawMove * quantity * 100
  } else if (trade.type === 'futures') {
    gross = rawMove * quantity * toNum(trade.pointValue)
  } else {
    gross = rawMove * quantity
  }

  return gross - fees
}

export function tradeTypeLabel(trade) {
  if (trade.type === 'option') {
    if (trade.optionType === 'put') return 'Put'
    if (trade.optionType === 'call') return 'Call'
    return 'Option'
  }
  if (trade.type === 'futures') return 'Futures'
  if (trade.type === 'stock') return 'Stock'
  return trade.type || ''
}
