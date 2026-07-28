import { describe, it, expect } from 'vitest'
import { lookupPointValue } from './futuresContracts'

describe('lookupPointValue', () => {
  it('returns the point value for a known contract', () => {
    expect(lookupPointValue('ES')).toBe(50)
    expect(lookupPointValue('MES')).toBe(5)
    expect(lookupPointValue('CL')).toBe(1000)
  })

  it('is case-insensitive', () => {
    expect(lookupPointValue('es')).toBe(50)
  })

  it('returns undefined for an unknown symbol', () => {
    expect(lookupPointValue('ZZZZ')).toBeUndefined()
  })

  it('returns undefined for blank input', () => {
    expect(lookupPointValue('')).toBeUndefined()
    expect(lookupPointValue(undefined)).toBeUndefined()
  })
})
