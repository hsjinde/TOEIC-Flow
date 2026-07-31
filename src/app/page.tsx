'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { BookOpen, ChevronRight, FileText, Flame, Sparkles, Zap } from 'lucide-react'
import {
  getCategoryStats,
  getDailyProgress,
  getPracticeCalendar,
  getPracticedDayCount,
  getProfile,
  getVocabMasteryMap,
  getWeakVocabStats,
  getWrongQuestionList,
  type CalendarDay,
  type CategoryStat,
  type DailyProgress,
} from '../lib/storage'
import { getCategoryLabel, getFormulaCards, getVocabById } from '../lib/content'
import { estimateToeicScore } from '../lib/toeicScore'
import { ProgressRing } from '../components/ui/ProgressRing'
import { DailyTaskCard } from '../components/DailyTaskCard'
import { PracticeCalendar } from '../components/PracticeCalendar'
import { ThemeToggle } from '../components/ThemeToggle'
import { Button } from '../components/ui/Button'
import { EntryCard } from '../components/EntryCard'
import { GraduationDots } from '../components/GraduationDots'

/** 設計 01：15 分鐘 ≒ 單字 10 個＋文法 5 題＋閱讀 1 篇。 */
const TASKS = [
  {
    key: 'vocab' as const,
    title: '單字複習',
    subtitle: '10 個 · 約 4 分鐘',
    minutes: 4,
    href: '/practice/vocab',
    icon: <BookOpen className="h-5 w-5" />,
    shortcut: '1',
  },
  {
    key: 'grammar' as const,
    title: '文法練習',
    subtitle: '5 題 · 約 6 分鐘',
    minutes: 6,
    href: '/practice/grammar',
    icon: <Sparkles className="h-5 w-5" />,
    shortcut: '2',
  },
  {
    key: 'reading' as const,
    title: '閱讀理解',
    subtitle: '1 篇 · 約 5 分鐘',
    minutes: 5,
    href: '/practice/reading',
    icon: <FileText className="h-5 w-5" />,
    shortcut: '3',
  },
]

interface HomeSnapshot {
  progress: DailyProgress
  wrongCount: number
  wrongPreview: { categoryId: string; count: number }[]
  stats: CategoryStat[]
  calendar: CalendarDay[]
  practicedDays: number
  vocabCount: number
  weakVocabCount: number
  /** 卡片上直接秀出來的前幾個弱點單字 */
  weakVocabPreview: string[]
  totalAnswered: number
  totalCorrect: number
  reminderTime: string
  reminderEnabled: boolean
  formulaCardCount: number
}

