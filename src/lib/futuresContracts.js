const POINT_VALUES = {
  ES: 50, MES: 5, NQ: 20, MNQ: 2, YM: 5, MYM: 0.5, RTY: 50, M2K: 5,
  CL: 1000, MCL: 100, GC: 100, MGC: 10, SI: 5000, NG: 10000, ZB: 1000, ZN: 1000,
}

export function lookupPointValue(symbol) {
  if (!symbol) return undefined
  return POINT_VALUES[symbol.trim().toUpperCase()]
}
