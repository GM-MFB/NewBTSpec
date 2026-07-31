import { useState } from 'react'
import { formatCurrency } from '../../lib/format'
import {
  cashSecuredPut, coveredCall, creditSpread, debitSpread, calendarSpread, ironCondor,
} from '../../lib/strategyMath'
import PayoffChart from './PayoffChart'

function Field({ id, label, value, onChange, step = '0.01' }) {
  return (
    <label className="calc-field" htmlFor={id}>
      <span>{label}</span>
      <input id={id} type="number" step={step} value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  )
}

function Result({ label, value, tone, note }) {
  return (
    <div className="calc-result">
      <span className="calc-result-label">{label}</span>
      <span className={`calc-result-value mono ${tone ?? ''}`}>{value}</span>
      {note && <span className="calc-result-note">{note}</span>}
    </div>
  )
}

function money(value) {
  return value === null ? '—' : formatCurrency(value)
}

function percent(value) {
  return value === null ? '—' : `${(value * 100).toFixed(2)}%`
}

function toneFor(value) {
  if (value === null) return ''
  return value >= 0 ? 'price-favorable' : 'price-unfavorable'
}

function WheelCalculator() {
  const [put, setPut] = useState({ strike: '380', premium: '2', contracts: '1', days: '30' })
  const [call, setCall] = useState({ strike: '390', premium: '1.5', costBasis: '378', contracts: '1' })

  const p = cashSecuredPut({
    strike: put.strike, premium: put.premium, contracts: put.contracts, days: put.days,
  })
  const c = coveredCall({
    strike: call.strike, premium: call.premium, costBasis: call.costBasis, contracts: call.contracts,
  })

  return (
    <>
      <div className="calc-block">
        <h4 className="calc-block-title">Cash-Secured Put</h4>
        <div className="calc-fields">
          <Field id="cspStrike" label="Strike" value={put.strike} onChange={(v) => setPut({ ...put, strike: v })} />
          <Field id="cspPremium" label="Premium" value={put.premium} onChange={(v) => setPut({ ...put, premium: v })} />
          <Field id="cspContracts" label="Contracts" value={put.contracts} onChange={(v) => setPut({ ...put, contracts: v })} step="1" />
          <Field id="cspDays" label="Days held" value={put.days} onChange={(v) => setPut({ ...put, days: v })} step="1" />
        </div>
        <div className="calc-results">
          <Result label="Collateral" value={money(p.collateral)} />
          <Result label="Max profit" value={money(p.maxProfit)} tone="price-favorable" />
          <Result label="Breakeven" value={money(p.breakeven)} />
          <Result label="Return on capital" value={percent(p.returnOnCapital)} />
          <Result label="Annualized" value={percent(p.annualized)} tone={toneFor(p.annualized)} />
        </div>
        <PayoffChart kind="wheel-put" params={put} gradientId="csp" />
      </div>

      <div className="calc-block">
        <h4 className="calc-block-title">Covered Call</h4>
        <div className="calc-fields">
          <Field id="ccStrike" label="Call strike" value={call.strike} onChange={(v) => setCall({ ...call, strike: v })} />
          <Field id="ccPremium" label="Premium" value={call.premium} onChange={(v) => setCall({ ...call, premium: v })} />
          <Field id="ccBasis" label="Cost basis" value={call.costBasis} onChange={(v) => setCall({ ...call, costBasis: v })} />
          <Field id="ccContracts" label="Contracts" value={call.contracts} onChange={(v) => setCall({ ...call, contracts: v })} step="1" />
        </div>
        <div className="calc-results">
          <Result
            label="Profit if called"
            value={money(c.profitIfCalled)}
            tone={toneFor(c.profitIfCalled)}
            note={c.profitIfCalled !== null && c.profitIfCalled < 0 ? 'Below cost basis — being called away locks in this loss' : null}
          />
          <Result label="Breakeven" value={money(c.breakeven)} />
          <Result label="Return if called" value={percent(c.returnIfCalled)} tone={toneFor(c.returnIfCalled)} />
        </div>
        <PayoffChart kind="wheel-call" params={call} gradientId="cc" />
      </div>
    </>
  )
}

function CreditSpreadCalculator() {
  const [f, setF] = useState({ shortStrike: '36', longStrike: '35', credit: '0.40', contracts: '1', type: 'put' })
  const r = creditSpread(f)

  return (
    <div className="calc-block">
      <div className="calc-fields">
        <label className="calc-field" htmlFor="csType">
          <span>Type</span>
          <select id="csType" value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })}>
            <option value="put">Put spread</option>
            <option value="call">Call spread</option>
          </select>
        </label>
        <Field id="csShort" label="Short strike" value={f.shortStrike} onChange={(v) => setF({ ...f, shortStrike: v })} />
        <Field id="csLong" label="Long strike" value={f.longStrike} onChange={(v) => setF({ ...f, longStrike: v })} />
        <Field id="csCredit" label="Credit" value={f.credit} onChange={(v) => setF({ ...f, credit: v })} />
        <Field id="csContracts" label="Contracts" value={f.contracts} onChange={(v) => setF({ ...f, contracts: v })} step="1" />
      </div>
      <div className="calc-results">
        <Result label="Max profit" value={money(r.maxProfit)} tone="price-favorable" />
        <Result label="Max loss" value={money(r.maxLoss)} tone="price-unfavorable" />
        <Result label="Breakeven" value={money(r.breakeven)} />
        <Result label="Return on risk" value={percent(r.returnOnRisk)} />
      </div>
      <PayoffChart kind="credit-spread" params={f} gradientId="cs" />
    </div>
  )
}

