import './TradeRow.css'

export default function TradeRow({ trade, onClick, onDelete }) {
  const badge = trade.type === 'option' ? trade.optionType : trade.type

  async function handleDelete(e) {
    e.stopPropagation()
    try {
      await onDelete(trade.id)
    } catch (err) {
      window.alert(err.message)
    }
  }

  return (
    <li className="trade-row" data-testid="trade-row" onClick={() => onClick(trade.id)}>
      <span className="mono trade-symbol">{trade.symbol}</span>
      <span className="trade-badge">{badge}</span>
      <span className={`trade-direction trade-direction--${trade.direction}`}>{trade.direction}</span>
      <span className="mono">{trade.entryPrice}</span>
      <span className="mono">{trade.quantity}</span>
      {onDelete && <button type="button" className="danger" onClick={handleDelete}>Delete</button>}
    </li>
  )
}
