# Stats Page — PDF Report & Excel Export — Design

## Context

The Stats page (`/stats`) design explicitly deferred PDF export as a
follow-up. This spec builds that follow-up, and adds a matching Excel
export, both driven from the data already computed on the Stats page
(`computeInvestmentStats`, plus the open-position list already fetched by
`useInvestmentsHistory`).

Two buttons in the Stats page toolbar: **Export PDF** and **Export Excel**.
Both pull the same underlying dataset — Overview/Stocks/Options figures, By
Strategy, By Symbol, the closed-investments list, and open positions — and
both respect the page's active date range filter for closed positions (open
positions have no sell date, so they're always included in full).

## Libraries

New dependencies:
- `jspdf` + `jspdf-autotable` — PDF generation and table layout.
- `html2canvas` — snapshots the live-rendered chart DOM into images for
  embedding in the PDF.
- `xlsx` (SheetJS) — multi-sheet Excel file generation.

## Keeping charts capturable

`StatsCharts` is currently mounted only while `view === 'charts'`
(conditional render, unmounts on toggle). For `html2canvas` to reliably
snapshot the charts regardless of which view the user is looking at when
they click Export PDF, `StatsPage` switches from conditional mounting to
CSS-based show/hide: `StatsCharts` stays mounted at all times, with
`display: none` applied via a wrapper class when `view !== 'charts'`. A
hidden ref (`chartsRef`) on that wrapper is what `html2canvas` targets.

This is the one behavioral change to the existing Numbers/Charts toggle —
purely internal (mount vs. CSS visibility), no visible UI difference to the
user in either view.

## Data preparation

A new pure module, `src/lib/exportData.js`, shapes the already-computed
values into export-ready structures shared by both PDF and Excel builders,
so neither generator re-derives business logic:

```js
buildExportData({ stats, closedInvestments, openInvestments, account, dateRange })
```

returns:
```js
{
  meta: { accountName, generatedAt, dateRangeLabel },
  overview: { totalRealizedPnl, winRate, totalClosed, totalOpen, avgWin, avgLoss, bestTrade, worstTrade },
  stock: { totalPnl, winRate, count },
  options: { totalPnl, winRate, count, totalPremiumCollected },
  byStrategy: [...],   // already on `stats.byStrategy`
  bySymbol: [...],     // already on `stats.bySymbol`
  closedRows: [...],   // one row per closed investment: symbol, assetType, strategy label, avgCost, sellPrice, sellDate, realizedPnl
  openRows: [...],     // one row per open investment: symbol, assetType, strategy label, shares, avgCost, currentPrice, unrealizedPnl
}
```

`dateRangeLabel` is a human string ("All time", "From 2026-01-01", "2026-01-01 – 2026-01-31") derived from the page's `startDate`/`endDate` state, shown in both export headers.

