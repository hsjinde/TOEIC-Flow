'use client'

import React, { useMemo, useState } from 'react'
import Link from 'next/link'
import { Check, Flag, Plus } from 'lucide-react'
import type { Question } from '../../scripts/build-content/types'
import { Button } from './ui/Button'
import { ExplanationCard } from './ExplanationCard'
import { cn } from '../lib/utils'

export interface MockAnswerRow {
  question: Question
  /** undefined = 未作答 */
  selectedKey?: string
  isCorrect: boolean
  marked: boolean
  seconds: number
  /** 所屬 Part，模擬考題的 categoryId 全是 'mock'，分項表現只能靠這個 */
  part: string
}

interface MockReportModalProps {
  rows: MockAnswerRow[]
  estimatedScore: number
  targetScore: number
  durationSeconds: number
  /** 上一次的答對題數，沒有前次紀錄則為 null */
  previousCorrect: number | null
  onFileWrongQuestions: () => void
  wrongFiled: boolean
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return m > 0 ? `${m} 分 ${s} 秒` : `${s} 秒`
}

/** 設計 17：分數與預估分在最上，類別表現排序後直接連到逐題檢討。 */
export const MockReportModal: React.FC<MockReportModalProps> = ({
  rows,
  estimatedScore,
  targetScore,
  durationSeconds,
  previousCorrect,
  onFileWrongQuestions,
  wrongFiled,
}) => {
  const [reviewIndex, setReviewIndex] = useState<number | null>(null)

  const correctCount = rows.filter((r) => r.isCorrect).length
  const wrongRows = rows.filter((r) => !r.isCorrect)
  const unanswered = rows.filter((r) => !r.selectedKey).length
  const markedCount = rows.filter((r) => r.marked).length
  const accuracy = rows.length > 0 ? Math.round((correctCount / rows.length) * 100) : 0
  const avgSeconds = rows.length > 0 ? Math.round(durationSeconds / rows.length) : 0
  const gap = targetScore - estimatedScore

  const byPart = useMemo(() => {
    const map: Record<string, { total: number; correct: number }> = {}
    for (const row of rows) {
      const b = map[row.part] ?? { total: 0, correct: 0 }
      b.total += 1
      if (row.isCorrect) b.correct += 1
      map[row.part] = b
    }
    return Object.entries(map)
      .map(([part, v]) => ({ part, ...v, rate: Math.round((v.correct / v.total) * 100) }))
      .sort((a, b) => b.rate - a.rate)
  }, [rows])

  const slowest = useMemo(() => [...rows].sort((a, b) => b.seconds - a.seconds).slice(0, 3), [rows])

  const reviewRow = reviewIndex !== null ? rows[reviewIndex] : null

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-[var(--tx)]">模擬考結算</h1>
          <p className="mt-0.5 text-xs text-[var(--mu)]">
            {new Date().toLocaleDateString('zh-TW', { month: 'long', day: 'numeric' })} · {rows.length} 題 ·
            用時 {formatDuration(durationSeconds)}
          </p>
        </div>
        <div className="flex gap-2">
          {wrongRows.length > 0 && (
            <Button
              variant="outline"
              onClick={onFileWrongQuestions}
              disabled={wrongFiled}
              className="min-h-[40px] w-auto px-3 text-xs"
            >
              {wrongFiled ? (
                <>
                  <Check className="h-3.5 w-3.5" /> 已加入錯題本
                </>
              ) : (
                <>
                  <Plus className="h-3.5 w-3.5" /> 把 {wrongRows.length} 題加入錯題本
                </>
              )}
            </Button>
          )}
          <Button
            variant="primary"
            onClick={() => setReviewIndex(rows.findIndex((r) => !r.isCorrect))}
            className="min-h-[40px] w-auto px-3 text-xs"
          >
            開始逐題檢討
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-[var(--ln)] bg-[var(--sf)] p-4">
          <p className="text-xs text-[var(--mu)]">得分</p>
          <p className="mt-1 text-2xl font-extrabold text-[var(--tx)]">
            {correctCount}
            <span className="text-sm font-normal text-[var(--mu)]"> /{rows.length}</span>
          </p>
          <p className="mt-0.5 text-xs text-[var(--mu)]">
            正確率 {accuracy}%
            {previousCorrect !== null &&
              ` · 比上次 ${correctCount - previousCorrect >= 0 ? '+' : ''}${correctCount - previousCorrect} 題`}
          </p>
        </div>
        <div className="rounded-2xl border border-[var(--ln)] bg-[var(--sf)] p-4">
          <p className="text-xs text-[var(--mu)]">預估 TOEIC 分數</p>
          <p className="mt-1 text-2xl font-extrabold text-[var(--pr)]">{estimatedScore}</p>
          <p className="mt-0.5 text-xs text-[var(--mu)]">
            目標 {targetScore}
            {gap > 0 ? ` · 差 ${gap} 分` : ' · 已達成'}
          </p>
        </div>
        <div className="rounded-2xl border border-[var(--ln)] bg-[var(--sf)] p-4">
          <p className="text-xs text-[var(--mu)]">平均每題</p>
          <p className="mt-1 text-2xl font-extrabold text-[var(--tx)]">{avgSeconds} 秒</p>
        </div>
        <div className="rounded-2xl border border-[var(--ln)] bg-[var(--sf)] p-4">
          <p className="text-xs text-[var(--mu)]">標記／未作答</p>
          <p className="mt-1 text-2xl font-extrabold text-[var(--tx)]">
            {markedCount} <span className="text-sm font-normal text-[var(--mu)]">/ {unanswered}</span>
          </p>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="space-y-2.5 rounded-2xl border border-[var(--ln)] bg-[var(--sf)] p-5">
          <h2 className="text-sm font-bold text-[var(--tx)]">各部分表現</h2>
          {byPart.map((c) => (
            <div key={c.part} className="space-y-1">
              <div className="flex items-baseline justify-between text-xs">
                <span className="truncate text-[var(--tx)]">{c.part}</span>
                <span className="shrink-0 font-bold text-[var(--mu)]">
                  {c.correct}/{c.total}
                </span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--sf2)]">
                <div
                  className="h-full rounded-full bg-[var(--pr)] transition-all duration-300"
                  style={{ width: `${c.rate}%` }}
                />
              </div>
            </div>
          ))}
        </section>

        <section className="space-y-3 rounded-2xl border border-[var(--ln)] bg-[var(--sf)] p-5">
          <div className="flex flex-wrap items-baseline gap-3">
            <h2 className="text-sm font-bold text-[var(--tx)]">題號一覽</h2>
            <span className="flex items-center gap-2 text-[11px] text-[var(--mu)]">
              <Legend color="var(--ok)" label={`正確 ${correctCount}`} />
              <Legend color="var(--bad)" label={`錯誤 ${wrongRows.length}`} />
              <Legend color="var(--fa)" label={`標記 ${markedCount}`} />
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {rows.map((row, i) => (
              <button
                key={row.question.id}
                type="button"
                onClick={() => setReviewIndex(i)}
                title={`第 ${i + 1} 題`}
                className={cn(
                  // hover:scale 是第四個動效場景，不在允許的三處內；改用邊框回饋。
                  'relative flex h-11 w-11 items-center justify-center rounded-lg border text-xs font-semibold transition-colors hover:border-[var(--pr)]',
                  row.isCorrect
                    ? 'border-[var(--ok)] bg-[var(--ok-sf)] text-[var(--ok)]'
                    : 'border-[var(--bad)] bg-[var(--bad-sf)] text-[var(--bad)]',
                  reviewIndex === i && 'ring-2 ring-[var(--pr)]'
                )}
              >
                {i + 1}
                {row.marked && (
                  <Flag className="absolute right-1 top-1 h-2.5 w-2.5 text-[var(--mu)]" />
                )}
              </button>
            ))}
          </div>

          {slowest.length > 0 && slowest[0]!.seconds > 0 && (
            <div className="space-y-1.5 border-t border-[var(--ln)] pt-3">
              <h3 className="text-xs font-bold text-[var(--tx)]">最花時間的三題</h3>
              {slowest.map((row) => (
                <div key={row.question.id} className="flex items-baseline gap-2 text-[11px]">
                  <span className="shrink-0 font-mono text-[var(--mu)]">
                    {rows.indexOf(row) + 1}
                  </span>
                  <span className="line-clamp-1 flex-1 text-[var(--mu)]">{row.question.stem}</span>
                  <span className="shrink-0 font-mono text-[var(--mu)]">
                    {Math.floor(row.seconds / 60)}:{String(row.seconds % 60).padStart(2, '0')}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* 逐題檢討 */}
      {reviewRow && (
        <section className="animate-fade-in space-y-4 rounded-2xl border border-[var(--ln)] bg-[var(--sf)] p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-[var(--tx)]">
              第 {(reviewIndex ?? 0) + 1} 題檢討
            </h2>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={(reviewIndex ?? 0) <= 0}
                onClick={() => setReviewIndex((i) => Math.max(0, (i ?? 0) - 1))}
                className="min-h-[44px] rounded-lg border border-[var(--ln)] px-3 text-xs text-[var(--mu)] disabled:opacity-40"
              >
                上一題
              </button>
              <button
                type="button"
                disabled={(reviewIndex ?? 0) >= rows.length - 1}
                onClick={() => setReviewIndex((i) => Math.min(rows.length - 1, (i ?? 0) + 1))}
                className="min-h-[44px] rounded-lg border border-[var(--ln)] px-3 text-xs text-[var(--mu)] disabled:opacity-40"
              >
                下一題
              </button>
            </div>
          </div>

          <p className="font-stem text-[var(--tx)]">{reviewRow.question.stem}</p>

          <ul className="space-y-1.5">
            {reviewRow.question.blanks[0]?.options.map((opt) => {
              const isAnswer = opt.key === reviewRow.question.blanks[0]?.answer
              const isPicked = opt.key === reviewRow.selectedKey
              return (
                <li
                  key={opt.key}
                  className={cn(
                    'flex items-center gap-2 rounded-lg border px-3 py-2 text-sm',
                    isAnswer
                      ? 'border-[var(--ok)] bg-[var(--ok-sf)] text-[var(--ok)]'
                      : isPicked
                        ? 'border-[var(--bad)] bg-[var(--bad-sf)] text-[var(--bad)]'
                        : 'border-[var(--ln)] text-[var(--tx)]'
                  )}
                >
                  <span className="text-xs font-semibold opacity-70">({opt.key})</span>
                  <span className="flex-1">{opt.text}</span>
                  {isAnswer && <span className="text-[11px] font-bold">正解</span>}
                  {!isAnswer && isPicked && <span className="text-[11px] font-bold">你的答案</span>}
                </li>
              )
            })}
          </ul>

          {reviewRow.question.explanation && (
            <ExplanationCard
              explanation={reviewRow.question.explanation}
              answerKey={reviewRow.question.blanks[0]?.answer}
            />
          )}
        </section>
      )}

      <div className="flex flex-col gap-2 sm:flex-row">
        <Link href="/" className="flex-1">
          <Button variant="outline">返回今日任務</Button>
        </Link>
        <Link href="/stats" className="flex-1">
          <Button variant="primary">看更新後的統計</Button>
        </Link>
      </div>
    </div>
  )
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1">
      <span className="h-2.5 w-2.5 rounded-sm" style={{ background: color }} />
      {label}
    </span>
  )
}
