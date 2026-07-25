'use client'

import React, { useState, useCallback } from 'react'
import { Volume2, RotateCw } from 'lucide-react'
import type { VocabItem } from '../../scripts/build-content/types'
import { Button } from './ui/Button'

interface VocabFlashcardProps {
  item: VocabItem
  onGrade: (level: number) => void
}

export const VocabFlashcard: React.FC<VocabFlashcardProps> = ({ item, onGrade }) => {
  const [isFlipped, setIsFlipped] = useState(false)

  const playSpeech = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel()
      const utterance = new SpeechSynthesisUtterance(item.word)
      utterance.lang = 'en-US'
      utterance.rate = 0.9
      window.speechSynthesis.speak(utterance)
    }
  }, [item.word])

  return (
    <div className="flex flex-col gap-6 w-full">
      {/* Flashcard Area */}
      <div
        onClick={() => setIsFlipped(!isFlipped)}
        className="w-full min-h-[260px] p-6 rounded-3xl bg-card border border-muted/80 shadow-md flex flex-col justify-between items-center text-center cursor-pointer transition-all duration-300 hover:border-primary/40"
      >
        <div className="w-full flex justify-between items-center text-xs text-muted-foreground">
          <span className="px-2.5 py-1 rounded-md bg-muted/60 font-semibold">{item.pos}</span>
          <button
            onClick={playSpeech}
            className="p-2 rounded-full hover:bg-primary/10 text-primary transition-colors"
            title="朗讀發音"
          >
            <Volume2 className="w-5 h-5" />
          </button>
        </div>

        {!isFlipped ? (
          /* Front Side */
          <div className="my-auto space-y-2">
            <h2 className="text-3xl font-bold tracking-tight text-foreground">{item.word}</h2>
            <p className="text-xs text-muted-foreground flex items-center justify-center gap-1">
              <RotateCw className="w-3.5 h-3.5" /> 點擊翻轉看釋義
            </p>
          </div>
        ) : (
          /* Back Side */
          <div className="my-auto space-y-4 animate-fade-in">
            <h3 className="text-xl font-bold text-primary">{item.meaning}</h3>
            {item.example && (
              <p className="text-sm text-muted-foreground italic leading-relaxed max-w-xs mx-auto border-t border-muted/50 pt-3">
                "{item.example}"
              </p>
            )}
          </div>
        )}

        <div className="text-[10px] text-muted-foreground">
          {isFlipped ? '點擊可切回正面' : '翻面後可進行 SRS 熟悉度自評'}
        </div>
      </div>

      {/* SRS Grading Buttons (Visible after flip) */}
      {isFlipped && (
        <div className="grid grid-cols-3 gap-2 animate-fade-in">
          <Button variant="wrong" onClick={() => onGrade(1)} className="text-xs py-3">
            🔴 不會
          </Button>
          <Button variant="secondary" onClick={() => onGrade(2)} className="text-xs py-3">
            🟡 有點難
          </Button>
          <Button variant="correct" onClick={() => onGrade(3)} className="text-xs py-3">
            🟢 記得
          </Button>
        </div>
      )}
    </div>
  )
}