`closedRows`/`openRows` reuse `realizedPnlFor` (from `investmentStats.js`) and the same unrealized-P&L calculation already in `InvestmentRow.jsx` (that formula moves to a shared export in `investmentStats.js` — `unrealizedPnlFor` — so it isn't duplicated) and `effectiveStrategyDef` for the strategy label fallback, matching what's already on screen.

## PDF report (`src/lib/pdfReport.js`)

`generatePdfReport(exportData, chartsElement)` — professional single-column
layout, one logical flow across as many pages as needed (`jspdf-autotable`
handles page breaks for tables automatically):

1. **Header** — "BT Speculation — Performance Report", account name, "Generated: <timestamp>", date range label. A thin rule under the header.
2. **Overview** — stat tiles rendered as a 2-column `autoTable` (label/value pairs): Total Realized P&L, Win Rate, Closed/Open Positions, Avg Win/Loss, Best/Worst Trade.
3. **Stocks** and **Options** — same label/value table treatment, one section each.
4. **Charts** — the four chart images (equity curve, P&L by strategy, win/loss, P&L by symbol), captured via `html2canvas(chartsElement)` and added with `pdf.addImage`, scaled to page width, one per section with its own heading. If `closedRows` is empty (nothing to chart), this section is skipped.
5. **By Strategy** and **By Symbol** — `autoTable` grids matching the on-screen tables (Strategy/Trades/Win Rate/Total P&L, Symbol/Trades/Total P&L).
6. **Closed Investments** — `autoTable` grid: Symbol, Type, Strategy, Avg Cost, Sell Price, Sell Date, Realized P&L (colored red/green text via autoTable's `didParseCell`).
7. **Open Positions** — `autoTable` grid: Symbol, Type, Strategy, Shares, Avg Cost, Current Price, Unrealized P&L (same coloring).
8. **Footer** — page numbers ("Page X of Y"), added in an `addPage` hook.

Color palette: reuse the app's `--green`/`--red` hex values (`#22c55e` /
`#ef4444`) for P&L coloring, `--text`/`--text-dim` grays for structure —
keeps the exported document visually consistent with the app rather than
inventing a new palette.

Filename: `bt-speculation-report-<YYYY-MM-DD>.pdf` (today's date).

## Excel export (`src/lib/excelExport.js`)

`generateExcelWorkbook(exportData)` — `xlsx` workbook with five sheets:

1. **Overview** — two columns (Metric, Value), one row per overview stat.
2. **Closed Investments** — header row + one row per closed investment (same columns as the PDF's Closed table).
3. **Open Investments** — header row + one row per open investment (same columns as the PDF's Open table).
4. **By Strategy** — header row + one row per `byStrategy` entry.
5. **By Symbol** — header row + one row per `bySymbol` entry.

Numeric columns (P&L, avg cost, etc.) are written as numbers (not
pre-formatted strings) so they stay usable for further calculation/pivoting
in Excel — display formatting (currency) is applied via a cell number
format (`'$#,##0.00'`) rather than baking `$`/commas into the string.

Filename: `bt-speculation-export-<YYYY-MM-DD>.xlsx`.

## Page wiring

`StatsPage.jsx` gains:
- `openInvestments` — derived the same way `closedInvestments` already is, from `filteredInvestments` (open positions aren't date-filtered, so this reads from `investments` directly, not `filteredInvestments`).
- Two toolbar buttons, "Export PDF" and "Export Excel", next to the existing date filter / view toggle. Both are disabled while `loading`.
- `handleExportPdf` — builds `exportData` via `buildExportData(...)`, calls `generatePdfReport(exportData, chartsRef.current)`, triggers download (`pdf.save(filename)`, jsPDF's built-in browser download).
- `handleExportExcel` — builds `exportData`, calls `generateExcelWorkbook(exportData)`, triggers download via `XLSX.writeFile(workbook, filename)`.

No new Supabase calls — everything needed is already loaded by
`useInvestmentsHistory`.

## Out of scope

- Scheduled/emailed reports — this is an on-demand, client-side download only.
- Custom report templates or column selection — fixed layout per this spec.
- Trades (day-trading journal) data — Investments only, matching the rest of the Stats page.
- Server-side PDF/Excel generation — everything runs in the browser.

## Testing

- `exportData.js`: unit tests for `buildExportData` — correct shaping of overview/stock/options figures, closed/open row mapping (including the strategy-label fallback and realized/unrealized P&L math), and the date-range label formatting (no range / start only / end only / both).
- `pdfReport.js` / `excelExport.js`: since these wrap third-party libraries producing binary output, tests mock `jspdf`/`jspdf-autotable`/`html2canvas`/`xlsx` and assert the *calls* made (correct sheet names, correct row data passed to `autoTable`/`aoa_to_sheet`, correct filename) rather than inspecting generated file bytes.
- `StatsPage.jsx`: tests that the Export PDF/Export Excel buttons call the respective generator with the currently-filtered data, and are disabled while loading. The mount-vs-CSS-visibility change for `StatsCharts` gets a test asserting it's present in the DOM (not just absent) even when `view === 'numbers'`.
- Manual smoke test: open `/stats` with real data, generate both files, confirm the PDF opens and looks correct, confirm the Excel file opens with all five sheets populated.
