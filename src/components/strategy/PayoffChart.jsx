import {
  ResponsiveContainer, ComposedChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine,
} from 'recharts'
import { formatCurrency, formatAxisCurrency } from '../../lib/format'
import { payoffCurve } from '../../lib/payoffCurve'

const GREEN = '#22c55e'
const RED = '#ef4444'
const GRID = '#262626'
const AXIS_TEXT = '#888'
const ZERO_LINE = '#8a8a8a'
// Deliberately not green or red — it marks a position, not an outcome.
const SPOT_LINE = '#3b82f6'

function PayoffTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const { price, pnl } = payload[0].payload
  const profitable = pnl >= 0

  return (
    <div className="payoff-tooltip">
      <div className="payoff-tooltip-price">Underlying at {formatCurrency(price)}</div>
      <div className={`payoff-tooltip-pnl mono ${profitable ? 'price-favorable' : 'price-unfavorable'}`}>
        {profitable ? 'Profit' : 'Loss'} {formatCurrency(pnl)}
      </div>
    </div>
  )
}

export default function PayoffChart({ kind, params, gradientId, spot }) {
  const curve = payoffCurve(kind, params, spot)
  if (!curve) return null

  const values = curve.points.map((p) => p.pnl)
  const dataMax = Math.max(...values, 0)
  const dataMin = Math.min(...values, 0)
  // Headroom so the curve does not run along the top and bottom edges, and so
  // the breakeven labels have somewhere to sit.
  const pad = (dataMax - dataMin) * 0.14 || 1
  const top = dataMax + pad
  const bottom = dataMin - pad

  // Where zero sits in the padded domain, so the fill and stroke change colour
  // exactly at the profit/loss boundary. This has to use the padded bounds —
  // computing it from the raw data range would put the split at the wrong
  // height once the domain is padded.
  const zeroOffset = top === bottom ? 0.5 : top / (top - bottom)

  return (
    <figure className="payoff-figure">
      <figcaption className="payoff-caption">
        Profit and loss at expiration, by where the underlying finishes.
        Above the zero line is profit, below it is loss.
      </figcaption>

      {curve.spot !== null && (
        <p className="payoff-spot-readout">
          At <strong className="mono">{formatCurrency(curve.spot)}</strong> this position is
          {' '}
          <strong className={`mono ${curve.pnlAtSpot >= 0 ? 'price-favorable' : 'price-unfavorable'}`}>
            {formatCurrency(curve.pnlAtSpot)}
          </strong>
          {' at expiration.'}
        </p>
      )}

      <ResponsiveContainer width="100%" height={300}>
        <ComposedChart data={curve.points} margin={{ top: 34, right: 26, left: 0, bottom: 8 }}>
          <defs>
            <linearGradient id={`${gradientId}-stroke`} x1="0" y1="0" x2="0" y2="1">
              <stop offset={zeroOffset} stopColor={GREEN} />
              <stop offset={zeroOffset} stopColor={RED} />
            </linearGradient>
            <linearGradient id={`${gradientId}-fill`} x1="0" y1="0" x2="0" y2="1">
              <stop offset={0} stopColor={GREEN} stopOpacity={0.28} />
              <stop offset={zeroOffset} stopColor={GREEN} stopOpacity={0.06} />
              <stop offset={zeroOffset} stopColor={RED} stopOpacity={0.06} />
              <stop offset={1} stopColor={RED} stopOpacity={0.28} />
            </linearGradient>
          </defs>

          <CartesianGrid stroke={GRID} strokeDasharray="0" vertical={false} />

          <XAxis
            dataKey="price"
            type="number"
            domain={[curve.from, curve.to]}
            tick={{ fill: AXIS_TEXT, fontSize: 11 }}
            axisLine={{ stroke: GRID }}
            tickLine={false}
            tickFormatter={formatAxisCurrency}
            minTickGap={28}
          />
          <YAxis
            type="number"
            domain={[bottom, top]}
            tick={{ fill: AXIS_TEXT, fontSize: 11 }}
            axisLine={{ stroke: GRID }}
            tickLine={false}
            tickFormatter={formatAxisCurrency}
            width={52}
          />

          <Tooltip content={<PayoffTooltip />} cursor={{ stroke: AXIS_TEXT, strokeDasharray: '3 3' }} />

          {/* Position relative to this line is what actually distinguishes
              profit from loss — green and red are only 7.4 ΔE apart under
              deuteranopia, so colour alone cannot carry it. */}
          <ReferenceLine y={0} stroke={ZERO_LINE} strokeWidth={1.5} />

          {curve.spot !== null && (
            <ReferenceLine
              x={curve.spot}
              stroke={SPOT_LINE}
              strokeWidth={1.5}
              label={{ value: 'Now', position: 'insideBottomRight', fill: SPOT_LINE, fontSize: 10 }}
            />
          )}

          {curve.breakevens.map((be, i) => (
            <ReferenceLine
              key={be}
              x={be}
              stroke={AXIS_TEXT}
              strokeDasharray="4 4"
              label={{
                value: `BE ${formatAxisCurrency(be)}`,
                position: 'top',
                fill: AXIS_TEXT,
                fontSize: 10,
                // Two breakevens sit either side of the body; nudging them
                // outward keeps them off each other and off the spot marker.
                dx: curve.breakevens.length > 1 ? (i === 0 ? -14 : 14) : 0,
              }}
            />
          ))}

          <Area
            type="linear"
            dataKey="pnl"
            stroke={`url(#${gradientId}-stroke)`}
            strokeWidth={2}
            fill={`url(#${gradientId}-fill)`}
            dot={false}
            activeDot={{ r: 4, stroke: 'none' }}
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </figure>
  )
}
