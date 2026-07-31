'use client'

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Flag, Grid3x3, X } from 'lucide-react'
import type { MockExam, Question } from '../../../../scripts/build-content/types'
import { getMockExams, getQuestionPassage, getQuestionStem } from '../../../lib/content'
import {
  fileWrongQuestions,
  getProfile,
  recordQuestionAnswer,
  saveMockResult,
  type MockResult,
} from '../../../lib/storage'
import { estimateToeicScore } from '../../../lib/toeicScore'
import { resolveOrigin } from '../../../lib/origin'
import { Button } from '../../../components/ui/Button'
import { MarkdownRenderer } from '../../../components/MarkdownRenderer'
import { MockReportModal, type MockAnswerRow } from '../../../components/MockReportModal'
import { useScrollToTopOnChange } from '../../../lib/scroll'
import { cn } from '../../../lib/utils'

/** 每題配 45 秒，40 題約 30 分鐘，接近 Part 5/6 的實際節奏。 */
const SECONDS_PER_QUESTION = 45
/** 設計 08：最後 5 分鐘才轉為主色細線提示。 */
const URGENT_THRESHOLD_SECONDS = 5 * 60

/**
 * 作答中的暫存。所有狀態原本只活在 useState 裡，被電話打斷、切走 App 再回來就整份
 * 歸零——30 分鐘與 40 題答案一起消失，且事前毫無警告。用 sessionStorage 是刻意的：
 * 分頁關掉就作廢，不會有一份三天前的半成品在下次開啟時跳出來。
 */
const STORAGE_KEY_INFLIGHT = 'toeic_mock_inflight'

interface InflightExam {
  examId: string
  currentIndex: number
  answers: Record<string, string>
  marked: string[]
  spent: Record<string, number>
  remaining: number
}

