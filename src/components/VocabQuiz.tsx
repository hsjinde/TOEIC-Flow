'use client'

import React, { useEffect, useMemo, useState } from 'react'
import type { VocabItem } from '../../scripts/build-content/types'
import { MAX_VOCAB_LEVEL, getSrsIntervalLabel } from '../lib/storage'
import { stripEmphasis, toClozeSentence } from '../lib/emphasis'
import { Button } from './ui/Button'
import { MasteryDots } from './MasteryDots'
import { cn } from '../lib/utils'

export type QuizKind = 'en2zh' | 'zh2en' | 'cloze'

interface VocabQuizProps {
  item: VocabItem
  /** 抽誘答項的來源，至少要有 4 個字才湊得滿四選一 */
  pool: VocabItem[]
  index: number
  currentLevel: number
  onAnswer: (isCorrect: boolean) => void
}

const KIND_LABELS: Record<QuizKind, string> = {
  en2zh: '英 → 中',
  zh2en: '中 → 英',
  cloze: '例句填空',
}

/** 設計 03：三種題型輪替，用題序決定，避免同一輪一直出同一型。 */
export function quizKindFor(index: number, item: VocabItem): QuizKind {
  const kinds: QuizKind[] = item.example ? ['en2zh', 'zh2en', 'cloze'] : ['en2zh', 'zh2en']
  return kinds[index % kinds.length]!
}

/**
 * 依 id 產生穩定的洗牌序，讓同一題在重新渲染（例如作答後）時選項不會跳位。
 */
function stableShuffle<T>(items: T[], seed: string): T[] {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0
  const out = [...items]
  for (let i = out.length - 1; i > 0; i--) {
    h = (h * 1103515245 + 12345) >>> 0
    const j = h % (i + 1)
    ;[out[i], out[j]] = [out[j]!, out[i]!]
  }
  return out
}

export const VocabQuiz: React.FC<VocabQuizProps> = ({
  item,
  pool,
  index,
  currentLevel,
  onAnswer,
}) => {
  const [picked, setPicked] = useState<string | null>(null)
  const [nextLevel, setNextLevel] = useState(0)
  const kind = quizKindFor(index, item)

  useEffect(() => {
    setPicked(null)
    setNextLevel(0)
  }, [item.id])

  const { prompt, hint, correct, options } = useMemo(() => {
    const answerIsWord = kind !== 'en2zh'
    const correctText = answerIsWord ? item.word : item.meaning

    const distractors = pool
      .filter((v) => v.id !== item.id)
      .filter((v) => (answerIsWord ? v.word !== item.word : v.meaning !== item.meaning))
      .slice(0, 3)
      .map((v) => (answerIsWord ? v.word : v.meaning))

    return {
      prompt:
        kind === 'en2zh'
          ? item.word
          : kind === 'zh2en'
            ? item.meaning
            : stripEmphasis(toClozeSentence(item.example, item.word)),
      hint:
        kind === 'en2zh'
          ? '選出正確的中文釋義'
          : kind === 'zh2en'
            ? '選出正確的英文單字'
            : '選出最適合填入空格的字',
      correct: correctText,
      options: stableShuffle([correctText, ...distractors], item.id),
    }
  }, [item, pool, kind])

  const answered = picked !== null

  const handlePick = (choice: string) => {
    if (answered) return
    const isCorrect = choice === correct
    // 結果檔位要在通知父層「之前」用當下的 currentLevel 算好並鎖住。
    // onAnswer 會讓父層更新 currentLevel，若之後才從 prop 推導就會多跳一格。
    setPicked(choice)
    setNextLevel(
      isCorrect ? Math.min(MAX_VOCAB_LEVEL, currentLevel + 1) : Math.max(0, currentLevel - 1)
    )
    onAnswer(isCorrect)
  }

  return (
    <div className="flex w-full flex-col gap-4">
      <div className="rounded-2xl border border-[var(--ln)] bg-[var(--sf)] p-6 text-center">
        <p className="text-xs font-semibold text-[var(--pr)]">{KIND_LABELS[kind]}</p>
        <p
          className={cn(
            'mt-3 text-[var(--tx)]',
            kind === 'cloze' ? 'font-option text-left leading-relaxed' : 'font-display'
          )}
        >
          {prompt}
        </p>
        <p className="mt-3 text-xs text-[var(--mu)]">{hint}</p>
      </div>

      <div className="grid gap-2.5">
        {options.map((opt, i) => {
          const isCorrect = opt === correct
          const isPicked = opt === picked
          let variant: 'outline' | 'correct' | 'wrong' = 'outline'
          if (answered) {
            if (isCorrect) variant = 'correct'
            else if (isPicked) variant = 'wrong'
          }
          return (
            <Button
              key={`${opt}-${i}`}
              variant={variant}
              disabled={answered}
              onClick={() => handlePick(opt)}
              className="justify-start px-5 text-left font-option"
            >
              <span className="w-6 text-xs font-semibold opacity-70">
                ({String.fromCharCode(65 + i)})
              </span>
              <span className="flex-1">{opt}</span>
              {answered && isCorrect && <span className="text-xs font-bold">正解</span>}
              {answered && isPicked && !isCorrect && (
                <span className="text-xs font-bold">你的選擇</span>
              )}
            </Button>
          )
        })}
      </div>

      {answered && (
        <p className="flex animate-fade-in items-center justify-center gap-2 text-xs text-[var(--mu)]">
          熟悉度 <MasteryDots level={nextLevel} /> → 下次 {getSrsIntervalLabel(nextLevel)}
          <span className="opacity-70">· 0.6 秒後下一張</span>
        </p>
      )}
    </div>
  )
}
