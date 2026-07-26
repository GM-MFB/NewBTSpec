export const STRATEGIES = [
  { value: 'call', label: 'Call', optionType: 'call', optionDirection: 'long', isSpread: false },
  { value: 'put', label: 'Put', optionType: 'put', optionDirection: 'long', isSpread: false },
  { value: 'cash_secured_put', label: 'Cash Secured Put', optionType: 'put', optionDirection: 'short', isSpread: false },
  { value: 'covered_call', label: 'Covered Call', optionType: 'call', optionDirection: 'short', isSpread: false },
  { value: 'put_credit_spread', label: 'Put Credit Spread', optionType: 'put', optionDirection: 'short', isSpread: true },
  { value: 'call_credit_spread', label: 'Call Credit Spread', optionType: 'call', optionDirection: 'short', isSpread: true },
]

export function strategyByValue(value) {
  return STRATEGIES.find((s) => s.value === value)
}

function isBlank(value) {
  return value === '' || value === undefined || value === null
}

function capitalize(value) {
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : ''
}

export function effectiveStrategyDef(investment) {
  const strategyDef = strategyByValue(investment.strategy)
  if (strategyDef) return strategyDef
  const { optionType, optionDirection } = investment
  if (isBlank(optionType) || isBlank(optionDirection)) return null
  return {
    value: null,
    label: `${capitalize(optionDirection)} ${capitalize(optionType)}`,
    optionType,
    optionDirection,
    isSpread: false,
  }
}
