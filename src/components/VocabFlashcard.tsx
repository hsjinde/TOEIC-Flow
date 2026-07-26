'use client'

import React, { useCallback, useEffect, useState } from 'react'
import { RotateCw, Volume2 } from 'lucide-react'
import type { VocabItem } from '../../scripts/build-content/types'
import { getSrsIntervalLabel } from '../lib/storage'
import { splitEmphasis } from '../lib/emphasis'
import { Button } from './ui/Button'
import { MasteryDots } from './MasteryDots'

interface VocabFlashcardProps {
  item: VocabItem
  /** level 1=不會 2=有點難 3=記得（見 storage.updateVocabMastery） */
  onGrade: (level: number) => void
  currentLevel: number
}

/**
 * 例句裡的目標字用星號標起來，渲染時去掉星號但保留強調。
 * 筆記兩種寫法都有（*斜體* 與 **粗體**），只認單星號會把外圈的 * 漏在畫面上。
 */
function renderExample(example: string): React.ReactNode {
  return splitEmphasis(example).map((part, i) =>
    part.emphasised ? (
      <strong key={i} className="font-bold text-[var(--tx)]">
        {part.text}
      </strong>
    ) : (
      <React.Fragment key={i}>{part.text}</React.Fragment>
    )
  )
}

const GRADES = [
  { level: 1, label: '不會' },
  { level: 2, label: '有點難' },
  { level: 3, label: '記得' },
] as const

export const VocabFlashcard: React.FC<VocabFlashcardProps> = ({
  item,
  onGrade,
  currentLevel,
}) => {
  const [isFlipped, setIsFlipped] = useState(false)

  // 換字時一律回到英文正面，否則會直接看到答案。
  useEffect(() => {
    setIsFlipped(false)
  }, [item.id])

  const playSpeech = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel()
        const utterance = new SpeechSynthesisUtterance(item.word)
        utterance.lang = 'en-US'
        utterance.rate = 0.9
        window.speechSynthesis.speak(utterance)
      }
    },
    [item.word]
  )

  return (
    <div className="flex w-full flex-col gap-4">
      <button
        type="button"
        onClick={() => setIsFlipped((v) => !v)}
        aria-label={isFlipped ? '翻回英文面' : '翻到中文釋義'}
        className="flex min-h-[264px] w-full flex-col items-center justify-between gap-4 rounded-2xl border border-[var(--ln)] bg-[var(--sf)] p-6 text-center transition-colors duration-200 hover:border-[var(--pr-ln)]"
      >
        <div className="flex w-full items-center justify-between text-xs text-[var(--mu)]">
          <span className="rounded-md bg-[var(--sf2)] px-2.5 py-1 font-semibold">{item.pos}</span>
          <span
            role="button"
            tabIndex={0}
            onClick={playSpeech}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                e.stopPropagation()
                playSpeech(e as unknown as React.MouseEvent)
              }
            }}
            title="朗讀發音"
            aria-label="朗讀發音"
            className="flex h-11 w-11 items-center justify-center rounded-full text-[var(--pr)] transition-colors hover:bg-[var(--pr-sf)]"
          >
            <Volume2 className="h-5 w-5" />
          </span>
        </div>

        {!isFlipped ? (
          <div className="my-auto space-y-2">
            <h2 className="font-display text-[var(--tx)]">{item.word}</h2>
            <p className="flex items-center justify-center gap-1 text-xs text-[var(--mu)]">
              <RotateCw className="h-3.5 w-3.5" /> 點卡片翻面看釋義
            </p>
          </div>
        ) : (
          <div className="my-auto animate-fade-in space-y-3">
            <h3 className="text-xl font-bold text-[var(--pr)]">{item.meaning}</h3>
            {item.example && (
              <p className="mx-auto max-w-xs border-t border-[var(--ln)] pt-3 text-sm leading-relaxed text-[var(--mu)]">
                {renderExample(item.example)}
              </p>
            )}
          </div>
        )}

        <div className="flex w-full items-center justify-between text-[11px] text-[var(--mu)]">
          <span className="flex items-center gap-1.5">
            熟悉度 <MasteryDots level={currentLevel} />
          </span>
          <span>{isFlipped ? '記得程度會決定下次出現時間' : '翻面後可自評'}</span>
        </div>
      </button>

      {isFlipped && (
        <div className="grid animate-fade-in grid-cols-3 gap-2">
          {GRADES.map((grade) => (
            <Button
              key={grade.level}
              variant={grade.level === 3 ? 'correct' : grade.level === 1 ? 'wrong' : 'secondary'}
              onClick={() => onGrade(grade.level)}
              className="flex-col gap-0.5 py-3 text-xs"
            >
              <span className="font-bold">{grade.label}</span>
              <span className="text-[10px] font-normal opacity-70">
                {getSrsIntervalLabel(grade.level)}
              </span>
            </Button>
          ))}
        </div>
      )}
    </div>
  )
}
