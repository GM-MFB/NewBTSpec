import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  ComposedChart,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
} from 'recharts'
import './FinancialsCharts.css'
import {
  revenueProfitData,
  marginTrendsData,
  yoyGrowthData,
  cashFlowStatementData,
  fcfVsNetIncomeData,
  cashCompositionData,
  balanceSheetCompositionData,
  liquidityLeverageData,
  roeRoaData,
  debtVsFcfData,
  rdSgaData,
  fcfGrowthData,
  ebitdaData,
} from '../../lib/financialsCharts'
import { formatLarge } from '../../lib/format'

const GREEN = '#22c55e'
const RED = '#ef4444'
const GRID = '#262626'
const AXIS_TEXT = '#888'
const CATEGORICAL = ['#3987e5', '#d95926', '#199e70', '#c98500']
const TOOLTIP_STYLE = {
  background: '#141414',
  border: '1px solid #262626',
  borderRadius: 6,
  color: '#e5e5e5',
  fontSize: 12,
}
const TOOLTIP_ITEM_STYLE = { color: '#e5e5e5' }
const TOOLTIP_LABEL_STYLE = { color: AXIS_TEXT }

function pnlColor(value) {
  return value >= 0 ? GREEN : RED
}

function InsufficientData() {
  return <div className="chart-empty">Need at least two periods to show growth over time.</div>
}

function ChartCard({ title, isEmpty, children }) {
  return (
    <div className="chart-card">
      <h3 className="chart-card-title">{title}</h3>
      {isEmpty ? <InsufficientData /> : children}
    </div>
  )
}

const sharedAxisProps = {
  tick: { fill: AXIS_TEXT, fontSize: 11 },
  axisLine: { stroke: GRID },
  tickLine: false,
}

function DollarBarChart({ data, seriesKeys, seriesLabels }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid stroke={GRID} strokeDasharray="0" vertical={false} />
        <XAxis dataKey="date" {...sharedAxisProps} />
        <YAxis {...sharedAxisProps} tickFormatter={(v) => formatLarge(v)} width={70} />
        <Tooltip contentStyle={TOOLTIP_STYLE} itemStyle={TOOLTIP_ITEM_STYLE} labelStyle={TOOLTIP_LABEL_STYLE} formatter={(v) => formatLarge(v)} />
        <Legend wrapperStyle={{ fontSize: 11, color: AXIS_TEXT }} />
        {seriesKeys.map((key, i) => (
          <Bar key={key} dataKey={key} name={seriesLabels[i]} fill={CATEGORICAL[i]} radius={[4, 4, 0, 0]} maxBarSize={24} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  )
}

function DollarLineChart({ data, seriesKeys, seriesLabels, referenceY }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid stroke={GRID} strokeDasharray="0" vertical={false} />
        <XAxis dataKey="date" {...sharedAxisProps} />
        <YAxis {...sharedAxisProps} width={60} />
        <Tooltip contentStyle={TOOLTIP_STYLE} itemStyle={TOOLTIP_ITEM_STYLE} labelStyle={TOOLTIP_LABEL_STYLE} />
        <Legend wrapperStyle={{ fontSize: 11, color: AXIS_TEXT }} />
        {referenceY !== undefined && <ReferenceLine y={referenceY} stroke={GRID} strokeDasharray="4 4" />}
        {seriesKeys.map((key, i) => (
          <Line key={key} type="monotone" dataKey={key} name={seriesLabels[i]} stroke={CATEGORICAL[i]} strokeWidth={2} dot={{ r: 3 }} connectNulls />
        ))}
      </LineChart>
    </ResponsiveContainer>
  )
}

function PercentLineChart({ data, seriesKeys, seriesLabels }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid stroke={GRID} strokeDasharray="0" vertical={false} />
        <XAxis dataKey="date" {...sharedAxisProps} />
        <YAxis {...sharedAxisProps} width={50} tickFormatter={(v) => `${v}%`} />
        <Tooltip contentStyle={TOOLTIP_STYLE} itemStyle={TOOLTIP_ITEM_STYLE} labelStyle={TOOLTIP_LABEL_STYLE} formatter={(v) => `${Number(v).toFixed(1)}%`} />
        <Legend wrapperStyle={{ fontSize: 11, color: AXIS_TEXT }} />
        {seriesKeys.map((key, i) => (
          <Line key={key} type="monotone" dataKey={key} name={seriesLabels[i]} stroke={CATEGORICAL[i]} strokeWidth={2} dot={{ r: 3 }} connectNulls />
        ))}
      </LineChart>
    </ResponsiveContainer>
  )
}

