import { useState } from 'react'
import './SectorBrowser.css'
import { SECTORS } from '../../lib/sectorStocks'

export default function SectorBrowser({ onAddToCompare }) {
  const [selected, setSelected] = useState(new Set())

  function toggle(sym) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(sym)) next.delete(sym)
      else next.add(sym)
      return next
    })
  }

  function handleAdd() {
    onAddToCompare([...selected])
    setSelected(new Set())
  }

  return (
    <div className="sector-browser">
      {SECTORS.map((sector) => (
        <details key={sector.name} className="sector-group">
          <summary>{sector.name}</summary>
          <div className="sector-stock-grid">
            {sector.stocks.map((stock) => (
              <label key={stock.sym} className="sector-stock">
                <input
                  type="checkbox"
                  checked={selected.has(stock.sym)}
                  onChange={() => toggle(stock.sym)}
                  aria-label={`${stock.sym} — ${stock.name}`}
                />
                {stock.sym} — {stock.name}
              </label>
            ))}
          </div>
        </details>
      ))}
      <div className="sector-actions">
        <span>{selected.size} selected</span>
        <button type="button" onClick={handleAdd} disabled={selected.size === 0}>Add to Compare</button>
      </div>
    </div>
  )
}
