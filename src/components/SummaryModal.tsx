import React from 'react'
import Link from 'next/link'
import { Check } from 'lucide-react'
import { Button } from './ui/Button'

interface SummaryModalProps {
  correctCount: number
  totalCount: number
  title?: string
  /** 有錯題時給一個直接去複習的入口 */
  wrongCount?: number
}

/**
 * 設計 01：安靜的完成感——勾號、一行結語，不放彩帶或大型動畫。
 */
export const SummaryModal: React.FC<SummaryModalProps> = ({
  correctCount,
  totalCount,
  title = '文法練習完成',
  wrongCount,
}) => {
  const percentage = totalCount > 0 ? Math.round((correctCount / totalCount) * 100) : 0
  const missed = wrongCount ?? totalCount - correctCount

  return (
    <div className="flex flex-col items-center gap-4 rounded-2xl border border-[var(--ln)] bg-[var(--sf)] px-6 py-12 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full border border-[var(--ok)] bg-[var(--ok-sf)] text-[var(--ok)]">
        <Check className="h-7 w-7" />
      </div>
      <div className="space-y-1">
        <h2 className="text-lg font-bold text-[var(--tx)]">{title}</h2>
        <p className="text-sm text-[var(--mu)]">
          答對 {correctCount} / {totalCount} 題 · {percentage}%
        </p>
      </div>

      <div className="flex w-full max-w-[280px] flex-col gap-2 pt-1">
        <Link href="/">
          <Button variant="primary">返回今日任務</Button>
        </Link>
        {missed > 0 && (
          <Link href="/wrong-questions">
            <Button variant="outline" className="text-xs">
              這回錯了 {missed} 題 · 去錯題本
            </Button>
          </Link>
        )}
      </div>
    </div>
  )
}
