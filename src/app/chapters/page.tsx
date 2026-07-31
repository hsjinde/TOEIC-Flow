'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { CheckCircle2, ChevronDown, ChevronRight, ListChecks, Zap } from 'lucide-react'
import {
  getCategories,
  getChapterNumber,
  getGrammarQuestionsByChapter,
  stripOrderPrefix,
  type CategoryMeta,
} from '../../lib/content'
import {
  getChapterAchievements,
  getChapterMasteryMap,
  isChapterAchieved,
  type ChapterMastery,
} from '../../lib/storage'
import { getPathProgress, pathChapterTitle, type PathProgress } from '../../lib/learning-path'
import { EntryCard } from '../../components/EntryCard'
import { cn } from '../../lib/utils'

function chapterHref(id: string): string {
  return `/chapters/${id.split('/').map(encodeURIComponent).join('/')}`
}

/** 分類完成率＝該類中單輪正確率達標（≥80%）過的小章節數 / 該類總章節數。 */
function categoryCompletion(
  category: CategoryMeta,
  masteryMap: Record<string, ChapterMastery>,
  achievements: Record<string, number>
): { rate: number | null; completedCount: number; hasPracticed: boolean } {
  let completedCount = 0
  let hasPracticed = false

  for (const ch of category.chapters) {
    const m = masteryMap[ch.id]
    if (m && (m.uniqueAnsweredCount ?? 0) > 0) {
      hasPracticed = true
    }
    if (isChapterAchieved(ch.id, achievements)) {
      completedCount += 1
      // 已達標的章節定義上就是練過的——即使該章的作答歷史因筆數上限已從 mastery 消失。
      hasPracticed = true
    }
  }

  const total = category.chapters.length
  return {
    rate: hasPracticed && total > 0 ? Math.round((completedCount / total) * 100) : null,
    completedCount,
    hasPracticed,
  }
}

