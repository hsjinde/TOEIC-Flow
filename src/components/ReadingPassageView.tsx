'use client'

import React, { useCallback, useEffect, useState } from 'react'
import { Check, ChevronDown, ChevronUp, X } from 'lucide-react'
import type { ReadingPassage } from '../../scripts/build-content/types'
import { recordQuestionAnswer } from '../lib/storage'
import { Button } from './ui/Button'
import { ExplanationCard } from './ExplanationCard'
import { GlossaryText } from './GlossaryText'
import { cn } from '../lib/utils'

interface ReadingPassageViewProps {
  passage: ReadingPassage
  onComplete: (correctCount: number) => void
}

/** 短文／文章題的 stem 在題庫裡只是「題目 N」佔位字串，沒有內容。 */
export const PLACEHOLDER_STEM = /^題目\s*\d+$/

/**
 * 設計 13：題目要顯示空格所在的那一句，而不是佔位標題。
 * 空格在文章裡標成 `______(N)`，往前後找到句界就是上下文。
 */
export function contextSentence(passageText: string, questionNumber: number): string | null {
  const marker = `______(${questionNumber})`
  const at = passageText.indexOf(marker)
  if (at < 0) return null

  const before = passageText.slice(0, at)
  const after = passageText.slice(at + marker.length)
  const start = Math.max(
    before.lastIndexOf('. '),
    before.lastIndexOf('\n'),
    before.lastIndexOf('? '),
    before.lastIndexOf('! ')
  )
  const endCandidates = ['.', '\n', '?', '!']
    .map((ch) => after.indexOf(ch))
    .filter((i) => i >= 0)
  const end = endCandidates.length > 0 ? Math.min(...endCandidates) : after.length

  const sentence = `${before.slice(start + 1)}___${after.slice(0, end + 1)}`.trim()
  return sentence.length > 0 ? sentence : null
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
      else setShowExplanation(true)
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
    <div className="flex max-h-[58vh] flex-col overflow-hidden rounded-2xl border border-[var(--ln)] bg-[var(--sf)] lg:max-h-[calc(100vh-13rem)]">
      {passage.title && (
        <h3 className="shrink-0 border-b border-[var(--ln)] px-5 py-3 text-xs font-bold tracking-wider text-[var(--mu)]">
          {passage.title}
        </h3>
      )}
      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
        <GlossaryText text={passage.passage} onGlossaryCount={setGlossaryCount} />
      </div>
      <p className="shrink-0 border-t border-[var(--ln)] px-5 py-2 text-[11px] text-[var(--fa)]">
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
            {PLACEHOLDER_STEM.test(currentQ.stem)
              ? (contextSentence(passage.passage, currentQ.number) ?? '請對照左側文章作答')
              : currentQ.stem}
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
                disabled={!!selectedKey}
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
                  <span className="hidden rounded border border-[var(--ln)] px-1.5 text-[10px] text-[var(--fa)] lg:inline">
                    {idx + 1}
                  </span>
                )}
              </Button>
            )
          })}
        </div>

        {selectedKey && currentQ.explanation && (
          <div>
            <button
              type="button"
              onClick={() => setShowExplanation(!showExplanation)}
              className="flex min-h-[36px] items-center gap-1 text-xs text-[var(--mu)] hover:text-[var(--tx)]"
            >
              {showExplanation ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
              詳解 · {currentQ.explanation.title}
            </button>
            {showExplanation && (
              <ExplanationCard explanation={currentQ.explanation} answerKey={currentBlank.answer} />
            )}
          </div>
        )}

        {selectedKey && (
          <Button variant="primary" onClick={handleNextQuestion}>
            {currentQIndex + 1 < passage.questions.length ? '下一題' : '完成閱讀練習'}
            <span className="hidden text-xs opacity-70 lg:inline">SPACE</span>
          </Button>
        )}

        <p className="hidden text-[11px] text-[var(--fa)] lg:block">
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
            aria-selected={activeTab === 'passage'}
            onClick={() => setActiveTab('passage')}
            className={cn(
              'min-h-[38px] flex-1 rounded-lg text-xs font-semibold transition-colors',
              activeTab === 'passage'
                ? 'bg-[var(--pr-sf)] text-[var(--pr)]'
                : 'text-[var(--mu)] hover:text-[var(--tx)]'
            )}
          >
            文章
          </button>
          <button
            role="tab"
            aria-selected={activeTab === 'questions'}
            onClick={() => setActiveTab('questions')}
            className={cn(
              'min-h-[38px] flex-1 rounded-lg text-xs font-semibold transition-colors',
              activeTab === 'questions'
                ? 'bg-[var(--pr-sf)] text-[var(--pr)]'
                : 'text-[var(--mu)] hover:text-[var(--tx)]'
            )}
          >
            題組 {currentQIndex + 1}/{passage.questions.length}
          </button>
        </div>
      )}

      <div className="lg:hidden">
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