function DebitSpreadCalculator() {
  const [f, setF] = useState({ longStrike: '100', shortStrike: '105', debit: '2', contracts: '1', type: 'call' })
  const r = debitSpread(f)

  return (
    <div className="calc-block">
      <div className="calc-fields">
        <label className="calc-field" htmlFor="dsType">
          <span>Type</span>
          <select id="dsType" value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })}>
            <option value="call">Call spread</option>
            <option value="put">Put spread</option>
          </select>
        </label>
        <Field id="dsLong" label="Long strike" value={f.longStrike} onChange={(v) => setF({ ...f, longStrike: v })} />
        <Field id="dsShort" label="Short strike" value={f.shortStrike} onChange={(v) => setF({ ...f, shortStrike: v })} />
        <Field id="dsDebit" label="Debit" value={f.debit} onChange={(v) => setF({ ...f, debit: v })} />
        <Field id="dsContracts" label="Contracts" value={f.contracts} onChange={(v) => setF({ ...f, contracts: v })} step="1" />
      </div>
      <div className="calc-results">
        <Result label="Max profit" value={money(r.maxProfit)} tone="price-favorable" />
        <Result label="Max loss" value={money(r.maxLoss)} tone="price-unfavorable" />
        <Result label="Breakeven" value={money(r.breakeven)} />
      </div>
      <PayoffChart kind="debit-spread" params={f} gradientId="ds" />
    </div>
  )
}

function CalendarCalculator() {
  const [f, setF] = useState({ debit: '1.50', contracts: '1' })
  const r = calendarSpread(f)

  return (
    <div className="calc-block">
      <div className="calc-fields">
        <Field id="calDebit" label="Net debit" value={f.debit} onChange={(v) => setF({ ...f, debit: v })} />
        <Field id="calContracts" label="Contracts" value={f.contracts} onChange={(v) => setF({ ...f, contracts: v })} step="1" />
      </div>
      <div className="calc-results">
        <Result label="Max loss" value={money(r.maxLoss)} tone="price-unfavorable" />
        <Result
          label="Max profit"
          value="Not calculable"
          note="Depends on implied volatility at the near expiry and where the underlying sits then. Any figure here would be a model output, not a fact."
        />
      </div>
    </div>
  )
}

function CondorCalculator() {
  const [f, setF] = useState({ shortPut: '95', longPut: '90', shortCall: '105', longCall: '110', credit: '1.20', contracts: '1' })
  const r = ironCondor(f)

  return (
    <div className="calc-block">
      <div className="calc-fields">
        <Field id="icShortPut" label="Short put" value={f.shortPut} onChange={(v) => setF({ ...f, shortPut: v })} />
        <Field id="icLongPut" label="Long put" value={f.longPut} onChange={(v) => setF({ ...f, longPut: v })} />
        <Field id="icShortCall" label="Short call" value={f.shortCall} onChange={(v) => setF({ ...f, shortCall: v })} />
        <Field id="icLongCall" label="Long call" value={f.longCall} onChange={(v) => setF({ ...f, longCall: v })} />
        <Field id="icCredit" label="Total credit" value={f.credit} onChange={(v) => setF({ ...f, credit: v })} />
        <Field id="icContracts" label="Contracts" value={f.contracts} onChange={(v) => setF({ ...f, contracts: v })} step="1" />
      </div>
      <div className="calc-results">
        <Result label="Max profit" value={money(r.maxProfit)} tone="price-favorable" />
        <Result label="Max loss" value={money(r.maxLoss)} tone="price-unfavorable" note="Wider wing only — one side can finish in the money" />
        <Result label="Lower breakeven" value={money(r.lowerBreakeven)} />
        <Result label="Upper breakeven" value={money(r.upperBreakeven)} />
        <Result label="Return on risk" value={percent(r.returnOnRisk)} />
      </div>
      <PayoffChart kind="iron-condor" params={f} gradientId="ic" />
    </div>
  )
}

const CALCULATORS = {
  wheel: WheelCalculator,
  'credit-spread': CreditSpreadCalculator,
  'debit-spread': DebitSpreadCalculator,
  'calendar-spread': CalendarCalculator,
  'iron-condor': CondorCalculator,
}

export default function StrategyCalculator({ kind }) {
  const Calculator = CALCULATORS[kind]
  if (!Calculator) return null

  return (
    <section className="strategy-section strategy-calculator" data-testid="strategy-calculator">
      <h3 className="strategy-section-title">Calculator</h3>
      <p className="calc-caveat">
        At-expiration math. This describes the shape of the trade, not what it is worth right now.
      </p>
      <Calculator />
    </section>
  )
}
