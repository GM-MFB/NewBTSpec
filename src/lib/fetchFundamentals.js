const BASE = 'https://finnhub.io/api/v1'

async function safeFetchJson(url) {
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

function daysAgoISO(days) {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d.toISOString().slice(0, 10)
}

export async function fetchFundamentals(symbol, apiKey) {
  const [profile, quote, metric, recs, targets, news, earnings] = await Promise.allSettled([
    safeFetchJson(`${BASE}/stock/profile2?symbol=${symbol}&token=${apiKey}`),
    safeFetchJson(`${BASE}/quote?symbol=${symbol}&token=${apiKey}`),
    safeFetchJson(`${BASE}/stock/metric?symbol=${symbol}&metric=all&token=${apiKey}`),
    safeFetchJson(`${BASE}/stock/recommendation?symbol=${symbol}&token=${apiKey}`),
    safeFetchJson(`${BASE}/stock/price-target?symbol=${symbol}&token=${apiKey}`),
    safeFetchJson(`${BASE}/company-news?symbol=${symbol}&from=${daysAgoISO(30)}&to=${todayISO()}&token=${apiKey}`),
    safeFetchJson(`${BASE}/stock/earnings?symbol=${symbol}&token=${apiKey}`),
  ])

  const value = (r) => (r.status === 'fulfilled' ? r.value : null)
  const newsList = value(news)

  return {
    profile: value(profile),
    quote: value(quote),
    metrics: value(metric)?.metric ?? null,
    recs: Array.isArray(value(recs)) ? value(recs)[0] ?? null : null,
    targets: value(targets),
    news: Array.isArray(newsList) ? newsList.slice(0, 8) : [],
    earnings: value(earnings),
  }
}

export async function fetchPeers(symbol, apiKey) {
  const peers = await safeFetchJson(`${BASE}/stock/peers?symbol=${symbol}&token=${apiKey}`)
  return Array.isArray(peers) ? peers : []
}
