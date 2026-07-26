export function pctChange(current, previous) {
  if (current === null || current === undefined) return null
  if (previous === null || previous === undefined) return null
  if (previous === 0) return null
  return ((current - previous) / Math.abs(previous)) * 100
}
