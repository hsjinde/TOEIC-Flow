import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  DEFAULT_PROFILE,
  MAX_VOCAB_LEVEL,
  bumpVocabMastery,
  fileWrongQuestions,
  getChapterMasteryMap,
  getPracticeCalendar,
  getPracticedDayCount,
  getProfile,
  getQuestionHistory,
  getSrsIntervalLabel,
  getWrongQuestionList,
  getWrongQuestionsMap,
  recordQuestionAnswer,
  removeWrongQuestions,
  saveMockResult,
  getMockResults,
  saveProfile,
  getDeduplicatedAnswerHistory,
  getCategoryStats,
  getVocabStats,
  getAnswerHistory,
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
// storage 的每個寫入都會 fire-and-forget 一個 POST；測試裡吞掉即可。
vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve({}) })))

const CHAPTER = 'grammar/03_動狀詞_非謂語動詞/09_不定詞'
const Q1 = `${CHAPTER}#q1`
const Q2 = `${CHAPTER}#q2`

function seedHistory(entries: { questionId: string; isCorrect: boolean; daysAgo: number }[]) {
  const history = entries.map((e) => ({
    questionId: e.questionId,
    categoryId: '03_動狀詞_非謂語動詞',
    isCorrect: e.isCorrect,
    timestamp: Date.now() - e.daysAgo * 86_400_000,
  }))
  localStorage.setItem('toeic_answer_history', JSON.stringify(history))
}

describe('wrong-question bookkeeping', () => {
  beforeEach(() => localStorage.clear())

  it('does not file a question that was answered correctly on the first try', () => {
    recordQuestionAnswer(Q1, 'cat', true)
    expect(getWrongQuestionsMap()[Q1]).toBeUndefined()
  })

  it('keeps graduation progress only for questions already in the book', () => {
    recordQuestionAnswer(Q1, 'cat', false)
    expect(getWrongQuestionsMap()[Q1]?.failCount).toBe(1)

    recordQuestionAnswer(Q1, 'cat', true)
    expect(getWrongQuestionsMap()[Q1]?.consecutiveCorrect).toBe(1)

    recordQuestionAnswer(Q1, 'cat', true)
    expect(getWrongQuestionsMap()[Q1]).toBeUndefined()
  })

  it('sorts un-graduated questions before ones close to graduating', () => {
    recordQuestionAnswer(Q1, 'cat', false)
    recordQuestionAnswer(Q1, 'cat', true) // consecutiveCorrect = 1
    recordQuestionAnswer(Q2, 'cat', false) // consecutiveCorrect = 0

    expect(getWrongQuestionList().map((r) => r.questionId)).toEqual([Q2, Q1])
  })

  it('removes questions from the book on request', () => {
    recordQuestionAnswer(Q1, 'cat', false)
    recordQuestionAnswer(Q2, 'cat', false)
    removeWrongQuestions([Q1])

    expect(Object.keys(getWrongQuestionsMap())).toEqual([Q2])
  })

  it('records history without filing when the caller opts out', () => {
    // 模擬考交卷用的路徑：歷程與統計要記，錯題入本等使用者按按鈕。
    recordQuestionAnswer(Q1, 'cat', false, { source: 'mock', fileWrong: false })

    expect(getWrongQuestionsMap()[Q1]).toBeUndefined()
    expect(getQuestionHistory(Q1)).toHaveLength(1)
  })

  it('files wrong questions separately without duplicating the history entry', () => {
    recordQuestionAnswer(Q1, 'cat', false, { source: 'mock', fileWrong: false })
    fileWrongQuestions([{ questionId: Q1, categoryId: 'cat' }])

    expect(getWrongQuestionsMap()[Q1]?.failCount).toBe(1)
    expect(getQuestionHistory(Q1)).toHaveLength(1)
  })

  it('bumps the fail count and resets progress when filing a question already in the book', () => {
    recordQuestionAnswer(Q1, 'cat', false)
    recordQuestionAnswer(Q1, 'cat', true) // consecutiveCorrect = 1
    fileWrongQuestions([{ questionId: Q1, categoryId: 'cat' }])

    expect(getWrongQuestionsMap()[Q1]).toMatchObject({ failCount: 2, consecutiveCorrect: 0 })
  })

  it('records the picked option and source so the review pane can show them', () => {
    recordQuestionAnswer(Q1, 'cat', false, { selectedKey: 'B', source: 'mock' })
    const [entry] = getQuestionHistory(Q1)

    expect(entry?.selectedKey).toBe('B')
    expect(entry?.source).toBe('mock')
  })
})

describe('practice calendar', () => {
  beforeEach(() => localStorage.clear())

  it('returns one entry per day with gaps filled in', () => {
    seedHistory([
      { questionId: Q1, isCorrect: true, daysAgo: 0 },
      { questionId: Q2, isCorrect: false, daysAgo: 0 },
      { questionId: Q1, isCorrect: true, daysAgo: 3 },
    ])

    const days = getPracticeCalendar(7)
    expect(days).toHaveLength(7)
    expect(days[days.length - 1]?.count).toBe(2)
    expect(days[days.length - 4]?.count).toBe(1)
    expect(days[days.length - 2]?.count).toBe(0)
  })

  it('counts distinct practice days', () => {
    seedHistory([
      { questionId: Q1, isCorrect: true, daysAgo: 0 },
      { questionId: Q2, isCorrect: true, daysAgo: 0 },
      { questionId: Q1, isCorrect: true, daysAgo: 5 },
    ])
    expect(getPracticedDayCount()).toBe(2)
  })
})

