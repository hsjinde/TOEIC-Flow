'use client'

import React, { useState } from 'react'
import type { ReadingPassage } from '../../scripts/build-content/types'
import { Button } from './ui/Button'
import { ExplanationCard } from './ExplanationCard'
import { recordQuestionAnswer } from '../lib/storage'
import { Check, X } from 'lucide-react'

interface ReadingPassageViewProps {
  passage: ReadingPassage
  onComplete: () => void
}

export const ReadingPassageView: React.FC<ReadingPassageViewProps> = ({ passage, onComplete }) => {
  const [activeTab, setActiveTab] = useState<'passage' | 'questions'>('passage')
  const [currentQIndex, setCurrentQIndex] = useState(0)
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, string>>({})
  const [showExplanation, setShowExplanation] = useState(false)

  const currentQ = passage.questions[currentQIndex]
  const currentBlank = currentQ?.blanks[0]
  const selectedKey = currentQ ? selectedAnswers[currentQ.id] : undefined

  const handleSelectOption = (optionKey: string) => {
    if (!currentQ || selectedKey) return
    const next = { ...selectedAnswers, [currentQ.id]: optionKey }
    setSelectedAnswers(next)

    const isCorrect = optionKey === currentBlank?.answer
    recordQuestionAnswer(currentQ.id, passage.id, isCorrect)

    if (!isCorrect) {
      setShowExplanation(true)
    }
  }

  const handleNextQuestion = () => {
    if (currentQIndex + 1 < passage.questions.length) {
      setCurrentQIndex((prev) => prev + 1)
      setShowExplanation(false)
    } else {
      onComplete()
    }
  }

  return (
    <div className="flex flex-col gap-4 w-full">
      {/* Tab Selector for Mobile (文章 / 題目) */}
      <div className="grid grid-cols-2 p-1 rounded-xl bg-muted text-xs font-semibold">
        <button
          onClick={() => setActiveTab('passage')}
          className={`py-2 rounded-lg transition-all ${
            activeTab === 'passage' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'
          }`}
        >
          📄 閱讀文章
        </button>
        <button
          onClick={() => setActiveTab('questions')}
          className={`py-2 rounded-lg transition-all ${
            activeTab === 'questions' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'
          }`}
        >
          ✍️ 題目 ({currentQIndex + 1}/{passage.questions.length})
        </button>
      </div>

      {/* Content Area */}
      {activeTab === 'passage' ? (
        <div className="p-5 rounded-2xl bg-card border border-muted text-sm leading-relaxed space-y-4 max-h-[60vh] overflow-y-auto">
          <h3 className="font-bold text-base text-primary">{passage.title}</h3>
          <div className="whitespace-pre-line text-foreground/90 font-serif">{passage.passage}</div>
          <Button variant="secondary" onClick={() => setActiveTab('questions')} className="mt-4 text-xs">
            前往回答題目 ➔
          </Button>
        </div>
      ) : currentQ && currentBlank ? (
        <div className="space-y-4">
          <div className="p-4 rounded-2xl bg-card border border-muted">
            <div className="text-xs text-primary font-semibold mb-1">題目 {currentQ.number}</div>
            <p className="text-base font-medium">{currentQ.stem}</p>
          </div>

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
                  onClick={() => handleSelectOption(opt.key)}
                  disabled={!!selectedKey}
                  className="justify-start px-4 text-left py-3"
                >
                  <span className="w-6 text-xs font-semibold opacity-70">({opt.key})</span>
                  <span className="flex-1 text-sm">{opt.text}</span>
                  {selectedKey && isCorrect && (
                    <span className="text-xs text-correct flex items-center gap-1 font-bold">
                      <Check className="w-3.5 h-3.5" /> 正確
                    </span>
                  )}
                  {selectedKey && isSelected && !isCorrect && (
                    <span className="text-xs text-wrong flex items-center gap-1 font-bold">
                      <X className="w-3.5 h-3.5" /> 錯誤
                    </span>
                  )}
                </Button>
              )
            })}
          </div>

          {selectedKey && currentQ.explanation && (
            <div>
              <button
                onClick={() => setShowExplanation(!showExplanation)}
                className="text-xs text-muted-foreground py-1"
              >
                {showExplanation ? '▲ 隱藏詳解' : '▼ 查看詳解'}
              </button>
              {showExplanation && <ExplanationCard explanation={currentQ.explanation} />}
            </div>
          )}

          {selectedKey && (
            <Button variant="primary" onClick={handleNextQuestion} className="mt-4">
              {currentQIndex + 1 < passage.questions.length ? '下一題' : '完成閱讀練習'}
            </Button>
          )}
        </div>
      ) : null}
    </div>
  )
}