function buildSnapshot(): HomeSnapshot {
  const wrongList = getWrongQuestionList()
  const byCategory: Record<string, number> = {}
  for (const w of wrongList) byCategory[w.categoryId] = (byCategory[w.categoryId] ?? 0) + 1

  const stats = getCategoryStats()
  const profile = getProfile()
  const weakVocab = getWeakVocabStats()

  return {
    progress: getDailyProgress(),
    wrongCount: wrongList.filter((w) => w.consecutiveCorrect < 2).length,
    wrongPreview: Object.entries(byCategory)
      .map(([categoryId, count]) => ({ categoryId, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 3),
    stats,
    calendar: getPracticeCalendar(84),
    practicedDays: getPracticedDayCount(),
    vocabCount: Object.values(getVocabMasteryMap()).filter((v) => v.level >= 2).length,
    weakVocabCount: weakVocab.length,
    weakVocabPreview: weakVocab
      .slice(0, 3)
      .map((s) => getVocabById(s.vocabId)?.word)
      .filter((w): w is string => !!w),
    totalAnswered: stats.reduce((a, c) => a + c.totalAnswered, 0),
    totalCorrect: stats.reduce((a, c) => a + c.correctCount, 0),
    reminderTime: profile.reminderTime,
    reminderEnabled: profile.reminderEnabled,
    formulaCardCount: getFormulaCards().length,
  }
}

export default function HomePage() {
  const router = useRouter()
  const [snap, setSnap] = useState<HomeSnapshot | null>(null)

  useEffect(() => {
    setSnap(buildSnapshot())

    const handleUpdate = () => {
      setSnap(buildSnapshot())
    }
    window.addEventListener('toeic_storage_update', handleUpdate)
    window.addEventListener('storage', handleUpdate)
    return () => {
      window.removeEventListener('toeic_storage_update', handleUpdate)
      window.removeEventListener('storage', handleUpdate)
    }
  }, [])

  const doneMap = snap
    ? {
        vocab: snap.progress.vocabCompleted,
        grammar: snap.progress.grammarCompleted,
        reading: snap.progress.readingCompleted,
      }
    : null

  // 設計 11：數字鍵 1–3 直接開啟對應任務。
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return
      const task = TASKS.find((t) => t.shortcut === e.key)
      if (task) router.push(task.href)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [router])

  if (!snap || !doneMap) return <HomeSkeleton />

  const completedCount = TASKS.filter((t) => doneMap[t.key]).length
  const remainingMinutes = TASKS.filter((t) => !doneMap[t.key]).reduce((a, t) => a + t.minutes, 0)
  const allDone = completedCount === TASKS.length

  const weakest = [...snap.stats].sort((a, b) => a.accuracyRate - b.accuracyRate)[0]
  const nextTask = TASKS.find((t) => !doneMap[t.key])

  const overallAccuracy =
    snap.totalAnswered > 0 ? Math.round((snap.totalCorrect / snap.totalAnswered) * 100) : 0
  const scoreData = estimateToeicScore({ totalAnswered: snap.totalAnswered, overallAccuracy })

  return (
    <div className="flex flex-col gap-5">
      {/* 標題列 */}
      <div className="flex items-center justify-between gap-2 overflow-hidden">
        <div className="min-w-0 shrink">
          <h1 className="truncate text-lg font-bold text-[var(--tx)] sm:text-xl">今日任務</h1>
          <p className="mt-0.5 truncate text-xs text-[var(--mu)]">
            {new Date().toLocaleDateString('zh-TW', {
              month: 'long',
              day: 'numeric',
              weekday: 'long',
            })}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
          <div className="lg:hidden">
            <ThemeToggle compact />
          </div>
          <span className="flex shrink-0 items-center gap-1 rounded-full border border-[var(--pr-ln)] bg-[var(--pr-sf)] px-2.5 py-1 text-xs font-bold text-[var(--pr)] sm:px-3 sm:py-1.5 sm:text-sm">
            <Flame className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            {snap.progress.streak} 天
          </span>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] lg:items-start">
        {/* 左欄：任務流程 */}
        <div className="flex flex-col gap-4 min-w-0">
          <section className="flex flex-col items-center gap-3 rounded-2xl border border-[var(--ln)] bg-[var(--sf)] px-4 py-6 sm:px-5 sm:py-8">
            <ProgressRing completed={completedCount} total={TASKS.length} size={168} strokeWidth={11} />
            {allDone ? (
              <div className="animate-fade-in space-y-1 text-center">
                <p className="text-sm font-semibold text-[var(--tx)]">今天的 15 分鐘做完了</p>
                <p className="text-xs text-[var(--mu)]">
                  連續第 {snap.progress.streak} 天
                  {snap.reminderEnabled && ` · 明天 ${snap.reminderTime} 提醒你`}
                </p>
              </div>
            ) : (
              <p className="text-xs text-[var(--mu)]">再 {remainingMinutes} 分鐘就完成今天</p>
            )}

            {/* 下一步任務與按鈕 */}
            {!allDone && nextTask && (
              <div className="flex w-full max-w-sm flex-col gap-2 pt-2">
                <p className="text-center text-xs leading-relaxed text-[var(--mu)]">
                  {weakest
                    ? `今天的重點是${getCategoryLabel(weakest.categoryId)}。這一類目前正確率 ${weakest.accuracyRate}%，練完 5 題會重新估分。`
                    : '完成三項任務後就能看到第一份弱項分析。'}
                </p>
                <Link href={nextTask.href} className="w-full">
                  <Button variant="primary" className="w-full">
                    繼續{nextTask.title}
                    <span className="hidden text-xs opacity-70 lg:inline ml-1.5">{nextTask.shortcut}</span>
                  </Button>
                </Link>
              </div>
            )}
          </section>

          <section className="flex flex-col gap-2.5 min-w-0">
            <div className="flex items-baseline justify-between px-1">
              <h2 className="text-xs font-bold tracking-wider text-[var(--fa)]">今日練習任務</h2>
              <span className="hidden text-[11px] text-[var(--fa)] lg:inline">
                數字鍵 1–3 可直接開啟
              </span>
            </div>
            {TASKS.map((task) => (
              <DailyTaskCard
                key={task.key}
                title={task.title}
                subtitle={task.subtitle}
                icon={task.icon}
                completed={doneMap[task.key]}
                href={task.href}
                resultText={`已完成 · 約 ${task.minutes} 分`}
                shortcut={task.shortcut}
              />
            ))}
          </section>

          {/* 設計 01：錯題本入口卡 */}
          {snap.wrongCount > 0 && (
            <EntryCard
              href="/wrong-questions"
              title="錯題本"
              badge={`${snap.wrongCount} 題待複習`}
              action="開始複習"
              description={
                <>
                  {snap.wrongPreview
                    .map((p) => `${getCategoryLabel(p.categoryId)} ${p.count}`)
                    .join(' · ')}
                  {' · 連續答對 2 次'}
                  <GraduationDots
                    consecutiveCorrect={2}
                    className="ml-1 inline-block align-middle text-[11px]"
                  />
                  {' 畢業'}
                </>
              }
            />
          )}

          {/* 常錯／到期的單字，跟錯題本同一種入口卡 */}
          {snap.weakVocabCount > 0 && (
            <EntryCard
              href="/vocab-review"
              title="單字複習本"
              badge={`${snap.weakVocabCount} 個字要加強`}
              action="開始複習"
              description={
                snap.weakVocabPreview.length > 0
                  ? `${snap.weakVocabPreview.join(' · ')}${snap.weakVocabCount > snap.weakVocabPreview.length ? ' …' : ''}`
                  : '常錯與該複習的字都收在這裡'
              }
            />
          )}

          {/*
            章節速查卡不綁三項每日任務，通勤情境是「隨時想刷就刷」，所以跟錯題本／
            單字複習本一樣是常駐入口卡，不放進下面「全部完成後」才出現的加練區。
          */}
          <EntryCard
            href="/practice/formulas"
            title="章節速查卡"
            icon={<Zap className="h-3.5 w-3.5 text-[var(--pr)]" />}
            action="開始刷卡"
            description={`${snap.formulaCardCount} 張決策樹＋用法總表 · 一章一張，通勤也能刷`}
          />

          {/*
            首頁只放「今天要做的事」，其餘功能一律收在練習中心。沒有這條連結的話，
            那些依條件才出現的卡片（錯題本、弱點單字、模擬考）不出現時，使用者會以為
            這個 App 就只有三項任務。
          */}
          <Link
            href="/practice"
            className="flex min-h-[44px] items-center justify-center gap-1 rounded-2xl border border-dashed border-[var(--ln)] px-4 text-xs font-semibold text-[var(--mu)] transition-colors hover:border-[var(--pr-ln)] hover:text-[var(--pr)]"
          >
            看全部練習方式 · 模擬考、章節、學習路徑 <ChevronRight className="h-3.5 w-3.5" />
          </Link>

          {/* 設計 01：全部完成後低調的加練入口 */}
          {allDone && (
            <section className="animate-fade-in space-y-2.5">
              <h2 className="px-1 text-xs font-bold tracking-wider text-[var(--fa)]">還想練？</h2>
              <div className="grid gap-2.5 sm:grid-cols-2">
                <Link
                  href="/practice/mock"
                  className="rounded-2xl border border-[var(--ln)] bg-[var(--sf)] p-4 text-sm text-[var(--tx)] transition-colors hover:border-[var(--pr-ln)]"
                >
                  模擬考
                  <span className="mt-0.5 block text-xs text-[var(--mu)]">整份計時測驗</span>
                </Link>
                {snap.weakVocabCount > 0 && (
                  <Link
                    href="/practice/vocab?mode=weak"
                    className="rounded-2xl border border-[var(--ln)] bg-[var(--sf)] p-4 text-sm text-[var(--tx)] transition-colors hover:border-[var(--pr-ln)]"
                  >
                    弱點單字
                    <span className="mt-0.5 block text-xs text-[var(--mu)]">
                      常錯與該複習的 {snap.weakVocabCount} 個字
                    </span>
                  </Link>
                )}
                {weakest && (
                  <Link
                    href={`/practice/grammar?category=${encodeURIComponent(weakest.categoryId)}`}
                    className="rounded-2xl border border-[var(--ln)] bg-[var(--sf)] p-4 text-sm text-[var(--tx)] transition-colors hover:border-[var(--pr-ln)]"
                  >
                    弱項加練 · {getCategoryLabel(weakest.categoryId)}
                    <span className="mt-0.5 block text-xs text-[var(--mu)]">
                      正確率 {weakest.accuracyRate}%
                    </span>
                  </Link>
                )}
              </div>
            </section>
          )}
        </div>

        {/* 右欄：長期進度與預估分數卡片 */}
        <aside className="flex flex-col gap-4">
          <section className="space-y-3 rounded-2xl border border-[var(--ln)] bg-[var(--sf)] p-5">
            <div className="flex items-baseline justify-between">
              <h2 className="text-sm font-bold text-[var(--tx)]">練習日曆</h2>
              <span className="text-[11px] text-[var(--mu)]">{snap.practicedDays} 天</span>
            </div>
            <PracticeCalendar days={snap.calendar.slice(-42)} cellSize={22} />
          </section>

          <section className="rounded-2xl border border-[var(--ln)] bg-[var(--sf)] p-5">
            <h2 className="text-sm font-bold text-[var(--tx)]">預估分數</h2>
            <p className="mt-1 text-3xl font-extrabold text-[var(--pr)]">{scoreData.displayScore}</p>
            <p className="mt-0.5 text-xs text-[var(--mu)]">{scoreData.levelName}</p>
            <div className="mt-4 grid grid-cols-3 gap-2 border-t border-[var(--ln)] pt-4 text-center">
              <MiniStat label="總答題" value={snap.totalAnswered} />
              <MiniStat label="正確率" value={`${overallAccuracy}%`} />
              <MiniStat label="單字" value={snap.vocabCount} />
            </div>
          </section>

          {snap.stats.length > 0 && (
            <section className="space-y-2 rounded-2xl border border-[var(--ln)] bg-[var(--sf)] p-5">
              <h2 className="text-sm font-bold text-[var(--tx)]">弱項</h2>
              {[...snap.stats]
                .sort((a, b) => a.accuracyRate - b.accuracyRate)
                .slice(0, 3)
                .map((s) => (
                  <Link
                    key={s.categoryId}
                    href={`/practice/grammar?category=${encodeURIComponent(s.categoryId)}`}
                    className="flex min-h-[44px] items-center justify-between gap-2 text-xs text-[var(--mu)] hover:text-[var(--tx)]"
                  >
                    <span className="truncate">{getCategoryLabel(s.categoryId)}</span>
                    <span className="shrink-0 font-bold text-[var(--tx)]">{s.accuracyRate}%</span>
                  </Link>
                ))}
              <Link
                href="/stats"
                className="flex min-h-[44px] items-center text-xs font-semibold text-[var(--pr)] hover:opacity-80"
              >
                看完整統計 →
              </Link>
            </section>
          )}
        </aside>
      </div>
    </div>
  )
}

function MiniStat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-sm font-bold text-[var(--tx)]">{value}</div>
      <div className="text-[11px] text-[var(--mu)]">{label}</div>
    </div>
  )
}

function HomeSkeleton() {
  return (
    <div className="flex animate-pulse flex-col gap-5">
      <div className="h-10 w-40 rounded-md bg-[var(--sf2)]" />
      <div className="h-[248px] rounded-2xl bg-[var(--sf2)]" />
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-[72px] rounded-2xl bg-[var(--sf2)]" />
      ))}
    </div>
  )
}
