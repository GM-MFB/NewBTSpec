import { useState } from 'react'
import { formatCurrency } from '../../lib/format'
import {
  cashSecuredPut, coveredCall, creditSpread, debitSpread, calendarSpread, ironCondor,
  longOption, poorMansCoveredCall, protectivePut, collar, strangle, ironButterfly,
  jadeLizard, coveredStrangle, brokenWingButterfly, tailHedge, bufferStructure, riskReversal, ratioSpread,
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

function LongOptionCalculator() {
  const [f, setF] = useState({ strike: '100', premium: '3', contracts: '1', type: 'call' })
  const r = longOption(f)

  return (
    <div className="calc-block">
      <div className="calc-fields">
        <label className="calc-field" htmlFor="loType">
          <span>Type</span>
          <select id="loType" value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })}>
            <option value="call">Long call</option>
            <option value="put">Long put</option>
          </select>
        </label>
        <Field id="loStrike" label="Strike" value={f.strike} onChange={(v) => setF({ ...f, strike: v })} />
        <Field id="loPremium" label="Premium" value={f.premium} onChange={(v) => setF({ ...f, premium: v })} />
        <Field id="loContracts" label="Contracts" value={f.contracts} onChange={(v) => setF({ ...f, contracts: v })} step="1" />
      </div>
      <div className="calc-results">
        <Result
          label="Max profit"
          value={f.type === 'call' ? 'Unbounded' : money(r.maxProfit)}
          tone="price-favorable"
          note={f.type === 'call' ? 'A call has no ceiling — there is no number to give' : 'If the underlying goes to zero'}
        />
        <Result label="Max loss" value={money(r.maxLoss)} tone="price-unfavorable" />
        <Result label="Breakeven" value={money(r.breakeven)} />
      </div>
      <PayoffChart kind="long-option" params={f} gradientId="lo" />
    </div>
  )
}

function PmccCalculator() {
  const [f, setF] = useState({ longStrike: '80', longDebit: '25', shortStrike: '110', shortCredit: '2', contracts: '1' })
  const r = poorMansCoveredCall(f)

  return (
    <div className="calc-block">
      <div className="calc-fields">
        <Field id="pmLongStrike" label="Long strike" value={f.longStrike} onChange={(v) => setF({ ...f, longStrike: v })} />
        <Field id="pmLongDebit" label="Long cost" value={f.longDebit} onChange={(v) => setF({ ...f, longDebit: v })} />
        <Field id="pmShortStrike" label="Short strike" value={f.shortStrike} onChange={(v) => setF({ ...f, shortStrike: v })} />
        <Field id="pmShortCredit" label="Short credit" value={f.shortCredit} onChange={(v) => setF({ ...f, shortCredit: v })} />
        <Field id="pmContracts" label="Contracts" value={f.contracts} onChange={(v) => setF({ ...f, contracts: v })} step="1" />
      </div>
      <div className="calc-results">
        <Result label="Net debit" value={money(r.netDebit)} />
        <Result label="Max loss" value={money(r.maxLoss)} tone="price-unfavorable" />
        <Result
          label="Profit ceiling"
          value={money(r.profitCeiling)}
          tone="price-favorable"
          note="Assumes both legs run to the long expiry. Before then the long call still holds time value."
        />
        <Result label="Breakeven" value={money(r.breakeven)} />
      </div>
      <PayoffChart kind="pmcc" params={f} gradientId="pm" />
    </div>
  )
}

