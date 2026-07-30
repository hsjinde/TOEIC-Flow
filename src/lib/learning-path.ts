import pathData from '../../data/learning-path.json'
import type { PathStage, Question } from '../../scripts/build-content/types'
import { getChapterById, getGrammarQuestionsByChapter, stripOrderPrefix } from './content'
import { isChapterAchieved, type ChapterMastery } from './storage'

/**
 * 學習路徑：**刻意不照文法章節編號**的建議順序。
 *
 * 章節在筆記裡是按主題歸檔的（八大詞性、動詞時態、動狀詞…），那是給「查」用的
 * 結構，不是給「學」用的。這份路徑把 69 章重排成十站，跨大類混編——例如主動詞
 * 一致性從第六大類搬到時態那一站、分詞形容詞從第一大類搬到動狀詞那一站——排序
 * 的理由寫在每一站的 `why` 裡，那是這個頁面真正要傳達的東西。
 *
 * 一致性（每章恰好出現一次、id 都對得到章節）由 build:content 的
 * checkLearningPath 擋，前端這裡不再重複驗證。
 */
const stages = (pathData as unknown) as PathStage[]

export function getPathStages(): PathStage[] {
  return stages
}

export function getPathStageById(stageId: string): PathStage | null {
  return stages.find((s) => s.id === stageId) ?? null
}

/** 章節在整條路徑上的第幾站。不在路徑上（新章節還沒排）回 null。 */
export function getStageOfChapter(chapterId: string): PathStage | null {
  return stages.find((s) => s.chapterIds.includes(chapterId)) ?? null
}

/** 路徑順序攤平後的所有章節 id，`第 N 站第 M 章` 的 N/M 都由這個順序決定。 */
export function getPathChapterIds(): string[] {
  return stages.flatMap((s) => s.chapterIds)
}

export function getStageQuestionCount(stage: PathStage): number {
  return stage.chapterIds.reduce((n, id) => n + getGrammarQuestionsByChapter(id).length, 0)
}

/** 一站的綜合測驗題庫：整站章節混在一起抽，這正是路徑跟單章練習的差別。 */
export function getStageQuestions(stageId: string, count?: number): Question[] {
  const stage = getPathStageById(stageId)
  if (!stage) return []
  const pool = stage.chapterIds.flatMap((id) => getGrammarQuestionsByChapter(id))
  if (count === undefined) return pool
  return [...pool].sort(() => 0.5 - Math.random()).slice(0, count)
}

export interface StageProgress {
  stage: PathStage
  /** 該站已達標（單輪正確率 ≥80%）的章節數 */
  achievedCount: number
  totalCount: number
  /** 已達標比例，0–100 */
  rate: number
  /** 這一站有沒有動過——完全沒練過的站不顯示百分比，避免一整排 0% */
  hasPracticed: boolean
  /** 路徑順序下，這一站第一個還沒達標的章節；整站完成則為 null */
  nextChapterId: string | null
}

export interface PathProgress {
  stages: StageProgress[]
  achievedCount: number
  totalCount: number
  /** 整條路徑上第一個還沒達標的章節，就是首頁與路徑頁的「下一步」 */
  next: { stage: PathStage; chapterId: string } | null
  /** 目前所在的站（= next 那一站；全部完成時是最後一站） */
  currentStageId: string
}

/**
 * 路徑進度。純函式（進度資料由呼叫端從 storage 取好再傳進來），才能在沒有
 * localStorage 的環境下測。
 *
 * 「完成」的判準沿用章節頁的 isChapterAchieved（單輪正確率 ≥80% 且永久保留），
 * 不另外定義一套——路徑頁與章節頁對同一章說出不同的完成狀態會直接讓人不信任。
 */
export function getPathProgress(
  mastery: Record<string, ChapterMastery>,
  achievements: Record<string, number>
): PathProgress {
  const stageProgress: StageProgress[] = stages.map((stage) => {
    let achieved = 0
    let hasPracticed = false
    let nextChapterId: string | null = null

    for (const id of stage.chapterIds) {
      const done = isChapterAchieved(id, achievements)
      if (done) {
        achieved += 1
        // 達標的章節定義上就練過，即使作答歷程已因筆數上限被擠掉。
        hasPracticed = true
      } else if (nextChapterId === null) {
        nextChapterId = id
      }
      if ((mastery[id]?.uniqueAnsweredCount ?? 0) > 0) hasPracticed = true
    }

    const total = stage.chapterIds.length
    return {
      stage,
      achievedCount: achieved,
      totalCount: total,
      rate: total > 0 ? Math.round((achieved / total) * 100) : 0,
      hasPracticed,
      nextChapterId,
    }
  })

  const firstUnfinished = stageProgress.find((s) => s.nextChapterId !== null)
  const last = stageProgress[stageProgress.length - 1]

  return {
    stages: stageProgress,
    achievedCount: stageProgress.reduce((n, s) => n + s.achievedCount, 0),
    totalCount: stageProgress.reduce((n, s) => n + s.totalCount, 0),
    next:
      firstUnfinished && firstUnfinished.nextChapterId
        ? { stage: firstUnfinished.stage, chapterId: firstUnfinished.nextChapterId }
        : null,
    currentStageId: firstUnfinished?.stage.id ?? last?.stage.id ?? '',
  }
}

/** 路徑頁的章節連結，跟章節頁走同一套 encode 規則。 */
export function pathChapterHref(chapterId: string): string {
  return `/chapters/${chapterId.split('/').map(encodeURIComponent).join('/')}`
}

/** 章節在路徑上的顯示名（去掉數字前綴的章名）。查無此章回原 id 尾段。 */
export function pathChapterTitle(chapterId: string): string {
  const chapter = getChapterById(chapterId)
  return stripOrderPrefix(chapter?.title ?? chapterId.split('/').pop() ?? chapterId)
}
