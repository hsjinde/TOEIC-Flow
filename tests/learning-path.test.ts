import { describe, it, expect } from 'vitest'
import {
  getPathChapterIds,
  getPathProgress,
  getPathStageById,
  getPathStages,
  getStageOfChapter,
  getStageQuestionCount,
  getStageQuestions,
  pathChapterHref,
  pathChapterTitle,
} from '../src/lib/learning-path'
import { getChapters } from '../src/lib/content'
import { PathStageSchema } from '../scripts/build-content/types'
import type { ChapterMastery } from '../src/lib/storage'

const stages = getPathStages()
const chapters = getChapters()

describe('learning path data', () => {
  it('matches the schema', () => {
    for (const stage of stages) {
      expect(PathStageSchema.safeParse(stage).success).toBe(true)
    }
  })

  it('is numbered 1..n in file order', () => {
    expect(stages.map((s) => s.order)).toEqual(stages.map((_, i) => i + 1))
  })

  it('has unique stage ids', () => {
    expect(new Set(stages.map((s) => s.id)).size).toBe(stages.length)
  })

  // 路徑頁上寫著「N 章」，使用者拿它來確認自己沒漏學。漏排或重複排都會讓那個
  // 數字說謊，所以這裡跟 build:content 的 checkLearningPath 兩邊都擋。
  it('places every grammar chapter exactly once', () => {
    const placed = getPathChapterIds()
    expect(new Set(placed).size).toBe(placed.length)
    expect([...placed].sort()).toEqual(chapters.map((c) => c.id).sort())
  })

  it('resolves every chapter id to a real chapter', () => {
    for (const id of getPathChapterIds()) {
      expect(getStageOfChapter(id)).not.toBeNull()
      expect(pathChapterTitle(id)).not.toBe('')
      // 章名顯示時要去掉檔名的數字前綴，否則路徑上的第 3 章會顯示成「03_…」。
      expect(pathChapterTitle(id)).not.toMatch(/^\d/)
    }
  })

  // 這條路徑存在的理由就是「跟章節編號順序不一樣」。哪天有人把它照大類重排回去，
  // 這個測試會提醒他整個頁面也就沒有意義了。
  it('does not simply repeat the chapter file order', () => {
    expect(getPathChapterIds()).not.toEqual(chapters.map((c) => c.id))
  })

  it('mixes categories across stages', () => {
    const crossCategory = stages.filter(
      (s) => new Set(s.chapterIds.map((id) => id.split('/')[1])).size > 1
    )
    expect(crossCategory.length).toBeGreaterThan(0)
  })

  it('escapes chapter hrefs the same way the chapters page does', () => {
    const id = getPathChapterIds()[0]!
    expect(pathChapterHref(id)).toBe(`/chapters/${id.split('/').map(encodeURIComponent).join('/')}`)
  })
})

describe('stage question pools', () => {
  it('pulls from every chapter in the stage', () => {
    const stage = stages[0]!
    const pool = getStageQuestions(stage.id)
    expect(pool.length).toBe(getStageQuestionCount(stage))
    expect(new Set(pool.map((q) => q.chapterId)).size).toBe(stage.chapterIds.length)
  })

  it('caps the round at the requested count', () => {
    expect(getStageQuestions(stages[0]!.id, 10)).toHaveLength(10)
  })

  it('returns nothing for an unknown stage rather than throwing', () => {
    expect(getStageQuestions('stage-99')).toEqual([])
    expect(getPathStageById('stage-99')).toBeNull()
  })
})

function achieve(ids: string[]): Record<string, number> {
  return Object.fromEntries(ids.map((id) => [id, 1_700_000_000_000]))
}

describe('path progress', () => {
  const first = stages[0]!

  it('points at the very first chapter when nothing is done', () => {
    const p = getPathProgress({}, {})
    expect(p.achievedCount).toBe(0)
    expect(p.next?.stage.id).toBe(first.id)
    expect(p.next?.chapterId).toBe(first.chapterIds[0])
    expect(p.currentStageId).toBe(first.id)
    expect(p.stages[0]!.hasPracticed).toBe(false)
  })

  it('advances to the next unfinished chapter in path order', () => {
    const p = getPathProgress({}, achieve([first.chapterIds[0]!]))
    expect(p.achievedCount).toBe(1)
    expect(p.next?.chapterId).toBe(first.chapterIds[1])
  })

  // 達標與否照路徑順序看，不照使用者實際的練習順序：先跳去練第 3 章的人，
  // 下一步還是要被帶回第 1 章，否則路徑就不是路徑了。
  it('still points back at an earlier unfinished chapter', () => {
    const p = getPathProgress({}, achieve([first.chapterIds[2]!]))
    expect(p.next?.chapterId).toBe(first.chapterIds[0])
    expect(p.stages[0]!.achievedCount).toBe(1)
  })

  it('rolls over to the next stage once a stage is complete', () => {
    const p = getPathProgress({}, achieve(first.chapterIds))
    expect(p.stages[0]!.rate).toBe(100)
    expect(p.stages[0]!.nextChapterId).toBeNull()
    expect(p.next?.stage.id).toBe(stages[1]!.id)
    expect(p.currentStageId).toBe(stages[1]!.id)
  })

  it('reports no next step once every chapter is achieved', () => {
    const p = getPathProgress({}, achieve(getPathChapterIds()))
    expect(p.next).toBeNull()
    expect(p.achievedCount).toBe(p.totalCount)
    expect(p.currentStageId).toBe(stages[stages.length - 1]!.id)
  })

  // 練過但沒達標的站要顯示進度條（0%），完全沒碰過的站不顯示——否則十站一整排
  // 0% 看起來像是全都失敗了。
  it('counts a stage as practiced from answered questions alone', () => {
    const mastery: Record<string, ChapterMastery> = {
      [first.chapterIds[0]!]: {
        accuracyRate: 40,
        totalAnswered: 5,
        correctCount: 2,
        uniqueAnsweredCount: 5,
      },
    }
    const p = getPathProgress(mastery, {})
    expect(p.stages[0]!.hasPracticed).toBe(true)
    expect(p.stages[0]!.achievedCount).toBe(0)
    expect(p.stages[1]!.hasPracticed).toBe(false)
  })
})
