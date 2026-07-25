'use client'

import { useEffect, useState, useCallback } from 'react'
import { ArrowLeft, ChevronDown, ChevronUp, Check, X } from 'lucide-react'
import Link from 'next/link'
import type { Question } from '../../../../scripts/build-content/types'
import { getRandomGrammarQuestions } from '../../../../src/lib/content'
import { recordTaskCompletion } from '../../../../src/lib/storage'
import { Button } from '../../../../src/components/ui/Button'
import { ExplanationCard } from '../../../../src/components/ExplanationCard'
import { SummaryModal } from '../../../../src/components/SummaryModal'

export default function GrammarPracticePage() {
  const [questions, setQuestions] = useState<Question[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  /** Maps blankIndex -> selected option key ('A' | 'B' | 'C' | 'D') */
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, string>>({})
  const [showExplanation, setShowExplanation] = useState(false)
  const [correctCount, setCorrectCount] = useState(0)
  const [isFinished, setIsFinished] = useState(false)

  useEffect(() => {
    setQuestions(getRandomGrammarQuestions(5))
  }, [])

  const currentQ = questions[currentIndex]

  // Check if all blanks for current question are answered
  const isQuestionAnswered = currentQ
    ? currentQ.blanks.every((_, idx) => !!selectedAnswers[idx])
    : false

  const handleSelectOption = useCallback(
    (blankIndex: number, optionKey: string) => {
      if (selectedAnswers[blankIndex] || !currentQ) return

      const nextAnswers = { ...selectedAnswers, [blankIndex]: optionKey }
      setSelectedAnswers(nextAnswers)

      // If all blanks are now answered, evaluate whole question
      const allDone = currentQ.blanks.every((_, idx) => !!nextAnswers[idx])
      if (allDone) {
        const isAllCorrect = currentQ.blanks.every(
          (blank, idx) => nextAnswers[idx] === blank.answer
        )

        if (isAllCorrect) {
          setCorrectCount((prev) => prev + 1)
        } else {
          setShowExplanation(true)
        }
      }
    },
    [selectedAnswers, currentQ]
  )

  const handleNext = useCallback(() => {
    if (currentIndex + 1 < questions.length) {
      setCurrentIndex((prev) => prev + 1)
      setSelectedAnswers({})
      setShowExplanation(false)
    } else {
      recordTaskCompletion('grammar')
      setIsFinished(true)
    }
  }, [currentIndex, questions.length])

  // Keyboard Shortcuts (for first/single blank)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isFinished || !currentQ) return
      const firstBlank = currentQ.blanks[0]
      if (['1', '2', '3', '4'].includes(e.key) && !selectedAnswers[0] && firstBlank) {
        const optionIndex = Number(e.key) - 1
        const option = firstBlank.options[optionIndex]
        if (option) handleSelectOption(0, option.key)
      } else if (e.code === 'Space' && isQuestionAnswered) {
        e.preventDefault()
        handleNext()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleSelectOption, handleNext, selectedAnswers, isQuestionAnswered, currentQ, isFinished])

  if (!currentQ) return null

  return (
    <div className="flex flex-col justify-between h-full min-h-[80vh]">
      {/* Top Bar */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <Link href="/" className="p-2 -ml-2 rounded-xl text-muted-foreground hover:bg-muted">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <span className="text-sm font-semibold">
            {currentIndex + 1} / {questions.length}
          </span>
        </div>

        {/* Question Stem */}
        <div className="p-5 rounded-3xl bg-card border border-muted/80 shadow-sm mb-6">
          <p className="text-lg font-medium leading-relaxed tracking-wide">
            {currentQ.stem}
          </p>
        </div>

        {/* Blanks & Options */}
        <div className="space-y-6">
          {currentQ.blanks.map((blank, blankIdx) => {
            const userChoice = selectedAnswers[blankIdx]
            const isBlankAnswered = !!userChoice

            return (
              <div key={blankIdx} className="space-y-3">
                {blank.label && (
                  <div className="text-xs font-semibold text-primary px-1">
                    📌 {blank.label}
                  </div>
                )}

                <div className="grid gap-3">
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
                        disabled={isBlankAnswered}
                        className="justify-start px-5 text-left h-auto py-3.5"
                      >
                        <span className="w-6 text-xs font-semibold opacity-70">
                          ({opt.key})
                        </span>
                        <span className="flex-1 text-base">{opt.text}</span>

                        {/* Status Badges */}
                        {isBlankAnswered && isCorrect && (
                          <span className="flex items-center gap-1 text-xs px-2 py-1 rounded bg-correct/20 text-correct font-bold">
                            <Check className="w-3.5 h-3.5" /> 正確答案
                          </span>
                        )}
                        {isBlankAnswered && isSelected && !isCorrect && (
                          <span className="flex items-center gap-1 text-xs px-2 py-1 rounded bg-wrong/20 text-wrong font-bold">
                            <X className="w-3.5 h-3.5" /> 您的選擇
                          </span>
                        )}
                        {!isBlankAnswered && (
                          <span className="text-xs opacity-40">[{idx + 1}]</span>
                        )}
                      </Button>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>

        {/* Explanation Toggle / Content */}
        {isQuestionAnswered && currentQ.explanation && (
          <div className="mt-6">
            <button
              onClick={() => setShowExplanation(!showExplanation)}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground py-1"
            >
              {showExplanation ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              {showExplanation ? '隱藏詳解' : '查看詳解'}
            </button>
            {showExplanation && <ExplanationCard explanation={currentQ.explanation} />}
          </div>
        )}
      </div>

      {/* Bottom Action Bar */}
      {isQuestionAnswered && (
        <div className="pt-6">
          <Button variant="primary" onClick={handleNext}>
            下一題 <span className="text-xs opacity-70">[Space]</span>
          </Button>
        </div>
      )}

      {isFinished && (
        <SummaryModal correctCount={correctCount} totalCount={questions.length} />
      )}
    </div>
  )
}
