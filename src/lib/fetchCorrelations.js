export function computeAssetParams(returns) {
  const mean = returns.reduce((a, b) => a + b, 0) / returns.length
  const variance = returns.reduce((sum, r) => sum + (r - mean) ** 2, 0) / returns.length
  const stddev = Math.sqrt(variance)
  return { r: mean * 52, s: stddev * Math.sqrt(52) }
}

export function pearson(a, b) {
  const n = Math.min(a.length, b.length)
  if (n < 8) return null
  const ta = a.slice(a.length - n)
  const tb = b.slice(b.length - n)

  const meanA = ta.reduce((x, y) => x + y, 0) / n
  const meanB = tb.reduce((x, y) => x + y, 0) / n

  let cov = 0
  let varA = 0
  let varB = 0
  for (let i = 0; i < n; i += 1) {
    const da = ta[i] - meanA
    const db = tb[i] - meanB
    cov += da * db
    varA += da * da
    varB += db * db
  }
  const denom = Math.sqrt(varA * varB)
  return denom === 0 ? null : cov / denom
}
