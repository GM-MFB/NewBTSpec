const currencyFormatter = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })
const wholeCurrencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
})

export function formatCurrency(value) {
  if (value === '' || value === undefined || value === null || Number.isNaN(Number(value))) return ''
  return currencyFormatter.format(Number(value))
}

export function formatCurrencyWhole(value) {
  if (value === '' || value === undefined || value === null || Number.isNaN(Number(value))) return ''
  return wholeCurrencyFormatter.format(Number(value))
}
