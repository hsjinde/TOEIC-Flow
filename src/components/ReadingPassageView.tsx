'use client'

import React, { useCallback, useEffect, useState } from 'react'
import { Check, ChevronDown, ChevronUp, X } from 'lucide-react'
import type { ReadingPassage } from '../../scripts/build-content/types'
import { recordQuestionAnswer } from '../lib/storage'
import { resolveStem } from '../lib/stem'
import { Button } from './ui/Button'
import { ExplanationCard } from './ExplanationCard'
import { GlossaryText } from './GlossaryText'
import { cn } from '../lib/utils'

interface ReadingPassageViewProps {
  passage: ReadingPassage
  onComplete: (correctCount: number) => void
}

export const ReadingPassageView: React.FC<ReadingPassageViewProps> = ({ passage, onComplete }) => {
  const [activeTab, setActiveTab] = useState<'passage' | 'questions'>(
    passage.passage ? 'passage' : 'questions'
  )
  const [currentQIndex, setCurrentQIndex] = useState(0)
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, string>>({})
  const [showExplanation, setShowExplanation] = useState(false)
  const [correctCount, setCorrectCount] = useState(0)
  const [glossaryCount, setGlossaryCount] = useState(0)

  const currentQ = passage.questions[currentQIndex]
  const currentBlank = currentQ?.blanks[0]
  const selectedKey = currentQ ? selectedAnswers[currentQ.id] : undefined

  const handleSelectOption = useCallback(
    (optionKey: string) => {
      if (!currentQ || !currentBlank || selectedAnswers[currentQ.id]) return
      setSelectedAnswers((prev) => ({ ...prev, [currentQ.id]: optionKey }))

      const isCorrect = optionKey === currentBlank.answer
      // categoryId 要用題目自己的分類，之前誤傳 passage.id 會污染統計。
      recordQuestionAnswer(currentQ.id, currentQ.categoryId, isCorrect, {
        selectedKey: optionKey,
        source: 'reading',
      })

      if (isCorrect) setCorrectCount((c) => c + 1)
      // 判定後不自動展開詳解：先給一行結論，要細節由使用者自己展開。
    },
    [currentQ, currentBlank, selectedAnswers]
  )

  const handleNextQuestion = useCallback(() => {
    if (currentQIndex + 1 < passage.questions.length) {
      setCurrentQIndex((prev) => prev + 1)
      setShowExplanation(false)
      setActiveTab('questions')
    } else {
      onComplete(correctCount)
    }
  }, [currentQIndex, passage.questions.length, onComplete, correctCount])

  // 設計 13：鍵盤 1–4 選答、空白鍵下一題。
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return
      if (!currentQ || !currentBlank) return

      if (['1', '2', '3', '4'].includes(e.key) && !selectedAnswers[currentQ.id]) {
        const option = currentBlank.options[Number(e.key) - 1]
        if (option) handleSelectOption(option.key)
      } else if ((e.code === 'Space' || e.key === ' ') && selectedAnswers[currentQ.id]) {
        e.preventDefault()
        handleNextQuestion()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [currentQ, currentBlank, selectedAnswers, handleSelectOption, handleNextQuestion])

  const passageBox = passage.passage ? (
    // dvh 而非 vh：手機瀏覽器工具列收合時 vh 不會跟著變，文章框會比實際可視區高一截。
    <div className="flex max-h-[58dvh] flex-col overflow-hidden rounded-2xl border border-[var(--ln)] bg-[var(--sf)] lg:max-h-[calc(100dvh-13rem)]">
      {passage.title && (
        <h3 className="shrink-0 border-b border-[var(--ln)] px-5 py-3 text-xs font-bold tracking-wider text-[var(--mu)]">
          {passage.title}
        </h3>
      )}
      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
        <GlossaryText text={passage.passage} onGlossaryCount={setGlossaryCount} />
      </div>
      <p className="shrink-0 border-t border-[var(--ln)] px-5 py-2 text-[11px] text-[var(--mu)]">
        點擊底線單字看釋義 · 本篇難字 {glossaryCount} 個
      </p>
    </div>
  ) : null

  const questionBox =
    currentQ && currentBlank ? (
      <div className="space-y-4">
        <div className="rounded-2xl border border-[var(--ln)] bg-[var(--sf)] p-4">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-[var(--pr)]">第 {currentQ.number} 題</span>
            <span className="text-[var(--mu)]">
              {currentQIndex + 1} / {passage.questions.length}
            </span>
          </div>
          <p className="mt-2 font-option text-[var(--tx)]">
            {resolveStem(currentQ.stem, currentQ.number, passage.passage)}
          </p>
        </div>

        <div className="grid gap-2.5">
          {currentBlank.options.map((opt, idx) => {
            const isSelected = selectedKey === opt.key
            const isCorrect = opt.key === currentBlank.answer

            let variant: 'outline' | 'correct' | 'wrong' = 'outline'
            if (selectedKey) {
              if (isCorrect) variant = 'correct'
              else if (isSelected) variant = 'wrong'
            }

            return (
              <Button
                key={opt.key}
                variant={variant}
                onClick={() => handleSelectOption(opt.key)}
                softDisabled={!!selectedKey}
                className="justify-start px-4 text-left font-option"
              >
                <span className="w-6 text-xs font-semibold opacity-70">({opt.key})</span>
                <span className="flex-1">{opt.text}</span>
                {selectedKey && isCorrect && (
                  <span className="flex items-center gap-1 text-xs font-bold">
                    <Check className="h-3.5 w-3.5" /> 正解
                  </span>
                )}
                {selectedKey && isSelected && !isCorrect && (
                  <span className="flex items-center gap-1 text-xs font-bold">
                    <X className="h-3.5 w-3.5" /> 你的答案
                  </span>
                )}
                {!selectedKey && (
                  <span className="hidden rounded border border-[var(--ln)] px-1.5 text-[11px] text-[var(--mu)] lg:inline">
                    {idx + 1}
                  </span>
                )}
              </Button>
            )
          })}
        </div>

        {/* 選項作答後變成 aria-disabled，結果靠這條 live region 主動播報。 */}
        <p role="status" aria-live="polite" className="sr-only">
          {selectedKey &&
            (selectedKey === currentBlank.answer
              ? `答對，正解 ${currentBlank.answer}`
              : `答錯，你選了 ${selectedKey}，正解 ${currentBlank.answer}`)}
        </p>

        {selectedKey && currentQ.explanation && (
          <div className="space-y-2">
            <p className="text-xs leading-relaxed text-[var(--mu)]">
              <span className="font-semibold text-[var(--tx)]">正解 ({currentBlank.answer})</span>
              {' — '}
              {currentQ.explanation.grammarPoint ?? currentQ.explanation.title}
            </p>
            <button
              type="button"
              onClick={() => setShowExplanation(!showExplanation)}
              aria-expanded={showExplanation}
              className="flex min-h-[44px] items-center gap-1 text-xs text-[var(--mu)] hover:text-[var(--tx)]"
            >
              {showExplanation ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
              {showExplanation ? '收合詳解' : '看完整詳解'} · {currentQ.explanation.title}
            </button>
            {showExplanation && (
              <ExplanationCard explanation={currentQ.explanation} answerKey={currentBlank.answer} />
            )}
          </div>
        )}

        {/* 手機把主要動作釘在拇指區，詳解再長也不會把「下一題」推出視窗。 */}
        {selectedKey && (
          <div className="sticky bottom-[var(--nav-h)] z-30 -mx-4 border-t border-[var(--ln)] bg-[var(--bg)]/95 px-4 pb-3 pt-3 backdrop-blur-md lg:static lg:z-auto lg:mx-0 lg:border-0 lg:bg-transparent lg:p-0 lg:backdrop-blur-none">
            <Button variant="primary" onClick={handleNextQuestion}>
              {currentQIndex + 1 < passage.questions.length ? '下一題' : '完成閱讀練習'}
              <span className="hidden text-xs opacity-70 lg:inline">SPACE</span>
            </Button>
          </div>
        )}

        <p className="hidden text-[11px] text-[var(--mu)] lg:block">
          數字鍵 1–4 選答 · 空白鍵下一題
        </p>
      </div>
    ) : null

  return (
    <div className="w-full">
      {/* 手機：文章／題組雙頁籤，各自擁有整個螢幕（設計 04） */}
      {passageBox && (
        <div
          role="tablist"
          aria-label="閱讀檢視"
          className="mb-4 flex rounded-xl border border-[var(--ln)] bg-[var(--sf)] p-1 lg:hidden"
        >
          <button
            role="tab"
            id="reading-tab-passage"
            aria-selected={activeTab === 'passage'}
            aria-controls="reading-tabpanel"
            onClick={() => setActiveTab('passage')}
            className={cn(
              'min-h-[44px] flex-1 rounded-lg text-xs font-semibold transition-colors',
              activeTab === 'passage'
                ? 'bg-[var(--pr-sf)] text-[var(--pr)]'
                : 'text-[var(--mu)] hover:text-[var(--tx)]'
            )}
          >
            文章
          </button>
          <button
            role="tab"
            id="reading-tab-questions"
            aria-selected={activeTab === 'questions'}
            aria-controls="reading-tabpanel"
            onClick={() => setActiveTab('questions')}
            className={cn(
              'min-h-[44px] flex-1 rounded-lg text-xs font-semibold transition-colors',
              activeTab === 'questions'
                ? 'bg-[var(--pr-sf)] text-[var(--pr)]'
                : 'text-[var(--mu)] hover:text-[var(--tx)]'
            )}
          >
            題組 {currentQIndex + 1}/{passage.questions.length}
          </button>
        </div>
      )}

      <div
        id="reading-tabpanel"
        role={passageBox ? 'tabpanel' : undefined}
        aria-labelledby={passageBox ? `reading-tab-${activeTab}` : undefined}
        className="lg:hidden"
      >
        {activeTab === 'passage' && passageBox ? (
          <div className="space-y-3">
            {passageBox}
            <Button variant="primary" onClick={() => setActiveTab('questions')}>
              前往作答
            </Button>
          </div>
        ) : (
          questionBox
        )}
      </div>

      {/* 桌機：左右分欄，文章區獨立滾動（設計 13） */}
      <div
        className={cn(
          'hidden items-start gap-6 lg:grid',
          passageBox ? 'lg:grid-cols-2' : 'lg:grid-cols-1'
        )}
      >
        {passageBox}
        {questionBox}
      </div>
    </div>
  )
}
