'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Award, Target, Flame, BookOpen, ListChecks } from 'lucide-react'
import {
  getAnswerHistory,
  getCategoryStats,
  getDailyProgress,
  getPracticeCalendar,
  getPracticedDayCount,
  getProfile,
  getVocabMasteryMap,
  getWrongQuestionList,
  type CalendarDay,
  type CategoryStat,
} from '../../lib/storage'
import { getCategories } from '../../lib/content'
import { estimateToeicScore } from '../../lib/toeicScore'
import { RadarChart, type RadarAxis } from '../../components/RadarChart'
import { PracticeCalendar } from '../../components/PracticeCalendar'
import { WeaknessCards } from '../../components/WeaknessCards'
import { Button } from '../../components/ui/Button'

/** 設計 06 空狀態：低於這個題數還看不出弱項，直接給下一步而不是空圖。 */
const MIN_TOTAL_FOR_ANALYSIS = 10
/** 設計 06：雷達圖每類至少 3 題才算有樣本。 */
const MIN_PER_CATEGORY = 3

interface StatsSnapshot {
  stats: CategoryStat[]
  calendar: CalendarDay[]
  totalAnswered: number
  totalCorrect: number
  vocabCount: number
  streak: number
  practicedDays: number
  wrongCountByCategory: Record<string, number>
  chapterCountByCategory: Record<string, number>
  scoreDelta: number | null
  targetScore: number
}

function buildSnapshot(): StatsSnapshot {
  const stats = getCategoryStats()
  const history = getAnswerHistory()
  const vocabMap = getVocabMasteryMap()
  const progress = getDailyProgress()

  const totalAnswered = stats.reduce((acc, cur) => acc + cur.totalAnswered, 0)
  const totalCorrect = stats.reduce((acc, cur) => acc + cur.correctCount, 0)

  const wrongCountByCategory: Record<string, number> = {}
  const chapterSets: Record<string, Set<string>> = {}
  for (const record of getWrongQuestionList()) {
    wrongCountByCategory[record.categoryId] = (wrongCountByCategory[record.categoryId] ?? 0) + 1
    const hashAt = record.questionId.indexOf('#')
    if (hashAt > 0) {
      const set = chapterSets[record.categoryId] ?? new Set<string>()
      set.add(record.questionId.slice(0, hashAt))
      chapterSets[record.categoryId] = set
    }
  }
  const chapterCountByCategory: Record<string, number> = {}
  for (const [cat, set] of Object.entries(chapterSets)) chapterCountByCategory[cat] = set.size

  // 設計 05 的「近 30 天 +45」：拿「30 天前為止」的估分跟現在比。
  const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000
  const older = history.filter((e) => e.timestamp < cutoff)
  let scoreDelta: number | null = null
  if (older.length > 0 && totalAnswered > older.length) {
    const olderCorrect = older.filter((e) => e.isCorrect).length
    const before = estimateToeicScore({
      totalAnswered: older.length,
      overallAccuracy: Math.round((olderCorrect / older.length) * 100),
    })
    const now = estimateToeicScore({
      totalAnswered,
      overallAccuracy: Math.round((totalCorrect / totalAnswered) * 100),
    })
    if (before.score !== null && now.score !== null) scoreDelta = now.score - before.score
  }

  return {
    stats,
    calendar: getPracticeCalendar(84),
    totalAnswered,
    totalCorrect,
    vocabCount: Object.values(vocabMap).filter((v) => v.level >= 2).length,
    streak: progress.streak,
    practicedDays: getPracticedDayCount(),
    wrongCountByCategory,
    chapterCountByCategory,
    scoreDelta,
    targetScore: getProfile().targetScore,
  }
}

