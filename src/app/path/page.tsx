'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { CheckCircle2, ChevronDown, ChevronRight, Zap } from 'lucide-react'
import { getChapterById, getChapterNumber, getGrammarQuestionsByChapter } from '../../lib/content'
import {
  getPathProgress,
  getPathStages,
  getStageQuestionCount,
  pathChapterHref,
  pathChapterTitle,
  type PathProgress,
} from '../../lib/learning-path'
import { getChapterAchievements, getChapterMasteryMap, isChapterAchieved } from '../../lib/storage'
import { cn } from '../../lib/utils'

/** 一站的綜合測驗題數：整站混合抽，比單章 5 題多，才有「驗收」的意思。 */
const STAGE_QUIZ_COUNT = 10

export default function LearningPathPage() {
  const [progress, setProgress] = useState<PathProgress | null>(null)
  const [achievements, setAchievements] = useState<Record<string, number>>({})
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  // 每站題數要掃過整個題庫一次，跟進度無關且永遠不變——放在 render 裡會在每次
  // 展開／收合時重算十遍。
  const questionCounts = useMemo(() => {
    const map: Record<string, number> = {}
    for (const stage of getPathStages()) map[stage.id] = getStageQuestionCount(stage)
    return map
  }, [])

  useEffect(() => {
    const achieved = getChapterAchievements()
    const next = getPathProgress(getChapterMasteryMap(), achieved)
    setAchievements(achieved)
    setProgress(next)
    // 只展開目前所在的那一站——十站全開會讓「我現在在哪」整個消失。
    setExpanded(new Set([next.currentStageId]))
  }, [])

  if (!progress) return <PathSkeleton />

  const stages = getPathStages()
  const totalQuestions = Object.values(questionCounts).reduce((n, c) => n + c, 0)
  const overallRate =
    progress.totalCount > 0 ? Math.round((progress.achievedCount / progress.totalCount) * 100) : 0

  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  return (
    <div className="flex flex-col gap-5">
      <header>
        <h1 className="text-xl font-bold text-[var(--tx)]">學習路徑</h1>
        <p className="mt-1 text-xs leading-relaxed text-[var(--mu)]">
          {stages.length} 站 · {progress.totalCount} 章 · {totalQuestions} 題
        </p>
        <p className="mt-2 text-xs leading-relaxed text-[var(--mu)] max-w-[var(--measure)]">
          這條路徑<span className="font-semibold text-[var(--tx)]">不照文法章節的編號順序</span>。
          筆記是按主題歸檔的，方便查；這裡是按「先學會什麼、後面才學得動」重排的，方便學。
          每一站都寫了它為什麼排在這個位置。
        </p>
      </header>

      {/* 下一步：整條路徑上第一個還沒達標的章節 */}
      <NextStepCard progress={progress} overallRate={overallRate} />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] lg:items-start">
        {/*
          左欄索引。top-20 對齊 TopNav 的 57px 高度。
          刻意不是「兩欄並排卡片」：路徑有先後順序，左右交錯閱讀會破壞它；
          索引 ＋ 內容既填滿了寬度又保住順序。
        */}
        <nav aria-label="學習路徑索引" className="hidden lg:sticky lg:top-20 lg:block">
          <ol className="flex flex-col gap-0.5 rounded-2xl border border-[var(--ln)] bg-[var(--sf)] p-2">
            {progress.stages.map((sp) => {
              const done = sp.nextChapterId === null
              const current = sp.stage.id === progress.currentStageId && progress.next !== null
              return (
                <li key={sp.stage.id}>
                  <a
                    href={`#stage-${sp.stage.id}`}
                    aria-current={current ? 'step' : undefined}
                    className={cn(
                      'flex min-h-11 items-center gap-2.5 rounded-xl px-2.5 text-xs transition-colors',
                      current
                        ? 'bg-[var(--pr-sf)] font-bold text-[var(--pr)]'
                        : 'text-[var(--mu)] hover:bg-[var(--sf2)] hover:text-[var(--tx)]'
                    )}
                  >
                    <span className="w-5 shrink-0 text-right tabular-nums">{sp.stage.order}</span>
                    <span className="min-w-0 flex-1 truncate">{sp.stage.title}</span>
                    {/* 完成狀態只用主色，不用綠色——綠色專屬於答題對錯回饋 */}
                    <span className="shrink-0 tabular-nums text-[11px] text-[var(--fa)]">
                      {done ? '✓' : `${sp.achievedCount}/${sp.totalCount}`}
                    </span>
                  </a>
                </li>
              )
            })}
          </ol>
        </nav>

        <ol className="flex flex-col">
          {progress.stages.map((sp, index) => {
            const { stage } = sp
            const isOpen = expanded.has(stage.id)
            const isCurrent = stage.id === progress.currentStageId && progress.next !== null
            const isDone = sp.nextChapterId === null
            const isLast = index === progress.stages.length - 1
            const questionCount = questionCounts[stage.id] ?? 0

            return (
              <li key={stage.id} id={`stage-${stage.id}`} className="relative pl-10 sm:pl-12">
                {/* 站點編號與連接線 */}
                <span
                  aria-hidden
                  className={cn(
                    'absolute left-0 top-3 flex h-7 w-7 items-center justify-center rounded-full border text-[11px] font-bold transition-colors sm:h-8 sm:w-8 sm:text-xs',
                    isDone
                      ? 'border-[var(--pr)] bg-[var(--pr)] text-[var(--pr-tx)]'
                      : isCurrent
                        ? 'border-[var(--pr)] bg-[var(--pr-sf)] text-[var(--pr)]'
                        : 'border-[var(--ln)] bg-[var(--sf)] text-[var(--mu)]'
                  )}
                >
                  {stage.order}
                </span>
                {!isLast && (
                  <span
                    aria-hidden
                    className={cn(
                      'absolute left-[13px] top-11 bottom-0 w-px sm:left-4 sm:top-12',
                      isDone ? 'bg-[var(--pr)]' : 'bg-[var(--ln)]'
                    )}
                  />
                )}

                <section
                  className={cn(
                    'mb-3 overflow-hidden rounded-2xl border bg-[var(--sf)] transition-colors',
                    isCurrent ? 'border-[var(--pr-ln)]' : 'border-[var(--ln)]'
                  )}
                >
                  <button
                    type="button"
                    onClick={() => toggle(stage.id)}
                    aria-expanded={isOpen}
                    className="flex w-full items-center gap-3 p-4 text-left transition-colors hover:bg-[var(--sf2)]"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5">
                        <span className="truncate text-sm font-semibold text-[var(--tx)]">
                          {stage.title}
                        </span>
                        {isDone && (
                          // 完成是進度，用主色；綠色專屬於「這一題答對了」。
                          <CheckCircle2
                            className="h-3.5 w-3.5 shrink-0 text-[var(--pr)]"
                            aria-label="這一站已完成"
                          />
                        )}
                        {isCurrent && (
                          <span className="shrink-0 rounded-full border border-[var(--pr-ln)] bg-[var(--pr-sf)] px-1.5 py-px text-[10px] font-bold text-[var(--pr)]">
                            目前
                          </span>
                        )}
                      </span>
                      <span className="mt-0.5 block truncate text-[11px] text-[var(--mu)]">
                        {stage.subtitle}
                      </span>
                      <span className="mt-1.5 block text-[11px] text-[var(--mu)]">
                        {sp.totalCount} 章 · {questionCount} 題
                        {sp.hasPracticed ? ` · ${sp.achievedCount}/${sp.totalCount} 完成` : ' · 尚未開始'}
                      </span>
                    </span>

                    {sp.hasPracticed && (
                      <span className="w-14 shrink-0 sm:w-16">
                        <span className="block h-1.5 w-full overflow-hidden rounded-full bg-[var(--sf2)]">
                          <span
                            className="block h-full rounded-full bg-[var(--pr)] transition-all duration-300"
                            style={{ width: `${sp.rate}%` }}
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
                    <div className="animate-fade-in border-t border-[var(--ln)]">
                      <div className="space-y-2.5 px-4 py-3.5">
                        <p className="text-xs leading-relaxed text-[var(--tx)]">
                          <span className="font-semibold">學完會做到：</span>
                          {stage.goal}
                        </p>
                        <p className="text-xs leading-relaxed text-[var(--mu)]">
                          <span className="font-semibold text-[var(--fa)]">為什麼排在這裡：</span>
                          {stage.why}
                        </p>
                      </div>

                      <ul className="border-t border-[var(--ln)]">
                        {stage.chapterIds.map((chapterId, chapterIndex) => (
                          <ChapterRow
                            key={chapterId}
                            chapterId={chapterId}
                            step={chapterIndex + 1}
                            isNext={chapterId === progress.next?.chapterId}
                            isAchieved={isChapterAchieved(chapterId, achievements)}
                          />
                        ))}
                      </ul>

                      <div className="flex flex-wrap items-center gap-2 border-t border-[var(--ln)] px-4 py-3">
                        <Link
                          href={`/practice/grammar?stage=${encodeURIComponent(stage.id)}`}
                          className="flex min-h-[44px] items-center rounded-lg border border-[var(--pr-ln)] bg-[var(--pr-sf)] px-3 py-1.5 text-xs font-bold text-[var(--pr)] transition-colors hover:border-[var(--pr)]"
                        >
                          這一站綜合測驗 {STAGE_QUIZ_COUNT} 題
                        </Link>
                        {stage.extraPractice && (
                          <Link
                            href={stage.extraPractice.href}
                            className="flex min-h-[44px] items-center px-1 text-xs font-semibold text-[var(--pr)] hover:opacity-80"
                          >
                            {stage.extraPractice.label} →
                          </Link>
                        )}
                      </div>
                    </div>
                  )}
                </section>
              </li>
            )
          })}
        </ol>
      </div>

      <p className="px-1 pb-2 text-[11px] leading-relaxed text-[var(--fa)]">
        章節在路徑上的順序跟
        <Link href="/chapters" className="text-[var(--pr)] hover:opacity-80">
          文法章節
        </Link>
        頁的編號不同，但點進去是同一章；完成的判準也一樣，都是練這章單輪正確率 80% 以上。
      </p>
    </div>
  )
}

