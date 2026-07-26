import React from 'react'
import Link from 'next/link'
import { Check, ChevronRight, RotateCcw } from 'lucide-react'
import { cn } from '../lib/utils'

interface DailyTaskCardProps {
  title: string
  /** 例如「10 個 · 約 4 分鐘」，已含時間，呼叫端不要再拼一次 */
  subtitle: string
  icon: React.ReactNode
  completed: boolean
  href: string
  /** 完成後顯示的成績，如「10/10 · 4 分」 */
  resultText?: string
  /** 桌機常駐的數字鍵提示（設計 11：數字鍵 1–3 可直接開啟） */
  shortcut?: string
}

/**
 * 設計 01：未完成的任務有主色邊框，已完成降對比但仍可點——完成後的動作是
 * 「重做」，不是變成死卡片。
 */
export const DailyTaskCard: React.FC<DailyTaskCardProps> = ({
  title,
  subtitle,
  icon,
  completed,
  href,
  resultText,
  shortcut,
}) => {
  return (
    <Link
      href={href}
      className={cn(
        'flex min-h-[72px] items-center justify-between gap-3 rounded-2xl border p-4 transition-colors duration-200',
        completed
          ? 'border-[var(--ln)] bg-[var(--sf)] opacity-70 hover:opacity-100'
          : 'border-[var(--pr-ln)] bg-[var(--sf)] hover:bg-[var(--pr-sf)]'
      )}
    >
      <div className="flex min-w-0 items-center gap-3.5">
        <div
          className={cn(
            'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl',
            completed
              ? 'bg-[var(--sf2)] text-[var(--mu)]'
              : 'bg-[var(--pr-sf)] text-[var(--pr)]'
          )}
        >
          {completed ? <Check className="h-5 w-5" /> : icon}
        </div>
        <div className="min-w-0">
          <h3 className="truncate text-[15px] font-semibold text-[var(--tx)]">{title}</h3>
          <p className="mt-0.5 truncate text-xs text-[var(--mu)]">
            {completed && resultText ? resultText : subtitle}
          </p>
        </div>
      </div>

      <span className="flex shrink-0 items-center gap-1.5 text-xs font-semibold text-[var(--mu)]">
        {shortcut && (
          <span className="hidden rounded border border-[var(--ln)] px-1.5 py-0.5 text-[10px] text-[var(--fa)] lg:inline">
            {shortcut}
          </span>
        )}
        {completed ? (
          <>
            <RotateCcw className="h-3.5 w-3.5" /> 重做
          </>
        ) : (
          <ChevronRight className="h-5 w-5" />
        )}
      </span>
    </Link>
  )
}
