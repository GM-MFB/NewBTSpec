import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import PortfolioContext from './PortfolioContext'
import { setComputedParams, setRealCorrelations } from '../../lib/efficientFrontier'

describe('PortfolioContext', () => {
  beforeEach(() => {
    setComputedParams({ AAPL: { r: 0.15, s: 0.27 }, NVDA: { r: 0.28, s: 0.45 } })
    setRealCorrelations({ AAPL: { NVDA: 0.6 } })
  })

  it('defaults to the Correlation Matrix sub-tab', () => {
    render(<PortfolioContext portfolioSymbols={['AAPL']} researchedSymbols={['NVDA']} priceMap={{ NVDA: 900 }} />)
    expect(screen.getByRole('button', { name: /correlation matrix/i })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getAllByTestId('heatmap-cell').length).toBeGreaterThan(0)
  })

  it('switches to the Efficient Frontier sub-tab and renders FrontierPanel in combined mode', async () => {
    render(<PortfolioContext portfolioSymbols={['AAPL']} researchedSymbols={['NVDA']} priceMap={{ NVDA: 900 }} />)
    await userEvent.click(screen.getByRole('button', { name: /efficient frontier/i }))
    expect(screen.getAllByText('Your Portfolio').length).toBeGreaterThan(0)
  })

  it('weights "Your Portfolio" by each position\'s market value instead of splitting evenly', async () => {
    setComputedParams({ AAPL: { r: 0.15, s: 0.27 }, MSFT: { r: 0.12, s: 0.2 } })
    setRealCorrelations({ AAPL: { MSFT: 0.5 } })
    const investments = [
      { assetType: 'Stock', symbol: 'AAPL', shares: 1, avgCost: 100, currentPrice: 100 },
      { assetType: 'Stock', symbol: 'MSFT', shares: 100, avgCost: 400, currentPrice: 400 },
    ]
    render(
      <PortfolioContext
        portfolioSymbols={['AAPL', 'MSFT']}
        researchedSymbols={[]}
        priceMap={{}}
        investments={investments}
      />,
    )
    await userEvent.click(screen.getByRole('button', { name: /efficient frontier/i }))

    const yourPortfolioCard = screen.getByText('Current allocation').closest('.frontier-stat-card')
    const rows = [...yourPortfolioCard.querySelectorAll('.frontier-allocation-row')]
    const msftRow = rows.find((r) => r.textContent.includes('MSFT'))
    expect(msftRow).toHaveTextContent(/9[5-9]\.\d\d%/) // MSFT is ~40000 of ~40100 total value
  })
})
