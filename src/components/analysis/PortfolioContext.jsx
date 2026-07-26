import { useState } from 'react'
import './PortfolioContext.css'
import CorrelationHeatmap from './CorrelationHeatmap'
import FrontierPanel from './FrontierPanel'

export default function PortfolioContext({ portfolioSymbols, researchedSymbols, priceMap }) {
  const [subTab, setSubTab] = useState('correlation')
  const allSymbols = [...new Set([...portfolioSymbols, ...researchedSymbols])]

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
          weights={portfolioSymbols.map(() => 1 / portfolioSymbols.length)}
          storageKey="bt_ef_research_params"
          mode="combined"
          extraSymbols={researchedSymbols}
          priceMap={priceMap}
        />
      )}
    </div>
  )
}
