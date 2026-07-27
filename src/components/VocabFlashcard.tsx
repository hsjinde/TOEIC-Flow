'use client'

import React, { useCallback, useEffect, useState } from 'react'
import { RotateCw, Volume2 } from 'lucide-react'
import type { VocabItem } from '../../scripts/build-content/types'
import { getSrsIntervalLabel } from '../lib/storage'
import { Button } from './ui/Button'
import { EmphasisText } from './EmphasisText'
import { MasteryDots } from './MasteryDots'

interface VocabFlashcardProps {
  item: VocabItem
  /** level 1=不會 2=有點難 3=記得（見 storage.updateVocabMastery） */
  onGrade: (level: number) => void
  currentLevel: number
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
      {/*
        翻面按鈕鋪滿整張卡，內容層 pointer-events-none 讓點擊穿透下去；喇叭再單獨
        把指標事件收回來。這樣整張卡仍然可點，但喇叭不再是巢狀在 button 裡的
        span[role=button]——HTML 不允許互動元素巢狀，AT 的可及性樹也會壞掉。
      */}
      <div className="relative min-h-[264px] w-full rounded-2xl border border-[var(--ln)] bg-[var(--sf)] transition-colors duration-200 hover:border-[var(--pr-ln)]">
        <button
          type="button"
          onClick={() => setIsFlipped((v) => !v)}
          aria-label={isFlipped ? '翻回英文面' : '翻到中文釋義'}
          aria-pressed={isFlipped}
          className="absolute inset-0 h-full w-full rounded-2xl"
        />
        <div className="pointer-events-none relative flex min-h-[264px] w-full flex-col items-center justify-between gap-4 p-6 text-center">
        <div className="flex w-full items-center justify-between text-xs text-[var(--mu)]">
          <span className="rounded-md bg-[var(--sf2)] px-2.5 py-1 font-semibold">{item.pos}</span>
          <button
            type="button"
            onClick={playSpeech}
            title="朗讀發音"
            aria-label={`朗讀 ${item.word}`}
            className="pointer-events-auto flex h-11 w-11 items-center justify-center rounded-full text-[var(--pr)] transition-colors hover:bg-[var(--pr-sf)]"
          >
            <Volume2 className="h-5 w-5" />
          </button>
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
              <div className="mx-auto max-w-xs space-y-1.5 border-t border-[var(--ln)] pt-3">
                <p className="text-sm leading-relaxed text-[var(--mu)]">
                  <EmphasisText text={item.example} />
                </p>
                {/* 例句看得懂才有意義；沒有翻譯的字就只留英文，不留空欄位。 */}
                {item.exampleZh && (
                  <p className="text-[13px] leading-relaxed text-[var(--mu)] opacity-80">
                    {item.exampleZh}
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        <div className="flex w-full items-center justify-between text-[11px] text-[var(--mu)]">
          <span className="flex items-center gap-1.5">
            熟悉度 <MasteryDots level={currentLevel} />
          </span>
          <span>{isFlipped ? '記得程度會決定下次出現時間' : '翻面後可自評'}</span>
        </div>
        </div>
      </div>

      {/*
        自評是使用者對自己的評估，不是系統判定，所以不能用綠／紅——同一顆綠色在別的
        畫面上代表「你答對了」。三檔的差異改由文字與間隔標籤承載，只有正向的「記得」
        帶主色。
      */}
      {isFlipped && (
        <div className="grid animate-fade-in grid-cols-3 gap-2">
          {GRADES.map((grade) => (
            <Button
              key={grade.level}
              variant={grade.level === 3 ? 'outline' : 'secondary'}
              onClick={() => onGrade(grade.level)}
              className={
                grade.level === 3
                  ? 'flex-col gap-0.5 border-[var(--pr-ln)] py-3 text-xs text-[var(--pr)]'
                  : 'flex-col gap-0.5 py-3 text-xs'
              }
            >
              <span className="font-bold">{grade.label}</span>
              <span className="text-[11px] font-normal opacity-80">
                {getSrsIntervalLabel(grade.level)}
              </span>
            </Button>
          ))}
        </div>
      )}
    </div>
  )
}
