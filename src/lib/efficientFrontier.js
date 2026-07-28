export const RISK_FREE = 0.045
export const SPY_VOL = 0.17

const ASSET_PARAMS = {
  AAPL: { r: 0.15, s: 0.27, cat: 'tech' },
  NVDA: { r: 0.28, s: 0.45, cat: 'tech' },
  MSFT: { r: 0.14, s: 0.24, cat: 'tech' },
  META: { r: 0.18, s: 0.38, cat: 'tech' },
  AMZN: { r: 0.16, s: 0.32, cat: 'tech' },
  GOOGL: { r: 0.14, s: 0.28, cat: 'tech' },
  AMD: { r: 0.22, s: 0.42, cat: 'tech' },
  TSLA: { r: 0.20, s: 0.55, cat: 'tech' },
  SMH: { r: 0.20, s: 0.35, cat: 'etf_eq' },
  SPY: { r: 0.10, s: 0.16, cat: 'etf_eq' },
  QQQ: { r: 0.13, s: 0.20, cat: 'etf_eq' },
  TLT: { r: 0.03, s: 0.12, cat: 'bond' },
  GLD: { r: 0.06, s: 0.14, cat: 'gold' },
  XOM: { r: 0.09, s: 0.25, cat: 'energy' },
  BTC: { r: 0.35, s: 0.60, cat: 'crypto' },
  ETH: { r: 0.35, s: 0.70, cat: 'crypto' },
  JPM: { r: 0.11, s: 0.22, cat: 'financial' },
  SOFI: { r: 0.18, s: 0.50, cat: 'financial' },
}
const DEFAULT_PARAMS = { r: 0.12, s: 0.28, cat: 'other' }

const CAT_CORR = {
  tech: { tech: 0.65, etf_eq: 0.70, bond: -0.10, gold: 0.00, crypto: 0.25, energy: 0.20, financial: 0.35, other: 0.40, cash: 0 },
  etf_eq: { etf_eq: 0.85, bond: -0.15, gold: 0.05, crypto: 0.20, energy: 0.30, financial: 0.45, other: 0.45, cash: 0 },
  bond: { bond: 0.70, gold: 0.10, crypto: -0.05, energy: -0.10, financial: -0.05, other: -0.05, cash: 0 },
  gold: { gold: 1.0, crypto: 0.10, energy: 0.15, financial: 0.00, other: 0.05, cash: 0 },
  crypto: { crypto: 0.60, energy: 0.05, financial: 0.10, other: 0.15, cash: 0 },
  energy: { energy: 0.55, financial: 0.20, other: 0.25, cash: 0 },
  financial: { financial: 0.60, other: 0.35, cash: 0 },
  other: { other: 0.50, cash: 0 },
  cash: { cash: 0 },
}
const UNKNOWN_PAIR_CORR = 0.50

let _realCorr = {}
let _computedParams = {}
let corrVersion = 0

export function setRealCorrelations(map) {
  _realCorr = { ..._realCorr, ...map }
  corrVersion += 1
}

export function setComputedParams(map) {
  _computedParams = { ..._computedParams, ...map }
  corrVersion += 1
}

export function getCorrVersion() {
  return corrVersion
}

export function getAssetParams(symbol) {
  const base = ASSET_PARAMS[symbol] ?? { ...DEFAULT_PARAMS }
  const computed = _computedParams[symbol]
  return computed ? { r: computed.r, s: computed.s, cat: base.cat } : base
}

export function getCorrelation(sym1, sym2) {
  if (sym1 === sym2) return 1
  if (sym1 === 'CASH' || sym2 === 'CASH') return 0
  const real = _realCorr[sym1]?.[sym2] ?? _realCorr[sym2]?.[sym1]
  if (real !== undefined && real !== null) return real
  const cat1 = getAssetParams(sym1).cat
  const cat2 = getAssetParams(sym2).cat
  return CAT_CORR[cat1]?.[cat2] ?? CAT_CORR[cat2]?.[cat1] ?? UNKNOWN_PAIR_CORR
}

export function portfolioStats(symbols, weights, paramsOverride = {}) {
  const params = symbols.map((s) => paramsOverride[s] ?? getAssetParams(s))
  const ret = weights.reduce((sum, w, i) => sum + w * params[i].r, 0)
  let variance = 0
  for (let i = 0; i < symbols.length; i += 1) {
    for (let j = 0; j < symbols.length; j += 1) {
      variance += weights[i] * weights[j] * params[i].s * params[j].s * getCorrelation(symbols[i], symbols[j])
    }
  }
  const vol = Math.sqrt(Math.max(0, variance))
  const sharpe = vol > 0 ? (ret - RISK_FREE) / vol : 0
  return { ret, vol, sharpe }
}

