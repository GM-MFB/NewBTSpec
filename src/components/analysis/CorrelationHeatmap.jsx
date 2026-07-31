import './CorrelationHeatmap.css'
import { getCorrelationMatrixForSymbols } from '../../lib/efficientFrontier'

function bandFor(value) {
  if (value >= 0.7) return 'red'
  if (value >= 0.4) return 'orange'
  if (value >= 0.15) return 'yellow'
  if (value >= -0.05) return 'gray'
  return 'blue'
}

export default function CorrelationHeatmap({ symbols }) {
  const matrix = getCorrelationMatrixForSymbols(symbols)

  return (
    <div className="correlation-heatmap">
      <div className="corr-table-wrap">
        <table className="correlation-table">
          <tbody>
            {symbols.map((rowSymbol, i) => (
              <tr key={rowSymbol}>
                <th scope="row">{rowSymbol}</th>
                {symbols.slice(0, i).map((colSymbol, j) => {
                  const value = matrix[i][j]
                  const band = bandFor(value)
                  return (
                    <td key={colSymbol} data-testid="heatmap-cell" data-band={band} className={`heatmap-cell heatmap-cell--${band}`}>
                      {value.toFixed(2)}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="heatmap-legend">
        <span className="heatmap-legend-key heatmap-cell--red">&ge; 0.7</span>
        <span className="heatmap-legend-key heatmap-cell--orange">&ge; 0.4</span>
        <span className="heatmap-legend-key heatmap-cell--yellow">&ge; 0.15</span>
        <span className="heatmap-legend-key heatmap-cell--gray">&ge; -0.05</span>
        <span className="heatmap-legend-key heatmap-cell--blue">&lt; -0.05</span>
      </div>
    </div>
  )
}