function formatClock(totalSeconds: number): string {
  const safe = Math.max(0, totalSeconds)
  const m = Math.floor(safe / 60)
  const s = safe % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export default function MockExamPageWrapper() {
  return (
    <Suspense fallback={<MockSkeleton />}>
      <MockExamPage />
    </Suspense>
  )
}

function MockExamPage() {
  const searchParams = useSearchParams()
  // 首頁沒有連到模擬考，唯一入口是練習中心與桌機 TopNav，所以預設出口就是練習中心。
  const origin = resolveOrigin(
    new URLSearchParams(searchParams.toString()),
    { backHref: '/practice', backLabel: '練習中心' }
  )
  const [exam, setExam] = useState<MockExam | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [inflight, setInflight] = useState<InflightExam | null>(null)
  const [confirmingSubmit, setConfirmingSubmit] = useState(false)
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
    setLoaded(true)
    if (!first) return

    const count = first.sections.reduce((a, s) => a + s.questions.length, 0)
    const raw = sessionStorage.getItem(STORAGE_KEY_INFLIGHT)
    if (raw) {
      try {
        const saved = JSON.parse(raw) as InflightExam
        if (saved.examId === first.id && saved.remaining > 0) {
          setInflight(saved)
          setRemaining(saved.remaining)
          return
        }
      } catch {
        // 壞掉的暫存就當作沒有，不要讓它擋住開新的一份。
      }
      sessionStorage.removeItem(STORAGE_KEY_INFLIGHT)
    }
    setRemaining(count * SECONDS_PER_QUESTION)
  }, [])

  // 作答中把導航收起來，並攔截重新整理／關閉分頁。
  useEffect(() => {
    if (!started || report) return
    document.body.dataset.examMode = 'true'
    const onBeforeUnload = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => {
      delete document.body.dataset.examMode
      window.removeEventListener('beforeunload', onBeforeUnload)
    }
  }, [started, report])

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
        // 檢討頁不能只印「題目 16」——那對使用者不構成一道可以檢討的題目。
        displayStem: getQuestionStem(question),
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
    sessionStorage.removeItem(STORAGE_KEY_INFLIGHT)

    setReport({
      rows,
      estimatedScore: estimated.score ?? 0,
      durationSeconds,
      previousCorrect: previous?.correctCount ?? null,
    })
  }, [exam, questions, answers, marked, spent, currentIndex, partOf])

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

  // 閱讀題的文章可以很長，跳題（含答題卡直接跳）之後不回到頂端就會落在上一題的段落中間。
  useScrollToTopOnChange(`${currentIndex}|${started}|${!!report}`)

  // 每次狀態變動就寫回暫存，讓中斷後回來能接續。
  useEffect(() => {
    if (!started || report || !exam) return
    const snapshot: InflightExam = {
      examId: exam.id,
      currentIndex,
      answers,
      marked: [...marked],
      spent,
      remaining,
    }
    sessionStorage.setItem(STORAGE_KEY_INFLIGHT, JSON.stringify(snapshot))
  }, [started, report, exam, currentIndex, answers, marked, spent, remaining])

  const resume = useCallback(() => {
    if (!inflight) return
    setCurrentIndex(inflight.currentIndex)
    setAnswers(inflight.answers)
    setMarked(new Set(inflight.marked))
    setSpent(inflight.spent)
    setRemaining(inflight.remaining)
    setInflight(null)
    setStarted(true)
  }, [inflight])

  const discardInflight = useCallback(() => {
    sessionStorage.removeItem(STORAGE_KEY_INFLIGHT)
    setInflight(null)
    if (exam) {
      const count = exam.sections.reduce((a, s) => a + s.questions.length, 0)
      setRemaining(count * SECONDS_PER_QUESTION)
    }
  }, [exam])

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
  /*
   * Part 6/7 的空格與線索都在文章裡，題幹本身只是「題目 16」這種佔位字串——沒有把
   * 文章印出來，31 題裡有 16 題在畫面上是無從作答的（types.ts 早就寫了「The passage
   * has to be kept or those parts are unanswerable」，只是從沒被讀出來）。
   */
  const currentPassage = currentQ ? getQuestionPassage(currentQ.id) : null

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

  if (!loaded) return <MockSkeleton />

  if (!exam) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-3 rounded-2xl border border-[var(--ln)] bg-[var(--sf)] px-6 py-14 text-center">
        <h2 className="text-base font-bold text-[var(--tx)]">目前沒有可用的模擬考</h2>
        <p className="text-xs text-[var(--mu)]">模擬考題庫是空的，重新建置題庫後再回來。</p>
        <Link href={origin.backHref} className="w-full max-w-[240px] pt-1">
          <Button variant="primary">回到{origin.backLabel}</Button>
        </Link>
      </div>
    )
  }

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
        backHref={origin.backHref}
        backLabel={origin.backLabel}
      />
    )
  }

  // 開始前的說明頁：模擬考一旦開始就不該有導航干擾。
  if (!started) {
    const answeredInflight = inflight ? Object.keys(inflight.answers).length : 0
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-4 rounded-2xl border border-[var(--ln)] bg-[var(--sf)] px-6 py-12 text-center">
        <h1 className="text-xl font-bold text-[var(--tx)]">{exam.title}</h1>

        {inflight ? (
          <>
            <p className="text-sm leading-relaxed text-[var(--mu)]">
              上次有一份沒交的作答
              <br />
              已作答 {answeredInflight} / {questions.length} 題 · 剩餘{' '}
              {formatClock(inflight.remaining)}
            </p>
            <div className="flex w-full max-w-[240px] flex-col gap-2">
              <Button variant="primary" onClick={resume}>
                接續作答
              </Button>
              <Button variant="outline" onClick={discardInflight} className="text-xs">
                放棄並重新開始
              </Button>
            </div>
          </>
        ) : (
          <>
            <p className="text-sm leading-relaxed text-[var(--mu)]">
              {questions.length} 題 · 限時{' '}
              {Math.round((questions.length * SECONDS_PER_QUESTION) / 60)} 分鐘
              <br />
              作答期間不顯示對錯，交卷後一次檢討。
            </p>
            <Button variant="primary" onClick={() => setStarted(true)} className="max-w-[240px]">
              開始作答
            </Button>
          </>
        )}

        <Link href={origin.backHref} className="text-xs text-[var(--mu)] hover:text-[var(--tx)]">
          先回{origin.backLabel}
        </Link>
      </div>
    )
  }

  const answeredCount = Object.keys(answers).length
  const urgent = remaining <= URGENT_THRESHOLD_SECONDS

  return (
    /*
     * 手機把作答區撐滿一屏，讓動作列落到螢幕底部。題幹長度不一，動作列若跟著文字流
     * 走，「下一題」會在每一題之間上下跳——單手拿著考 30 分鐘，拇指得重新找一次位置。
     */
    <div className="mx-auto flex min-h-[calc(100dvh-3.5rem)] w-full max-w-2xl flex-col gap-4 lg:min-h-0">
      {/* 計時器：明顯但不焦慮，最後 5 分鐘才轉主色 */}
      <div className="flex items-center gap-2">
        {/* 導航在考試中被收起來了，離開的出口必須自己提供，而且要帶確認。 */}
        <Link
          href={origin.backHref}
          aria-label="離開模擬考"
          onClick={(e) => {
            if (!window.confirm('離開模擬考？作答會暫存，可以稍後接續。')) e.preventDefault()
          }}
          className="-ml-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-[var(--mu)] hover:bg-[var(--sf2)]"
        >
          <X className="h-5 w-5" />
        </Link>
        {/*
          role=timer 搭配 aria-live=off：每秒播報一次剩餘時間會讓螢幕閱讀器整場不停說話。
          真正需要主動通知的只有進入最後 5 分鐘那一刻，由下面獨立的 live region 說一次。
        */}
        <span
          role="timer"
          aria-live="off"
          aria-label={`剩餘時間 ${formatClock(remaining)}`}
          className={cn(
            'font-mono text-2xl font-bold tabular-nums',
            urgent ? 'text-[var(--pr)]' : 'text-[var(--tx)]'
          )}
        >
          {formatClock(remaining)}
        </span>
        <span className="ml-auto text-sm font-semibold text-[var(--mu)]">
          {currentIndex + 1} / {questions.length}
        </span>
        <button
          type="button"
          onClick={() => setShowGrid((v) => !v)}
          aria-expanded={showGrid}
          className="flex min-h-[44px] shrink-0 items-center gap-1.5 rounded-lg border border-[var(--ln)] px-3 text-xs font-semibold text-[var(--mu)] hover:text-[var(--tx)]"
        >
          {showGrid ? <X className="h-3.5 w-3.5" /> : <Grid3x3 className="h-3.5 w-3.5" />}
          題號一覽
        </button>
      </div>

      <p role="status" aria-live="polite" className="sr-only">
        {urgent && '剩餘時間不到 5 分鐘'}
      </p>

      <div
        className={cn(
          'h-0.5 w-full overflow-hidden rounded-full',
          urgent ? 'bg-[var(--sf2)]' : 'bg-transparent'
        )}
      >
        {urgent && (
          <div
            // 每秒跳一格的離散更新不需要補間；1000ms 的補間也超過全站 300ms 上限。
            className="h-full bg-[var(--pr)]"
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
                aria-label={`第 ${i + 1} 題${answers[q.id] ? '，已作答' : ''}${marked.has(q.id) ? '，已標記' : ''}`}
                aria-current={i === currentIndex ? 'true' : undefined}
                className={cn(
                  'relative flex h-11 w-11 items-center justify-center rounded-lg border text-xs font-semibold',
                  answers[q.id]
                    ? 'border-[var(--pr-ln)] bg-[var(--pr-sf)] text-[var(--pr)]'
                    : 'border-[var(--ln)] text-[var(--mu)]',
                  i === currentIndex && 'ring-2 ring-[var(--pr)]'
                )}
              >
                {i + 1}
                {marked.has(q.id) && (
                  <Flag className="absolute right-1 top-1 h-2.5 w-2.5 text-[var(--mu)]" />
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
          {/*
            Part 6/7 的文章。手機上限 34dvh 並自己捲動，讓題幹與選項一定留在畫面內——
            整篇 1000 字直接展開的話，作答區會被推到兩個螢幕之外。
          */}
          {currentPassage && (
            <div className="flex max-h-[34dvh] flex-col overflow-hidden rounded-2xl border border-[var(--ln)] bg-[var(--sf)] lg:max-h-[42dvh]">
              {currentPassage.title && (
                <h2 className="shrink-0 border-b border-[var(--ln)] px-4 py-2.5 text-xs font-bold tracking-wider text-[var(--mu)]">
                  {currentPassage.title}
                </h2>
              )}
              {/*
                走 MarkdownRenderer 而不是純文字：文章裡有 **粗體** 這類標記，直接印
                會把星號當內文顯示。這裡刻意不用 GlossaryText——考試中不該點一下就有
                中文釋義。
              */}
              <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
                <MarkdownRenderer content={currentPassage.passage} />
              </div>
            </div>
          )}

          <div className="rounded-2xl border border-[var(--ln)] bg-[var(--sf)] p-5">
            <p className="font-stem text-[var(--tx)]">{getQuestionStem(currentQ)}</p>
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
                  <span className="hidden rounded border border-[var(--ln)] px-1.5 text-[11px] text-[var(--mu)] lg:inline">
                    {idx + 1}
                  </span>
                </Button>
              )
            })}
          </div>

          <div className="mt-auto flex flex-wrap items-center gap-2 pt-2 lg:mt-0 lg:pt-0">
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
                'flex min-h-[44px] items-center gap-1.5 rounded-lg border px-3 text-xs font-semibold transition-colors',
                marked.has(currentQ.id)
                  ? 'border-[var(--pr-ln)] bg-[var(--pr-sf)] text-[var(--pr)]'
                  : 'border-[var(--ln)] text-[var(--mu)] hover:text-[var(--tx)]'
              )}
            >
              <Flag className="h-3.5 w-3.5" />
              {marked.has(currentQ.id) ? '已標記' : '標記本題'}
            </button>

            {/*
              原本這裡有「略過」與「下一題」兩顆按鈕，onClick 完全一樣——決策點多一個
              選項卻不多一個結果。未作答就前進本來就是略過，留一顆就好。
            */}
            {currentIndex + 1 < questions.length ? (
              <Button
                variant="primary"
                onClick={() => goTo(currentIndex + 1)}
                className="ml-auto min-h-[44px] w-auto px-5 text-xs"
              >
                下一題
                <span className="hidden opacity-70 lg:inline">SPACE</span>
              </Button>
            ) : (
              <Button
                variant="primary"
                onClick={() => setConfirmingSubmit(true)}
                className="ml-auto min-h-[44px] w-auto px-5 text-xs"
              >
                交卷並看結算
              </Button>
            )}
          </div>

          {/*
            交卷不可撤銷，而未作答的題目一律算錯。原本按下去就直接送出，40 題可以在
            沒有任何提示的情況下交出 28 題空白。確認層的主要動作刻意是「回去作答」。
          */}
          {confirmingSubmit ? (
            <div
              role="alertdialog"
              aria-label="確認交卷"
              className="animate-fade-in rounded-2xl border border-[var(--pr-ln)] bg-[var(--sf)] p-4"
            >
              <p className="text-sm font-bold text-[var(--tx)]">確定要交卷嗎？</p>
              <p className="mt-1 text-xs leading-relaxed text-[var(--mu)]">
                {questions.length - answeredCount > 0
                  ? `尚有 ${questions.length - answeredCount} 題未作答，未作答一律計為答錯。`
                  : `${questions.length} 題都已作答。`}
                交卷後無法返回修改。
              </p>
              <div className="mt-3 flex flex-col gap-2 sm:flex-row-reverse">
                <Button
                  variant="primary"
                  onClick={() => setConfirmingSubmit(false)}
                  className="text-xs sm:flex-1"
                >
                  回去作答
                </Button>
                <Button variant="secondary" onClick={submit} className="text-xs sm:flex-1">
                  確認交卷
                </Button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmingSubmit(true)}
              className="mx-auto min-h-[44px] text-xs text-[var(--mu)] underline-offset-4 hover:underline"
            >
              提前交卷（已作答 {answeredCount} 題）
            </button>
          )}
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
