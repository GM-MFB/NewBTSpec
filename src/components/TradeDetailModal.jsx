import { useState } from 'react'

export default function TradeDetailModal({ trade, onClose, onUpdate, onCloseTrade, onDelete }) {
  const [fields, setFields] = useState(trade)
  const [closing, setClosing] = useState(false)
  const [exitPrice, setExitPrice] = useState('')
  const [exitDate, setExitDate] = useState('')
  const [error, setError] = useState(null)

  function set(key, value) {
    setFields((f) => ({ ...f, [key]: value }))
  }

  async function handleSave(e) {
    e.preventDefault()
    setError(null)
    try {
      await onUpdate(fields)
    } catch (err) {
      setError(err.message)
    }
  }

  async function handleConfirmClose(e) {
    e.preventDefault()
    setError(null)
    try {
      await onCloseTrade({ exitPrice, exitDate })
    } catch (err) {
      setError(err.message)
    }
  }

  async function handleDelete() {
    setError(null)
    try {
      await onDelete()
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div className="modal-backdrop" role="dialog" aria-label="Trade Detail">
      <div className="modal">
        <form onSubmit={handleSave}>
          <label htmlFor="detail-symbol">Symbol</label>
          <input id="detail-symbol" value={fields.symbol} onChange={(e) => set('symbol', e.target.value)} />

          {fields.type === 'option' && (
            <>
              <label htmlFor="detail-strike">Strike</label>
              <input id="detail-strike" value={fields.strike} onChange={(e) => set('strike', e.target.value)} />

              <label htmlFor="detail-expiry">Expiry</label>
              <input id="detail-expiry" value={fields.expiry} onChange={(e) => set('expiry', e.target.value)} />
            </>
          )}

          <label htmlFor="detail-quantity">Quantity</label>
          <input id="detail-quantity" value={fields.quantity} onChange={(e) => set('quantity', e.target.value)} />

          <label htmlFor="detail-entryPrice">Entry Price</label>
          <input id="detail-entryPrice" value={fields.entryPrice} onChange={(e) => set('entryPrice', e.target.value)} />

          <label htmlFor="detail-notes">Notes</label>
          <textarea id="detail-notes" value={fields.notes} onChange={(e) => set('notes', e.target.value)} />

          {error && <p role="alert">{error}</p>}

          <div className="modal-actions">
            <button type="button" onClick={onClose}>Close</button>
            <button type="button" onClick={handleDelete}>Delete</button>
            <button type="submit">Save</button>
          </div>
        </form>

        {!closing ? (
          <button type="button" onClick={() => setClosing(true)}>Close Trade</button>
        ) : (
          <form onSubmit={handleConfirmClose}>
            <label htmlFor="exitPrice">Exit Price</label>
            <input id="exitPrice" type="number" step="0.01" value={exitPrice} onChange={(e) => setExitPrice(e.target.value)} required />

            <label htmlFor="exitDate">Exit Date</label>
            <input id="exitDate" type="date" value={exitDate} onChange={(e) => setExitDate(e.target.value)} required />

            <button type="submit">Confirm Close</button>
          </form>
        )}
      </div>
    </div>
  )
}
