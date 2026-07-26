import { useEffect } from 'react'
import './FrontierTab.css'
import FrontierPanel from './FrontierPanel'
import { fetchCorrelations } from '../../lib/fetchCorrelations'
import { setRealCorrelations, setComputedParams } from '../../lib/efficientFrontier'

export default function FrontierTab({ investments }) {
  const positions = investments.filter((i) => ['Stock', 'ETF', 'Crypto'].includes(i.assetType))
  const symbols = positions.map((p) => p.symbol)

  useEffect(() => {
    if (symbols.length < 2) return
    fetchCorrelations(symbols).then(({ corrMap, paramsMap }) => {
      setRealCorrelations(corrMap)
      setComputedParams(paramsMap)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbols.join(',')])

  if (symbols.length < 2) {
    return (
      <div className="frontier-empty">
        <p>Add at least 2 open positions to see your Efficient Frontier.</p>
      </div>
    )
  }

  const totalMV = positions.reduce((sum, p) => sum + p.shares * p.currentPrice, 0)
  const weights = positions.map((p) => (totalMV > 0 ? (p.shares * p.currentPrice) / totalMV : 0))
  const priceMap = Object.fromEntries(positions.map((p) => [p.symbol, p.currentPrice]))

  return (
    <div className="frontier-tab">
      <FrontierPanel symbols={symbols} weights={weights} storageKey="bt_ef_params" priceMap={priceMap} />
    </div>
  )
}
