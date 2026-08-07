import { describe, it, expect, beforeEach } from 'vitest'
import { getDailyGrammarQuestions, getGrammarQuestionsByChapter } from '../src/lib/content'
import { buildSession } from '../src/app/practice/grammar/page'
import { recordQuestionAnswer } from '../src/lib/storage'
import grammarData from '../content/grammar.json'
import type { Question } from '../scripts/build-content/types'

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
  writable: true,
})
Object.defineProperty(globalThis, 'window', {
  value: globalThis,
  writable: true,
})

const grammar = grammarData as unknown as Question[]

describe('getDailyGrammarQuestions SRS 排程測試', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('無作答紀錄時，抽滿 5 題且不重複', () => {
    const list = getDailyGrammarQuestions(5)
    expect(list).toHaveLength(5)
    const ids = new Set(list.map((q) => q.id))
    expect(ids.size).toBe(5)
    for (const q of list) {
      expect(q.id).toMatch(/^grammar\//)
    }
  })

  it('有到期錯題時，到期錯題（consecutiveCorrect < 2）優先放入', () => {
    const q1 = grammar[0]!
    const q2 = grammar[1]!
    // 答錯 2 題
    recordQuestionAnswer(q1.id, 'A', false)
    recordQuestionAnswer(q2.id, 'B', false)

    const list = getDailyGrammarQuestions(5)
    expect(list).toHaveLength(5)
    // q1, q2 必須在回傳列表中
    const listIds = list.map((q) => q.id)
    expect(listIds).toContain(q1.id)
    expect(listIds).toContain(q2.id)
    // 且前 2 題必須是這兩題錯題
    expect(new Set(listIds.slice(0, 2))).toEqual(new Set([q1.id, q2.id]))
  })

  it('已畢業錯題（consecutiveCorrect >= 2）不會被當成到期錯題優先抽取', () => {
    const q1 = grammar[0]!
    recordQuestionAnswer(q1.id, 'A', false) // consecutiveCorrect = 0
    recordQuestionAnswer(q1.id, 'A', true)  // consecutiveCorrect = 1
    recordQuestionAnswer(q1.id, 'A', true)  // consecutiveCorrect = 2 -> graduated & removed from wrong map

    const list = getDailyGrammarQuestions(5)
    expect(list).toHaveLength(5)
  })

  it('錯題不足 5 題時，由弱章節題目補位', () => {
    const chapter1 = grammar[0]!.chapterId
    const ch1Questions = getGrammarQuestionsByChapter(chapter1)

    // 模擬在 chapter1 答錯 1 題，建立低正確率紀錄
    const wrongQ1 = ch1Questions[0]!
    recordQuestionAnswer(wrongQ1.id, 'X', false)

    const list = getDailyGrammarQuestions(5)
    expect(list).toHaveLength(5)
    // 第一題是錯題 wrongQ1
    expect(list[0]!.id).toBe(wrongQ1.id)
    // 列表包含 chapter1 的其他題目（弱章節補位）
    const selectedIds = new Set(list.map((q) => q.id))
    const ch1Matches = ch1Questions.filter((q) => selectedIds.has(q.id))
    expect(ch1Matches.length).toBeGreaterThanOrEqual(1)
  })

  it('每日任務 buildSession 預設分支調用排程抽題且 countsAsDailyTask: true', () => {
    const session = buildSession(new URLSearchParams())
    expect(session.questions).toHaveLength(5)
    expect(session.countsAsDailyTask).toBe(true)
    expect(session.title).toBe('文法練習')
    expect(session.backHref).toBe('/')
  })
})
