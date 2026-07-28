import { useState } from 'react'
import '../styles/modal.css'

export default function ClosePositionModal({ investment, onClose, onConfirm, onRoll }) {
  const isOption = investment?.assetType === 'Option'
  const [mode, setMode] = useState('close')

  const [sellPrice, setSellPrice] = useState('')
  const [sellDate, setSellDate] = useState('')

  const [closePrice, setClosePrice] = useState('')
  const [closeDate, setCloseDate] = useState('')
  const [newCredit, setNewCredit] = useState('')
  const [newStrike, setNewStrike] = useState('')
  const [newExpiry, setNewExpiry] = useState('')

  const [error, setError] = useState(null)

  async function handleCloseSubmit(e) {
    e.preventDefault()
    setError(null)
    try {
      await onConfirm({ sellPrice, sellDate })
    } catch (err) {
      setError(err.message)
    }
  }

  async function handleRollSubmit(e) {
    e.preventDefault()
    setError(null)
    try {
      await onRoll({ closePrice, closeDate, newCredit, newStrike, newExpiry })
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div className="modal-backdrop" role="dialog" aria-label="Close Position">
      <div className="modal">
        {isOption && (
          <div className="type-toggle">
            <button type="button" aria-pressed={mode === 'close'} onClick={() => setMode('close')}>Close</button>
            <button type="button" aria-pressed={mode === 'roll'} onClick={() => setMode('roll')}>Roll</button>
          </div>
        )}

        {mode === 'close' ? (
          <form onSubmit={handleCloseSubmit}>
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
        ) : (
          <form onSubmit={handleRollSubmit}>
            <label htmlFor="rollClosePrice">Close Price</label>
            <input id="rollClosePrice" type="number" step="0.01" value={closePrice} onChange={(e) => setClosePrice(e.target.value)} required />

            <label htmlFor="rollCloseDate">Close Date</label>
            <input id="rollCloseDate" type="date" value={closeDate} onChange={(e) => setCloseDate(e.target.value)} required />

            <label htmlFor="rollNewCredit">New Credit Received</label>
            <input id="rollNewCredit" type="number" step="0.01" value={newCredit} onChange={(e) => setNewCredit(e.target.value)} required />

            <label htmlFor="rollNewStrike">New Strike</label>
            <input id="rollNewStrike" type="number" step="0.01" value={newStrike} onChange={(e) => setNewStrike(e.target.value)} required />

            <label htmlFor="rollNewExpiry">New Expiry</label>
            <input id="rollNewExpiry" type="date" value={newExpiry} onChange={(e) => setNewExpiry(e.target.value)} required />

            {error && <p role="alert">{error}</p>}

            <div className="modal-actions">
              <button type="button" onClick={onClose}>Cancel</button>
              <button type="submit">Confirm Roll</button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