describe('chapter mastery', () => {
  beforeEach(() => localStorage.clear())

  it('derives the chapter from the part of the question id before #', () => {
    seedHistory([
      { questionId: Q1, isCorrect: true, daysAgo: 0 },
      { questionId: Q2, isCorrect: false, daysAgo: 0 },
    ])

    const map = getChapterMasteryMap()
    expect(map[CHAPTER]).toEqual({
      totalAnswered: 2,
      correctCount: 1,
      accuracyRate: 50,
      uniqueAnsweredCount: 2,
    })
  })

  it('ignores ids without a # so it never keys on a truncated path', () => {
    seedHistory([{ questionId: 'legacy-id', isCorrect: true, daysAgo: 0 }])
    expect(Object.keys(getChapterMasteryMap())).toHaveLength(0)
  })
})

describe('vocab SRS levels', () => {
  beforeEach(() => localStorage.clear())

  it('clamps between 0 and the maximum level', () => {
    for (let i = 0; i < 10; i++) bumpVocabMastery('v1', true)
    expect(bumpVocabMastery('v1', true)).toBe(MAX_VOCAB_LEVEL)

    for (let i = 0; i < 10; i++) bumpVocabMastery('v1', false)
    expect(bumpVocabMastery('v1', false)).toBe(0)
  })

  it('maps each level to the interval shown on the flashcard', () => {
    expect(getSrsIntervalLabel(1)).toBe('10 分鐘後')
    expect(getSrsIntervalLabel(2)).toBe('明天')
    expect(getSrsIntervalLabel(3)).toBe('4 天後')
  })
})

describe('user profile', () => {
  beforeEach(() => localStorage.clear())

  it('falls back to defaults when nothing is stored', () => {
    expect(getProfile()).toEqual(DEFAULT_PROFILE)
  })

  it('round-trips a saved profile and back-fills newly added fields', () => {
    saveProfile({ ...DEFAULT_PROFILE, targetScore: 900, examDate: '2026-09-20' })
    localStorage.setItem('toeic_user_profile', JSON.stringify({ targetScore: 900 }))

    const profile = getProfile()
    expect(profile.targetScore).toBe(900)
    expect(profile.reminderTime).toBe(DEFAULT_PROFILE.reminderTime)
  })
})

describe('mock results', () => {
  beforeEach(() => localStorage.clear())

  it('returns the prior result so the report can show the delta', () => {
    const base = { examId: 'mock/1', totalCount: 40, durationSeconds: 600, estimatedScore: 700 }
    expect(saveMockResult({ ...base, finishedAt: 1, correctCount: 29 })).toBeNull()
    expect(saveMockResult({ ...base, finishedAt: 2, correctCount: 32 })?.correctCount).toBe(29)
    expect(getMockResults()).toHaveLength(2)
  })
})

describe('same-day duplicate attempt deduplication', () => {
  beforeEach(() => localStorage.clear())

  it('deduplicates same-day attempts using first attempt by default', () => {
    const now = Date.now()
    seedHistory([
      { questionId: Q1, isCorrect: false, daysAgo: 0 },
      { questionId: Q1, isCorrect: true, daysAgo: 0 },
      { questionId: Q1, isCorrect: true, daysAgo: 0 },
    ])

    const dedup = getDeduplicatedAnswerHistory()
    expect(dedup).toHaveLength(1)
    expect(dedup[0]?.isCorrect).toBe(false)
  })

  it('supports deduplication rules: last and best', () => {
    seedHistory([
      { questionId: Q1, isCorrect: false, daysAgo: 0 },
      { questionId: Q1, isCorrect: true, daysAgo: 0 },
    ])

    const rawHistory = getAnswerHistory()
    const last = getDeduplicatedAnswerHistory(rawHistory, 'last')
    expect(last[0]?.isCorrect).toBe(true)

    const best = getDeduplicatedAnswerHistory(rawHistory, 'best')
    expect(best[0]?.isCorrect).toBe(true)
  })

  it('does not double count same-day attempts in category stats and chapter mastery', () => {
    seedHistory([
      { questionId: Q1, isCorrect: false, daysAgo: 0 },
      { questionId: Q1, isCorrect: true, daysAgo: 0 },
      { questionId: Q2, isCorrect: true, daysAgo: 0 },
    ])

    const catStats = getCategoryStats()
    const cat = catStats.find((s) => s.categoryId === '03_動狀詞_非謂語動詞')
    expect(cat).toBeDefined()
    expect(cat?.totalAnswered).toBe(2) // Q1 (deduped to 1) + Q2 = 2
    expect(cat?.correctCount).toBe(1)  // Q1 (first was false) + Q2 (true) = 1

    const chapterMap = getChapterMasteryMap()
    expect(chapterMap[CHAPTER]).toMatchObject({
      totalAnswered: 2,
      correctCount: 1,
      accuracyRate: 50,
      uniqueAnsweredCount: 2,
    })
  })

  it('counts attempts on different days separately', () => {
    seedHistory([
      { questionId: Q1, isCorrect: false, daysAgo: 0 },
      { questionId: Q1, isCorrect: true, daysAgo: 1 },
    ])

    const dedup = getDeduplicatedAnswerHistory()
    expect(dedup).toHaveLength(2)

    const catStats = getCategoryStats()
    const cat = catStats.find((s) => s.categoryId === '03_動狀詞_非謂語動詞')
    expect(cat?.totalAnswered).toBe(2)
  })
})

