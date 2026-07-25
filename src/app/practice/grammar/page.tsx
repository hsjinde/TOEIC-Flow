'use client'

import { useEffect, useState, useCallback } from 'react'
import { ArrowLeft, ChevronDown, ChevronUp } from 'lucide-react'
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
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const [showExplanation, setShowExplanation] = useState(false)
  const [correctCount, setCorrectCount] = useState(0)
  const [isFinished, setIsFinished] = useState(false)

  useEffect(() => {
    setQuestions(getRandomGrammarQuestions(5))
  }, [])

  const currentQ = questions[currentIndex]
  const currentBlank = currentQ?.blanks[0]

  const handleSelect = useCallback((key: string) => {
    if (selectedKey || !currentBlank) return
    setSelectedKey(key)

    const isCorrect = key === currentBlank.answer
    if (isCorrect) {
      setCorrectCount((prev) => prev + 1)
    } else {
      setShowExplanation(true)
    }
  }, [selectedKey, currentBlank])

  const handleNext = useCallback(() => {
    if (currentIndex + 1 < questions.length) {
      setCurrentIndex((prev) => prev + 1)
      setSelectedKey(null)
      setShowExplanation(false)
    } else {
      recordTaskCompletion('grammar')
      setIsFinished(true)
    }
  }, [currentIndex, questions.length])

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isFinished) return
      if (['1', '2', '3', '4'].includes(e.key) && !selectedKey && currentBlank) {
        const optionIndex = Number(e.key) - 1
        const option = currentBlank.options[optionIndex]
        if (option) handleSelect(option.key)
      } else if (e.code === 'Space' && selectedKey) {
        e.preventDefault()
        handleNext()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleSelect, handleNext, selectedKey, currentBlank, isFinished])

  if (!currentQ || !currentBlank) return null

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

        {/* Options Grid */}
        <div className="grid gap-3">
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
                onClick={() => handleSelect(opt.key)}
                disabled={!!selectedKey}
                className="justify-start px-5 text-left h-auto py-3.5"
              >
                <span className="w-6 text-xs font-semibold opacity-70">
                  ({opt.key})
                </span>
                <span className="flex-1 text-base">{opt.text}</span>
                <span className="text-xs opacity-40">[{idx + 1}]</span>
              </Button>
            )
          })}
        </div>

        {/* Explanation Toggle / Content */}
        {selectedKey && currentQ.explanation && (
          <div className="mt-4">
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
      {selectedKey && (
        <div className="pt-4">
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
