export function normalizeUrl(url) {
  if (!url) return ''
  return url.includes('://') ? url : `https://${url}`
}

export function abbreviateUrl(url) {
  if (!url) return ''
  try {
    const hostname = new URL(normalizeUrl(url)).hostname
    return hostname.replace(/^www\./, '')
  } catch {
    return url.length > 30 ? `${url.slice(0, 30)}…` : url
  }
}
