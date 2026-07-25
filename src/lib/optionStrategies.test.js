import { describe, it, expect } from 'vitest'
import { STRATEGIES, strategyByValue } from './optionStrategies'

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
