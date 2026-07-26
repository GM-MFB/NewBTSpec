const CRYPTO_SKIP = new Set(['BTC', 'ETH', 'SOL', 'BNB', 'XRP', 'ADA', 'DOGE', 'AVAX', 'DOT', 'MATIC', 'SHIB', 'LTC'])
const CACHE_KEY = 'bt_returns_cache_v2'
const CACHE_TTL_MS = 24 * 60 * 60 * 1000

function weeklyReturns(closes) {
  const present = closes.filter((c) => c !== null && c !== undefined)
  const returns = []
  for (let i = 1; i < present.length; i += 1) {
    returns.push(present[i] / present[i - 1] - 1)
  }
  return returns
}

async function getReturnsForSymbol(symbol) {
  const cacheRaw = localStorage.getItem(CACHE_KEY)
  const cache = cacheRaw ? JSON.parse(cacheRaw) : {}
  const entry = cache[symbol]
  if (entry && Date.now() - entry._ts < CACHE_TTL_MS) {
    return entry.returns
  }

  const res = await fetch(`/yahoo-proxy?symbol=${symbol}&interval=1wk&range=2y`)
  const body = JSON.parse(await res.text())
  const closes = body.chart.result[0].indicators.quote[0].close
  const returns = weeklyReturns(closes)

  cache[symbol] = { returns, _ts: Date.now() }
  localStorage.setItem(CACHE_KEY, JSON.stringify(cache))
  return returns
}

export async function fetchCorrelations(symbols) {
  const eligible = symbols.filter((s) => !CRYPTO_SKIP.has(s))
  const returnsMap = {}

  for (const symbol of eligible) {
    try {
      // eslint-disable-next-line no-await-in-loop
      returnsMap[symbol] = await getReturnsForSymbol(symbol)
    } catch {
      // omitted from the maps below; caller's static fallback absorbs the gap
    }
  }

  const fetched = Object.keys(returnsMap)
  const paramsMap = {}
  for (const symbol of fetched) {
    paramsMap[symbol] = computeAssetParams(returnsMap[symbol])
  }

  const corrMap = {}
  for (const a of fetched) {
    corrMap[a] = {}
    for (const b of fetched) {
      if (a === b) continue
      const corr = pearson(returnsMap[a], returnsMap[b])
      if (corr !== null) corrMap[a][b] = corr
    }
  }

  return { corrMap, paramsMap }
}

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
