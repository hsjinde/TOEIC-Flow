'use client'

import React from 'react'
import { Zap } from 'lucide-react'
import type { Formula } from '../../scripts/build-content/types'
import { getChapterLabel } from '../lib/content'
import { MarkdownRenderer } from './MarkdownRenderer'

interface FormulaFlashcardProps {
  formula: Formula
}

export const FormulaFlashcard: React.FC<FormulaFlashcardProps> = ({ formula }) => {
  // 少數筆記把技巧寫成一整句夾雜粗體，沒有獨立的「**標題**：」——parse-formulas.ts
  // 會給出空字串而不是硬湊一個假標題，那種卡就只有內文、不印空的 h2。
  const hasTitle = formula.title.trim().length > 0

  return (
    <div className="flex w-full flex-1 flex-col">
      {/* 公式是要「看」的，不是要「猜」的：標題與解法同時呈現，通勤時一眼掃完就換下一條。 */}
      <div className="relative flex min-h-[264px] w-full flex-1 rounded-2xl border border-[var(--ln)] bg-[var(--sf)] lg:flex-none">
        <div className="relative flex w-full flex-1 flex-col gap-4 p-6">
          <div className="flex w-full items-center justify-between gap-2 text-xs text-[var(--mu)]">
            <span className="truncate rounded-md bg-[var(--sf2)] px-2.5 py-1 font-semibold">
              {getChapterLabel(formula.chapterId)}
            </span>
            <span className="flex shrink-0 items-center gap-1 rounded-md bg-[var(--pr-sf)] px-2.5 py-1 font-bold text-[var(--pr)]">
              <Zap className="h-3 w-3" /> 秒殺公式
            </span>
          </div>

          <div className="my-auto w-full space-y-3 text-left">
            {hasTitle && (
              <h2 className="text-lg font-bold leading-snug text-[var(--tx)]">{formula.title}</h2>
            )}
            <MarkdownRenderer content={formula.body} className="text-[13px]" />
          </div>
        </div>
      </div>
    </div>
  )
}
