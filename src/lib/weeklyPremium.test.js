import { describe, it, expect } from 'vitest'
import { premiumForWeek } from './weeklyPremium'

describe('premiumForWeek', () => {
  it('sums outstanding premium for short options expiring within the week', () => {
    const investments = [
      { assetType: 'Option', strategy: 'cash_secured_put', shares: 2, strike: 380, avgCost: 1.5, expiry: '2026-01-28' },
      { assetType: 'Option', strategy: 'put_credit_spread', shares: 1, strike: 36, strike2: 35, avgCost: 1.2, expiry: '2026-01-30' },
    ]
    expect(premiumForWeek(investments, '2026-W05')).toBe(420)
  })

  it('excludes options expiring outside the week', () => {
    const investments = [
      { assetType: 'Option', strategy: 'cash_secured_put', shares: 2, strike: 380, avgCost: 1.5, expiry: '2026-02-10' },
    ]
    expect(premiumForWeek(investments, '2026-W05')).toBe(0)
  })

  it('excludes long calls/puts (no premium collected)', () => {
    const investments = [
      { assetType: 'Option', strategy: 'call', shares: 1, strike: 300, avgCost: 5, expiry: '2026-01-28' },
    ]
    expect(premiumForWeek(investments, '2026-W05')).toBe(0)
  })

  it('excludes stock investments', () => {
    const investments = [
      { assetType: 'Stock', shares: 10, avgCost: 150, expiry: '' },
    ]
    expect(premiumForWeek(investments, '2026-W05')).toBe(0)
  })
})
