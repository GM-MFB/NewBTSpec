import { useEffect, useRef } from 'react'

export default function TradingViewWidget({ symbol }) {
  const containerRef = useRef(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    container.innerHTML = ''

    const script = document.createElement('script')
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js'
    script.type = 'text/javascript'
    script.async = true
    script.textContent = JSON.stringify({
      autosize: true,
      symbol,
      interval: 'D',
      timezone: 'Etc/UTC',
      theme: 'dark',
      style: '1',
      locale: 'en',
      allow_symbol_change: true,
      support_host: 'https://www.tradingview.com',
    })
    container.appendChild(script)
  }, [symbol])

  return <div className="tradingview-widget-container" ref={containerRef} />
}
