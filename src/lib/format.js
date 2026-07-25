const currencyFormatter = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })

export function formatCurrency(value) {
  if (value === '' || value === undefined || value === null || Number.isNaN(Number(value))) return ''
  return currencyFormatter.format(Number(value))
}
