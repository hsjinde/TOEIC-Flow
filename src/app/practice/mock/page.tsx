'use client'

import { useEffect, useState } from 'react'
import { ArrowLeft, Clock, Check, X } from 'lucide-react'
import Link from 'next/link'
import type { MockExam, Question } from '../../../../scripts/build-content/types'
import { getMockExams } from '../../../../src/lib/content'
import { recordQuestionAnswer } from '../../../../src/lib/storage'
import { Button } from '../../../../src/components/ui/Button'
import { MockReportModal } from '../../../../src/components/MockReportModal'

export default function MockExamPage() {
  const [exam, setExam] = useState<MockExam | null>(null)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [userAnswers, setUserAnswers] = useState<Record<string, string>>({})
  const [timerSeconds, setTimerSeconds] = useState(0)
  const [isFinished, setIsFinished] = useState(false)

  useEffect(() => {
    const exams = getMockExams()
    if (exams.length > 0) setExam(exams[0]!)
  }, [])

  // Timer interval
  useEffect(() => {
    if (isFinished) return
    const interval = setInterval(() => {
      setTimerSeconds((prev) => prev + 1)
    }, 1000)
    return () => clearInterval(interval)
  }, [isFinished])

  if (!exam) return null

  // Flatten all questions across sections
  const questions: Question[] = exam.sections.flatMap((s) => s.questions)
  const currentQ = questions[currentIndex]
  const currentBlank = currentQ?.blanks[0]
  const selectedKey = currentQ ? userAnswers[currentQ.id] : undefined

  const handleSelectOption = (optionKey: string) => {
    if (!currentQ || selectedKey) return
    const next = { ...userAnswers, [currentQ.id]: optionKey }
    setUserAnswers(next)

    const isCorrect = optionKey === currentBlank?.answer
    recordQuestionAnswer(currentQ.id, exam.id, isCorrect)
  }

  const handleNext = () => {
    if (currentIndex + 1 < questions.length) {
      setCurrentIndex((prev) => prev + 1)
    } else {
      setIsFinished(true)
    }
  }

  // Calculate results
  const correctCount = questions.filter(
    (q) => userAnswers[q.id] === q.blanks[0]?.answer
  ).length
  const score = Math.round((correctCount / (questions.length || 1)) * 990)

  const formatTimer = (secs: number) => {
    const m = Math.floor(secs / 60)
    const s = secs % 60
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }

  return (
    <div className="flex flex-col justify-between h-full min-h-[80vh]">
      <div>
        {/* Header Bar */}
        <div className="flex items-center justify-between mb-4">
          <Link href="/" className="p-2 -ml-2 rounded-xl text-muted-foreground hover:bg-muted">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 text-primary font-mono font-semibold text-xs">
            <Clock className="w-3.5 h-3.5" /> {formatTimer(timerSeconds)}
          </div>
          <span className="text-sm font-semibold">
            {currentIndex + 1} / {questions.length}
          </span>
        </div>

        {/* Stem */}
        {currentQ && currentBlank && (
          <div className="space-y-4">
            <div className="p-5 rounded-3xl bg-card border border-muted/80 shadow-sm">
              <span className="text-xs font-semibold text-primary block mb-1">模擬考 · 題目 {currentQ.number}</span>
              <p className="text-lg font-medium leading-relaxed">{currentQ.stem}</p>
            </div>

            {/* Options */}
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
                    className="justify-start px-5 text-left py-3.5"
                  >
                    <span className="w-6 text-xs font-semibold opacity-70">({opt.key})</span>
                    <span className="flex-1 text-base">{opt.text}</span>
                    {selectedKey && isCorrect && (
                      <span className="text-xs text-correct font-bold flex items-center gap-1">
                        <Check className="w-3.5 h-3.5" /> 正確
                      </span>
                    )}
                    {selectedKey && isSelected && !isCorrect && (
                      <span className="text-xs text-wrong font-bold flex items-center gap-1">
                        <X className="w-3.5 h-3.5" /> 錯誤
                      </span>
                    )}
                  </Button>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {selectedKey && (
        <div className="pt-4">
          <Button variant="primary" onClick={handleNext}>
            {currentIndex + 1 < questions.length ? '下一題' : '查看模擬考結算報告'}
          </Button>
        </div>
      )}

      {isFinished && (
        <MockReportModal
          score={score}
          correctCount={correctCount}
          totalCount={questions.length}
          timeSpentSeconds={timerSeconds}
        />
      )}
    </div>
  )
}
