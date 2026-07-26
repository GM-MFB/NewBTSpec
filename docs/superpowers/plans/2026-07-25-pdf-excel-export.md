# Stats Page PDF Report & Excel Export Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add "Export PDF" and "Export Excel" buttons to the Stats page toolbar that generate a professional PDF report (with embedded chart images) and a multi-sheet Excel workbook, both covering the same data already shown on `/stats`, respecting the active date range filter.

**Architecture:** A pure data-shaping module (`exportData.js`) turns already-computed stats + investment lists into export-ready structures. Two independent generator modules (`pdfReport.js`, `excelExport.js`) consume that shape and produce downloadable files via `jsPDF`/`jspdf-autotable`/`html2canvas` and `xlsx`. `StatsPage.jsx` wires two buttons to these generators and switches `StatsCharts` from conditional mounting to CSS-based show/hide so chart DOM is always available to snapshot.

**Tech Stack:** React 19, Vitest + @testing-library/react, `jspdf`, `jspdf-autotable`, `html2canvas`, `xlsx` (new deps).

## Global Constraints

- Do not change Supabase table/column names or add new queries — all data needed is already fetched by `useInvestmentsHistory`.
- Match existing app conventions: camelCase JS objects, `formatCurrency`/`formatCurrencyAuto` from `src/lib/format.js` where used for display, dark app color values `--green` (`#22c55e`) / `--red` (`#ef4444`) for P&L coloring in exports.
- TDD throughout: failing test → implementation → passing test → commit, per task.
- No confirmation dialogs (matches the rest of the app's delete/close button conventions) — clicking Export just downloads.

---

### Task 1: Install export dependencies

**Files:**
- Modify: `package.json`, `package-lock.json` (via npm install)

- [ ] **Step 1: Install the four new dependencies**

Run: `npm install jspdf jspdf-autotable html2canvas xlsx`

- [ ] **Step 2: Verify the install didn't break the existing suite**

Run: `npm test`
Expected: all existing tests still pass (208 at time of writing).

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add jspdf, jspdf-autotable, html2canvas, xlsx for Stats page export"
```

---

### Task 2: Share `unrealizedPnlFor` from `investmentStats.js`

**Files:**
- Modify: `src/lib/investmentStats.js`
- Modify: `src/lib/investmentStats.test.js`
- Modify: `src/components/InvestmentRow.jsx`

**Interfaces:**
- Produces: `unrealizedPnlFor(investment) -> number | ''` — exported from `src/lib/investmentStats.js`. Blank when `investment.currentPrice` is blank; otherwise `(currentPrice - avgCost) * shares` (stocks) — matches the existing local function in `InvestmentRow.jsx` exactly (options don't currently show Unrealized P&L, so no `* 100` branch needed — same as today's behavior).

- [ ] **Step 1: Write the failing test**

Add to `src/lib/investmentStats.test.js`:

```js
import { unrealizedPnlFor } from './investmentStats'

describe('unrealizedPnlFor', () => {
  it('computes unrealized P&L for a stock with a current price set', () => {
    const investment = { assetType: 'Stock', shares: 10, avgCost: 100, currentPrice: 165 }
    expect(unrealizedPnlFor(investment)).toBe(650)
  })

  it('returns blank when current price is not set', () => {
    const investment = { assetType: 'Stock', shares: 10, avgCost: 100, currentPrice: '' }
    expect(unrealizedPnlFor(investment)).toBe('')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- investmentStats`
Expected: FAIL — `unrealizedPnlFor` is not exported.

- [ ] **Step 3: Add the export to `investmentStats.js`**

Add near `realizedPnlFor`:

```js
function isBlank(value) {
  return value === '' || value === undefined || value === null
}

export function unrealizedPnlFor(investment) {
  if (isBlank(investment.currentPrice)) return ''
  return (Number(investment.currentPrice) - Number(investment.avgCost)) * Number(investment.shares)
}
```

- [ ] **Step 4: Update `InvestmentRow.jsx` to use the shared function**

In `src/components/InvestmentRow.jsx`, remove the local `unrealizedPnlFor` function definition and import it instead:

```js
import { realizedPnlFor, unrealizedPnlFor } from '../lib/investmentStats'
```

Leave every call site (`unrealizedPnlFor(investment)`) unchanged — only the import/definition moves.

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test -- investmentStats InvestmentRow`
Expected: PASS, no behavior change in `InvestmentRow` (existing 37 tests there still pass).

- [ ] **Step 6: Commit**

```bash
git add src/lib/investmentStats.js src/lib/investmentStats.test.js src/components/InvestmentRow.jsx
git commit -m "refactor: share unrealizedPnlFor from investmentStats.js instead of duplicating in InvestmentRow"
```

---

### Task 3: `buildExportData` (`src/lib/exportData.js`)

**Files:**
- Create: `src/lib/exportData.js`
- Create: `src/lib/exportData.test.js`

**Interfaces:**
- Consumes: `computeInvestmentStats(investments)` output shape (Task-independent, already exists in `investmentStats.js`); `realizedPnlFor`, `unrealizedPnlFor` from `investmentStats.js`; `effectiveStrategyDef` from `optionStrategies.js`; `formatCurrency` not used here (raw numbers only — formatting is presentation-layer, done in `pdfReport.js`/`excelExport.js`).
- Produces: `buildExportData({ stats, closedInvestments, openInvestments, accountName, startDate, endDate }) -> ExportData` (shape below), consumed by Task 4 and Task 5.

```
ExportData = {
  meta: { accountName: string, generatedAt: string (ISO), dateRangeLabel: string },
  overview: { totalRealizedPnl, winRate, totalClosed, totalOpen, avgWin, avgLoss, bestTradeSymbol, worstTradeSymbol },
  stock: { totalPnl, winRate, count },
  options: { totalPnl, winRate, count, totalPremiumCollected },
  byStrategy: [{ label, count, winRate, totalPnl }],
  bySymbol: [{ symbol, count, totalPnl }],
  closedRows: [{ symbol, assetType, strategyLabel, avgCost, sellPrice, sellDate, realizedPnl }],
  openRows: [{ symbol, assetType, strategyLabel, shares, avgCost, currentPrice, unrealizedPnl }],
}
```

- [ ] **Step 1: Write the failing test**

Create `src/lib/exportData.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { buildExportData } from './exportData'
import { computeInvestmentStats } from './investmentStats'

const closed = [
  { id: 'i1', status: 'closed', assetType: 'Stock', symbol: 'AAPL', shares: 10, avgCost: 100, sellPrice: 150, sellDate: '2026-01-10', strategy: '', strike: '', expiry: '' },
  { id: 'i3', status: 'closed', assetType: 'Option', symbol: 'QQQ', shares: 2, avgCost: 1.5, sellPrice: 0.5, sellDate: '2026-01-12', strategy: 'cash_secured_put', strike: 380, expiry: '2026-01-17' },
]
const open = [
  { id: 'i2', status: 'open', assetType: 'Stock', symbol: 'MSFT', shares: 3, avgCost: 400, currentPrice: 420, strategy: '', strike: '', expiry: '' },
]

describe('buildExportData', () => {
  it('shapes overview, stock, and options figures from computeInvestmentStats', () => {
    const stats = computeInvestmentStats([...closed, ...open])
    const data = buildExportData({ stats, closedInvestments: closed, openInvestments: open, accountName: 'Main Account', startDate: '', endDate: '' })

    expect(data.overview.totalRealizedPnl).toBe(stats.totalRealizedPnl)
    expect(data.overview.totalClosed).toBe(2)
    expect(data.overview.totalOpen).toBe(1)
    expect(data.stock.count).toBe(1)
    expect(data.options.count).toBe(1)
  })

  it('maps closed rows with symbol, strategy label, and realized P&L', () => {
    const stats = computeInvestmentStats([...closed, ...open])
    const data = buildExportData({ stats, closedInvestments: closed, openInvestments: open, accountName: 'Main Account', startDate: '', endDate: '' })

    const aapl = data.closedRows.find((r) => r.symbol === 'AAPL')
    expect(aapl.realizedPnl).toBe(500)
    expect(aapl.strategyLabel).toBe('')

    const qqq = data.closedRows.find((r) => r.symbol === 'QQQ')
    expect(qqq.strategyLabel).toBe('Cash Secured Put')
    expect(qqq.realizedPnl).toBe(200)
  })

  it('maps open rows with unrealized P&L', () => {
    const stats = computeInvestmentStats([...closed, ...open])
    const data = buildExportData({ stats, closedInvestments: closed, openInvestments: open, accountName: 'Main Account', startDate: '', endDate: '' })

    const msft = data.openRows.find((r) => r.symbol === 'MSFT')
    expect(msft.unrealizedPnl).toBe(60)
  })

  it('labels the date range as "All time" when no bounds are set', () => {
    const stats = computeInvestmentStats([])
    const data = buildExportData({ stats, closedInvestments: [], openInvestments: [], accountName: 'Main Account', startDate: '', endDate: '' })
    expect(data.meta.dateRangeLabel).toBe('All time')
  })

  it('labels the date range with both bounds when both are set', () => {
    const stats = computeInvestmentStats([])
    const data = buildExportData({ stats, closedInvestments: [], openInvestments: [], accountName: 'Main Account', startDate: '2026-01-01', endDate: '2026-01-31' })
    expect(data.meta.dateRangeLabel).toBe('2026-01-01 – 2026-01-31')
  })

  it('labels the date range with just a start bound', () => {
    const stats = computeInvestmentStats([])
    const data = buildExportData({ stats, closedInvestments: [], openInvestments: [], accountName: 'Main Account', startDate: '2026-01-01', endDate: '' })
    expect(data.meta.dateRangeLabel).toBe('From 2026-01-01')
  })

  it('labels the date range with just an end bound', () => {
    const stats = computeInvestmentStats([])
    const data = buildExportData({ stats, closedInvestments: [], openInvestments: [], accountName: 'Main Account', startDate: '', endDate: '2026-01-31' })
    expect(data.meta.dateRangeLabel).toBe('Through 2026-01-31')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- exportData`
Expected: FAIL — module doesn't exist.

- [ ] **Step 3: Implement `src/lib/exportData.js`**

```js
import { realizedPnlFor, unrealizedPnlFor } from './investmentStats'
import { effectiveStrategyDef } from './optionStrategies'

function toNum(value) {
  return value === '' || value === undefined || value === null ? 0 : Number(value)
}

function dateRangeLabel(startDate, endDate) {
  if (startDate && endDate) return `${startDate} – ${endDate}`
  if (startDate) return `From ${startDate}`
  if (endDate) return `Through ${endDate}`
  return 'All time'
}

function strategyLabelFor(investment) {
  const def = effectiveStrategyDef(investment)
  return def ? def.label : ''
}

export function buildExportData({ stats, closedInvestments, openInvestments, accountName, startDate, endDate }) {
  const closedRows = closedInvestments.map((investment) => ({
    symbol: investment.symbol,
    assetType: investment.assetType,
    strategyLabel: investment.assetType === 'Option' ? strategyLabelFor(investment) : '',
    avgCost: toNum(investment.avgCost),
    sellPrice: toNum(investment.sellPrice),
    sellDate: investment.sellDate,
    realizedPnl: realizedPnlFor(investment),
  }))

  const openRows = openInvestments.map((investment) => ({
    symbol: investment.symbol,
    assetType: investment.assetType,
    strategyLabel: investment.assetType === 'Option' ? strategyLabelFor(investment) : '',
    shares: toNum(investment.shares),
    avgCost: toNum(investment.avgCost),
    currentPrice: investment.currentPrice === '' ? '' : toNum(investment.currentPrice),
    unrealizedPnl: unrealizedPnlFor(investment),
  }))

  return {
    meta: {
      accountName,
      generatedAt: new Date().toISOString(),
      dateRangeLabel: dateRangeLabel(startDate, endDate),
    },
    overview: {
      totalRealizedPnl: stats.totalRealizedPnl,
      winRate: stats.winRate,
      totalClosed: stats.totalClosed,
      totalOpen: stats.totalOpen,
      avgWin: stats.avgWin,
      avgLoss: stats.avgLoss,
      bestTradeSymbol: stats.bestTrade ? stats.bestTrade.symbol : '',
      worstTradeSymbol: stats.worstTrade ? stats.worstTrade.symbol : '',
    },
    stock: stats.stock,
    options: stats.options,
    byStrategy: stats.byStrategy,
    bySymbol: stats.bySymbol,
    closedRows,
    openRows,
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- exportData`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/exportData.js src/lib/exportData.test.js
git commit -m "feat: add buildExportData to shape Stats page data for PDF/Excel export"
```

---

### Task 4: PDF report generator (`src/lib/pdfReport.js`)

**Files:**
- Create: `src/lib/pdfReport.js`
- Create: `src/lib/pdfReport.test.js`

**Interfaces:**
- Consumes: `ExportData` shape from Task 3.
- Produces: `generatePdfReport(exportData, chartsElement) -> void` (calls `.save(filename)` internally — side-effecting, triggers a browser download). `chartsElement` is a DOM node (or `null`/`undefined` when there's nothing to chart) passed in by `StatsPage.jsx`.

`jspdf-autotable` attaches an `autoTable` method to `jsPDF` instances as a side effect of importing it — `import autoTable from 'jspdf-autotable'` then call `autoTable(doc, {...})` (the current jspdf-autotable v4+ API), not `doc.autoTable(...)` (older API) — check the installed version's README if the calls below don't match, but write to the `autoTable(doc, options)` free-function form since that's current as of this plan.

- [ ] **Step 1: Write the failing test**

Create `src/lib/pdfReport.test.js`. Mock all three libraries so the test asserts on the calls made, not on binary PDF output:

```js
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { generatePdfReport } from './pdfReport'

const saveMock = vi.fn()
const addImageMock = vi.fn()
const textMock = vi.fn()
const addPageMock = vi.fn()
const setFontSizeMock = vi.fn()
const jsPdfInstance = {
  save: saveMock,
  addImage: addImageMock,
  text: textMock,
  addPage: addPageMock,
  setFontSize: setFontSizeMock,
  internal: { pageSize: { getWidth: () => 210, getHeight: () => 297 }, getNumberOfPages: () => 1 },
  setPage: vi.fn(),
  lastAutoTable: { finalY: 40 },
}

vi.mock('jspdf', () => ({ jsPDF: vi.fn(() => jsPdfInstance) }))
vi.mock('jspdf-autotable', () => ({ default: vi.fn() }))
vi.mock('html2canvas', () => ({ default: vi.fn().mockResolvedValue({ toDataURL: () => 'data:image/png;base64,fake' }) }))

const exportData = {
  meta: { accountName: 'Main Account', generatedAt: '2026-01-20T00:00:00.000Z', dateRangeLabel: 'All time' },
  overview: { totalRealizedPnl: 500, winRate: 100, totalClosed: 1, totalOpen: 0, avgWin: 500, avgLoss: 0, bestTradeSymbol: 'AAPL', worstTradeSymbol: '' },
  stock: { totalPnl: 500, winRate: 100, count: 1 },
  options: { totalPnl: 0, winRate: 0, count: 0, totalPremiumCollected: 0 },
  byStrategy: [],
  bySymbol: [{ symbol: 'AAPL', count: 1, totalPnl: 500 }],
  closedRows: [{ symbol: 'AAPL', assetType: 'Stock', strategyLabel: '', avgCost: 100, sellPrice: 150, sellDate: '2026-01-10', realizedPnl: 500 }],
  openRows: [],
}

describe('generatePdfReport', () => {
  beforeEach(() => vi.clearAllMocks())

  it('saves a PDF with the expected filename', async () => {
    await generatePdfReport(exportData, null)
    expect(saveMock).toHaveBeenCalledWith(expect.stringMatching(/^bt-speculation-report-\d{4}-\d{2}-\d{2}\.pdf$/))
  })

  it('writes the account name and date range into the header', async () => {
    await generatePdfReport(exportData, null)
    const allTextCalls = textMock.mock.calls.map((c) => c[0]).join(' ')
    expect(allTextCalls).toContain('Main Account')
    expect(allTextCalls).toContain('All time')
  })

  it('skips chart capture when no charts element is provided', async () => {
    await generatePdfReport(exportData, null)
    expect(addImageMock).not.toHaveBeenCalled()
  })

  it('captures chart images when a charts element is provided', async () => {
    const fakeElement = {}
    await generatePdfReport(exportData, fakeElement)
    expect(addImageMock).toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- pdfReport`
Expected: FAIL — module doesn't exist.

- [ ] **Step 3: Implement `src/lib/pdfReport.js`**

```js
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import html2canvas from 'html2canvas'
import { formatCurrency } from './format'

const GREEN = [34, 197, 94]
const RED = [239, 68, 68]
const DARK = [20, 20, 20]
const GRAY = [136, 136, 136]

function pnlColor(value) {
  return value >= 0 ? GREEN : RED
}

function addHeader(doc, meta) {
  doc.setFontSize(18)
  doc.text('BT Speculation — Performance Report', 14, 18)
  doc.setFontSize(10)
  doc.text(meta.accountName, 14, 26)
  doc.text(`Generated: ${new Date(meta.generatedAt).toLocaleString()}`, 14, 32)
  doc.text(`Date range: ${meta.dateRangeLabel}`, 14, 38)
  return 46
}

function addKeyValueTable(doc, title, rows, startY) {
  doc.setFontSize(13)
  doc.text(title, 14, startY)
  autoTable(doc, {
    startY: startY + 4,
    head: [['Metric', 'Value']],
    body: rows,
    theme: 'grid',
    styles: { fontSize: 9 },
  })
  return doc.lastAutoTable.finalY + 10
}

async function addChartsSection(doc, chartsElement, startY) {
  if (!chartsElement) return startY
  const canvas = await html2canvas(chartsElement)
  const imgData = canvas.toDataURL('image/png')
  const pageWidth = doc.internal.pageSize.getWidth()
  const imgWidth = pageWidth - 28
  const imgHeight = (canvas.height / canvas.width) * imgWidth
  doc.setFontSize(13)
  doc.text('Charts', 14, startY)
  doc.addImage(imgData, 'PNG', 14, startY + 4, imgWidth, imgHeight)
  return startY + imgHeight + 20
}

function addRowsTable(doc, title, head, body, startY) {
  doc.setFontSize(13)
  doc.text(title, 14, startY)
  autoTable(doc, {
    startY: startY + 4,
    head: [head],
    body,
    theme: 'grid',
    styles: { fontSize: 8 },
    didParseCell(data) {
      if (data.section === 'body' && data.column.dataKey === head.length - 1) {
        const raw = data.cell.raw
        if (typeof raw === 'number') data.cell.styles.textColor = pnlColor(raw)
      }
    },
  })
  return doc.lastAutoTable.finalY + 10
}

function addFooter(doc) {
  const pageCount = doc.internal.getNumberOfPages()
  for (let i = 1; i <= pageCount; i += 1) {
    doc.setPage(i)
    doc.setFontSize(8)
    doc.setTextColor(...GRAY)
    doc.text(`Page ${i} of ${pageCount}`, doc.internal.pageSize.getWidth() - 30, doc.internal.pageSize.getHeight() - 10)
  }
}

export async function generatePdfReport(exportData, chartsElement) {
  const doc = new jsPDF()
  let y = addHeader(doc, exportData.meta)

  y = addKeyValueTable(doc, 'Overview', [
    ['Total Realized P&L', formatCurrency(exportData.overview.totalRealizedPnl)],
    ['Win Rate', `${exportData.overview.winRate.toFixed(1)}%`],
    ['Closed Positions', String(exportData.overview.totalClosed)],
    ['Open Positions', String(exportData.overview.totalOpen)],
    ['Avg Win', formatCurrency(exportData.overview.avgWin)],
    ['Avg Loss', formatCurrency(exportData.overview.avgLoss)],
    ['Best Trade', exportData.overview.bestTradeSymbol || '—'],
    ['Worst Trade', exportData.overview.worstTradeSymbol || '—'],
  ], y)

  y = addKeyValueTable(doc, 'Stocks', [
    ['Closed Stock P&L', formatCurrency(exportData.stock.totalPnl)],
    ['Stock Win Rate', `${exportData.stock.winRate.toFixed(1)}%`],
    ['Stock Positions Closed', String(exportData.stock.count)],
  ], y)

  y = addKeyValueTable(doc, 'Options', [
    ['Closed Option P&L', formatCurrency(exportData.options.totalPnl)],
    ['Option Win Rate', `${exportData.options.winRate.toFixed(1)}%`],
    ['Option Positions Closed', String(exportData.options.count)],
    ['Total Premium Collected', formatCurrency(exportData.options.totalPremiumCollected)],
  ], y)

  y = await addChartsSection(doc, chartsElement, y)

  if (exportData.byStrategy.length > 0) {
    y = addRowsTable(doc, 'By Strategy',
      ['Strategy', 'Trades', 'Win Rate', 'Total P&L'],
      exportData.byStrategy.map((r) => [r.label, r.count, `${r.winRate.toFixed(1)}%`, r.totalPnl]),
      y)
  }

  if (exportData.bySymbol.length > 0) {
    y = addRowsTable(doc, 'By Symbol',
      ['Symbol', 'Trades', 'Total P&L'],
      exportData.bySymbol.map((r) => [r.symbol, r.count, r.totalPnl]),
      y)
  }

  if (exportData.closedRows.length > 0) {
    y = addRowsTable(doc, 'Closed Investments',
      ['Symbol', 'Type', 'Strategy', 'Avg Cost', 'Sell Price', 'Sell Date', 'Realized P&L'],
      exportData.closedRows.map((r) => [r.symbol, r.assetType, r.strategyLabel, formatCurrency(r.avgCost), formatCurrency(r.sellPrice), r.sellDate, r.realizedPnl]),
      y)
  }

  if (exportData.openRows.length > 0) {
    y = addRowsTable(doc, 'Open Positions',
      ['Symbol', 'Type', 'Strategy', 'Shares', 'Avg Cost', 'Current Price', 'Unrealized P&L'],
      exportData.openRows.map((r) => [r.symbol, r.assetType, r.strategyLabel, r.shares, formatCurrency(r.avgCost), r.currentPrice === '' ? '' : formatCurrency(r.currentPrice), r.unrealizedPnl === '' ? '' : r.unrealizedPnl]),
      y)
  }

  addFooter(doc)

  const filename = `bt-speculation-report-${new Date().toISOString().slice(0, 10)}.pdf`
  doc.save(filename)
}
```

Note: `addRowsTable`'s `didParseCell` P&L coloring keys off `data.column.dataKey === head.length - 1` — `autoTable` without explicit `columns` config uses zero-based array indices as `dataKey`, so the last column index is `head.length - 1`. This colors the rightmost column (always the P&L figure in every table this function is used for).

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- pdfReport`
Expected: PASS (4 tests). If the `jspdf-autotable` mock/import shape doesn't match the installed version (check `node_modules/jspdf-autotable/package.json` `"version"` and its README for the current call convention), adjust the `vi.mock('jspdf-autotable', ...)` and the `autoTable(doc, {...})` call together — keep both in sync.

- [ ] **Step 5: Commit**

```bash
git add src/lib/pdfReport.js src/lib/pdfReport.test.js
git commit -m "feat: add generatePdfReport for Stats page PDF export"
```

---

### Task 5: Excel export generator (`src/lib/excelExport.js`)

**Files:**
- Create: `src/lib/excelExport.js`
- Create: `src/lib/excelExport.test.js`

**Interfaces:**
- Consumes: `ExportData` shape from Task 3.
- Produces: `generateExcelWorkbook(exportData) -> void` (side-effecting, triggers a browser download via `XLSX.writeFile`).

- [ ] **Step 1: Write the failing test**

Create `src/lib/excelExport.test.js`:

```js
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { generateExcelWorkbook } from './excelExport'
import * as XLSX from 'xlsx'

vi.mock('xlsx', () => ({
  utils: {
    book_new: vi.fn(() => ({ SheetNames: [], Sheets: {} })),
    aoa_to_sheet: vi.fn((rows) => ({ __rows: rows })),
    book_append_sheet: vi.fn(),
  },
  writeFile: vi.fn(),
}))

const exportData = {
  meta: { accountName: 'Main Account', generatedAt: '2026-01-20T00:00:00.000Z', dateRangeLabel: 'All time' },
  overview: { totalRealizedPnl: 500, winRate: 100, totalClosed: 1, totalOpen: 0, avgWin: 500, avgLoss: 0, bestTradeSymbol: 'AAPL', worstTradeSymbol: '' },
  stock: { totalPnl: 500, winRate: 100, count: 1 },
  options: { totalPnl: 0, winRate: 0, count: 0, totalPremiumCollected: 0 },
  byStrategy: [{ label: 'Cash Secured Put', count: 1, winRate: 100, totalPnl: 200 }],
  bySymbol: [{ symbol: 'AAPL', count: 1, totalPnl: 500 }],
  closedRows: [{ symbol: 'AAPL', assetType: 'Stock', strategyLabel: '', avgCost: 100, sellPrice: 150, sellDate: '2026-01-10', realizedPnl: 500 }],
  openRows: [{ symbol: 'MSFT', assetType: 'Stock', strategyLabel: '', shares: 3, avgCost: 400, currentPrice: 420, unrealizedPnl: 60 }],
}

describe('generateExcelWorkbook', () => {
  beforeEach(() => vi.clearAllMocks())

  it('creates five sheets with the expected names', () => {
    generateExcelWorkbook(exportData)
    const sheetNames = XLSX.utils.book_append_sheet.mock.calls.map((c) => c[2])
    expect(sheetNames).toEqual(['Overview', 'Closed Investments', 'Open Investments', 'By Strategy', 'By Symbol'])
  })

  it('writes the closed investment row data into the Closed Investments sheet', () => {
    generateExcelWorkbook(exportData)
    const closedSheetCall = XLSX.utils.aoa_to_sheet.mock.calls.find((c) => c[0].some((row) => row.includes('AAPL')))
    expect(closedSheetCall[0]).toEqual(expect.arrayContaining([
      expect.arrayContaining(['AAPL', 'Stock']),
    ]))
  })

  it('calls writeFile with the expected filename', () => {
    generateExcelWorkbook(exportData)
    expect(XLSX.writeFile).toHaveBeenCalledWith(expect.anything(), expect.stringMatching(/^bt-speculation-export-\d{4}-\d{2}-\d{2}\.xlsx$/))
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- excelExport`
Expected: FAIL — module doesn't exist.

- [ ] **Step 3: Implement `src/lib/excelExport.js`**

```js
import * as XLSX from 'xlsx'

function addSheet(workbook, name, rows) {
  const sheet = XLSX.utils.aoa_to_sheet(rows)
  XLSX.utils.book_append_sheet(workbook, sheet, name)
}

export function generateExcelWorkbook(exportData) {
  const workbook = XLSX.utils.book_new()

  addSheet(workbook, 'Overview', [
    ['Metric', 'Value'],
    ['Account', exportData.meta.accountName],
    ['Generated', exportData.meta.generatedAt],
    ['Date Range', exportData.meta.dateRangeLabel],
    ['Total Realized P&L', exportData.overview.totalRealizedPnl],
    ['Win Rate (%)', exportData.overview.winRate],
    ['Closed Positions', exportData.overview.totalClosed],
    ['Open Positions', exportData.overview.totalOpen],
    ['Avg Win', exportData.overview.avgWin],
    ['Avg Loss', exportData.overview.avgLoss],
    ['Best Trade', exportData.overview.bestTradeSymbol],
    ['Worst Trade', exportData.overview.worstTradeSymbol],
    ['Closed Stock P&L', exportData.stock.totalPnl],
    ['Stock Win Rate (%)', exportData.stock.winRate],
    ['Closed Option P&L', exportData.options.totalPnl],
    ['Option Win Rate (%)', exportData.options.winRate],
    ['Total Premium Collected', exportData.options.totalPremiumCollected],
  ])

  addSheet(workbook, 'Closed Investments', [
    ['Symbol', 'Type', 'Strategy', 'Avg Cost', 'Sell Price', 'Sell Date', 'Realized P&L'],
    ...exportData.closedRows.map((r) => [r.symbol, r.assetType, r.strategyLabel, r.avgCost, r.sellPrice, r.sellDate, r.realizedPnl]),
  ])

  addSheet(workbook, 'Open Investments', [
    ['Symbol', 'Type', 'Strategy', 'Shares', 'Avg Cost', 'Current Price', 'Unrealized P&L'],
    ...exportData.openRows.map((r) => [r.symbol, r.assetType, r.strategyLabel, r.shares, r.avgCost, r.currentPrice, r.unrealizedPnl]),
  ])

  addSheet(workbook, 'By Strategy', [
    ['Strategy', 'Trades', 'Win Rate (%)', 'Total P&L'],
    ...exportData.byStrategy.map((r) => [r.label, r.count, r.winRate, r.totalPnl]),
  ])

  addSheet(workbook, 'By Symbol', [
    ['Symbol', 'Trades', 'Total P&L'],
    ...exportData.bySymbol.map((r) => [r.symbol, r.count, r.totalPnl]),
  ])

  const filename = `bt-speculation-export-${new Date().toISOString().slice(0, 10)}.xlsx`
  XLSX.writeFile(workbook, filename)
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- excelExport`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/excelExport.js src/lib/excelExport.test.js
git commit -m "feat: add generateExcelWorkbook for Stats page Excel export"
```

---

### Task 6: Wire buttons into `StatsPage.jsx`

**Files:**
- Modify: `src/pages/StatsPage.jsx`
- Modify: `src/pages/StatsPage.test.jsx`
- Modify: `src/pages/StatsPage.css`

**Interfaces:**
- Consumes: `buildExportData` (Task 3), `generatePdfReport` (Task 4), `generateExcelWorkbook` (Task 5).

- [ ] **Step 1: Write the failing tests**

Add to `src/pages/StatsPage.test.jsx`, mocking the three new modules:

```js
import { buildExportData } from '../lib/exportData'
import { generatePdfReport } from '../lib/pdfReport'
import { generateExcelWorkbook } from '../lib/excelExport'

vi.mock('../lib/exportData')
vi.mock('../lib/pdfReport')
vi.mock('../lib/excelExport')
```

(add alongside the existing `vi.mock` calls at the top of the file)

```js
  it('keeps StatsCharts mounted (hidden) even in Numbers view, for PDF chart capture', () => {
    mockAccounts()
    useInvestmentsHistory.mockReturnValue({ investments, loading: false, error: null, reload: vi.fn(), deleteInvestment: vi.fn() })

    render(<MemoryRouter><StatsPage /></MemoryRouter>)

    expect(screen.getByTestId('stats-charts')).toBeInTheDocument()
  })

  it('calls buildExportData and generatePdfReport when Export PDF is clicked', async () => {
    mockAccounts()
    useInvestmentsHistory.mockReturnValue({ investments, loading: false, error: null, reload: vi.fn(), deleteInvestment: vi.fn() })
    buildExportData.mockReturnValue({ meta: {}, closedRows: [], openRows: [] })

    render(<MemoryRouter><StatsPage /></MemoryRouter>)

    await userEvent.click(screen.getByRole('button', { name: /export pdf/i }))

    expect(buildExportData).toHaveBeenCalled()
    expect(generatePdfReport).toHaveBeenCalled()
  })

  it('calls buildExportData and generateExcelWorkbook when Export Excel is clicked', async () => {
    mockAccounts()
    useInvestmentsHistory.mockReturnValue({ investments, loading: false, error: null, reload: vi.fn(), deleteInvestment: vi.fn() })
    buildExportData.mockReturnValue({ meta: {}, closedRows: [], openRows: [] })

    render(<MemoryRouter><StatsPage /></MemoryRouter>)

    await userEvent.click(screen.getByRole('button', { name: /export excel/i }))

    expect(buildExportData).toHaveBeenCalled()
    expect(generateExcelWorkbook).toHaveBeenCalled()
  })

  it('disables the export buttons while loading', () => {
    mockAccounts()
    useInvestmentsHistory.mockReturnValue({ investments: [], loading: true, error: null, reload: vi.fn(), deleteInvestment: vi.fn() })

    render(<MemoryRouter><StatsPage /></MemoryRouter>)

    expect(screen.getByRole('button', { name: /export pdf/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /export excel/i })).toBeDisabled()
  })
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- StatsPage`
Expected: FAIL — no Export buttons yet, `StatsCharts` still conditionally unmounted.

- [ ] **Step 3: Update `StatsPage.jsx`**

Import additions:

```js
import { buildExportData } from '../lib/exportData'
import { generatePdfReport } from '../lib/pdfReport'
import { generateExcelWorkbook } from '../lib/excelExport'
```

Add a `chartsRef` (from `useRef`) and switch the charts render from conditional mount to always-mounted with a CSS class:

```js
import { useRef, useState } from 'react'
```

```jsx
const chartsRef = useRef(null)
```

Replace:
```jsx
{!loading && view === 'charts' && <StatsCharts stats={stats} />}
```
with:
```jsx
{!loading && (
  <div ref={chartsRef} className={view === 'charts' ? '' : 'stats-charts-hidden'}>
    <StatsCharts stats={stats} />
  </div>
)}
```

Add `openInvestments` derivation near the other `closedInvestments`-adjacent derivations:

```js
const openInvestments = investments.filter((i) => i.status === 'open')
```

Add the two handlers:

```js
async function handleExportPdf() {
  const data = buildExportData({ stats, closedInvestments, openInvestments, accountName: activeAccount?.name ?? '', startDate, endDate })
  await generatePdfReport(data, chartsRef.current)
}

function handleExportExcel() {
  const data = buildExportData({ stats, closedInvestments, openInvestments, accountName: activeAccount?.name ?? '', startDate, endDate })
  generateExcelWorkbook(data)
}
```

Add the two buttons to the toolbar, next to the date filter:

```jsx
<div className="export-buttons">
  <button type="button" onClick={handleExportPdf} disabled={loading}>Export PDF</button>
  <button type="button" onClick={handleExportExcel} disabled={loading}>Export Excel</button>
</div>
```

Placed in `.stats-toolbar`, after `.date-range-filter` and before `.view-toggle` (so the toolbar reads: date filter → export buttons → view toggle).

- [ ] **Step 4: Add CSS**

Add to `src/pages/StatsPage.css`:

```css
.stats-charts-hidden {
  display: none;
}

.export-buttons {
  display: flex;
  gap: 8px;
}

.export-buttons button {
  background: transparent;
  border: 1px solid var(--border);
  color: var(--text-dim);
  padding: 7px 14px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
}

.export-buttons button:hover:not(:disabled) {
  border-color: var(--green);
  color: var(--green);
}

.export-buttons button:disabled {
  opacity: 0.5;
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test -- StatsPage`
Expected: PASS (all StatsPage tests, existing + 4 new = 13).

- [ ] **Step 6: Commit**

```bash
git add src/pages/StatsPage.jsx src/pages/StatsPage.test.jsx src/pages/StatsPage.css
git commit -m "feat: wire Export PDF and Export Excel buttons into Stats page toolbar"
```

---

### Task 7: Full suite pass + manual smoke test

**Files:** none (verification only)

- [ ] **Step 1: Run the full test suite**

Run: `npm test`
Expected: all tests pass (208 existing + ~14 new from this plan).

- [ ] **Step 2: Restart the dev server**

```bash
taskkill //F //IM node.exe //T
npm run dev
```

- [ ] **Step 3: Manual smoke test**

At `/stats`:
- Click Export PDF — confirm a `.pdf` file downloads, open it and confirm the header, stat tables, chart images, and Closed/Open Investments tables are all populated and legible.
- Click Export Excel — confirm a `.xlsx` file downloads, open it and confirm all five sheets are present and populated.
- Toggle between Numbers/Charts view, then export again from Numbers view — confirm the PDF still contains chart images (proves the always-mounted `StatsCharts` capture works regardless of active view).
- Set a date range filter, export both files again, confirm the closed-investment rows respect the filter and the header/sheet shows the correct date range label.

- [ ] **Step 4: Report completion**

No commit needed for this task (verification only) unless smoke testing surfaces a bug — if so, fix it as a new small commit and re-run Step 1.
