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
    expect(screen.getByText('Your Portfolio')).toBeInTheDocument()
  })
})
