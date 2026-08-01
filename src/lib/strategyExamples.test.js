import { describe, it, expect } from 'vitest'
import { STRATEGY_EXAMPLES, exampleFor } from './strategyExamples'
import { STRATEGY_CONTENT } from './strategyContent'

describe('strategyExamples', () => {
  it('has an example for every strategy', () => {
    for (const strategy of STRATEGY_CONTENT) {
      expect(STRATEGY_EXAMPLES[strategy.id], `${strategy.name} has no worked example`).toBeDefined()
    }
  })

  it('has no examples for strategies that do not exist', () => {
    const ids = new Set(STRATEGY_CONTENT.map((s) => s.id))
    for (const id of Object.keys(STRATEGY_EXAMPLES)) {
      expect(ids.has(id), `${id} is an orphaned example`).toBe(true)
    }
  })

  it('gives every example a setup, outcomes and a lesson', () => {
    for (const [id, example] of Object.entries(STRATEGY_EXAMPLES)) {
      expect(example.setup, `${id} has no setup`).toBeTruthy()
      expect(example.outcomes.length, `${id} has too few outcomes`).toBeGreaterThanOrEqual(3)
      expect(example.lesson, `${id} has no lesson`).toBeTruthy()
    }
  })

  it('shows a losing outcome on every strategy, not just the good case', () => {
    for (const [id, example] of Object.entries(STRATEGY_EXAMPLES)) {
      const hasBad = example.outcomes.some((o) => o.tone === 'bad')
      expect(hasBad, `${id} only shows outcomes that go well`).toBe(true)
    }
  })

  it('returns null for an unknown id', () => {
    expect(exampleFor('nope')).toBeNull()
  })
})
