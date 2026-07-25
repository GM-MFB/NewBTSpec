import { useState } from 'react'

const initial = {
  type: '', symbol: '', direction: 'long', quantity: '', entryPrice: '',
  entryDate: '', fees: '', notes: '', chartLink: '',
  optionType: '', strike: '', expiry: '',
}

export default function AddTradeModal({ onClose, onSubmit }) {
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

  return (
    <div className="modal-backdrop" role="dialog" aria-label="Add Trade">
      <div className="modal">
        <div className="type-toggle">
          <button type="button" aria-pressed={fields.type === 'option'} onClick={() => set('type', 'option')}>Option</button>
          <button type="button" aria-pressed={fields.type === 'futures'} onClick={() => set('type', 'futures')}>Futures</button>
        </div>

        {fields.type && (
          <form onSubmit={handleSubmit}>
            <label htmlFor="symbol">Symbol</label>
            <input id="symbol" value={fields.symbol} onChange={(e) => set('symbol', e.target.value)} required />

            <label htmlFor="direction">Direction</label>
            <select id="direction" value={fields.direction} onChange={(e) => set('direction', e.target.value)}>
              <option value="long">Long</option>
              <option value="short">Short</option>
            </select>

            {fields.type === 'option' && (
              <>
                <label htmlFor="optionType">Option Type</label>
                <select id="optionType" value={fields.optionType} onChange={(e) => set('optionType', e.target.value)}>
                  <option value="">Select…</option>
                  <option value="call">Call</option>
                  <option value="put">Put</option>
                </select>

                <label htmlFor="strike">Strike</label>
                <input id="strike" type="number" value={fields.strike} onChange={(e) => set('strike', e.target.value)} />

                <label htmlFor="expiry">Expiry</label>
                <input id="expiry" type="date" value={fields.expiry} onChange={(e) => set('expiry', e.target.value)} />
              </>
            )}

            <label htmlFor="quantity">Quantity</label>
            <input id="quantity" type="number" value={fields.quantity} onChange={(e) => set('quantity', e.target.value)} required />

            <label htmlFor="entryPrice">Entry Price</label>
            <input id="entryPrice" type="number" step="0.01" value={fields.entryPrice} onChange={(e) => set('entryPrice', e.target.value)} required />

            <label htmlFor="entryDate">Entry Date</label>
            <input id="entryDate" type="date" value={fields.entryDate} onChange={(e) => set('entryDate', e.target.value)} required />

            <label htmlFor="fees">Fees</label>
            <input id="fees" type="number" step="0.01" value={fields.fees} onChange={(e) => set('fees', e.target.value)} />

            <label htmlFor="notes">Notes</label>
            <textarea id="notes" value={fields.notes} onChange={(e) => set('notes', e.target.value)} />

            <label htmlFor="chartLink">Chart Link</label>
            <input id="chartLink" value={fields.chartLink} onChange={(e) => set('chartLink', e.target.value)} />

            {error && <p role="alert">{error}</p>}

            <div className="modal-actions">
              <button type="button" onClick={onClose}>Cancel</button>
              <button type="submit">Save</button>
            </div>
          </form>
        )}

        {!fields.type && (
          <button type="button" onClick={onClose}>Close</button>
        )}
      </div>
    </div>
  )
}