export default function StatsPage() {
  const [snap, setSnap] = useState<StatsSnapshot | null>(null)

  useEffect(() => {
    setSnap(buildSnapshot())
  }, [])

  if (!snap) return <StatsSkeleton />

  const overallAccuracy =
    snap.totalAnswered > 0 ? Math.round((snap.totalCorrect / snap.totalAnswered) * 100) : 0

  const scoreData = estimateToeicScore({
    totalAnswered: snap.totalAnswered,
    overallAccuracy,
    vocabMasteryRate:
      snap.vocabCount > 0 ? Math.min(100, Math.round((snap.vocabCount / 352) * 100)) : 0,
  })

  const statByCategory = new Map(snap.stats.map((s) => [s.categoryId, s]))
  const categories = getCategories()
  const axes: RadarAxis[] = categories.map((cat) => ({
    label: cat.shortTitle,
    value: statByCategory.get(cat.id)?.accuracyRate ?? 0,
  }))
  const thinCategories = categories.filter(
    (cat) => (statByCategory.get(cat.id)?.totalAnswered ?? 0) < MIN_PER_CATEGORY
  )

  const hasAnalysis = snap.totalAnswered >= MIN_TOTAL_FOR_ANALYSIS
  const gapToTarget = scoreData.score !== null ? snap.targetScore - scoreData.score : null

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-baseline justify-between">
        <h1 className="text-xl font-bold text-[var(--tx)]">統計</h1>
        <span className="text-xs text-[var(--mu)]">近 30 天</span>
      </div>

      {/* 分數與四個關鍵數字 */}
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,2fr)]">
        <div className="flex items-center justify-between gap-4 rounded-2xl border border-[var(--ln)] bg-[var(--sf)] p-5">
          <div className="min-w-0 space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold tracking-wider text-[var(--mu)]">
                預估 TOEIC 分數
              </span>
              {scoreData.score !== null && (
                <span
                  className="rounded-full border px-2 py-0.5 text-[11px] font-bold"
                  style={{
                    borderColor: scoreData.certificateColor,
                    color: scoreData.certificateColor,
                  }}
                >
                  {scoreData.certificateBadge}
                </span>
              )}
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-[var(--pr)]">
                {scoreData.displayScore}
              </span>
              <span className="text-sm text-[var(--mu)]">/ 990</span>
              {snap.scoreDelta !== null && snap.scoreDelta !== 0 && (
                <span className="text-xs font-bold text-[var(--pr)]">
                  近 30 天 {snap.scoreDelta > 0 ? '+' : ''}
                  {snap.scoreDelta}
                </span>
              )}
            </div>
            <p className="text-xs text-[var(--mu)]">
              {gapToTarget !== null && gapToTarget > 0
                ? `目標 ${snap.targetScore} · 差 ${gapToTarget} 分`
                : gapToTarget !== null
                  ? `已達成目標 ${snap.targetScore}`
                  : scoreData.description}
            </p>
          </div>
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[var(--pr-sf)] text-[var(--pr)]">
            <Award className="h-6 w-6" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatTile icon={<Target className="h-4 w-4" />} label="總答題數" value={snap.totalAnswered} />
          <StatTile
            icon={<ListChecks className="h-4 w-4" />}
            label="正確率"
            value={`${overallAccuracy}%`}
          />
          <StatTile icon={<BookOpen className="h-4 w-4" />} label="已掌握單字" value={snap.vocabCount} />
          <StatTile icon={<Flame className="h-4 w-4" />} label="連續天數" value={snap.streak} />
        </div>
      </div>

      {hasAnalysis ? (
        <div className="grid gap-5 lg:grid-cols-2">
          <section className="flex flex-col justify-between space-y-3 rounded-2xl border border-[var(--ln)] bg-[var(--sf)] p-5">
            <h2 className="text-sm font-bold text-[var(--tx)]">六大文法類別正確率</h2>
            <div className="flex flex-1 items-center justify-center py-2">
              <RadarChart axes={axes} size={320} className="w-full max-w-[340px]" />
            </div>
            {thinCategories.length > 0 && (
              <p className="text-center text-[11px] text-[var(--fa)]">
                {thinCategories.map((c) => c.shortTitle).join('、')} 尚未滿 {MIN_PER_CATEGORY} 題，數值僅供參考
              </p>
            )}
          </section>

          <section className="space-y-3">
            <div className="flex items-baseline justify-between px-1">
              <h2 className="text-sm font-bold text-[var(--tx)]">弱項類別 · 點擊直接練</h2>
              <span className="text-[11px] text-[var(--mu)]">依正確率排序</span>
            </div>
            <WeaknessCards
              stats={snap.stats}
              wrongCountByCategory={snap.wrongCountByCategory}
              chapterCountByCategory={snap.chapterCountByCategory}
            />
          </section>
        </div>
      ) : (
        <section className="flex flex-col items-center gap-3 rounded-2xl border border-[var(--ln)] bg-[var(--sf)] px-6 py-10 text-center">
          <h2 className="text-base font-bold text-[var(--tx)]">
            再練 {MIN_TOTAL_FOR_ANALYSIS - snap.totalAnswered} 題就能看到弱項分析
          </h2>
          <p className="text-xs text-[var(--mu)]">
            目前已答 {snap.totalAnswered} 題 · 雷達圖需要每類至少 {MIN_PER_CATEGORY} 題
          </p>
          <Link href="/practice/grammar" className="w-full max-w-[240px] pt-1">
            <Button variant="primary">開始文法練習</Button>
          </Link>
        </section>
      )}

      <section className="space-y-3 rounded-2xl border border-[var(--ln)] bg-[var(--sf)] p-5">
        <div className="flex items-baseline justify-between">
          <h2 className="text-sm font-bold text-[var(--tx)]">練習日曆 · 近 12 週</h2>
          <span className="text-[11px] text-[var(--mu)]">累計 {snap.practicedDays} 天</span>
        </div>
        <PracticeCalendar days={snap.calendar} />
      </section>
    </div>
  )
}

function StatTile({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode
  label: string
  value: React.ReactNode
}) {
  return (
    <div className="rounded-2xl border border-[var(--ln)] bg-[var(--sf)] p-3.5">
      <div className="flex items-center gap-1.5 text-xs text-[var(--mu)]">
        {icon}
        {label}
      </div>
      <div className="mt-1 text-lg font-bold text-[var(--tx)]">{value}</div>
    </div>
  )
}

/** 設計 01：載入用骨架而非轉圈。 */
function StatsSkeleton() {
  return (
    <div className="flex animate-pulse flex-col gap-5">
      <div className="h-6 w-24 rounded-md bg-[var(--sf2)]" />
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,2fr)]">
        <div className="h-28 rounded-2xl bg-[var(--sf2)]" />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-[74px] rounded-2xl bg-[var(--sf2)]" />
          ))}
        </div>
      </div>
      <div className="h-72 rounded-2xl bg-[var(--sf2)]" />
    </div>
  )
}