function ProtectiveCalculator() {
  const [f, setF] = useState({ costBasis: '100', putStrike: '95', putPremium: '2', callStrike: '110', callCredit: '1.5', contracts: '1' })
  const p = protectivePut(f)
  const c = collar(f)

  return (
    <>
      <div className="calc-block">
        <h4 className="calc-block-title">Protective Put</h4>
        <div className="calc-fields">
          <Field id="ppBasis" label="Cost basis" value={f.costBasis} onChange={(v) => setF({ ...f, costBasis: v })} />
          <Field id="ppStrike" label="Put strike" value={f.putStrike} onChange={(v) => setF({ ...f, putStrike: v })} />
          <Field id="ppPremium" label="Put premium" value={f.putPremium} onChange={(v) => setF({ ...f, putPremium: v })} />
          <Field id="ppContracts" label="Contracts" value={f.contracts} onChange={(v) => setF({ ...f, contracts: v })} step="1" />
        </div>
        <div className="calc-results">
          <Result label="Max loss" value={money(p.maxLoss)} tone="price-unfavorable" note="The floor, whatever the stock does" />
          <Result label="Insurance cost" value={money(p.insuranceCost)} />
          <Result label="Breakeven" value={money(p.breakeven)} />
          <Result label="Max profit" value="Unbounded" tone="price-favorable" note="The put does not cap the upside" />
        </div>
        <PayoffChart kind="protective-put" params={f} gradientId="pp" />
      </div>

      <div className="calc-block">
        <h4 className="calc-block-title">Collar — the same put, paid for by a call</h4>
        <div className="calc-fields">
          <Field id="coCallStrike" label="Call strike" value={f.callStrike} onChange={(v) => setF({ ...f, callStrike: v })} />
          <Field id="coCallCredit" label="Call credit" value={f.callCredit} onChange={(v) => setF({ ...f, callCredit: v })} />
        </div>
        <div className="calc-results">
          <Result
            label="Net cost"
            value={money(c.netCost)}
            tone={c.netCost !== null && c.netCost <= 0 ? 'price-favorable' : ''}
            note={c.netCost !== null && c.netCost <= 0 ? 'A credit collar — the call more than pays for the put' : null}
          />
          <Result label="Max loss" value={money(c.maxLoss)} tone="price-unfavorable" />
          <Result label="Max profit" value={money(c.maxProfit)} tone="price-favorable" note="Capped at the call strike" />
          <Result label="Breakeven" value={money(c.breakeven)} />
        </div>
        <PayoffChart kind="collar" params={f} gradientId="co" />
      </div>
    </>
  )
}

function StrangleCalculator() {
  const [f, setF] = useState({ putStrike: '95', callStrike: '105', premium: '3', contracts: '1', direction: 'short' })
  const r = strangle(f)
  const isShort = f.direction === 'short'

  return (
    <div className="calc-block">
      <div className="calc-fields">
        <label className="calc-field" htmlFor="stDirection">
          <span>Direction</span>
          <select id="stDirection" value={f.direction} onChange={(e) => setF({ ...f, direction: e.target.value })}>
            <option value="short">Short (sell both)</option>
            <option value="long">Long (buy both)</option>
          </select>
        </label>
        <Field id="stPut" label="Put strike" value={f.putStrike} onChange={(v) => setF({ ...f, putStrike: v })} />
        <Field id="stCall" label="Call strike" value={f.callStrike} onChange={(v) => setF({ ...f, callStrike: v })} />
        <Field id="stPremium" label="Total premium" value={f.premium} onChange={(v) => setF({ ...f, premium: v })} />
        <Field id="stContracts" label="Contracts" value={f.contracts} onChange={(v) => setF({ ...f, contracts: v })} step="1" />
      </div>
      <div className="calc-results">
        <Result
          label="Max profit"
          value={isShort ? money(r.maxProfit) : 'Unbounded'}
          tone="price-favorable"
          note={isShort ? 'Only between the two strikes' : 'The call side has no ceiling'}
        />
        <Result
          label="Max loss"
          value={isShort ? 'Unbounded' : money(r.maxLoss)}
          tone="price-unfavorable"
          note={isShort ? 'A short call has no ceiling. There is no number to give, and that is the point.' : null}
        />
        <Result label="Lower breakeven" value={money(r.lowerBreakeven)} />
        <Result label="Upper breakeven" value={money(r.upperBreakeven)} />
      </div>
      <PayoffChart kind="strangle" params={f} gradientId="st" />
    </div>
  )
}

function ButterflyCalculator() {
  const [f, setF] = useState({ centerStrike: '100', wingWidth: '10', credit: '4', contracts: '1' })
  const r = ironButterfly(f)

  return (
    <div className="calc-block">
      <div className="calc-fields">
        <Field id="ibCenter" label="Centre strike" value={f.centerStrike} onChange={(v) => setF({ ...f, centerStrike: v })} />
        <Field id="ibWing" label="Wing width" value={f.wingWidth} onChange={(v) => setF({ ...f, wingWidth: v })} />
        <Field id="ibCredit" label="Credit" value={f.credit} onChange={(v) => setF({ ...f, credit: v })} />
        <Field id="ibContracts" label="Contracts" value={f.contracts} onChange={(v) => setF({ ...f, contracts: v })} step="1" />
      </div>
      <div className="calc-results">
        <Result label="Max profit" value={money(r.maxProfit)} tone="price-favorable" note="Only at the centre strike exactly" />
        <Result label="Max loss" value={money(r.maxLoss)} tone="price-unfavorable" />
        <Result label="Lower breakeven" value={money(r.lowerBreakeven)} />
        <Result label="Upper breakeven" value={money(r.upperBreakeven)} />
        <Result label="Return on risk" value={percent(r.returnOnRisk)} />
      </div>
      <PayoffChart kind="iron-butterfly" params={f} gradientId="ib" />
    </div>
  )
}

