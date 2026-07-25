import { useState } from 'react'
import '../styles/modal.css'

export default function InvestmentDetailModal({ investment, onClose, onUpdate, onCloseInvestment, onDelete }) {
  const [fields, setFields] = useState(investment)
  const [closing, setClosing] = useState(false)
  const [sellPrice, setSellPrice] = useState('')
  const [sellDate, setSellDate] = useState('')
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
      await onCloseInvestment({ sellPrice, sellDate })
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
    <div className="modal-backdrop" role="dialog" aria-label="Investment Detail">
      <div className="modal">
        <form onSubmit={handleSave}>
          <label htmlFor="detail-symbol">Symbol</label>
          <input id="detail-symbol" value={fields.symbol} onChange={(e) => set('symbol', e.target.value)} />

          {fields.assetType === 'Option' ? (
            <>
              <label htmlFor="detail-strike">Strike</label>
              <input id="detail-strike" value={fields.strike} onChange={(e) => set('strike', e.target.value)} />

              <label htmlFor="detail-expiry">Expiry</label>
              <input id="detail-expiry" value={fields.expiry} onChange={(e) => set('expiry', e.target.value)} />
            </>
          ) : (
            <>
              <label htmlFor="detail-shares">Shares</label>
              <input id="detail-shares" value={fields.shares} onChange={(e) => set('shares', e.target.value)} />

              <label htmlFor="detail-avgCost">Avg Cost</label>
              <input id="detail-avgCost" value={fields.avgCost} onChange={(e) => set('avgCost', e.target.value)} />
            </>
          )}

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
          <button type="button" onClick={() => setClosing(true)}>Close Position</button>
        ) : (
          <form onSubmit={handleConfirmClose}>
            <label htmlFor="sellPrice">Sell Price</label>
            <input id="sellPrice" type="number" step="0.01" value={sellPrice} onChange={(e) => setSellPrice(e.target.value)} required />

            <label htmlFor="sellDate">Sell Date</label>
            <input id="sellDate" type="date" value={sellDate} onChange={(e) => setSellDate(e.target.value)} required />

            <button type="submit">Confirm Close</button>
          </form>
        )}
      </div>
    </div>
  )
}
