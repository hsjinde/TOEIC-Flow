import { describe, it, expect } from 'vitest'
import { estimateToeicScore } from '../src/lib/toeicScore'

describe('TOEIC Score Estimation Algorithm', () => {
  it('returns null displayScore when no questions answered', () => {
    const result = estimateToeicScore({ totalAnswered: 0, overallAccuracy: 0 })
    expect(result.score).toBeNull()
    expect(result.displayScore).toBe('--')
    expect(result.levelName).toBe('尚待測試')
  })

  it('returns 10 points when all answers are wrong (0% accuracy)', () => {
    const result = estimateToeicScore({ totalAnswered: 10, overallAccuracy: 0 })
    expect(result.score).toBe(10)
    expect(result.displayScore).toBe('10')
    expect(result.levelName).toContain('橘色證書')
  })

  it('returns 490 points for 50% accuracy (Green certificate)', () => {
    const result = estimateToeicScore({ totalAnswered: 20, overallAccuracy: 50 })
    expect(result.score).toBe(490)
    expect(result.levelName).toContain('綠色證書')
  })

  it('returns 840 points for 85% accuracy (Blue certificate)', () => {
    const result = estimateToeicScore({ totalAnswered: 40, overallAccuracy: 85 })
    expect(result.score).toBe(840)
    expect(result.levelName).toContain('藍色證書')
  })

  it('returns 990 points for 100% accuracy (Golden certificate)', () => {
    const result = estimateToeicScore({ totalAnswered: 50, overallAccuracy: 100, vocabMasteryRate: 100 })
    expect(result.score).toBe(990)
    expect(result.levelName).toContain('金色證書')
  })
})
