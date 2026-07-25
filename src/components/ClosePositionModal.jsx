import { useState } from 'react'
import '../styles/modal.css'

export default function ClosePositionModal({ onClose, onConfirm }) {
  const [sellPrice, setSellPrice] = useState('')
  const [sellDate, setSellDate] = useState('')
  const [error, setError] = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    try {
      await onConfirm({ sellPrice, sellDate })
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div className="modal-backdrop" role="dialog" aria-label="Close Position">
      <div className="modal">
        <form onSubmit={handleSubmit}>
          <label htmlFor="closingPrice">Closing Price</label>
          <input id="closingPrice" type="number" step="0.01" value={sellPrice} onChange={(e) => setSellPrice(e.target.value)} required />

          <label htmlFor="closeDate">Date</label>
          <input id="closeDate" type="date" value={sellDate} onChange={(e) => setSellDate(e.target.value)} required />

          {error && <p role="alert">{error}</p>}

          <div className="modal-actions">
            <button type="button" onClick={onClose}>Cancel</button>
            <button type="submit">Confirm</button>
          </div>
        </form>
      </div>
    </div>
  )
}