export function randomWeights(n) {
  const draws = Array.from({ length: n }, () => -Math.log(Math.random()))
  const total = draws.reduce((a, b) => a + b, 0)
  return draws.map((d) => d / total)
}

export function extractFrontier(points) {
  if (points.length === 0) return []
  const minVol = Math.min(...points.map((p) => p.vol))
  const maxVol = Math.max(...points.map((p) => p.vol))
  const bucketWidth = (maxVol - minVol) / 150 || 1

  const buckets = new Array(150).fill(null)
  for (const p of points) {
    const idx = Math.min(149, Math.floor((p.vol - minVol) / bucketWidth))
    if (!buckets[idx] || p.ret > buckets[idx].ret) buckets[idx] = p
  }

  const frontier = []
  let runningMax = -Infinity
  for (const bucket of buckets) {
    if (bucket && bucket.ret > runningMax) {
      frontier.push(bucket)
      runningMax = bucket.ret
    }
  }
  return frontier
}

export function generateEfficientFrontierData(symbols, { nSim = 10000, cashOptions = null, paramsOverride = {} } = {}) {
  const simSymbols = [...symbols]
  const simParams = { ...paramsOverride }
  if (cashOptions?.amount > 0) {
    simSymbols.push('CASH')
    simParams.CASH = { r: cashOptions.rate ?? 0.03, s: 0.001 }
  }

  const points = []
  let maxSharpe = null
  let maxDiversification = null

  for (let i = 0; i < nSim; i += 1) {
    const weights = randomWeights(simSymbols.length)
    const { ret, vol, sharpe } = portfolioStats(simSymbols, weights, simParams)
    const weightedAvgVol = simSymbols.reduce((sum, s, idx) => sum + weights[idx] * (simParams[s] ?? getAssetParams(s)).s, 0)
    const diversificationRatio = vol > 0 ? weightedAvgVol / vol : 1
    const point = { ret, vol, sharpe, diversificationRatio, weights: [...weights] }
    points.push(point)
    if (!maxSharpe || sharpe > maxSharpe.sharpe) maxSharpe = point
    if (!maxDiversification || diversificationRatio > maxDiversification.diversificationRatio) maxDiversification = point
  }

  return { symbols: simSymbols, points, maxSharpe, maxDiversification, frontier: extractFrontier(points) }
}

export function generateCombinedFrontierData(portfolioSymbols, portfolioWeights, extraSymbols, options = {}) {
  const newSymbols = extraSymbols.filter((s) => !portfolioSymbols.includes(s))
  const allSymbols = [...portfolioSymbols, ...newSymbols]
  const currentWeights = [...portfolioWeights, ...newSymbols.map(() => 0)]
  const simData = generateEfficientFrontierData(allSymbols, options)
  const paddedWeights = [...currentWeights, ...simData.symbols.slice(allSymbols.length).map(() => 0)]
  const current = portfolioStats(simData.symbols, paddedWeights)
  return { ...simData, current: { ...current, weights: paddedWeights } }
}

export function getMaxSharpeForSubset(symbols, nSim, options = {}) {
  const { maxSharpe } = generateEfficientFrontierData(symbols, { ...options, nSim })
  return maxSharpe
}

export function runBackwardElimination(symbols, nSim, options = {}) {
  let current = [...symbols]
  let currentBest = getMaxSharpeForSubset(current, nSim, options)
  const steps = [{ symbols: [...current], sharpe: currentBest.sharpe, ret: currentBest.ret, vol: currentBest.vol, weights: currentBest.weights }]
  const dropped = []

  while (current.length > 2) {
    let bestAfterRemoval = null
    let bestRemovedSymbol = null
    for (const symbol of current) {
      const subset = current.filter((s) => s !== symbol)
      const candidate = getMaxSharpeForSubset(subset, Math.round(nSim * 0.6), options)
      if (!bestAfterRemoval || candidate.sharpe > bestAfterRemoval.sharpe) {
        bestAfterRemoval = candidate
        bestRemovedSymbol = symbol
      }
    }
    if (!bestAfterRemoval || bestAfterRemoval.sharpe <= currentBest.sharpe) break
    current = current.filter((s) => s !== bestRemovedSymbol)
    dropped.push(bestRemovedSymbol)
    currentBest = getMaxSharpeForSubset(current, nSim, options)
    steps.push({ symbols: [...current], sharpe: currentBest.sharpe, ret: currentBest.ret, vol: currentBest.vol, weights: currentBest.weights })
  }

  const full = steps[0]
  const optimal = steps[steps.length - 1]
  return {
    steps, fullSharpe: full.sharpe, fullSymbols: full.symbols,
    optimalSymbols: optimal.symbols, optimalSharpe: optimal.sharpe, optimalRet: optimal.ret,
    optimalVol: optimal.vol, optimalWeights: optimal.weights,
    improved: optimal.sharpe > full.sharpe, dropped,
  }
}