function SignedGrowthChart({ data, dataKey, name }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid stroke={GRID} strokeDasharray="0" vertical={false} />
        <XAxis dataKey="date" {...sharedAxisProps} />
        <YAxis {...sharedAxisProps} width={50} tickFormatter={(v) => `${v}%`} />
        <Tooltip contentStyle={TOOLTIP_STYLE} itemStyle={TOOLTIP_ITEM_STYLE} labelStyle={TOOLTIP_LABEL_STYLE} formatter={(v) => `${Number(v).toFixed(1)}%`} />
        <Bar dataKey={dataKey} name={name} radius={[4, 4, 0, 0]} maxBarSize={24}>
          {data.map((row, i) => (
            <Cell key={i} fill={row[dataKey] === null ? GRID : pnlColor(row[dataKey])} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

function YoyGrowthChart({ data }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid stroke={GRID} strokeDasharray="0" vertical={false} />
        <XAxis dataKey="date" {...sharedAxisProps} />
        <YAxis {...sharedAxisProps} width={50} tickFormatter={(v) => `${v}%`} />
        <Tooltip contentStyle={TOOLTIP_STYLE} itemStyle={TOOLTIP_ITEM_STYLE} labelStyle={TOOLTIP_LABEL_STYLE} formatter={(v) => `${Number(v).toFixed(1)}%`} />
        <Legend wrapperStyle={{ fontSize: 11, color: AXIS_TEXT }} />
        <Bar dataKey="revGrowth" name="Revenue Growth" radius={[4, 4, 0, 0]} maxBarSize={20}>
          {data.map((row, i) => <Cell key={i} fill={row.revGrowth === null ? GRID : pnlColor(row.revGrowth)} />)}
        </Bar>
        <Bar dataKey="niGrowth" name="Net Income Growth" radius={[4, 4, 0, 0]} maxBarSize={20}>
          {data.map((row, i) => <Cell key={i} fill={row.niGrowth === null ? GRID : pnlColor(row.niGrowth)} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

function RdSgaTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div style={TOOLTIP_STYLE}>
      <p style={{ margin: 0, marginBottom: 4 }}>{label}</p>
      {payload.map((entry) => (
        <p key={entry.dataKey} style={{ margin: 0, color: entry.color }}>
          {entry.name}: {formatLarge(entry.value)}
          {entry.dataKey === 'rd' && payload[0]?.payload.rdPctRevenue !== null && ` (${payload[0].payload.rdPctRevenue.toFixed(1)}% of revenue)`}
          {entry.dataKey === 'sga' && payload[0]?.payload.sgaPctRevenue !== null && ` (${payload[0].payload.sgaPctRevenue.toFixed(1)}% of revenue)`}
        </p>
      ))}
    </div>
  )
}

function RdSgaChart({ data }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid stroke={GRID} strokeDasharray="0" vertical={false} />
        <XAxis dataKey="date" {...sharedAxisProps} />
        <YAxis {...sharedAxisProps} tickFormatter={(v) => formatLarge(v)} width={70} />
        <Tooltip content={<RdSgaTooltip />} />
        <Legend wrapperStyle={{ fontSize: 11, color: AXIS_TEXT }} />
        <Bar dataKey="rd" name="R&D" fill={CATEGORICAL[0]} radius={[4, 4, 0, 0]} maxBarSize={24} />
        <Bar dataKey="sga" name="SG&A" fill={CATEGORICAL[1]} radius={[4, 4, 0, 0]} maxBarSize={24} />
      </BarChart>
    </ResponsiveContainer>
  )
}

function EbitdaChart({ data }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <ComposedChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid stroke={GRID} strokeDasharray="0" vertical={false} />
        <XAxis dataKey="date" {...sharedAxisProps} />
        <YAxis {...sharedAxisProps} tickFormatter={(v) => formatLarge(v)} width={70} />
        <Tooltip contentStyle={TOOLTIP_STYLE} itemStyle={TOOLTIP_ITEM_STYLE} labelStyle={TOOLTIP_LABEL_STYLE} formatter={(v) => formatLarge(v)} />
        <Legend wrapperStyle={{ fontSize: 11, color: AXIS_TEXT }} />
        <Bar dataKey="ebitda" name="EBITDA" fill={CATEGORICAL[0]} radius={[4, 4, 0, 0]} maxBarSize={24} />
        <Line type="monotone" dataKey="operatingIncome" name="Operating Income" stroke={CATEGORICAL[1]} strokeWidth={2} dot={{ r: 3 }} />
      </ComposedChart>
    </ResponsiveContainer>
  )
}

function EpsChart({ eps, onFetchEps, epsLoading }) {
  if (!eps) {
    return (
      <div className="chart-empty fin-eps-empty">
        <p>EPS data isn't fetched with the main financials request.</p>
        <button type="button" onClick={onFetchEps} disabled={epsLoading}>
          {epsLoading ? 'Fetching…' : 'Fetch EPS Data'}
        </button>
        <p className="fin-eps-note">Uses one extra Alpha Vantage call.</p>
      </div>
    )
  }
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={eps} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid stroke={GRID} strokeDasharray="0" vertical={false} />
        <XAxis dataKey="date" {...sharedAxisProps} />
        <YAxis {...sharedAxisProps} width={50} />
        <Tooltip contentStyle={TOOLTIP_STYLE} itemStyle={TOOLTIP_ITEM_STYLE} labelStyle={TOOLTIP_LABEL_STYLE} />
        <Bar dataKey="eps" name="Reported EPS" fill={CATEGORICAL[0]} radius={[4, 4, 0, 0]} maxBarSize={24} />
      </BarChart>
    </ResponsiveContainer>
  )
}

export default function FinancialsCharts({ periods, eps, onFetchEps, epsLoading }) {
  const yoyGrowth = yoyGrowthData(periods)
  const fcfGrowth = fcfGrowthData(periods)

  return (
    <div data-testid="financials-charts" className="fin-charts">
      <ChartCard title="Revenue & Profit">
        <DollarBarChart data={revenueProfitData(periods)} seriesKeys={['revenue', 'grossProfit', 'netIncome']} seriesLabels={['Revenue', 'Gross Profit', 'Net Income']} />
      </ChartCard>

      <ChartCard title="Margin Trends">
        <PercentLineChart data={marginTrendsData(periods)} seriesKeys={['grossMargin', 'opMargin', 'netMargin', 'fcfMargin']} seriesLabels={['Gross Margin', 'Operating Margin', 'Net Margin', 'FCF Margin']} />
      </ChartCard>

      <ChartCard title="YoY Growth %" isEmpty={yoyGrowth.length === 0}>
        <YoyGrowthChart data={yoyGrowth} />
      </ChartCard>

      <ChartCard title="EPS Trend">
        <EpsChart eps={eps} onFetchEps={onFetchEps} epsLoading={epsLoading} />
      </ChartCard>

      <ChartCard title="Cash Flow Statement">
        <DollarBarChart data={cashFlowStatementData(periods)} seriesKeys={['operatingCF', 'freeCF', 'capexAbs']} seriesLabels={['Operating CF', 'Free Cash Flow', 'CapEx (abs)']} />
      </ChartCard>

      <ChartCard title="FCF vs Net Income">
        <DollarBarChart data={fcfVsNetIncomeData(periods)} seriesKeys={['freeCF', 'netIncome']} seriesLabels={['Free Cash Flow', 'Net Income']} />
      </ChartCard>

      <ChartCard title="Cash & Short-Term Investments">
        <DollarBarChart data={cashCompositionData(periods)} seriesKeys={['cash', 'shortTermInvestments']} seriesLabels={['Cash', 'Short-Term Investments']} />
      </ChartCard>

      <ChartCard title="Balance Sheet Composition">
        <DollarBarChart data={balanceSheetCompositionData(periods)} seriesKeys={['totalAssets', 'totalLiabilities', 'equity']} seriesLabels={['Total Assets', 'Total Liabilities', 'Equity']} />
      </ChartCard>

      <ChartCard title="Liquidity & Leverage Ratios">
        <DollarLineChart data={liquidityLeverageData(periods)} seriesKeys={['currentRatio', 'debtToEquity']} seriesLabels={['Current Ratio', 'Debt/Equity']} referenceY={1} />
      </ChartCard>

      <ChartCard title="Return on Equity & Assets">
        <PercentLineChart data={roeRoaData(periods)} seriesKeys={['roe', 'roa']} seriesLabels={['ROE', 'ROA']} />
      </ChartCard>

      <ChartCard title="Long-Term Debt vs Free Cash Flow">
        <DollarBarChart data={debtVsFcfData(periods)} seriesKeys={['longTermDebt', 'freeCF']} seriesLabels={['Long-Term Debt', 'Free Cash Flow']} />
      </ChartCard>

      <ChartCard title="R&D & SG&A Spending">
        <RdSgaChart data={rdSgaData(periods)} />
      </ChartCard>

      <ChartCard title="FCF Growth YoY %" isEmpty={fcfGrowth.length === 0}>
        <SignedGrowthChart data={fcfGrowth} dataKey="fcfGrowth" name="FCF Growth" />
      </ChartCard>

      <ChartCard title="EBITDA">
        <EbitdaChart data={ebitdaData(periods)} />
      </ChartCard>
    </div>
  )
}