function NextStepCard({
  progress,
  overallRate,
}: {
  progress: PathProgress
  overallRate: number
}) {
  if (!progress.next) {
    return (
      <section className="rounded-2xl border border-[var(--pr-ln)] bg-[var(--pr-sf)] p-4">
        <h2 className="text-sm font-bold text-[var(--tx)]">十站都完成了</h2>
        <p className="mt-1 text-xs leading-relaxed text-[var(--mu)]">
          {progress.totalCount} 章全部達標。接下來用整份計時模擬考驗收，錯的題會回到錯題本。
        </p>
        <Link
          href="/practice/mock"
          className="mt-3 inline-flex min-h-[44px] items-center rounded-lg bg-[var(--pr)] px-3.5 py-1.5 text-xs font-bold text-[var(--pr-tx)] transition-opacity hover:opacity-90"
        >
          去做模擬考
        </Link>
      </section>
    )
  }

  const { stage, chapterId } = progress.next
  const chapterNumber = getChapterNumber(chapterId)

  return (
    <section className="rounded-2xl border border-[var(--pr-ln)] bg-[var(--pr-sf)] p-4">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-sm font-bold text-[var(--tx)]">下一步</h2>
        <span className="shrink-0 text-[11px] text-[var(--mu)]">
          {progress.achievedCount}/{progress.totalCount} 章 · {overallRate}%
        </span>
      </div>
      <p className="mt-1.5 text-xs text-[var(--mu)]">
        第 {stage.order} 站 · {stage.title}
      </p>
      <p className="mt-0.5 text-[15px] font-semibold text-[var(--tx)]">
        {pathChapterTitle(chapterId)}
      </p>
      {chapterNumber !== null && (
        <p className="mt-0.5 text-[11px] text-[var(--fa)]">章節頁的第 {chapterNumber} 章</p>
      )}
      <Link
        href={pathChapterHref(chapterId)}
        className="mt-3 inline-flex min-h-[44px] items-center rounded-lg bg-[var(--pr)] px-3.5 py-1.5 text-xs font-bold text-[var(--pr-tx)] transition-opacity hover:opacity-90"
      >
        開始這一章
      </Link>
    </section>
  )
}

