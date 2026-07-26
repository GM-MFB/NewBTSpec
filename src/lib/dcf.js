export function parseShorthandNumber(input) {
  if (input === null || input === undefined || input === '') return null
  const match = String(input).trim().match(/^(-?\d+(\.\d+)?)\s*([bmkBMK])?$/)
  if (!match) return null
  const value = Number(match[1])
  const suffix = match[3]?.toLowerCase()
  if (suffix === 'b') return value * 1e9
  if (suffix === 'm') return value * 1e6
  if (suffix === 'k') return value * 1e3
  return value
}

function toNum(v) {
  return v === null || v === undefined ? null : Number(v)
}

function average(values) {
  const present = values.filter((v) => v !== null && v !== undefined)
  if (present.length === 0) return null
  return present.reduce((sum, v) => sum + v, 0) / present.length
}

export function deriveDcfInputs({ financialsData, fundamentalsCacheEntry, investment }) {
  const annual = financialsData?.annual ?? []
  const quarterly = financialsData?.quarterly ?? []

  const recentAnnual = [...annual].slice(-3)
  const last4Q = [...quarterly].slice(-4)
  const allQuartersPresent = last4Q.length === 4 && last4Q.every((q) => q.freeCF !== null && q.freeCF !== undefined)
  const latestQuarterDate = quarterly[quarterly.length - 1]?.date
  const latestAnnualDate = annual[annual.length - 1]?.date
  const useTTM = allQuartersPresent && latestQuarterDate && latestAnnualDate && latestQuarterDate > latestAnnualDate

  const basisPeriod = useTTM ? quarterly[quarterly.length - 1] : annual[annual.length - 1]

  const baseFCF = useTTM
    ? last4Q.reduce((sum, q) => sum + q.freeCF, 0)
    : average(recentAnnual.map((p) => p.freeCF))

  const netCash = basisPeriod
    ? (toNum(basisPeriod.cashAndShortTerm) ?? toNum(basisPeriod.cash) ?? 0) - (toNum(basisPeriod.longTermDebt) ?? 0)
    : null

  const positiveFcfAnnual = annual.filter((p) => p.freeCF !== null && p.freeCF > 0)
  let impliedGrowthPct = null
  if (positiveFcfAnnual.length >= 2) {
    const oldest = positiveFcfAnnual[0].freeCF
    const newest = positiveFcfAnnual[positiveFcfAnnual.length - 1].freeCF
    const n = positiveFcfAnnual.length
    impliedGrowthPct = ((newest / oldest) ** (1 / (n - 1)) - 1) * 100
  }

  const sharesOutstanding = fundamentalsCacheEntry?.profile?.shareOutstanding
    ? fundamentalsCacheEntry.profile.shareOutstanding * 1e6
    : null

  const currentPriceRaw = investment?.currentPrice
  const currentPrice = (currentPriceRaw !== '' && currentPriceRaw !== undefined && currentPriceRaw !== null)
    ? Number(currentPriceRaw)
    : (investment?.avgCost ? Number(investment.avgCost) : null)

  return { baseFCF, netCash, impliedGrowthPct, sharesOutstanding, currentPrice }
}

export function runDcf({ baseFCF, growthRatePct, terminalRatePct, discountRatePct, netCash, sharesOutstanding }) {
  const r = discountRatePct / 100
  const g = growthRatePct / 100
  const gt = terminalRatePct / 100

  const years = []
  let sumDiscounted = 0
  for (let t = 1; t <= 5; t += 1) {
    const fcf = baseFCF * (1 + g) ** t
    const discounted = fcf / (1 + r) ** (t - 0.5)
    years.push({ year: t, fcf, discounted })
    sumDiscounted += discounted
  }

  const fcfYear5 = baseFCF * (1 + g) ** 5
  const terminalValue = (fcfYear5 * (1 + gt)) / (r - gt)
  const pvTerminal = terminalValue / (1 + r) ** 5
  const totalEquityValue = sumDiscounted + pvTerminal + netCash
  const intrinsicValue = sharesOutstanding ? totalEquityValue / sharesOutstanding : null

  return { years, terminalValue, pvTerminal, totalEquityValue, intrinsicValue }
}

export function marginOfSafety(intrinsicValue, currentPrice) {
  if (intrinsicValue === null || intrinsicValue === undefined) return null
  if (!currentPrice) return null
  return ((intrinsicValue - currentPrice) / currentPrice) * 100
}

function bucketFor(marginPct) {
  if (marginPct === null) return null
  if (marginPct > 20) return 'strong'
  if (marginPct >= 0) return 'good'
  if (marginPct >= -20) return 'caution'
  return 'weak'
}

export function buildSensitivityGrid({ baseFCF, growthRatePct, terminalRatePct, netCash, sharesOutstanding, currentPrice }) {
  const discountRates = [7, 8, 9, 10, 11, 12]
  const growthRates = [-10, -5, 0, 5, 10].map((delta) => Math.min(100, Math.max(-50, growthRatePct + delta)))

  const grid = []
  for (const discountRatePct of discountRates) {
    for (const g of growthRates) {
      const result = runDcf({ baseFCF, growthRatePct: g, terminalRatePct, discountRatePct, netCash, sharesOutstanding })
      const marginPct = marginOfSafety(result.intrinsicValue, currentPrice)
      grid.push({ discountRatePct, growthRatePct: g, marginOfSafetyPct: marginPct, bucket: bucketFor(marginPct) })
    }
  }
  return grid
}