export default function ChaptersPage() {
  const [categories, setCategories] = useState<CategoryMeta[] | null>(null)
  const [mastery, setMastery] = useState<Record<string, ChapterMastery>>({})
  const [achievements, setAchievements] = useState<Record<string, number>>({})
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [pathProgress, setPathProgress] = useState<PathProgress | null>(null)

  useEffect(() => {
    const cats = getCategories()
    const achieved = getChapterAchievements()
    const masteryMap = getChapterMasteryMap()
    setCategories(cats)
    setMastery(masteryMap)
    setAchievements(achieved)
    setPathProgress(getPathProgress(masteryMap, achieved))
    // 預設展開第一類，讓兩層結構一眼看得出來。
    if (cats[0]) setExpanded(new Set([cats[0].id]))
  }, [])

  if (!categories) return <ChaptersSkeleton />

  const totalChapters = categories.reduce((a, c) => a + c.chapters.length, 0)
  let totalCompletedChapters = 0
  let hasAnyPracticed = false

  for (const cat of categories) {
    for (const ch of cat.chapters) {
      const m = mastery[ch.id]
      if (m && (m.uniqueAnsweredCount ?? 0) > 0) {
        hasAnyPracticed = true
      }
      if (isChapterAchieved(ch.id, achievements)) {
        totalCompletedChapters += 1
        // 已達標的章節定義上就是練過的——即使該章的作答歷史因筆數上限已從 mastery 消失。
        hasAnyPracticed = true
      }
    }
  }

  const overallRate =
    hasAnyPracticed && totalChapters > 0
      ? Math.round((totalCompletedChapters / totalChapters) * 100)
      : null

  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-bold text-[var(--tx)]">文法章節</h1>
        <p className="mt-0.5 text-xs text-[var(--mu)]">
          {categories.length} 大類 · {totalChapters} 章
          {overallRate !== null && ` · 整體完成率 ${overallRate}%`}
        </p>
      </div>

      {/*
        這一頁是按主題歸檔的（方便查），不是按學習難度排的（方便學）。不知道從哪
        章開始的人在這裡就會卡住，所以把學習路徑的入口放在清單之前。
      */}
      <EntryCard
        href="/path"
        title="學習路徑"
        icon={<ListChecks className="h-3.5 w-3.5 shrink-0 text-[var(--pr)]" />}
        action="看順序"
        emphasis
        description={
          pathProgress?.next
            ? `目前在第 ${pathProgress.next.stage.order} 站 · ${pathProgress.next.stage.title}，下一章是${pathChapterTitle(pathProgress.next.chapterId)}。`
            : pathProgress
              ? `${pathProgress.totalCount} 章全部達標，去模擬考驗收。`
              : '不知道先學哪一章？不照章節編號的十站建議順序，跨大類重排過。'
        }
      />

      <div className="space-y-2.5 lg:grid lg:grid-cols-2 lg:gap-3 lg:space-y-0">
        {categories.map((cat) => {
          const isOpen = expanded.has(cat.id)
          const { rate } = categoryCompletion(cat, mastery, achievements)

          return (
            <section
              key={cat.id}
              className="overflow-hidden rounded-2xl border border-[var(--ln)] bg-[var(--sf)] lg:self-start"
            >
              <button
                type="button"
                onClick={() => toggle(cat.id)}
                aria-expanded={isOpen}
                className="flex w-full items-center gap-3 p-4 text-left transition-colors hover:bg-[var(--sf2)]"
              >
                <span className="font-mono text-xs font-bold text-[var(--fa)]">{cat.prefix}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-[var(--tx)]">
                    {cat.title}
                  </span>
                  <span className="mt-0.5 block text-[11px] text-[var(--mu)]">
                    {cat.chapters.length} 章 · {cat.questionCount} 題
                    {rate !== null ? ` · ${rate}%` : ' · 尚未練習'}
                  </span>
                </span>
                {rate !== null && (
                  <span className="w-16 shrink-0">
                    <span className="block h-1.5 w-full overflow-hidden rounded-full bg-[var(--sf2)]">
                      <span
                        className="block h-full rounded-full bg-[var(--pr)] transition-all duration-300"
                        style={{ width: `${rate}%` }}
                      />
                    </span>
                  </span>
                )}
                {isOpen ? (
                  <ChevronDown className="h-4 w-4 shrink-0 text-[var(--mu)]" />
                ) : (
                  <ChevronRight className="h-4 w-4 shrink-0 text-[var(--mu)]" />
                )}
              </button>

              {isOpen && (
                <ul className="animate-fade-in border-t border-[var(--ln)]">
                  {cat.chapters.map((chap) => {
                    const m = mastery[chap.id]
                    const chapQCount = getGrammarQuestionsByChapter(chap.id).length
                    const uniqueDone = m?.uniqueAnsweredCount ?? 0
                    const isAchieved = isChapterAchieved(chap.id, achievements)

                    return (
                      <li key={chap.id}>
                        <Link
                          href={chapterHref(chap.id)}
                          className="flex items-center gap-3 border-b border-[var(--ln)] px-4 py-3 transition-colors last:border-b-0 hover:bg-[var(--sf2)]"
                        >
                          <span className="min-w-0 flex-1">
                            <span className="flex items-center gap-1.5">
                              <span className="truncate text-[13px] text-[var(--tx)]">
                                第 {getChapterNumber(chap.id) ?? chap.order} 章 ·{' '}
                                {stripOrderPrefix(chap.title)}
                              </span>
                              {chap.quickTips && (
                                <Zap
                                  className="h-3 w-3 shrink-0 text-[var(--pr)]"
                                  aria-label="含秒殺公式"
                                />
                              )}
                              {isAchieved && (
                                // 完成是進度，用主色；綠色專屬於「這一題答對了」。
                                <CheckCircle2
                                  className="h-3.5 w-3.5 shrink-0 text-[var(--pr)]"
                                  aria-label="已完成 (練這章單輪正確率 80% 以上)"
                                />
                              )}
                            </span>
                            <span className="mt-1 block h-1 w-full overflow-hidden rounded-full bg-[var(--sf2)]">
                              <span
                                className={cn(
                                  'block h-full rounded-full transition-all duration-300',
                                  m ? 'bg-[var(--pr)]' : 'bg-transparent'
                                )}
                                style={{ width: `${m?.accuracyRate ?? 0}%` }}
                              />
                            </span>
                          </span>
                          <span className="shrink-0 text-right">
                            <span
                              className={cn(
                                'block text-xs font-bold',
                                isAchieved ? 'text-[var(--pr)]' : 'text-[var(--mu)]'
                              )}
                            >
                              {m ? `${m.accuracyRate}%` : '—'}
                            </span>
                            {m && uniqueDone < chapQCount && (
                              <span className="block text-[10px] font-normal text-[var(--mu)]">
                                ({uniqueDone}/{chapQCount}題)
                              </span>
                            )}
                          </span>
                        </Link>
                      </li>
                    )
                  })}
                </ul>
              )}
            </section>
          )
        })}
      </div>
    </div>
  )
}

function ChaptersSkeleton() {
  return (
    <div className="flex animate-pulse flex-col gap-3">
      <div className="h-10 w-48 rounded-md bg-[var(--sf2)]" />
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="h-[68px] rounded-2xl bg-[var(--sf2)]" />
      ))}
    </div>
  )
}
