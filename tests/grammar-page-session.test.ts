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
