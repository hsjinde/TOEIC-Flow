'use client'

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { ArrowLeft, Check, ChevronDown, ChevronUp, X } from 'lucide-react'
import type { Question } from '../../../../scripts/build-content/types'
import {
  getCategoryLabel,
  getChapterLabel,
  getGrammarQuestionsByCategory,
  getGrammarQuestionsByChapter,
  getQuestionsByIds,
  getRandomGrammarQuestions,
} from '../../../lib/content'
import {
  getWrongQuestionsMap,
  recordQuestionAnswer,
  recordTaskCompletion,
  type AnswerSource,
} from '../../../lib/storage'
import { Button } from '../../../components/ui/Button'
import { ExplanationCard } from '../../../components/ExplanationCard'
import { SummaryModal } from '../../../components/SummaryModal'
import { GraduationDots } from '../../../components/GraduationDots'
import { cn } from '../../../lib/utils'

const DEFAULT_COUNT = 5

interface Session {
  questions: Question[]
  source: AnswerSource
  /** 只有每日任務模式才記「今日文法已完成」 */
  countsAsDailyTask: boolean
  title: string
}

function buildSession(params: URLSearchParams): Session {
  const mode = params.get('mode')
  const ids = params.get('ids')
  const category = params.get('category')
  const chapter = params.get('chapter')

  if (mode === 'wrong' && ids) {
    const list = getQuestionsByIds(ids.split(',').filter(Boolean))
    return { questions: list, source: 'wrong', countsAsDailyTask: false, title: '錯題專攻' }
  }
  if (chapter) {
    const pool = getGrammarQuestionsByChapter(chapter)
    return {
      questions: [...pool].sort(() => 0.5 - Math.random()).slice(0, DEFAULT_COUNT),
      source: 'grammar',
      countsAsDailyTask: false,
      // 副標已經是章名，標題再放一次會變成同一行講兩遍。
      title: '章節練習',
    }
  }
  if (category) {
    return {
      questions: getGrammarQuestionsByCategory(category, DEFAULT_COUNT),
      source: 'grammar',
      countsAsDailyTask: false,
      title: `弱項加練 · ${getCategoryLabel(category)}`,
    }
  }
  return {
    questions: getRandomGrammarQuestions(DEFAULT_COUNT),
    source: 'grammar',
    countsAsDailyTask: true,
    title: '文法練習',
  }
}

export default function GrammarPracticePageWrapper() {
  return (
    <Suspense fallback={<PracticeSkeleton />}>
      <GrammarPracticePage />
    </Suspense>
  )
}

