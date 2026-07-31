const currencyFormatter = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })
const wholeCurrencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
})
const autoCurrencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
})

export function formatCurrency(value) {
  if (value === '' || value === undefined || value === null || Number.isNaN(Number(value))) return ''
  return currencyFormatter.format(Number(value))
}

export function formatCurrencyWhole(value) {
  if (value === '' || value === undefined || value === null || Number.isNaN(Number(value))) return ''
  return wholeCurrencyFormatter.format(Number(value))
}

export function formatCurrencyAuto(value) {
  if (value === '' || value === undefined || value === null || Number.isNaN(Number(value))) return ''
  return autoCurrencyFormatter.format(Number(value))
}

export function formatDecimal(value) {
  if (value === '' || value === undefined || value === null || Number.isNaN(Number(value))) return ''
  return Number(value).toFixed(2)
}

function compactMagnitude(abs) {
  if (abs >= 1e6) return `${(abs / 1e6).toFixed(1)}M`
  if (abs >= 1000) return `${(abs / 1000).toFixed(1)}k`
  return String(Math.round(abs))
}

// A calendar cell on a phone is roughly 44px wide — "+$1,205.00" does not fit
// in that, so day P&L is abbreviated to "+1.2k".
export function formatCompactCurrency(value) {
  if (value === '' || value === undefined || value === null || Number.isNaN(Number(value))) return ''
  const n = Number(value)
  if (n === 0) return '0'
  return `${n > 0 ? '+' : '-'}${compactMagnitude(Math.abs(n))}`
}

// Same abbreviation for chart axis ticks, minus the leading plus — axes carry
// a scale, not a gain, so a "+" on every positive tick reads as noise.
export function formatAxisCurrency(value) {
  if (value === '' || value === undefined || value === null || Number.isNaN(Number(value))) return ''
  const n = Number(value)
  if (n === 0) return '0'
  return `${n < 0 ? '-' : ''}${compactMagnitude(Math.abs(n))}`
}

export function formatLarge(value) {
  if (value === '' || value === undefined || value === null || Number.isNaN(Number(value))) return ''
  const n = Number(value)
  const abs = Math.abs(n)
  if (abs >= 1e12) return `$${(n / 1e12).toFixed(2)}T`
  if (abs >= 1e9) return `$${(n / 1e9).toFixed(2)}B`
  if (abs >= 1e6) return `$${(n / 1e6).toFixed(2)}M`
  return formatCurrency(n)
}
