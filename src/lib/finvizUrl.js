export function buildFinvizUrl(filters) {
  const codes = Object.values(filters).filter((v) => v)
  if (codes.length === 0) return 'https://finviz.com/screener.ashx'
  return `https://finviz.com/screener.ashx?f=${codes.join(',')}`
}
