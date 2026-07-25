export async function fetchQuote(symbol, apiKey) {
  const url = `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(symbol)}&token=${encodeURIComponent(apiKey)}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Finnhub request failed for ${symbol}`)
  const data = await res.json()
  if (data.c === undefined || data.c === null) throw new Error(`No quote returned for ${symbol}`)
  return data.c
}
