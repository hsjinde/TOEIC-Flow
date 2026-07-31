'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Award, Target, Flame, BookOpen, ListChecks } from 'lucide-react'
import {
  getDeduplicatedAnswerHistory,
  getCategoryStats,
  getDailyProgress,
  getPracticeCalendar,
  getPracticedDayCount,
  getProfile,
  getVocabMasteryMap,
  getVocabStats,
  getWrongQuestionList,
  seedDemoData,
  VOCAB_STATUS_LABELS,
  type CalendarDay,
  type CategoryStat,
  type VocabStatus,
} from '../../lib/storage'
import { getCategories, getVocabById } from '../../lib/content'
import { estimateToeicScore } from '../../lib/toeicScore'
import { RadarChart, type RadarAxis } from '../../components/RadarChart'
import { PracticeCalendar } from '../../components/PracticeCalendar'
import { WeaknessCards } from '../../components/WeaknessCards'
import { Button } from '../../components/ui/Button'
import { useIsDesktop } from '../../lib/useIsDesktop'

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
  weakVocab: WeakVocabRow[]
  weakVocabCount: number
}

interface WeakVocabRow {
  vocabId: string
  word: string
  meaning: string
  wrongCount: number
  attempts: number
  accuracyRate: number
  status: VocabStatus
}

/** 統計頁只給前幾個最該複習的字，完整清單在 /vocab-review。 */
const WEAK_VOCAB_PREVIEW = 5

function buildSnapshot(): StatsSnapshot {
  const stats = getCategoryStats()
  const history = getDeduplicatedAnswerHistory()
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

  // 常錯／到期的單字。查不到字的舊紀錄（筆記改過檔名）直接略過。
  const weakVocabStats = getVocabStats().filter((s) => s.status !== 'mastered')
  const weakVocab: WeakVocabRow[] = []
  for (const stat of weakVocabStats) {
    if (weakVocab.length >= WEAK_VOCAB_PREVIEW) break
    const item = getVocabById(stat.vocabId)
    if (!item) continue
    weakVocab.push({
      vocabId: stat.vocabId,
      word: item.word,
      meaning: item.meaning,
      wrongCount: stat.wrongCount,
      attempts: stat.attempts,
      accuracyRate: stat.accuracyRate,
      status: stat.status,
    })
  }

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
    weakVocab,
    weakVocabCount: weakVocabStats.length,
  }
}

export default function StatsPage() {
  const isDesktop = useIsDesktop()
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
          <section className="flex flex-col justify-between space-y-4 rounded-2xl border border-[var(--ln)] bg-[var(--sf)] p-6">
            <h2 className="text-base font-bold text-[var(--tx)]">六大文法類別正確率</h2>
            {/*
              SVG 的文字跟著 viewBox 一起縮。size=500 的圖被塞進 390px 手機時縮到
              0.51 倍，類別標籤實際只有 8px、數值 9px——比熱力圖那個唯一破例的 9px
              還小，而且沒有理由。手機改用較小的 viewBox，縮放比拉回 0.77，標籤回到
              12px 上下。
            */}
            <div className="flex flex-1 items-center justify-center py-2">
              <RadarChart
                axes={axes}
                size={isDesktop ? 500 : 300}
                className="h-auto w-full max-w-[560px]"
              />
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
              from="stats"
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
          <div className="flex flex-col sm:flex-row gap-2.5 w-full max-w-[360px] pt-2">
            <Link href="/practice/grammar?from=stats" className="flex-1">
              <Button variant="primary" className="w-full">開始文法練習</Button>
            </Link>
            <Button
              variant="outline"
              className="flex-1 border-[var(--pr)] text-[var(--pr)] hover:bg-[var(--pr-sf)]"
              onClick={() => {
                seedDemoData()
                setSnap(buildSnapshot())
              }}
            >
              載入示範測試數據
            </Button>
          </div>
        </section>
      )}

      {/* 單字弱點：常錯與該複習的字，完整清單在單字複習本 */}
      {snap.weakVocab.length > 0 && (
        <section className="space-y-3 rounded-2xl border border-[var(--ln)] bg-[var(--sf)] p-5">
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="text-sm font-bold text-[var(--tx)]">最該複習的單字</h2>
            <span className="text-[11px] text-[var(--mu)]">
              共 {snap.weakVocabCount} 個字要加強
            </span>
          </div>
          <ul className="divide-y divide-[var(--ln)]">
            {snap.weakVocab.map((v) => (
              <li key={v.vocabId} className="flex items-center gap-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2">
                    <span className="font-option text-sm font-bold text-[var(--tx)]">{v.word}</span>
                    <span className="rounded-md bg-[var(--pr-sf)] px-1.5 py-0.5 text-[11px] font-bold text-[var(--pr)]">
                      {VOCAB_STATUS_LABELS[v.status]}
                    </span>
                  </p>
                  <p className="mt-0.5 truncate text-[11px] text-[var(--mu)]">{v.meaning}</p>
                </div>
                <span className="shrink-0 text-right text-[11px] text-[var(--mu)]">
                  {v.wrongCount > 0 && (
                    <span className="block font-bold text-[var(--tx)]">錯 {v.wrongCount} 次</span>
                  )}
                  {v.attempts > 0 && <span className="block">正確率 {v.accuracyRate}%</span>}
                </span>
              </li>
            ))}
          </ul>
          <div className="flex flex-col gap-2 pt-1 sm:flex-row">
            <Link href="/practice/vocab?mode=weak&from=stats" className="flex-1">
              <Button variant="primary" className="min-h-[42px] text-xs">
                特別複習這些字
              </Button>
            </Link>
            <Link href="/vocab-review" className="flex-1">
              <Button variant="outline" className="min-h-[42px] text-xs">
                打開單字複習本
              </Button>
            </Link>
          </div>
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
