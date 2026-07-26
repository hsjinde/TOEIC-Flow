'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { Flag, Grid3x3, X } from 'lucide-react'
import type { MockExam, Question } from '../../../../scripts/build-content/types'
import { getMockExams } from '../../../lib/content'
import {
  fileWrongQuestions,
  getProfile,
  recordQuestionAnswer,
  saveMockResult,
  type MockResult,
} from '../../../lib/storage'
import { estimateToeicScore } from '../../../lib/toeicScore'
import { Button } from '../../../components/ui/Button'
import { MockReportModal, type MockAnswerRow } from '../../../components/MockReportModal'
import { cn } from '../../../lib/utils'

/** 每題配 45 秒，40 題約 30 分鐘，接近 Part 5/6 的實際節奏。 */
const SECONDS_PER_QUESTION = 45
/** 設計 08：最後 5 分鐘才轉為主色細線提示。 */
const URGENT_THRESHOLD_SECONDS = 5 * 60

function formatClock(totalSeconds: number): string {
  const safe = Math.max(0, totalSeconds)
  const m = Math.floor(safe / 60)
  const s = safe % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export default function MockExamPage() {
  const [exam, setExam] = useState<MockExam | null>(null)
  const [started, setStarted] = useState(false)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [marked, setMarked] = useState<Set<string>>(new Set())
  const [spent, setSpent] = useState<Record<string, number>>({})
  const [remaining, setRemaining] = useState(0)
  const [showGrid, setShowGrid] = useState(false)
  const [report, setReport] = useState<{
    rows: MockAnswerRow[]
    estimatedScore: number
    durationSeconds: number
    previousCorrect: number | null
  } | null>(null)
  const [wrongFiled, setWrongFiled] = useState(false)

  const questionEnterRef = useRef<number>(0)
  const submittedRef = useRef(false)

  useEffect(() => {
    const exams = getMockExams()
    const first = exams[0] ?? null
    setExam(first)
    if (first) {
      const count = first.sections.reduce((a, s) => a + s.questions.length, 0)
      setRemaining(count * SECONDS_PER_QUESTION)
    }
  }, [])

  const questions: Question[] = useMemo(
    () => exam?.sections.flatMap((s) => s.questions) ?? [],
    [exam]
  )

  /**
   * 題目 → 所屬 Part。模擬考題的 categoryId 一律是 'mock'，用它分組只會得到
   * 一列；設計 17 要的是分項表現，Part 才是這份資料真正有的維度。
   */
  const partOf: Record<string, string> = useMemo(() => {
    const map: Record<string, string> = {}
    for (const section of exam?.sections ?? []) {
      // Part 標題含題數說明，取冒號／全形冒號前的部分當短標。
      const label = section.part.split(/[：:]/)[0]?.trim() || section.part
      for (const q of section.questions) map[q.id] = label
    }
    return map
  }, [exam])

  /** 把停留在目前題目的秒數記進 spent，換題與交卷前都要呼叫。 */
  const flushTime = useCallback(() => {
    const q = questions[currentIndex]
    if (!q || !questionEnterRef.current) return
    const delta = Math.round((Date.now() - questionEnterRef.current) / 1000)
    questionEnterRef.current = Date.now()
    if (delta <= 0) return
    setSpent((prev) => ({ ...prev, [q.id]: (prev[q.id] ?? 0) + delta }))
  }, [questions, currentIndex])

  const submit = useCallback(() => {
    if (submittedRef.current || !exam) return
    submittedRef.current = true

    const finalSpent: Record<string, number> = { ...spent }
    const q = questions[currentIndex]
    if (q && questionEnterRef.current) {
      const delta = Math.round((Date.now() - questionEnterRef.current) / 1000)
      if (delta > 0) finalSpent[q.id] = (finalSpent[q.id] ?? 0) + delta
    }

    const rows: MockAnswerRow[] = questions.map((question) => {
      const selectedKey = answers[question.id]
      return {
        question,
        selectedKey,
        isCorrect: !!selectedKey && selectedKey === question.blanks[0]?.answer,
        marked: marked.has(question.id),
        seconds: finalSpent[question.id] ?? 0,
        part: partOf[question.id] ?? '其他',
      }
    })

    // 模擬考期間不即時揭曉答案，歷程一次在交卷時寫入。
    // fileWrong: false — 錯題入本是結算頁的獨立動作（設計 17）。
    for (const row of rows) {
      recordQuestionAnswer(row.question.id, row.question.categoryId, row.isCorrect, {
        ...(row.selectedKey ? { selectedKey: row.selectedKey } : {}),
        source: 'mock',
        fileWrong: false,
      })
    }

    const correctCount = rows.filter((r) => r.isCorrect).length
    const accuracy = rows.length > 0 ? Math.round((correctCount / rows.length) * 100) : 0
    const estimated = estimateToeicScore({ totalAnswered: rows.length, overallAccuracy: accuracy })
    const durationSeconds = Object.values(finalSpent).reduce((a, b) => a + b, 0)

    const result: MockResult = {
      examId: exam.id,
      finishedAt: Date.now(),
      correctCount,
      totalCount: rows.length,
      durationSeconds,
      estimatedScore: estimated.score ?? 0,
    }
    const previous = saveMockResult(result)

    setReport({
      rows,
      estimatedScore: estimated.score ?? 0,
      durationSeconds,
      previousCorrect: previous?.correctCount ?? null,
    })
  }, [exam, questions, answers, marked, spent, currentIndex])

  // 倒數計時；歸零自動交卷。
  useEffect(() => {
    if (!started || report) return
    const id = setInterval(() => {
      setRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(id)
          submit()
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(id)
  }, [started, report, submit])

  useEffect(() => {
    if (started && !report) questionEnterRef.current = Date.now()
  }, [started, currentIndex, report])

  const goTo = useCallback(
    (index: number) => {
      flushTime()
      setCurrentIndex(index)
      setShowGrid(false)
    },
    [flushTime]
  )

  const currentQ = questions[currentIndex]
  const currentBlank = currentQ?.blanks[0]

  const handleSelect = useCallback(
    (optionKey: string) => {
      if (!currentQ) return
      setAnswers((prev) => ({ ...prev, [currentQ.id]: optionKey }))
    },
    [currentQ]
  )

  // 設計 08：數字鍵選答、空白鍵下一題。
  useEffect(() => {
    if (!started || report) return
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return
      if (!currentBlank) return
      if (['1', '2', '3', '4'].includes(e.key)) {
        const option = currentBlank.options[Number(e.key) - 1]
        if (option) handleSelect(option.key)
      } else if (e.code === 'Space' || e.key === ' ') {
        e.preventDefault()
        if (currentIndex + 1 < questions.length) goTo(currentIndex + 1)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [started, report, currentBlank, handleSelect, currentIndex, questions.length, goTo])

  const handleFileWrong = () => {
    if (!report || wrongFiled) return
    fileWrongQuestions(
      report.rows
        .filter((r) => !r.isCorrect)
        .map((r) => ({ questionId: r.question.id, categoryId: r.question.categoryId }))
    )
    setWrongFiled(true)
  }

  if (!exam) return <MockSkeleton />

  if (report) {
    return (
      <MockReportModal
        rows={report.rows}
        estimatedScore={report.estimatedScore}
        targetScore={getProfile().targetScore}
        durationSeconds={report.durationSeconds}
        previousCorrect={report.previousCorrect}
        onFileWrongQuestions={handleFileWrong}
        wrongFiled={wrongFiled}
      />
    )
  }

  // 開始前的說明頁：模擬考一旦開始就不該有導航干擾。
  if (!started) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-4 rounded-2xl border border-[var(--ln)] bg-[var(--sf)] px-6 py-12 text-center">
        <h1 className="text-xl font-bold text-[var(--tx)]">{exam.title}</h1>
        <p className="text-sm leading-relaxed text-[var(--mu)]">
          {questions.length} 題 · 限時 {Math.round((questions.length * SECONDS_PER_QUESTION) / 60)} 分鐘
          <br />
          作答期間不顯示對錯，交卷後一次檢討。
        </p>
        <Button variant="primary" onClick={() => setStarted(true)} className="max-w-[240px]">
          開始作答
        </Button>
        <Link href="/" className="text-xs text-[var(--mu)] hover:text-[var(--tx)]">
          先回今日任務
        </Link>
      </div>
    )
  }

  const answeredCount = Object.keys(answers).length
  const urgent = remaining <= URGENT_THRESHOLD_SECONDS

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
      {/* 計時器：明顯但不焦慮，最後 5 分鐘才轉主色 */}
      <div className="flex items-center justify-between gap-3">
        <span
          className={cn(
            'font-mono text-2xl font-bold tabular-nums',
            urgent ? 'text-[var(--pr)]' : 'text-[var(--tx)]'
          )}
        >
          {formatClock(remaining)}
        </span>
        <span className="text-sm font-semibold text-[var(--mu)]">
          {currentIndex + 1} / {questions.length}
        </span>
        <button
          type="button"
          onClick={() => setShowGrid((v) => !v)}
          aria-expanded={showGrid}
          className="flex min-h-[36px] items-center gap-1.5 rounded-lg border border-[var(--ln)] px-3 text-xs font-semibold text-[var(--mu)] hover:text-[var(--tx)]"
        >
          {showGrid ? <X className="h-3.5 w-3.5" /> : <Grid3x3 className="h-3.5 w-3.5" />}
          題號一覽
        </button>
      </div>

      <div
        className={cn(
          'h-0.5 w-full overflow-hidden rounded-full',
          urgent ? 'bg-[var(--sf2)]' : 'bg-transparent'
        )}
      >
        {urgent && (
          <div
            className="h-full bg-[var(--pr)] transition-all duration-1000 ease-linear"
            style={{ width: `${(remaining / URGENT_THRESHOLD_SECONDS) * 100}%` }}
          />
        )}
      </div>

      {showGrid && (
        <div className="animate-fade-in rounded-2xl border border-[var(--ln)] bg-[var(--sf)] p-4">
          <div className="flex flex-wrap gap-1.5">
            {questions.map((q, i) => (
              <button
                key={q.id}
                type="button"
                onClick={() => goTo(i)}
                className={cn(
                  'relative flex h-8 w-8 items-center justify-center rounded-lg border text-xs font-semibold',
                  answers[q.id]
                    ? 'border-[var(--pr-ln)] bg-[var(--pr-sf)] text-[var(--pr)]'
                    : 'border-[var(--ln)] text-[var(--mu)]',
                  i === currentIndex && 'ring-2 ring-[var(--pr)]'
                )}
              >
                {i + 1}
                {marked.has(q.id) && (
                  <Flag className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 text-[var(--fa)]" />
                )}
              </button>
            ))}
          </div>
          <p className="mt-3 text-[11px] text-[var(--mu)]">
            已作答 {answeredCount} / {questions.length} · 標記 {marked.size} 題
          </p>
        </div>
      )}

      {currentQ && currentBlank && (
        <>
          <div className="rounded-2xl border border-[var(--ln)] bg-[var(--sf)] p-5">
            <p className="font-stem text-[var(--tx)]">{currentQ.stem}</p>
          </div>

          <div className="grid gap-2.5">
            {currentBlank.options.map((opt, idx) => {
              const isSelected = answers[currentQ.id] === opt.key
              return (
                <Button
                  key={opt.key}
                  variant="outline"
                  onClick={() => handleSelect(opt.key)}
                  className={cn(
                    'justify-start px-5 text-left font-option',
                    isSelected && 'border-[var(--pr)] bg-[var(--pr-sf)] text-[var(--pr)]'
                  )}
                >
                  <span className="w-6 text-xs font-semibold opacity-70">({opt.key})</span>
                  <span className="flex-1">{opt.text}</span>
                  <span className="hidden rounded border border-[var(--ln)] px-1.5 text-[10px] text-[var(--fa)] lg:inline">
                    {idx + 1}
                  </span>
                </Button>
              )
            })}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() =>
                setMarked((prev) => {
                  const next = new Set(prev)
                  if (next.has(currentQ.id)) next.delete(currentQ.id)
                  else next.add(currentQ.id)
                  return next
                })
              }
              aria-pressed={marked.has(currentQ.id)}
              className={cn(
                'flex min-h-[40px] items-center gap-1.5 rounded-lg border px-3 text-xs font-semibold transition-colors',
                marked.has(currentQ.id)
                  ? 'border-[var(--pr-ln)] bg-[var(--pr-sf)] text-[var(--pr)]'
                  : 'border-[var(--ln)] text-[var(--mu)] hover:text-[var(--tx)]'
              )}
            >
              <Flag className="h-3.5 w-3.5" />
              {marked.has(currentQ.id) ? '已標記' : '標記本題'}
            </button>

            {currentIndex + 1 < questions.length ? (
              <>
                <button
                  type="button"
                  onClick={() => goTo(currentIndex + 1)}
                  className="min-h-[40px] rounded-lg border border-[var(--ln)] px-3 text-xs font-semibold text-[var(--mu)] hover:text-[var(--tx)]"
                >
                  略過
                </button>
                <Button
                  variant="primary"
                  onClick={() => goTo(currentIndex + 1)}
                  className="ml-auto min-h-[40px] w-auto px-5 text-xs"
                >
                  下一題
                  <span className="hidden opacity-70 lg:inline">SPACE</span>
                </Button>
              </>
            ) : (
              <Button
                variant="primary"
                onClick={submit}
                className="ml-auto min-h-[40px] w-auto px-5 text-xs"
              >
                交卷並看結算
              </Button>
            )}
          </div>

          <button
            type="button"
            onClick={submit}
            className="mx-auto text-xs text-[var(--mu)] underline-offset-4 hover:underline"
          >
            提前交卷（已作答 {answeredCount} 題）
          </button>
        </>
      )}
    </div>
  )
}

function MockSkeleton() {
  return (
    <div className="mx-auto flex w-full max-w-2xl animate-pulse flex-col gap-4">
      <div className="h-9 w-full rounded-md bg-[var(--sf2)]" />
      <div className="h-28 rounded-2xl bg-[var(--sf2)]" />
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="h-[52px] rounded-[10px] bg-[var(--sf2)]" />
      ))}
    </div>
  )
}
