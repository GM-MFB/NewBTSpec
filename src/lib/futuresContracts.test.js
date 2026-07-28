import { describe, it, expect } from 'vitest'
import { lookupTickValue } from './futuresContracts'

describe('lookupTickValue', () => {
  it('returns the tick value for a known contract', () => {
    expect(lookupTickValue('ES')).toBe(12.5)
    expect(lookupTickValue('MES')).toBe(1.25)
    expect(lookupTickValue('CL')).toBe(10)
  })

  it('is case-insensitive', () => {
    expect(lookupTickValue('es')).toBe(12.5)
  })

  it('returns undefined for an unknown symbol', () => {
    expect(lookupTickValue('ZZZZ')).toBeUndefined()
  })

  it('returns undefined for blank input', () => {
    expect(lookupTickValue('')).toBeUndefined()
    expect(lookupTickValue(undefined)).toBeUndefined()
  })
})
