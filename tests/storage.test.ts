import { describe, it, expect, beforeEach } from 'vitest'
import {
  getDailyProgress,
  recordTaskCompletion,
  recordQuestionAnswer,
  getWrongQuestionsMap,
  updateVocabMastery,
  getVocabMasteryMap,
  getCategoryStats,
} from '../src/lib/storage'

const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString()
    },
    removeItem: (key: string) => {
      delete store[key]
    },
    clear: () => {
      store = {}
    },
  }
})()

Object.defineProperty(globalThis, 'localStorage', {
  value: localStorageMock,
})
Object.defineProperty(globalThis, 'window', {
  value: globalThis,
})

describe('storage controller', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('initializes today progress with 0 tasks done', () => {
    const progress = getDailyProgress()
    expect(progress.grammarCompleted).toBe(false)
    expect(progress.vocabCompleted).toBe(false)
    expect(progress.readingCompleted).toBe(false)
  })

  it('updates task completion state', () => {
    recordTaskCompletion('grammar')
    const progress = getDailyProgress()
    expect(progress.grammarCompleted).toBe(true)
  })

  it('records wrong answers and graduates after 2 consecutive correct answers', () => {
    // 1. Answer incorrectly -> added to wrong map
    recordQuestionAnswer('q1', 'grammar/01', false)
    expect(getWrongQuestionsMap()['q1']?.failCount).toBe(1)
    expect(getWrongQuestionsMap()['q1']?.consecutiveCorrect).toBe(0)

    // 2. Answer correctly once -> consecutiveCorrect = 1, still in wrong map
    recordQuestionAnswer('q1', 'grammar/01', true)
    expect(getWrongQuestionsMap()['q1']?.consecutiveCorrect).toBe(1)

    // 3. Answer correctly second time -> consecutiveCorrect = 2, graduated & removed!
    recordQuestionAnswer('q1', 'grammar/01', true)
    expect(getWrongQuestionsMap()['q1']).toBeUndefined()
  })

  it('updates vocab mastery levels and marks vocab completed', () => {
    updateVocabMastery('v-information', 3)
    expect(getVocabMasteryMap()['v-information']?.level).toBe(3)
    expect(getDailyProgress().vocabCompleted).toBe(true)
  })

  it('calculates category accuracy stats correctly', () => {
    recordQuestionAnswer('q1', '01_語態與時態', true)
    recordQuestionAnswer('q2', '01_語態與時態', false)

    const stats = getCategoryStats()
    expect(stats[0]?.categoryId).toBe('01_語態與時態')
    expect(stats[0]?.totalAnswered).toBe(2)
    expect(stats[0]?.accuracyRate).toBe(50)
  })

  it('preserves today completion state when syncUserDataFromD1 runs', async () => {
    const { syncUserDataFromD1 } = await import('../src/lib/storage')
    recordTaskCompletion('grammar')
    expect(getDailyProgress().grammarCompleted).toBe(true)

    // Mock fetch for /api/user/data returning D1 stats
    globalThis.fetch = (async (url: string) => {
      if (url === '/api/user/data') {
        return {
          ok: true,
          json: async () => ({
            stats: { streak_days: 3, last_practice_date: new Date().toISOString().split('T')[0] },
            answerHistory: [],
            vocabMastery: [],
            wrongQuestions: [],
          }),
        } as any
      }
      return { ok: false } as any
    }) as any

    await syncUserDataFromD1()
    expect(getDailyProgress().grammarCompleted).toBe(true)
  })

  it('infers completion state from today answer history', () => {
    recordQuestionAnswer('q1', 'grammar/01', true, { source: 'grammar' })
    const progress = getDailyProgress()
    expect(progress.grammarCompleted).toBe(true)
  })

  it('clears a today progress flag that the old buggy inference had already persisted', () => {
    const today = new Date()
    const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
    // 舊版存下來的今日進度（沒有 v），vocabCompleted 是登入時誤推斷出來的。
    localStorage.setItem(
      'toeic_daily_progress',
      JSON.stringify({
        date: dateStr,
        streak: 5,
        grammarCompleted: false,
        vocabCompleted: true,
        readingCompleted: false,
      })
    )

    const progress = getDailyProgress()
    expect(progress.vocabCompleted).toBe(false)
    expect(progress.streak).toBe(5)
    // 洗過一次就要留下版本標記，之後不再重算。
    recordTaskCompletion('vocab')
    expect(getDailyProgress().vocabCompleted).toBe(true)
  })

  it('does not mark 單字複習 done just because the mastery map says it was reviewed today', () => {
    // 同步下來的 lastReviewed 不是「今天練過」的證據——只有作答歷程才算。
    localStorage.setItem(
      'toeic_vocab_mastery',
      JSON.stringify({ 'v-old': { level: 3, lastReviewed: Date.now() } })
    )
    expect(getDailyProgress().vocabCompleted).toBe(false)
  })

  it('keeps the real review time when syncing vocab mastery from D1', async () => {
    const { syncUserDataFromD1 } = await import('../src/lib/storage')
    const threeDaysAgo = new Date(Date.now() - 3 * 86400000)
    // D1 的 CURRENT_TIMESTAMP：UTC、沒有時區標記的 `YYYY-MM-DD HH:MM:SS`
    const updatedAt = threeDaysAgo.toISOString().replace('T', ' ').slice(0, 19)

    globalThis.fetch = (async (url: string) => {
      if (url === '/api/user/data') {
        return {
          ok: true,
          json: async () => ({
            stats: { streak_days: 3 },
            answerHistory: [],
            vocabMastery: [{ vocab_id: 'v-old', mastery_level: 3, updated_at: updatedAt }],
            wrongQuestions: [],
          }),
        } as any
      }
      return { ok: false } as any
    }) as any

    await syncUserDataFromD1()

    const synced = getVocabMasteryMap()['v-old']!
    expect(Math.abs(synced.lastReviewed - threeDaysAgo.getTime())).toBeLessThan(1000)
    // 一登入就把今天的單字任務標成完成，正是這次要修的 bug。
    expect(getDailyProgress().vocabCompleted).toBe(false)
  })
})
