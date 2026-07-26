export default async (request) => {
  const url = new URL(request.url)
  const symbol = url.searchParams.get('symbol')
  const interval = url.searchParams.get('interval') ?? '1wk'
  const range = url.searchParams.get('range') ?? '2y'
  if (!symbol) return new Response(JSON.stringify({ error: 'symbol required' }), { status: 400 })

  const upstream = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=${interval}&range=${range}`
  const res = await fetch(upstream, { headers: { 'User-Agent': 'Mozilla/5.0' } })
  const body = await res.text()
  return new Response(body, { status: res.status, headers: { 'Content-Type': 'application/json' } })
}

export const config = { path: '/yahoo-proxy' }
