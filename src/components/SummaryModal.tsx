import React from 'react'
import Link from 'next/link'
import { Check, RotateCcw } from 'lucide-react'
import { Button } from './ui/Button'

interface SummaryModalProps {
  correctCount: number
  totalCount: number
  title?: string
  /** 有錯題時給一個直接去複習的入口 */
  wrongCount?: number
  /**
   * 回到「開始這一回合的地方」。預設今日任務，但從章節頁或學習路徑進來的回合要回得去
   * 原本那一頁——練完五題被丟回首頁，等於每次練習都把使用者從閱讀脈絡裡踢出來。
   */
  backHref?: string
  backLabel?: string
  /** 有值就顯示「再練一輪」，就地重抽，不必先回上一頁再點一次。 */
  onRetry?: () => void
}

/**
 * 設計 01：安靜的完成感——勾號、一行結語，不放彩帶或大型動畫。
 */
export const SummaryModal: React.FC<SummaryModalProps> = ({
  correctCount,
  totalCount,
  title = '文法練習完成',
  wrongCount,
  backHref = '/',
  backLabel = '今日任務',
  onRetry,
}) => {
  const percentage = totalCount > 0 ? Math.round((correctCount / totalCount) * 100) : 0
  const missed = wrongCount ?? totalCount - correctCount

  return (
    <div className="flex flex-col items-center gap-4 rounded-2xl border border-[var(--ln)] bg-[var(--sf)] px-6 py-12 text-center">
      {/* 完成是進度，不是判定。綠色只屬於「這一題你答對了」。 */}
      <div className="flex h-14 w-14 items-center justify-center rounded-full border border-[var(--pr-ln)] bg-[var(--pr-sf)] text-[var(--pr)]">
        <Check className="h-7 w-7" />
      </div>
      <div className="space-y-1">
        <h2 className="text-lg font-bold text-[var(--tx)]">{title}</h2>
        <p className="text-sm text-[var(--mu)]">
          答對 {correctCount} / {totalCount} 題 · {percentage}%
        </p>
      </div>

      <div className="flex w-full max-w-[280px] flex-col gap-2 pt-1">
        {/*
          主要動作是「繼續往下」而不是「離開」：練完一輪最常見的下一步是再練一輪，
          其次才是回原本那一頁。沒有 onRetry 的流程（例如閱讀）維持返回為主要動作。
        */}
        {onRetry ? (
          <>
            <Button variant="primary" onClick={onRetry}>
              <RotateCcw className="h-4 w-4" /> 再練一輪
            </Button>
            <Link href={backHref}>
              <Button variant="outline">返回{backLabel}</Button>
            </Link>
          </>
        ) : (
          <Link href={backHref}>
            <Button variant="primary">返回{backLabel}</Button>
          </Link>
        )}
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
