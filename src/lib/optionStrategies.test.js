import { describe, it, expect } from 'vitest'
import { STRATEGIES, strategyByValue, effectiveStrategyDef } from './optionStrategies'

describe('STRATEGIES', () => {
  it('defines exactly the 6 supported strategies', () => {
    expect(STRATEGIES.map((s) => s.value)).toEqual([
      'call', 'put', 'cash_secured_put', 'covered_call',
      'put_credit_spread', 'call_credit_spread',
    ])
  })

  it('marks only the two credit spreads as spreads', () => {
    const spreads = STRATEGIES.filter((s) => s.isSpread).map((s) => s.value)
    expect(spreads).toEqual(['put_credit_spread', 'call_credit_spread'])
  })
})

describe('strategyByValue', () => {
  it('returns the matching strategy definition', () => {
    expect(strategyByValue('covered_call')).toEqual({
      value: 'covered_call', label: 'Covered Call',
      optionType: 'call', optionDirection: 'short', isSpread: false,
    })
  })

  it('returns undefined for an unknown value', () => {
    expect(strategyByValue('nonsense')).toBeUndefined()
  })
})

describe('effectiveStrategyDef', () => {
  it('returns the matching strategy definition when strategy is set', () => {
    const investment = { strategy: 'covered_call' }
    expect(effectiveStrategyDef(investment)).toEqual(strategyByValue('covered_call'))
  })

  it('falls back to a synthetic def from option_type/option_direction when strategy is blank', () => {
    const investment = { strategy: '', optionType: 'put', optionDirection: 'short' }
    expect(effectiveStrategyDef(investment)).toEqual({
      value: null, label: 'Short Put', optionType: 'put', optionDirection: 'short', isSpread: false,
    })
  })

  it('returns null when strategy and option_type/option_direction are all blank', () => {
    const investment = { strategy: '', optionType: '', optionDirection: '' }
    expect(effectiveStrategyDef(investment)).toBeNull()
  })
})