function GrammarPracticePage() {
  const searchParams = useSearchParams()
  const [session, setSession] = useState<Session | null>(null)
  const [currentIndex, setCurrentIndex] = useState(0)
  /** blankIndex -> 選到的選項字母 */
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, string>>({})
  const [showExplanation, setShowExplanation] = useState(false)
  const [correctCount, setCorrectCount] = useState(0)
  const [results, setResults] = useState<(boolean | null)[]>([])
  const [justFiled, setJustFiled] = useState(false)
  const [isFinished, setIsFinished] = useState(false)

  useEffect(() => {
    const built = buildSession(new URLSearchParams(searchParams.toString()))
    setSession(built)
    setResults(new Array(built.questions.length).fill(null))
  }, [searchParams])

  const questions = session?.questions ?? []
  const currentQ = questions[currentIndex]

  const isQuestionAnswered = currentQ
    ? currentQ.blanks.every((_, idx) => !!selectedAnswers[idx])
    : false

  const verdict: 'correct' | 'wrong' | null = useMemo(() => {
    if (!currentQ || !isQuestionAnswered) return null
    return currentQ.blanks.every((blank, idx) => selectedAnswers[idx] === blank.answer)
      ? 'correct'
      : 'wrong'
  }, [currentQ, isQuestionAnswered, selectedAnswers])

  const handleNext = useCallback(() => {
    setJustFiled(false)
    if (currentIndex + 1 < questions.length) {
      setCurrentIndex((prev) => prev + 1)
      setSelectedAnswers({})
      setShowExplanation(false)
    } else {
      if (session?.countsAsDailyTask) recordTaskCompletion('grammar')
      setIsFinished(true)
    }
  }, [currentIndex, questions.length, session])

  const handleSelectOption = useCallback(
    (blankIndex: number, optionKey: string) => {
      if (selectedAnswers[blankIndex] || !currentQ || !session) return

      const nextAnswers = { ...selectedAnswers, [blankIndex]: optionKey }
      setSelectedAnswers(nextAnswers)

      const allDone = currentQ.blanks.every((_, idx) => !!nextAnswers[idx])
      if (!allDone) return

      const isAllCorrect = currentQ.blanks.every((blank, idx) => nextAnswers[idx] === blank.answer)
      const wasTracked = !!getWrongQuestionsMap()[currentQ.id]

      recordQuestionAnswer(currentQ.id, currentQ.categoryId, isAllCorrect, {
        selectedKey: nextAnswers[0],
        source: session.source,
      })

      setResults((prev) => {
        const next = [...prev]
        next[currentIndex] = isAllCorrect
        return next
      })

      if (isAllCorrect) {
        setCorrectCount((prev) => prev + 1)
      } else {
        // 設計 02：答錯才顯示「已加入錯題本」，本來就在本裡的不重複宣告。
        setJustFiled(!wasTracked)
      }
      // 判定後刻意不自動跳題、也不自動展開詳解：答對的人要來得及看到自己答對了，
      // 答錯的人要先自己想。前進一律由使用者按空白鍵或「下一題」觸發。
    },
    [selectedAnswers, currentQ, session, currentIndex]
  )

  // 設計 02/14：桌機 1/2/3/4 選答、空白鍵下一題。
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isFinished || !currentQ) return
      const target = e.target as HTMLElement | null
      if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return

      const firstBlank = currentQ.blanks[0]
      if (['1', '2', '3', '4'].includes(e.key) && !selectedAnswers[0] && firstBlank) {
        const option = firstBlank.options[Number(e.key) - 1]
        if (option) handleSelectOption(0, option.key)
      } else if ((e.code === 'Space' || e.key === ' ') && isQuestionAnswered) {
        e.preventDefault()
        handleNext()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleSelectOption, handleNext, selectedAnswers, isQuestionAnswered, currentQ, isFinished])

  if (!session) return <PracticeSkeleton />

  if (session.questions.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-[var(--ln)] bg-[var(--sf)] px-6 py-14 text-center">
        <h2 className="text-base font-bold text-[var(--tx)]">這組沒有可練的題目</h2>
        <p className="text-xs text-[var(--mu)]">題目可能已從題庫移除，換一組再試。</p>
        <Link href="/" className="w-full max-w-[240px] pt-1">
          <Button variant="primary">回到今日任務</Button>
        </Link>
      </div>
    )
  }

  if (isFinished || !currentQ) {
    return (
      <SummaryModal
        correctCount={correctCount}
        totalCount={questions.length}
        title={`${session.title}完成`}
      />
    )
  }

  const answeredCount = results.filter((r) => r !== null).length
  // 多空格題有兩組答案，只報第一格會讓「正解 (C)」在雙空格題上是錯的。
  const answerKeys = currentQ.blanks.map((b) => b.answer).join(' · ')
  const chosenKeys = currentQ.blanks.map((_, i) => selectedAnswers[i] ?? '—').join(' · ')

  return (
    <div className="flex flex-col gap-4">
      {/* 頂部：分類 · 章節 · 進度 */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <Link
            href="/"
            aria-label="返回今日任務"
            className="-ml-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-[var(--mu)] hover:bg-[var(--sf2)]"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-[var(--tx)]">{session.title}</p>
            <p className="truncate text-[11px] text-[var(--mu)]">
              {getChapterLabel(currentQ.chapterId)}
            </p>
          </div>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-sm font-bold text-[var(--tx)]">
            {currentIndex + 1} / {questions.length}
          </p>
          <p className="text-[11px] text-[var(--mu)]">
            已作答 {answeredCount} · 正確 {correctCount}
          </p>
        </div>
      </div>

      {/* 本回作答進度（設計 14） */}
      <div className="flex items-center gap-1.5">
        {results.map((r, i) => (
          <span
            key={i}
            aria-hidden
            className={cn(
              'h-1.5 flex-1 rounded-full transition-colors duration-200',
              r === null
                ? i === currentIndex
                  ? 'bg-[var(--pr)]'
                  : 'bg-[var(--sf2)]'
                : r
                  ? 'bg-[var(--ok)]'
                  : 'bg-[var(--bad)]'
            )}
          />
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] lg:items-start">
        {/* 左欄：題幹與選項 */}
        <div className="space-y-5">
          <div className="rounded-2xl border border-[var(--ln)] bg-[var(--sf)] p-5">
            <p className="font-stem text-[var(--tx)]">{currentQ.stem}</p>
          </div>

          <div className="space-y-6">
            {currentQ.blanks.map((blank, blankIdx) => {
              const userChoice = selectedAnswers[blankIdx]
              const isBlankAnswered = !!userChoice

              return (
                <div key={blankIdx} className="space-y-3">
                  {blank.label && (
                    <div className="px-1 text-xs font-semibold text-[var(--pr)]">{blank.label}</div>
                  )}

                  <div className="grid gap-2.5">
                    {blank.options.map((opt, idx) => {
                      const isSelected = userChoice === opt.key
                      const isCorrect = opt.key === blank.answer

                      let variant: 'outline' | 'correct' | 'wrong' = 'outline'
                      if (isBlankAnswered) {
                        if (isCorrect) variant = 'correct'
                        else if (isSelected) variant = 'wrong'
                      }

                      return (
                        <Button
                          key={opt.key}
                          variant={variant}
                          onClick={() => handleSelectOption(blankIdx, opt.key)}
                          softDisabled={isBlankAnswered}
                          className="justify-start px-5 text-left font-option"
                        >
                          <span className="w-6 text-xs font-semibold opacity-70">({opt.key})</span>
                          <span className="flex-1">{opt.text}</span>

                          {isBlankAnswered && isCorrect && (
                            <span className="flex items-center gap-1 text-xs font-bold">
                              <Check className="h-3.5 w-3.5" /> 正解
                            </span>
                          )}
                          {isBlankAnswered && isSelected && !isCorrect && (
                            <span className="flex items-center gap-1 text-xs font-bold">
                              <X className="h-3.5 w-3.5" /> 你的答案
                            </span>
                          )}
                          {/*
                            數字鍵只作用在第一組空格，所以第二組以後不能印按鍵提示——
                            印了等於叫使用者去按一個不會有反應的鍵。
                          */}
                          {!isBlankAnswered && blankIdx === 0 && (
                            <span className="hidden rounded border border-[var(--ln)] px-1.5 text-[11px] text-[var(--mu)] lg:inline">
                              {idx + 1}
                            </span>
                          )}
                        </Button>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>

          <p className="hidden text-[11px] text-[var(--mu)] lg:block">
            數字鍵 1–4 選答 · 空白鍵下一題
          </p>
        </div>

        {/* 右欄：判定與詳解（桌機常駐，手機接在下方） */}
        <div className="space-y-3 lg:sticky lg:top-20">
          {/*
            螢幕閱讀器唯一的結果來源。「正解」「你的答案」寫在選項按鈕裡，而選項作答後
            會變成 aria-disabled，游標不會自動走過去——沒有這條 live region，非視覺
            使用者答完一題後得不到任何對錯訊息。
          */}
          <p role="status" aria-live="polite" className="sr-only">
            {verdict === 'correct' && `答對，正解 ${answerKeys}`}
            {verdict === 'wrong' && `答錯，你選了 ${chosenKeys}，正解 ${answerKeys}`}
          </p>

          {verdict && (
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span
                className={cn(
                  'rounded-md px-2 py-1 font-bold',
                  verdict === 'correct'
                    ? 'bg-[var(--ok-sf)] text-[var(--ok)]'
                    : 'bg-[var(--bad-sf)] text-[var(--bad)]'
                )}
              >
                {verdict === 'correct' ? '答對' : '答錯'}
              </span>
              {verdict === 'wrong' && (
                <span className="flex items-center gap-1.5 text-[var(--mu)]">
                  {justFiled ? '已加入錯題本' : '錯題本已有這題'} · 連續答對 2 次畢業
                  <GraduationDots consecutiveCorrect={0} className="text-sm" />
                </span>
              )}
            </div>
          )}

          {isQuestionAnswered && currentQ.explanation && (
            <div className="space-y-2">
              {/*
                收合狀態下的一行結論。答錯時把整篇詳解推到臉上，只會讓通勤者為了找
                「下一題」而滑過去；先給結論，要細節再自己展開。
              */}
              <p className="text-xs leading-relaxed text-[var(--mu)]">
                <span className="font-semibold text-[var(--tx)]">正解 ({answerKeys})</span>
                {' — '}
                {currentQ.explanation.grammarPoint ?? currentQ.explanation.title}
              </p>
              <button
                type="button"
                onClick={() => setShowExplanation(!showExplanation)}
                aria-expanded={showExplanation}
                className="flex min-h-[44px] items-center gap-1 py-1 text-xs text-[var(--mu)] hover:text-[var(--tx)]"
              >
                {showExplanation ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
                {showExplanation ? '收合詳解' : '看完整詳解'} · {currentQ.explanation.title}
              </button>
              {showExplanation && (
                <ExplanationCard explanation={currentQ.explanation} answerKey={answerKeys} />
              )}
            </div>
          )}

          {!isQuestionAnswered && (
            <p className="hidden rounded-2xl border border-dashed border-[var(--ln)] px-4 py-6 text-center text-xs text-[var(--mu)] lg:block">
              作答後這裡會顯示判定與完整詳解
            </p>
          )}

          {/*
            手機把「下一題」固定在拇指區，詳解再長也不會把主要動作推出視窗；桌機回到
            文件流，因為右欄本來就是 sticky 的。
          */}
          {isQuestionAnswered && (
            <div className="sticky bottom-16 z-30 -mx-4 mt-1 border-t border-[var(--ln)] bg-[var(--bg)] px-4 pb-3 pt-3 lg:static lg:z-auto lg:mx-0 lg:border-0 lg:bg-transparent lg:p-0">
              <Button variant="primary" onClick={handleNext}>
                {currentIndex + 1 < questions.length ? '下一題' : '看本回結果'}
                <span className="hidden text-xs opacity-70 lg:inline">SPACE</span>
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function PracticeSkeleton() {
  return (
    <div className="flex animate-pulse flex-col gap-4">
      <div className="h-9 w-full rounded-md bg-[var(--sf2)]" />
      <div className="h-1.5 w-full rounded-full bg-[var(--sf2)]" />
      <div className="h-28 rounded-2xl bg-[var(--sf2)]" />
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="h-[52px] rounded-[10px] bg-[var(--sf2)]" />
      ))}
    </div>
  )
}
