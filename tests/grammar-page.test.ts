import { describe, it, expect } from 'vitest'
import grammarData from '../content/grammar.json'
import type { Question } from '../scripts/build-content/types'

describe('grammar questions data integrity', () => {
  const questions = grammarData as unknown as Question[]

  it('contains questions with single and multiple blanks', () => {
    const singleBlank = questions.filter((q) => q.blanks.length === 1)
    const multiBlank = questions.filter((q) => q.blanks.length > 1)

    expect(singleBlank.length).toBeGreaterThan(0)
    expect(multiBlank.length).toBeGreaterThan(0)
  })

  it('ensures every blank has valid option keys A, B, C, D and valid answer key', () => {
    for (const q of questions) {
      for (const blank of q.blanks) {
        expect(['A', 'B', 'C', 'D']).toContain(blank.answer)
        expect(blank.options.map((o) => o.key)).toContain(blank.answer)
      }
    }
  })
})
