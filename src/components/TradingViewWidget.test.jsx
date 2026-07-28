import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import TradingViewWidget from './TradingViewWidget'

describe('TradingViewWidget', () => {
  it('renders a widget container', () => {
    const { container } = render(<TradingViewWidget symbol="AAPL" />)
    expect(container.querySelector('.tradingview-widget-container')).toBeInTheDocument()
  })

  it('injects a script tag configured with the given symbol', () => {
    const { container } = render(<TradingViewWidget symbol="AAPL" />)
    const script = container.querySelector('script')
    expect(script).toBeInTheDocument()
    expect(script.textContent).toContain('"symbol":"AAPL"')
  })

  it('re-injects the script when the symbol prop changes', () => {
    const { container, rerender } = render(<TradingViewWidget symbol="AAPL" />)
    rerender(<TradingViewWidget symbol="TSLA" />)
    const script = container.querySelector('script')
    expect(script.textContent).toContain('"symbol":"TSLA"')
  })
})
