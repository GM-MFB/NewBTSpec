import { useState } from 'react'
import './PortfolioContext.css'
import CorrelationHeatmap from './CorrelationHeatmap'
import FrontierPanel from './FrontierPanel'
import { computePositionWeights, computePositionTotalValue } from '../../lib/portfolioWeights'

export default function PortfolioContext({ portfolioSymbols, researchedSymbols, priceMap, investments = [] }) {
  const [subTab, setSubTab] = useState('correlation')
  const allSymbols = [...new Set([...portfolioSymbols, ...researchedSymbols])]
  const weights = computePositionWeights(investments, portfolioSymbols)
  const portfolioValue = computePositionTotalValue(investments, portfolioSymbols)

  return (
    <div className="portfolio-context">
      <div className="portfolio-context-toggle">
        <button type="button" aria-pressed={subTab === 'correlation'} onClick={() => setSubTab('correlation')}>
          Correlation Matrix
        </button>
        <button type="button" aria-pressed={subTab === 'frontier'} onClick={() => setSubTab('frontier')}>
          Efficient Frontier
        </button>
      </div>

      {subTab === 'correlation' && <CorrelationHeatmap symbols={allSymbols} />}
      {subTab === 'frontier' && (
        <FrontierPanel
          symbols={portfolioSymbols}
          weights={weights}
          storageKey="bt_ef_research_params"
          mode="combined"
          extraSymbols={researchedSymbols}
          priceMap={priceMap}
          portfolioValue={portfolioValue}
        />
      )}
    </div>
  )
}
