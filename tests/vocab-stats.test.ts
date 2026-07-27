import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  LEECH_WRONG_THRESHOLD,
  bumpVocabMastery,
  getSrsIntervalMs,
  getVocabStats,
  getWeakVocabIds,
  updateVocabMastery,
  type AnswerHistoryEntry,
} from '../src/lib/storage'

const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => {
      store[key] = String(value)
    },
    removeItem: (key: string) => {
      delete store[key]
    },
    clear: () => {
      store = {}
    },
  }
})()

Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock })
Object.defineProperty(globalThis, 'window', { value: globalThis })
vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve({}) })))

const DAY = 86_400_000

function seedVocabHistory(
  entries: { vocabId: string; isCorrect: boolean; daysAgo?: number; at?: number }[]
) {
  const history: AnswerHistoryEntry[] = entries.map((e) => ({
    questionId: e.vocabId,
    categoryId: 'vocab',
    isCorrect: e.isCorrect,
    timestamp: e.at ?? Date.now() - (e.daysAgo ?? 0) * DAY,
    source: 'vocab' as const,
  }))
  localStorage.setItem('toeic_answer_history', JSON.stringify(history))
}

/** 同日去重是照當地日期分組，所以要測它就得把時鐘釘在當天中午，否則半夜跑測試會跨日。 */
function todayAt(hour: number): number {
  const d = new Date()
  d.setHours(hour, 0, 0, 0)
  return d.getTime()
}

function seedMastery(map: Record<string, { level: number; lastReviewed: number }>) {
  localStorage.setItem('toeic_vocab_mastery', JSON.stringify(map))
}

function statFor(vocabId: string) {
  return getVocabStats().find((s) => s.vocabId === vocabId)
}

describe('vocab weakness stats', () => {
  beforeEach(() => localStorage.clear())

  it('aggregates attempts, wrong count and accuracy per word', () => {
    seedVocabHistory([
      { vocabId: 'v1', isCorrect: false, daysAgo: 5 },
      { vocabId: 'v1', isCorrect: true, daysAgo: 3 },
      { vocabId: 'v1', isCorrect: true, daysAgo: 1 },
    ])
    seedMastery({ v1: { level: 2, lastReviewed: Date.now() - DAY } })

    const stat = statFor('v1')
    expect(stat?.attempts).toBe(3)
    expect(stat?.wrongCount).toBe(1)
    expect(stat?.correctCount).toBe(2)
    expect(stat?.accuracyRate).toBe(67)
  })

  it('flags a word as 常錯 once it has been missed the threshold number of times', () => {
    seedVocabHistory([
      { vocabId: 'v1', isCorrect: false, daysAgo: 4 },
      { vocabId: 'v1', isCorrect: false, daysAgo: 2 },
      // 就算後來答對、檔位也升上去了，錯過這麼多次仍然要被挑出來複習。
      { vocabId: 'v1', isCorrect: true, daysAgo: 0 },
    ])
    seedMastery({ v1: { level: 4, lastReviewed: Date.now() } })

    expect(LEECH_WRONG_THRESHOLD).toBe(2)
    expect(statFor('v1')?.status).toBe('leech')
  })

  it('marks a familiar word as 待複習 only after its SRS interval has passed', () => {
    const level = 3
    const interval = getSrsIntervalMs(level)

    seedVocabHistory([{ vocabId: 'fresh', isCorrect: true, daysAgo: 0 }])
    seedMastery({ fresh: { level, lastReviewed: Date.now() } })
    expect(statFor('fresh')?.status).toBe('mastered')

    localStorage.clear()
    seedVocabHistory([
      { vocabId: 'stale', isCorrect: true, daysAgo: interval / DAY + 1 },
    ])
    seedMastery({ stale: { level, lastReviewed: Date.now() } })
    expect(statFor('stale')?.status).toBe('due')
  })

  it('prefers the answer-history timestamp over the mastery map', () => {
    // syncUserDataFromD1() 會把每個字的 lastReviewed 寫成「現在」；只信 map 的話
    // 換裝置登入後所有的字都變成剛複習過。
    seedVocabHistory([{ vocabId: 'v1', isCorrect: true, daysAgo: 30 }])
    seedMastery({ v1: { level: 2, lastReviewed: Date.now() } })

    expect(statFor('v1')?.status).toBe('due')
  })

  it('treats a not-yet-familiar word as 不熟', () => {
    seedVocabHistory([{ vocabId: 'v1', isCorrect: false, daysAgo: 1 }])
    seedMastery({ v1: { level: 1, lastReviewed: Date.now() - DAY } })

    expect(statFor('v1')?.status).toBe('learning')
  })

  it('counts a word practiced several times in one day as a single attempt', () => {
    seedVocabHistory([
      { vocabId: 'v1', isCorrect: false, at: todayAt(10) },
      { vocabId: 'v1', isCorrect: false, at: todayAt(11) },
      { vocabId: 'v1', isCorrect: false, at: todayAt(12) },
    ])

    // 同一個下午刷三遍不該讓任何字變成常錯。
    expect(statFor('v1')?.attempts).toBe(1)
    expect(statFor('v1')?.status).not.toBe('leech')
  })

  it('records the real quiz verdict, not the resulting mastery level', () => {
    // level 0 答對只會升到 1；用 `level >= 2` 反推會把一次答對記成答錯。
    bumpVocabMastery('v1', true)

    const stat = statFor('v1')
    expect(stat?.correctCount).toBe(1)
    expect(stat?.wrongCount).toBe(0)
    expect(stat?.level).toBe(1)
  })

  it('still treats a flashcard self-grade of 不會 as a miss', () => {
    updateVocabMastery('v1', 1)
    expect(statFor('v1')?.wrongCount).toBe(1)
  })

  it('lists weak words first and leaves mastered ones out', () => {
    seedVocabHistory([
      { vocabId: 'leech', isCorrect: false, daysAgo: 4 },
      { vocabId: 'leech', isCorrect: false, daysAgo: 2 },
      { vocabId: 'learning', isCorrect: false, daysAgo: 1 },
      { vocabId: 'mastered', isCorrect: true, daysAgo: 0 },
    ])
    seedMastery({
      leech: { level: 1, lastReviewed: Date.now() },
      learning: { level: 1, lastReviewed: Date.now() },
      mastered: { level: 4, lastReviewed: Date.now() },
    })

    expect(getWeakVocabIds()).toEqual(['leech', 'learning'])
    expect(getWeakVocabIds(1)).toEqual(['leech'])
  })
})
