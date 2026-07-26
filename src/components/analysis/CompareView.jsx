import './CompareView.css'
import { METRIC_GROUPS, bestIndex } from '../../lib/compareMetrics'

export default function CompareView({ symbols, data, onRemove }) {
  return (
    <div className="compare-table-wrap" data-testid="compare-view">
      <table className="compare-table">
        <thead>
          <tr>
            <th></th>
            {symbols.map((symbol) => (
              <th key={symbol}>
                <span className="compare-header-cell">
                  {symbol}
                  <button type="button" className="compare-remove" aria-label={`Remove ${symbol}`} onClick={() => onRemove(symbol)}>×</button>
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {METRIC_GROUPS.map((group) => (
            <>
              <tr key={group.group} className="compare-group-row">
                <td colSpan={symbols.length + 1}>{group.group}</td>
              </tr>
              {group.rows.map((row) => {
                const values = symbols.map((symbol) => (data[symbol] ? row.get(data[symbol]) : null))
                const winner = bestIndex(values, row.better)
                return (
                  <tr key={row.label}>
                    <td>{row.label}</td>
                    {symbols.map((symbol, i) => (
                      <td key={symbol} data-symbol={symbol} className={i === winner ? 'compare-cell--best' : ''}>
                        {row.format(values[i])}
                        {i === winner && <span className="compare-best-marker">▲</span>}
                      </td>
                    ))}
                  </tr>
                )
              })}
            </>
          ))}
        </tbody>
      </table>
    </div>
  )
}
