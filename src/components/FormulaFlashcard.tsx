'use client'

import React, { useEffect, useState } from 'react'
import { RotateCw, Zap } from 'lucide-react'
import type { Formula } from '../../scripts/build-content/types'
import { getChapterLabel } from '../lib/content'
import { MarkdownRenderer } from './MarkdownRenderer'

interface FormulaFlashcardProps {
  formula: Formula
}

export const FormulaFlashcard: React.FC<FormulaFlashcardProps> = ({ formula }) => {
  // 少數筆記把技巧寫成一整句夾雜粗體，沒有獨立的「**標題**：」——parse-formulas.ts
  // 會給出空字串而不是硬湊一個假標題。這種卡片沒有「先猜再翻」的意義，直接show解法。
  const hasTitle = formula.title.trim().length > 0
  const [isFlipped, setIsFlipped] = useState(false)

  // 換卡時一律回到標題面，否則會直接看到解法。
  useEffect(() => {
    setIsFlipped(false)
  }, [formula.id])

  const revealed = isFlipped || !hasTitle

  return (
    <div className="flex w-full flex-1 flex-col">
      {/* 沿用 VocabFlashcard 的整卡可點手法：按鈕鋪滿卡片，內容層 pointer-events-none 讓點擊穿透下去。 */}
      <div className="relative flex min-h-[264px] w-full flex-1 rounded-2xl border border-[var(--ln)] bg-[var(--sf)] transition-colors duration-200 hover:border-[var(--pr-ln)] lg:flex-none">
        {hasTitle && (
          <button
            type="button"
            onClick={() => setIsFlipped((v) => !v)}
            aria-label={isFlipped ? '翻回標題' : '翻面看解法'}
            aria-pressed={isFlipped}
            className="absolute inset-0 h-full w-full rounded-2xl"
          />
        )}
        <div className="pointer-events-none relative flex w-full flex-1 flex-col gap-4 p-6">
          <div className="flex w-full items-center justify-between gap-2 text-xs text-[var(--mu)]">
            <span className="truncate rounded-md bg-[var(--sf2)] px-2.5 py-1 font-semibold">
              {getChapterLabel(formula.chapterId)}
            </span>
            <span className="flex shrink-0 items-center gap-1 rounded-md bg-[var(--pr-sf)] px-2.5 py-1 font-bold text-[var(--pr)]">
              <Zap className="h-3 w-3" /> 秒殺公式
            </span>
          </div>

          {!revealed ? (
            <div className="m-auto space-y-2 text-center">
              <h2 className="text-xl font-bold leading-snug text-[var(--tx)]">{formula.title}</h2>
              <p className="flex items-center justify-center gap-1 text-xs text-[var(--mu)]">
                <RotateCw className="h-3.5 w-3.5" /> 點卡片看解法
              </p>
            </div>
          ) : (
            <div className="my-auto w-full animate-fade-in text-left">
              <MarkdownRenderer content={formula.body} className="text-[13px]" />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
