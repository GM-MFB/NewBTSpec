import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import CorrelationHeatmap from './CorrelationHeatmap'
import { setRealCorrelations } from '../../lib/efficientFrontier'

describe('CorrelationHeatmap', () => {
  beforeEach(() => {
    setRealCorrelations({ AAPL: { SPY: 0.75 }, SPY: { TLT: -0.10 } })
  })

  it('renders only the lower triangle of the matrix', () => {
    render(<CorrelationHeatmap symbols={['AAPL', 'SPY', 'TLT']} />)
    const cells = screen.getAllByTestId('heatmap-cell')
    expect(cells).toHaveLength(3)
  })

  it('colors a cell red when correlation is >= 0.7', () => {
    render(<CorrelationHeatmap symbols={['AAPL', 'SPY']} />)
    const cell = screen.getByTestId('heatmap-cell')
    expect(cell).toHaveAttribute('data-band', 'red')
  })
})