export function findOptimalSubset(portfolioSymbols, nSim, options = {}) {
  return runBackwardElimination(portfolioSymbols, nSim, options)
}
export function findOptimalSubsetForSymbols(symbols, nSim, options = {}) {
  return runBackwardElimination(symbols, nSim, options)
}

export function getCorrelationMatrix(symbols) {
  return symbols.map((a) => symbols.map((b) => getCorrelation(a, b)))
}
export function getCorrelationMatrixForSymbols(symbols) {
  return getCorrelationMatrix(symbols)
}

export function getPortfolioRiskMetrics(positions) {
  const hhi = positions.reduce((sum, p) => sum + p.weight ** 2, 0)
  const diversificationScore = Math.round((1 - hhi) * 100)

  const stopEligible = positions.filter((p) => p.assetType !== 'Option')
  const withStop = stopEligible.filter((p) => p.stopLoss)
  const stopCoveragePct = stopEligible.length > 0 ? (withStop.length / stopEligible.length) * 100 : 0
  const dollarAtRisk = stopEligible.reduce((sum, p) => {
    if (!p.stopLoss || p.stopLoss >= p.currentPrice) return sum
    return sum + Math.max(0, p.currentPrice - p.stopLoss) * p.shares
  }, 0)

  const totalMV = positions.reduce((sum, p) => sum + p.marketValue, 0)
  const symbols = positions.map((p) => p.symbol)
  const weights = positions.map((p) => p.weight)
  const { ret, vol } = portfolioStats(symbols, weights)

  const beta = positions.reduce((sum, p) => {
    const params = getAssetParams(p.symbol)
    const symBeta = (params.s * getCorrelation(p.symbol, 'SPY')) / SPY_VOL
    return sum + p.weight * symBeta
  }, 0)

  const dailyVol = vol / Math.sqrt(252)
  const var95 = totalMV * dailyVol * 1.645

  return { hhi, diversificationScore, stopCoveragePct, dollarAtRisk, totalMV, expectedReturn: ret, volatility: vol, beta, var95 }
}

export function getRiskContribution(positions) {
  const symbols = positions.map((p) => p.symbol)
  const weights = positions.map((p) => p.weight)
  const { vol: portfolioVol } = portfolioStats(symbols, weights)

  return positions.map((p, i) => {
    const params = getAssetParams(p.symbol)
    const covarSum = symbols.reduce((sum, s2, j) => {
      const params2 = getAssetParams(s2)
      return sum + weights[j] * params.s * params2.s * getCorrelation(p.symbol, s2)
    }, 0)
    const mcr = portfolioVol > 0 ? (weights[i] * covarSum) / portfolioVol : 0
    const riskPct = portfolioVol > 0 ? (mcr / portfolioVol) * 100 : 0
    const weightPct = weights[i] * 100
    let flag = null
    if (riskPct > weightPct + 5) flag = 'outsized'
    else if (riskPct < weightPct - 5) flag = 'efficient'
    return { symbol: p.symbol, weightPct, riskPct, flag }
  })
}

const STRESS_SCENARIOS = [
  { name: 'Bull Run', move: 0.20 },
  { name: 'Mild Pullback', move: -0.05 },
  { name: 'Correction', move: -0.10 },
  { name: 'Bear Market', move: -0.20 },
  { name: 'Crash', move: -0.30 },
  { name: '2008-Level', move: -0.50 },
]

export function getStressTests(positions) {
  return STRESS_SCENARIOS.map((scenario) => {
    const perPosition = positions.map((p) => {
      const params = getAssetParams(p.symbol)
      const beta = (params.s * getCorrelation(p.symbol, 'SPY')) / SPY_VOL
      const move = beta * scenario.move
      const impact = move * p.marketValue
      return { symbol: p.symbol, beta, move, impact }
    })
    const totalMV = positions.reduce((sum, p) => sum + p.marketValue, 0)
    const weightedBeta = positions.reduce((sum, p, i) => sum + (p.marketValue / totalMV) * perPosition[i].beta, 0)
    const portfolioMove = weightedBeta * scenario.move
    return { name: scenario.name, marketMove: scenario.move, portfolioMove, perPosition: perPosition.sort((a, b) => a.impact - b.impact) }
  })
}
