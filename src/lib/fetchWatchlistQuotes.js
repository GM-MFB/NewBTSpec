export async function fetchWatchlistQuote(symbol, apiKey) {
  const url = `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(symbol)}&token=${encodeURIComponent(apiKey)}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Finnhub request failed for ${symbol}`)
  const data = await res.json()
  return { price: data.c, changePct: data.dp }
}
