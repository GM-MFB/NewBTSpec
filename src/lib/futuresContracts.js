const TICK_VALUES = {
  ES: 12.5, MES: 1.25, NQ: 5, MNQ: 0.5, YM: 5, MYM: 0.5, RTY: 5, M2K: 0.5,
  CL: 10, MCL: 1, GC: 10, MGC: 1, SI: 25, NG: 10, ZB: 31.25, ZN: 15.625,
}

export function lookupTickValue(symbol) {
  if (!symbol) return undefined
  return TICK_VALUES[symbol.trim().toUpperCase()]
}