function JadeLizardCalculator() {
  const [f, setF] = useState({ putStrike: '95', shortCall: '105', longCall: '110', credit: '5', contracts: '1' })
  const r = jadeLizard(f)

  return (
    <div className="calc-block">
      <div className="calc-fields">
        <Field id="jlPut" label="Short put" value={f.putStrike} onChange={(v) => setF({ ...f, putStrike: v })} />
        <Field id="jlShortCall" label="Short call" value={f.shortCall} onChange={(v) => setF({ ...f, shortCall: v })} />
        <Field id="jlLongCall" label="Long call" value={f.longCall} onChange={(v) => setF({ ...f, longCall: v })} />
        <Field id="jlCredit" label="Total credit" value={f.credit} onChange={(v) => setF({ ...f, credit: v })} />
        <Field id="jlContracts" label="Contracts" value={f.contracts} onChange={(v) => setF({ ...f, contracts: v })} step="1" />
      </div>
      <div className="calc-results">
        <Result label="Max profit" value={money(r.maxProfit)} tone="price-favorable" />
        <Result
          label="Upside risk"
          value={r.upsideCovered ? 'None' : money(r.upsideRisk)}
          tone={r.upsideCovered ? 'price-favorable' : 'price-unfavorable'}
          note={r.upsideCovered
            ? 'Credit covers the call spread width — no price above the calls can hurt you'
            : 'Credit is below the call spread width, so the upside is exposed'}
        />
        <Result label="Downside breakeven" value={money(r.downsideBreakeven)} />
        <Result label="Max downside loss" value={money(r.maxDownsideLoss)} tone="price-unfavorable" note="Stock to zero, as with any short put" />
      </div>
      <PayoffChart kind="jade-lizard" params={f} gradientId="jl" />
    </div>
  )
}

function CoveredStrangleCalculator() {
  const [f, setF] = useState({ costBasis: '100', putStrike: '95', callStrike: '110', credit: '4', contracts: '1' })
  const r = coveredStrangle(f)

  return (
    <div className="calc-block">
      <div className="calc-fields">
        <Field id="cgBasis" label="Cost basis" value={f.costBasis} onChange={(v) => setF({ ...f, costBasis: v })} />
        <Field id="cgPut" label="Short put" value={f.putStrike} onChange={(v) => setF({ ...f, putStrike: v })} />
        <Field id="cgCall" label="Short call" value={f.callStrike} onChange={(v) => setF({ ...f, callStrike: v })} />
        <Field id="cgCredit" label="Total credit" value={f.credit} onChange={(v) => setF({ ...f, credit: v })} />
        <Field id="cgContracts" label="Contracts" value={f.contracts} onChange={(v) => setF({ ...f, contracts: v })} step="1" />
      </div>
      <div className="calc-results">
        <Result label="Max profit" value={money(r.maxProfit)} tone="price-favorable" note="Called away, both premiums kept" />
        <Result label="Breakeven" value={money(r.breakeven)} />
        <Result label="Shares if assigned" value={r.sharesIfAssigned ?? '—'} tone="price-unfavorable" note="The put doubles the position" />
        <Result label="Blended basis" value={money(r.blendedBasis)} note="Sell calls above this, not the original basis" />
        <Result label="Put collateral" value={money(r.capitalRequired)} />
      </div>
      <PayoffChart kind="covered-strangle" params={f} gradientId="cg" />
    </div>
  )
}

function BrokenWingCalculator() {
  const [f, setF] = useState({ shortStrike: '100', narrowWing: '5', wideWing: '10', credit: '1', contracts: '1' })
  const r = brokenWingButterfly(f)

  return (
    <div className="calc-block">
      <div className="calc-fields">
        <Field id="bwShort" label="Body strike" value={f.shortStrike} onChange={(v) => setF({ ...f, shortStrike: v })} />
        <Field id="bwNarrow" label="Narrow wing" value={f.narrowWing} onChange={(v) => setF({ ...f, narrowWing: v })} />
        <Field id="bwWide" label="Wide wing" value={f.wideWing} onChange={(v) => setF({ ...f, wideWing: v })} />
        <Field id="bwCredit" label="Credit" value={f.credit} onChange={(v) => setF({ ...f, credit: v })} />
        <Field id="bwContracts" label="Contracts" value={f.contracts} onChange={(v) => setF({ ...f, contracts: v })} step="1" />
      </div>
      <div className="calc-results">
        <Result label="Max profit" value={money(r.maxProfit)} tone="price-favorable" note="At the body strike only" />
        <Result label="Max loss" value={money(r.maxLoss)} tone="price-unfavorable" note="Wide side only" />
        <Result
          label="Narrow side"
          value={r.riskFreeSide ? 'Risk free' : 'At risk'}
          tone={r.riskFreeSide ? 'price-favorable' : 'price-unfavorable'}
          note={r.riskFreeSide ? 'Opened for a credit, so this side cannot lose' : 'Opened for a debit — the credit advantage is gone'}
        />
        <Result label="Breakeven" value={money(r.breakeven)} />
      </div>
      <PayoffChart kind="broken-wing" params={f} gradientId="bw" />
    </div>
  )
}

