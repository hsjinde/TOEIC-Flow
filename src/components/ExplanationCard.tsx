import React from 'react'
import type { Explanation } from '../../scripts/build-content/types'
import { MarkdownRenderer } from './MarkdownRenderer'
import { cn } from '../lib/utils'

interface ExplanationCardProps {
  explanation: Explanation
  /** 正解字母，設計 14 的右欄第一行就是「正解 (C)」 */
  answerKey?: string
  className?: string
}

/**
 * 設計 14：正解 → 逐選項分析 → 相關文法點 → 相似題型提醒。
 * similarNote 之前完全沒被渲染，內容白寫了。
 */
export const ExplanationCard: React.FC<ExplanationCardProps> = ({
  explanation,
  answerKey,
  className,
}) => {
  return (
    <div
      className={cn(
        'animate-fade-in space-y-3 rounded-2xl border border-[var(--ln)] bg-[var(--sf2)] p-4 text-sm',
        className
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        {answerKey && (
          <span className="rounded-md border border-[var(--ok)] bg-[var(--ok-sf)] px-2 py-0.5 text-xs font-bold text-[var(--ok)]">
            正解 ({answerKey})
          </span>
        )}
        <span className="text-xs font-semibold text-[var(--pr)]">{explanation.title}</span>
      </div>

      <MarkdownRenderer content={explanation.analysis} className="text-[13px]" />

      {explanation.grammarPoint && (
        <div className="rounded-lg border border-[var(--pr-ln)] bg-[var(--pr-sf)] px-3 py-2 text-xs leading-relaxed text-[var(--pr)]">
          <span className="font-bold">相關文法點：</span>
          {explanation.grammarPoint}
        </div>
      )}

      {explanation.similarNote && (
        <div className="border-t border-[var(--ln)] pt-3 text-xs leading-relaxed text-[var(--mu)]">
          <span className="font-bold text-[var(--tx)]">相似題型提醒：</span>
          {explanation.similarNote}
        </div>
      )}
    </div>
  )
}
