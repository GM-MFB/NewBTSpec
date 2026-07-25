export default function TradeRow({ trade, onClick }) {
  const badge = trade.type === 'option' ? trade.optionType : trade.type

  return (
    <li className="trade-row" data-testid="trade-row" onClick={() => onClick(trade.id)}>
      <span className="mono trade-symbol">{trade.symbol}</span>
      <span className="trade-badge">{badge}</span>
      <span className={`trade-direction trade-direction--${trade.direction}`}>{trade.direction}</span>
      <span className="mono">{trade.entryPrice}</span>
      <span className="mono">{trade.quantity}</span>
    </li>
  )
}