function TailHedgeCalculator() {
  const [f, setF] = useState({ portfolioValue: '100000', spotPrice: '500', strikePct: '20', premium: '1.50', contracts: '2', rollsPerYear: '4' })
  const r = tailHedge(f)

  return (
    <div className="calc-block">
      <div className="calc-fields">
        <Field id="thPv" label="Portfolio value" value={f.portfolioValue} onChange={(v) => setF({ ...f, portfolioValue: v })} step="1000" />
        <Field id="thSpot" label="Index price" value={f.spotPrice} onChange={(v) => setF({ ...f, spotPrice: v })} />
        <Field id="thPct" label="% out of the money" value={f.strikePct} onChange={(v) => setF({ ...f, strikePct: v })} step="1" />
        <Field id="thPremium" label="Put premium" value={f.premium} onChange={(v) => setF({ ...f, premium: v })} />
        <Field id="thContracts" label="Contracts" value={f.contracts} onChange={(v) => setF({ ...f, contracts: v })} step="1" />
        <Field id="thRolls" label="Rolls per year" value={f.rollsPerYear} onChange={(v) => setF({ ...f, rollsPerYear: v })} step="1" />
      </div>
      <div className="calc-results">
        <Result label="Put strike" value={money(r.strike)} />
        <Result label="Annual cost" value={money(r.annualCost)} tone="price-unfavorable" note="The bleed — paid whether or not it is needed" />
        <Result label="Cost of portfolio" value={percent(r.costAsPct)} />
      </div>
      {r.payoffs && (
        <div className="tail-table-wrap">
          <table className="tail-table">
            <thead>
              <tr><th>Drawdown</th><th>Portfolio loses</th><th>Hedge pays</th><th>Net loss</th><th>Covered</th></tr>
            </thead>
            <tbody>
              {r.payoffs.map((row) => (
                <tr key={row.drop}>
                  <th scope="row">−{row.drop}%</th>
                  <td className="mono price-unfavorable">{money(row.portfolioLoss)}</td>
                  <td className="mono price-favorable">{money(row.hedgePayoff)}</td>
                  <td className="mono">{money(row.netLoss)}</td>
                  <td className="mono">{percent(row.coverage)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function RiskReversalCalculator() {
  const [f, setF] = useState({ putStrike: '95', callStrike: '110', netCredit: '0.50', contracts: '1' })
  const r = riskReversal(f)

  return (
    <div className="calc-block">
      <div className="calc-fields">
        <Field id="rrPut" label="Short put" value={f.putStrike} onChange={(v) => setF({ ...f, putStrike: v })} />
        <Field id="rrCall" label="Long call" value={f.callStrike} onChange={(v) => setF({ ...f, callStrike: v })} />
        <Field id="rrCredit" label="Net credit" value={f.netCredit} onChange={(v) => setF({ ...f, netCredit: v })} />
        <Field id="rrContracts" label="Contracts" value={f.contracts} onChange={(v) => setF({ ...f, contracts: v })} step="1" />
      </div>
      <div className="calc-results">
        <Result label="Max profit" value="Unbounded" tone="price-favorable" note="Above the call strike it tracks the shares" />
        <Result label="Max loss" value={money(r.maxLoss)} tone="price-unfavorable" note="Stock to zero, as with any short put" />
        <Result label="Lower breakeven" value={money(r.lowerBreakeven)} />
        <Result label="Credit kept" value={money(r.creditKept)} note="Whenever price finishes between the strikes" />
      </div>
      <PayoffChart kind="risk-reversal" params={f} gradientId="rr" />
    </div>
  )
}

function BufferCalculator() {
  const [f, setF] = useState({ portfolioValue: '100000', bufferPct: '15', capPct: '12' })
  const r = bufferStructure(f)

  return (
    <div className="calc-block">
      <div className="calc-fields">
        <Field id="bfPv" label="Position value" value={f.portfolioValue} onChange={(v) => setF({ ...f, portfolioValue: v })} step="1000" />
        <Field id="bfBuffer" label="Buffer %" value={f.bufferPct} onChange={(v) => setF({ ...f, bufferPct: v })} step="1" />
        <Field id="bfCap" label="Cap %" value={f.capPct} onChange={(v) => setF({ ...f, capPct: v })} step="1" />
      </div>
      {r.outcomes && (
        <div className="tail-table-wrap">
          <table className="tail-table">
            <thead>
              <tr><th>Underlying</th><th>You get</th><th>Value at end</th></tr>
            </thead>
            <tbody>
              {r.outcomes.map((row) => (
                <tr key={row.move}>
                  <th scope="row">{row.move > 0 ? '+' : ''}{row.move}%</th>
                  <td className={`mono ${row.result > 0 ? 'price-favorable' : row.result < 0 ? 'price-unfavorable' : ''}`}>
                    {row.result > 0 ? '+' : ''}{row.result.toFixed(1)}%
                  </td>
                  <td className="mono">{money(row.value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="calc-caveat">
        The buffer and the cap only apply at the end of the outcome period. Mid-period
        the legs price independently and the value will not track this table.
      </p>
    </div>
  )
}

function RatioSpreadCalculator() {
  const [f, setF] = useState({ nearStrike: '100', farStrike: '110', credit: '1', contracts: '1', type: 'call', structure: 'front' })
  const r = ratioSpread(f)
  const isFront = f.structure === 'front'

  return (
    <div className="calc-block">
      <div className="calc-fields">
        <label className="calc-field" htmlFor="rsStructure">
          <span>Structure</span>
          <select id="rsStructure" value={f.structure} onChange={(e) => setF({ ...f, structure: e.target.value })}>
            <option value="front">Front ratio (long 1, short 2)</option>
            <option value="back">Backspread (short 1, long 2)</option>
          </select>
        </label>
        <label className="calc-field" htmlFor="rsType">
          <span>Type</span>
          <select
            id="rsType"
            value={f.type}
            onChange={(e) => {
              const type = e.target.value
              // Calls ratio up, puts ratio down — mirror the far strike so the
              // structure stays valid when the type is switched.
              const near = Number(f.nearStrike) || 0
              const width = Math.abs((Number(f.farStrike) || 0) - near)
              const farStrike = String(type === 'put' ? near - width : near + width)
              setF({ ...f, type, farStrike })
            }}
          >
            <option value="call">Calls</option>
            <option value="put">Puts</option>
          </select>
        </label>
        <Field id="rsNear" label="Near strike (1x)" value={f.nearStrike} onChange={(v) => setF({ ...f, nearStrike: v })} />
        <Field id="rsFar" label="Far strike (2x)" value={f.farStrike} onChange={(v) => setF({ ...f, farStrike: v })} />
        <Field id="rsCredit" label="Net credit" value={f.credit} onChange={(v) => setF({ ...f, credit: v })} />
        <Field id="rsContracts" label="Sets" value={f.contracts} onChange={(v) => setF({ ...f, contracts: v })} step="1" />
      </div>
      <div className="calc-results">
        <Result
          label="Max profit"
          value={isFront ? money(r.maxProfit) : 'Unbounded'}
          tone="price-favorable"
          note={isFront ? 'At the far strike exactly' : 'Past the far strike it runs with the underlying'}
        />
        <Result
          label="Max loss"
          value={isFront ? 'Unbounded' : money(r.maxLoss)}
          tone="price-unfavorable"
          note={isFront
            ? 'One leg is naked. Past the far strike the loss does not stop.'
            : 'At the far strike, which is also where price often pins'}
        />
        <Result label="Peak / trough at" value={money(r.peakStrike)} />
        <Result label="Tail breakeven" value={money(r.tailBreakeven)} />
      </div>
      <PayoffChart kind="ratio-spread" params={f} gradientId="rs" />
    </div>
  )
}

const CALCULATORS = {
  wheel: WheelCalculator,
  'credit-spread': CreditSpreadCalculator,
  'debit-spread': DebitSpreadCalculator,
  'calendar-spread': CalendarCalculator,
  'iron-condor': CondorCalculator,
  'long-option': LongOptionCalculator,
  pmcc: PmccCalculator,
  'protective-put': ProtectiveCalculator,
  strangle: StrangleCalculator,
  'iron-butterfly': ButterflyCalculator,
  'jade-lizard': JadeLizardCalculator,
  'covered-strangle': CoveredStrangleCalculator,
  'broken-wing': BrokenWingCalculator,
  'tail-hedge': TailHedgeCalculator,
  'risk-reversal': RiskReversalCalculator,
  buffer: BufferCalculator,
  'ratio-spread': RatioSpreadCalculator,
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