function ChapterRow({
  chapterId,
  step,
  isNext,
  isAchieved,
}: {
  chapterId: string
  step: number
  isNext: boolean
  isAchieved: boolean
}) {
  const chapter = getChapterById(chapterId)
  const chapterNumber = getChapterNumber(chapterId)
  const questionCount = getGrammarQuestionsByChapter(chapterId).length

  return (
    <li>
      <Link
        href={pathChapterHref(chapterId)}
        className={cn(
          'flex items-center gap-3 border-b border-[var(--ln)] px-4 py-3 transition-colors last:border-b-0 hover:bg-[var(--sf2)]',
          isNext && 'bg-[var(--sf2)]'
        )}
      >
        <span className="w-4 shrink-0 font-mono text-[11px] text-[var(--fa)]">{step}</span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5">
            <span className="truncate text-[13px] text-[var(--tx)]">
              {pathChapterTitle(chapterId)}
            </span>
            {chapter?.quickTips && (
              <Zap className="h-3 w-3 shrink-0 text-[var(--pr)]" aria-label="含秒殺公式" />
            )}
            {isAchieved && (
              <CheckCircle2
                className="h-3.5 w-3.5 shrink-0 text-[var(--pr)]"
                aria-label="已完成 (練這章單輪正確率 80% 以上)"
              />
            )}
          </span>
          <span className="mt-0.5 block text-[11px] text-[var(--fa)]">
            {chapterNumber !== null && `第 ${chapterNumber} 章 · `}
            {questionCount} 題
          </span>
        </span>
        {isNext && (
          <span className="shrink-0 rounded-lg border border-[var(--pr-ln)] bg-[var(--pr-sf)] px-2 py-1 text-[11px] font-bold text-[var(--pr)]">
            從這裡開始
          </span>
        )}
      </Link>
    </li>
  )
}

function PathSkeleton() {
  return (
    <div className="flex animate-pulse flex-col gap-4">
      <div className="h-10 w-40 rounded-md bg-[var(--sf2)]" />
      <div className="h-28 rounded-2xl bg-[var(--sf2)]" />
      {[0, 1, 2, 3, 4].map((i) => (
        <div key={i} className="h-[92px] rounded-2xl bg-[var(--sf2)]" />
      ))}
    </div>
  )
}
