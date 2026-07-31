import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  Cell,
  PieChart,
  Pie,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  LabelList,
} from 'recharts'
import './StatsCharts.css'
import { formatCurrency, formatAxisCurrency } from '../lib/format'

const GREEN = '#22c55e'
const RED = '#ef4444'
const GRID = '#262626'
const AXIS_TEXT = '#888'
const TOOLTIP_STYLE = {
  background: '#141414',
  border: '1px solid #262626',
  borderRadius: 6,
  color: '#e5e5e5',
  fontSize: 12,
}

function EmptyState() {
  return <div className="chart-empty">No closed trades yet — this chart will fill in once you close a position.</div>
}

function ChartCard({ title, isEmpty, wide, children }) {
  return (
    <div className={`chart-card${wide ? ' chart-card--wide' : ''}`}>
      <h3 className="chart-card-title">{title}</h3>
      {isEmpty ? <EmptyState /> : children}
    </div>
  )
}

function pnlColor(value) {
  return value >= 0 ? GREEN : RED
}

export default function StatsCharts({ stats }) {
  const { equityCurve, byStrategy, bySymbol, totalClosed } = stats
  const wins = { name: 'Wins', value: Math.round((stats.winRate / 100) * totalClosed) }
  const losses = { name: 'Losses', value: totalClosed - wins.value }
  const winLossData = [wins, losses].filter((d) => d.value > 0)
  const topSymbols = [...bySymbol]
    .sort((a, b) => Math.abs(b.totalPnl) - Math.abs(a.totalPnl))
    .slice(0, 10)

  return (
    <div data-testid="stats-charts" className="stats-charts">
      <ChartCard title="Equity Curve" isEmpty={equityCurve.length === 0}>
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={equityCurve} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
            <CartesianGrid stroke={GRID} strokeDasharray="0" vertical={false} />
            <XAxis dataKey="date" tick={{ fill: AXIS_TEXT, fontSize: 11 }} axisLine={{ stroke: GRID }} tickLine={false} minTickGap={28} />
            <YAxis tick={{ fill: AXIS_TEXT, fontSize: 11 }} axisLine={{ stroke: GRID }} tickLine={false} tickFormatter={formatAxisCurrency} width={46} />
            <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v) => formatCurrency(v)} />
            <Line type="monotone" dataKey="cumulative" name="Cumulative P&L" stroke="#3987e5" strokeWidth={2} dot={{ r: 4, fill: '#3987e5', stroke: '#141414', strokeWidth: 2 }} activeDot={{ r: 5 }} />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="P&L by Strategy" isEmpty={byStrategy.length === 0}>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={byStrategy} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
            <CartesianGrid stroke={GRID} strokeDasharray="0" vertical={false} />
            <XAxis dataKey="label" tick={{ fill: AXIS_TEXT, fontSize: 11 }} axisLine={{ stroke: GRID }} tickLine={false} />
            <YAxis tick={{ fill: AXIS_TEXT, fontSize: 11 }} axisLine={{ stroke: GRID }} tickLine={false} tickFormatter={formatAxisCurrency} width={46} />
            <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v) => formatCurrency(v)} />
            <Bar dataKey="totalPnl" name="Total P&L" radius={[4, 4, 0, 0]} maxBarSize={24}>
              {byStrategy.map((row) => (
                <Cell key={row.strategy} fill={pnlColor(row.totalPnl)} />
              ))}
              <LabelList dataKey="totalPnl" position="top" formatter={(v) => formatCurrency(v)} fill={AXIS_TEXT} fontSize={11} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Win / Loss" isEmpty={winLossData.length === 0}>
        <ResponsiveContainer width="100%" height={260}>
          <PieChart>
            <Tooltip contentStyle={TOOLTIP_STYLE} />
            <Legend wrapperStyle={{ fontSize: 12, color: AXIS_TEXT }} />
            <Pie
              data={winLossData}
              dataKey="value"
              nameKey="name"
              innerRadius={60}
              outerRadius={90}
              paddingAngle={2}
              label={({ name, value }) => `${name}: ${value}`}
            >
              {winLossData.map((entry) => (
                <Cell key={entry.name} fill={entry.name === 'Wins' ? GREEN : RED} stroke="#141414" strokeWidth={2} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="P&L by Symbol" isEmpty={topSymbols.length === 0} wide>
        <ResponsiveContainer width="100%" height={Math.max(260, topSymbols.length * 40)}>
          <BarChart data={topSymbols} layout="vertical" margin={{ top: 8, right: 44, left: 8, bottom: 0 }} barCategoryGap="30%">
            <CartesianGrid stroke={GRID} strokeDasharray="0" horizontal={false} />
            <XAxis type="number" tick={{ fill: AXIS_TEXT, fontSize: 11 }} axisLine={{ stroke: GRID }} tickLine={false} tickFormatter={formatAxisCurrency} />
            <YAxis type="category" dataKey="symbol" tick={{ fill: AXIS_TEXT, fontSize: 11 }} axisLine={{ stroke: GRID }} tickLine={false} width={52} />
            <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v) => formatCurrency(v)} />
            <Bar dataKey="totalPnl" name="Total P&L" radius={[0, 4, 4, 0]} maxBarSize={20}>
              {topSymbols.map((row) => (
                <Cell key={row.symbol} fill={pnlColor(row.totalPnl)} />
              ))}
              <LabelList dataKey="totalPnl" position="right" formatter={formatAxisCurrency} fill={AXIS_TEXT} fontSize={11} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  )
}
