const PALETTE = ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#008300', '#9085e9', '#e66767']

export function assignColors(keys) {
  const colorMap = {}
  let i = 0
  for (const key of keys) {
    if (colorMap[key]) continue
    colorMap[key] = PALETTE[i % PALETTE.length]
    i += 1
  }
  return colorMap
}
