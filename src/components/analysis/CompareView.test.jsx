import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import CompareView from './CompareView'

const data = {
  AAPL: { quote: { c: 165, pc: 160 }, metrics: { peBasicExclExtraTTM: 28 }, recs: null, targets: null },
  MSFT: { quote: { c: 420, pc: 410 }, metrics: { peBasicExclExtraTTM: 35 }, recs: null, targets: null },
}

describe('CompareView', () => {
  it('renders one column header per symbol', () => {
    render(<CompareView symbols={['AAPL', 'MSFT']} data={data} onRemove={vi.fn()} />)
    expect(screen.getByRole('columnheader', { name: /AAPL/ })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: /MSFT/ })).toBeInTheDocument()
  })

  it('highlights the winning cell for a lower-is-better metric', () => {
    render(<CompareView symbols={['AAPL', 'MSFT']} data={data} onRemove={vi.fn()} />)
    const peRow = screen.getByText('P/E').closest('tr')
    const aaplCell = peRow.querySelector('[data-symbol="AAPL"]')
    expect(aaplCell).toHaveClass('compare-cell--best')
  })

  it('does not crash for a symbol still loading (no data yet)', () => {
    render(<CompareView symbols={['AAPL', 'TSLA']} data={{ AAPL: data.AAPL }} onRemove={vi.fn()} />)
    expect(screen.getByRole('columnheader', { name: /TSLA/ })).toBeInTheDocument()
  })

  it('calls onRemove when a column Remove button is clicked', async () => {
    const onRemove = vi.fn()
    render(<CompareView symbols={['AAPL', 'MSFT']} data={data} onRemove={onRemove} />)
    await userEvent.click(screen.getAllByRole('button', { name: /remove/i })[0])
    expect(onRemove).toHaveBeenCalledWith('AAPL')
  })

  it('renders inside a compare-view test container', () => {
    render(<CompareView symbols={['AAPL']} data={data} onRemove={vi.fn()} />)
    expect(screen.getByTestId('compare-view')).toBeInTheDocument()
  })
})
