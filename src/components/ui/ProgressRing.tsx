import React from 'react'
import { Check } from 'lucide-react'

interface ProgressRingProps {
  completed: number
  total: number
  size?: number
  strokeWidth?: number
  /** 環內下方的說明字，預設「今日任務完成」 */
  label?: string
}

/**
 * 設計 01：進度環是首頁唯一的視覺焦點。全部完成時環閉合並換成勾號——
 * 安靜的完成感，不放彩帶。動畫上限 300ms（見 DESIGN-PROMPT）。
 */
export const ProgressRing: React.FC<ProgressRingProps> = ({
  completed,
  total,
  size = 120,
  strokeWidth = 10,
  label = '今日任務完成',
}) => {
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const progress = total > 0 ? Math.min(completed / total, 1) : 0
  const offset = circumference - progress * circumference
  const isComplete = total > 0 && completed >= total

  return (
    <div
      className="relative inline-flex items-center justify-center"
      role="img"
      aria-label={`${label} ${completed} / ${total}`}
    >
      <svg width={size} height={size} className="-rotate-90 transform">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="var(--sf2)"
          strokeWidth={strokeWidth}
          fill="transparent"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="var(--pr)"
          className="transition-all duration-300 ease-out"
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          fill="transparent"
        />
      </svg>
      <div className="absolute flex flex-col items-center text-center">
        {isComplete ? (
          <>
            <Check className="h-8 w-8 text-[var(--pr)]" />
            <span className="mt-1 text-xs font-semibold text-[var(--mu)]">
              {completed}/{total} 已完成
            </span>
          </>
        ) : (
          <>
            <span className="text-2xl font-bold text-[var(--tx)]">
              {completed}/{total}
            </span>
            <span className="block text-xs text-[var(--mu)]">{label}</span>
          </>
        )}
      </div>
    </div>
  )
}
