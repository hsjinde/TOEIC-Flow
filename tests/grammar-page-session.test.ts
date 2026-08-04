import { describe, it, expect } from 'vitest'
import { buildSession } from '../src/app/practice/grammar/page'
import { getPathStages } from '../src/lib/learning-path'
import grammarData from '../content/grammar.json'
import type { Question } from '../scripts/build-content/types'

// 「只有 練這章 進來的回合才會計入章節達標」是這個功能的核心保證：
// buildSession 只有 chapter 分支才會設 chapterId，其餘分支（錯題、弱項加練、隨機）
// 都必須讓它維持 undefined，否則錯題複習或弱項加練也會悄悄影響章節達標判定。
describe('buildSession chapterId wiring', () => {
  const questions = grammarData as unknown as Question[]
  const sampleChapterId = questions[0]?.chapterId
  const sampleCategoryId = questions[0]?.categoryId

  if (!sampleChapterId || !sampleCategoryId) {
    throw new Error('grammar.json 沒有可用的題目來取得 chapterId/categoryId 樣本')
  }

  it('sets chapterId when entering via 練這章 (chapter param)', () => {
    const params = new URLSearchParams({ chapter: sampleChapterId })
    const session = buildSession(params)
    expect(session.chapterId).toBe(sampleChapterId)
  })

  it('leaves chapterId undefined for mode=wrong sessions', () => {
    const someIds = questions.slice(0, 3).map((q) => q.id)
    const params = new URLSearchParams({ mode: 'wrong', ids: someIds.join(',') })
    const session = buildSession(params)
    expect(session.chapterId).toBeUndefined()
  })

  it('leaves chapterId undefined for category (弱項加練) sessions', () => {
    const params = new URLSearchParams({ category: sampleCategoryId })
    const session = buildSession(params)
    expect(session.chapterId).toBeUndefined()
  })

  it('leaves chapterId undefined for the default random session', () => {
    const params = new URLSearchParams()
    const session = buildSession(params)
    expect(session.chapterId).toBeUndefined()
  })

  it('leaves chapterId undefined for a 學習路徑 stage session', () => {
    const session = buildSession(new URLSearchParams({ stage: getPathStages()[0]!.id }))
    expect(session.chapterId).toBeUndefined()
  })
})

// 每一回合都要記得自己是從哪裡開始的：返回鍵與結算頁都讀 backHref。
// 先前兩處都寫死 '/'，從章節頁按「練這章」的人練完就被丟回今日任務，
// 原本在讀的那一章不見了——那正是「被跳轉不知道去哪」的來源。
describe('buildSession 出口', () => {
  const questions = grammarData as unknown as Question[]
  const chapterId = questions[0]!.chapterId
  const categoryId = questions[0]!.categoryId

  it('sends a 練這章 round back to that chapter', () => {
    const session = buildSession(new URLSearchParams({ chapter: chapterId }))
    expect(session.backHref).toBe(
      `/chapters/${chapterId.split('/').map(encodeURIComponent).join('/')}`
    )
  })

  it('sends a 錯題專攻 round back to 錯題本', () => {
    const ids = questions.slice(0, 2).map((q) => q.id)
    const session = buildSession(new URLSearchParams({ mode: 'wrong', ids: ids.join(',') }))
    expect(session.backHref).toBe('/wrong-questions')
    expect(session.backLabel).toBe('錯題本')
  })

  it('sends a 路徑驗收 round back to 學習路徑', () => {
    const session = buildSession(new URLSearchParams({ stage: getPathStages()[0]!.id }))
    expect(session.backHref).toBe('/path')
    expect(session.backLabel).toBe('學習路徑')
  })

  it('sends the daily and 弱項加練 rounds back to 今日任務', () => {
    expect(buildSession(new URLSearchParams()).backHref).toBe('/')
    expect(buildSession(new URLSearchParams({ category: categoryId })).backHref).toBe('/')
  })
})

describe('buildSession 學習路徑 stage', () => {
  const stage = getPathStages()[0]!

  it('mixes the whole stage instead of one chapter', () => {
    const session = buildSession(new URLSearchParams({ stage: stage.id }))
    expect(session.questions).toHaveLength(10)
    expect(session.title).toContain(stage.title)
    for (const q of session.questions) {
      expect(stage.chapterIds).toContain(q.chapterId)
    }
  })

  it('does not count as the daily grammar task', () => {
    expect(buildSession(new URLSearchParams({ stage: stage.id })).countsAsDailyTask).toBe(false)
  })

  // 舊的分享連結或手打的網址不該讓整頁空掉——認不得的站名就退回隨機每日練習。
  it('falls back to the random daily session for an unknown stage', () => {
    const session = buildSession(new URLSearchParams({ stage: 'stage-99' }))
    expect(session.title).toBe('文法練習')
    expect(session.countsAsDailyTask).toBe(true)
  })
})

describe('buildSession 的 from 覆寫層', () => {
  const q = grammarData as unknown as Question[]
  const chapterId = q[0]!.chapterId
  const categoryId = q[0]!.categoryId

  it('沒帶 from 時預設回合仍回今日任務', () => {
    const s = buildSession(new URLSearchParams())
    expect(s.backHref).toBe('/')
    expect(s.backLabel).toBe('今日任務')
  })

  it('from=practice 讓預設回合改回練習中心', () => {
    const s = buildSession(new URLSearchParams({ from: 'practice' }))
    expect(s.backHref).toBe('/practice')
    expect(s.backLabel).toBe('練習中心')
  })

  // 這是本次最容易改壞的地方：唯一 countsAsDailyTask:true 的是無參數的預設分支，
  // 而練習中心正是規定要列出三項每日任務的那一頁。from 絕不能攔在它前面。
  it('from=practice 仍然算今日任務', () => {
    const s = buildSession(new URLSearchParams({ from: 'practice' }))
    expect(s.countsAsDailyTask).toBe(true)
  })

  it('from 只換出口，不動題目來源與計數', () => {
    const plain = buildSession(new URLSearchParams({ chapter: chapterId }))
    const withFrom = buildSession(new URLSearchParams({ chapter: chapterId, from: 'practice' }))
    expect(withFrom.source).toBe(plain.source)
    expect(withFrom.countsAsDailyTask).toBe(plain.countsAsDailyTask)
    expect(withFrom.chapterId).toBe(plain.chapterId)
    expect(withFrom.questions.length).toBe(plain.questions.length)
    expect(withFrom.backHref).toBe('/practice')
  })

  it('from=stats 讓弱項加練回統計而不是首頁', () => {
    const s = buildSession(new URLSearchParams({ category: categoryId, from: 'stats' }))
    expect(s.backHref).toBe('/stats')
    expect(s.countsAsDailyTask).toBe(false)
  })

  // 章節頁的「重練這章的錯題」：題目來自 ids，但使用者是從該章進來的。
  it('from=chapter 讓錯題回合回該章而不是錯題本', () => {
    const ids = q.slice(0, 3).map((x) => x.id).join(',')
    const s = buildSession(new URLSearchParams({ mode: 'wrong', ids, from: 'chapter', chapter: chapterId }))
    expect(s.backHref).toBe(`/chapters/${chapterId.split('/').map(encodeURIComponent).join('/')}`)
    expect(s.source).toBe('wrong')
  })

  it('未知的 from 退回該分支原本的出口', () => {
    const s = buildSession(new URLSearchParams({ stage: 'stage-01', from: 'evil' }))
    expect(s.backHref).toBe('/path')
  })
})
