import { useState } from 'react'
import '../styles/modal.css'
import { STRATEGIES, strategyByValue } from '../lib/optionStrategies'

const initial = {
  assetType: '', symbol: '', name: '', sector: '', buyDate: '', notes: '', chartLink: '',
  shares: '', avgCost: '', currentPrice: '', stopLoss: '', targetPrice: '',
  strategy: '', strike: '', expiry: '', strike2: '',
}

export default function AddInvestmentModal({ onClose, onSubmit }) {
  const [fields, setFields] = useState(initial)
  const [error, setError] = useState(null)

  function set(key, value) {
    setFields((f) => ({ ...f, [key]: value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    try {
      await onSubmit(fields)
    } catch (err) {
      setError(err.message)
    }
  }

  const isSpread = strategyByValue(fields.strategy)?.isSpread ?? false

  return (
    <div className="modal-backdrop" role="dialog" aria-label="Add Investment">
      <div className="modal modal--wide">
        <div className="type-toggle">
          <button type="button" aria-pressed={fields.assetType === 'Stock'} onClick={() => set('assetType', 'Stock')}>Stock</button>
          <button type="button" aria-pressed={fields.assetType === 'Option'} onClick={() => set('assetType', 'Option')}>Option</button>
        </div>

        {fields.assetType && (
          <form className="form-grid" onSubmit={handleSubmit}>
            <div className="field">
              <label htmlFor="symbol">Symbol</label>
              <input id="symbol" value={fields.symbol} onChange={(e) => set('symbol', e.target.value)} required />
            </div>

            <div className="field">
              <label htmlFor="name">Name</label>
              <input id="name" value={fields.name} onChange={(e) => set('name', e.target.value)} />
            </div>

            <div className="field">
              <label htmlFor="sector">Sector</label>
              <input id="sector" value={fields.sector} onChange={(e) => set('sector', e.target.value)} />
            </div>

            {fields.assetType === 'Stock' && (
              <>
                <div className="field">
                  <label htmlFor="shares">Shares</label>
                  <input id="shares" type="number" value={fields.shares} onChange={(e) => set('shares', e.target.value)} required />
                </div>

                <div className="field">
                  <label htmlFor="avgCost">Avg Cost</label>
                  <input id="avgCost" type="number" step="0.01" value={fields.avgCost} onChange={(e) => set('avgCost', e.target.value)} required />
                </div>

                <div className="field">
                  <label htmlFor="currentPrice">Current Price</label>
                  <input id="currentPrice" type="number" step="0.01" value={fields.currentPrice} onChange={(e) => set('currentPrice', e.target.value)} />
                </div>

                <div className="field">
                  <label htmlFor="stopLoss">Stop Loss</label>
                  <input id="stopLoss" type="number" step="0.01" value={fields.stopLoss} onChange={(e) => set('stopLoss', e.target.value)} />
                </div>

                <div className="field">
                  <label htmlFor="targetPrice">Target Price</label>
                  <input id="targetPrice" type="number" step="0.01" value={fields.targetPrice} onChange={(e) => set('targetPrice', e.target.value)} />
                </div>
              </>
            )}

            {fields.assetType === 'Option' && (
              <>
                <div className="field">
                  <label htmlFor="strategy">Strategy</label>
                  <select id="strategy" value={fields.strategy} onChange={(e) => set('strategy', e.target.value)} required>
                    <option value="">Select…</option>
                    {STRATEGIES.map((s) => (
                      <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
                  </select>
                </div>

                <div className="field">
                  <label htmlFor="contracts">Contracts</label>
                  <input id="contracts" type="number" value={fields.shares} onChange={(e) => set('shares', e.target.value)} required />
                </div>

                <div className="field">
                  <label htmlFor="strike">{isSpread ? 'Short Strike' : 'Strike'}</label>
                  <input id="strike" type="number" value={fields.strike} onChange={(e) => set('strike', e.target.value)} required />
                </div>

                {isSpread && (
                  <div className="field">
                    <label htmlFor="strike2">Long Strike</label>
                    <input id="strike2" type="number" value={fields.strike2} onChange={(e) => set('strike2', e.target.value)} required />
                  </div>
                )}

                <div className="field">
                  <label htmlFor="expiry">Expiry</label>
                  <input id="expiry" type="date" value={fields.expiry} onChange={(e) => set('expiry', e.target.value)} required />
                </div>

                <div className="field">
                  <label htmlFor="optionPrice">Price</label>
                  <input id="optionPrice" type="number" step="0.01" value={fields.avgCost} onChange={(e) => set('avgCost', e.target.value)} required />
                </div>

                <div className="field">
                  <label htmlFor="underlyingPrice">Underlying Price</label>
                  <input id="underlyingPrice" type="number" step="0.01" value={fields.currentPrice} onChange={(e) => set('currentPrice', e.target.value)} />
                </div>
              </>
            )}

            <div className="field">
              <label htmlFor="buyDate">Buy Date</label>
              <input id="buyDate" type="date" value={fields.buyDate} onChange={(e) => set('buyDate', e.target.value)} required />
            </div>

            <div className="field field-full">
              <label htmlFor="notes">Notes</label>
              <textarea id="notes" value={fields.notes} onChange={(e) => set('notes', e.target.value)} />
            </div>

            <div className="field field-full">
              <label htmlFor="chartLink">Chart Link</label>
              <input id="chartLink" value={fields.chartLink} onChange={(e) => set('chartLink', e.target.value)} />
            </div>

            {error && <p role="alert" className="field-full">{error}</p>}

            <div className="modal-actions field-full">
              <button type="button" onClick={onClose}>Cancel</button>
              <button type="submit">Save</button>
            </div>
          </form>
        )}

        {!fields.assetType && (
          <button type="button" onClick={onClose}>Close</button>
        )}
      </div>
    </div>
  )
}
