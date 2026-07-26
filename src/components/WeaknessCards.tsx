import React from 'react'
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import type { CategoryStat } from '../lib/storage'
import { getCategoryLabel } from '../lib/content'

interface WeaknessCardsProps {
  stats: CategoryStat[]
  /** 錯題數（依分類），設計 05 的「錯 11 題 · 3 章」用得到 */
  wrongCountByCategory?: Record<string, number>
  chapterCountByCategory?: Record<string, number>
  limit?: number
}

/**
 * 設計 05/12：弱項卡片解決觸控點過小的問題，整張卡可點直接開始練該類。
 * 排序依正確率由低到高；錯題數與章數放副標，兩個訊息都保留。
 */
export const WeaknessCards: React.FC<WeaknessCardsProps> = ({
  stats,
  wrongCountByCategory = {},
  chapterCountByCategory = {},
  limit,
}) => {
  if (stats.length === 0) {
    return (
      <div className="rounded-2xl border border-[var(--ln)] bg-[var(--sf)] p-4 text-center text-xs text-[var(--mu)]">
        尚無答題紀錄，完成任一組練習後就會列出最該補的類別。
      </div>
    )
  }

  const sorted = [...stats].sort((a, b) => a.accuracyRate - b.accuracyRate)
  const shown = limit ? sorted.slice(0, limit) : sorted

  return (
    <div className="space-y-2.5">
      {shown.map((item) => {
        const wrongCount = wrongCountByCategory[item.categoryId] ?? 0
        const chapterCount = chapterCountByCategory[item.categoryId] ?? 0
        const detail = [
          `已答 ${item.totalAnswered} 題`,
          wrongCount > 0 ? `錯 ${wrongCount} 題` : null,
          chapterCount > 0 ? `${chapterCount} 章` : null,
        ]
          .filter(Boolean)
          .join(' · ')

        return (
          <Link
            key={item.categoryId}
            href={`/practice/grammar?category=${encodeURIComponent(item.categoryId)}`}
            className="block rounded-2xl border border-[var(--ln)] bg-[var(--sf)] p-4 transition-colors hover:border-[var(--pr-ln)]"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <h4 className="truncate text-sm font-bold text-[var(--tx)]">
                  {getCategoryLabel(item.categoryId)}
                </h4>
                <p className="mt-0.5 text-xs text-[var(--mu)]">{detail}</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span className="text-base font-bold text-[var(--tx)]">{item.accuracyRate}%</span>
                <span className="flex items-center gap-0.5 rounded-lg border border-[var(--pr-ln)] bg-[var(--pr-sf)] px-2 py-1 text-[11px] font-bold text-[var(--pr)]">
                  練 <ChevronRight className="h-3 w-3" />
                </span>
              </div>
            </div>

            <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-[var(--sf2)]">
              <div
                className="h-full rounded-full bg-[var(--pr)] transition-all duration-300"
                style={{ width: `${item.accuracyRate}%` }}
              />
            </div>
          </Link>
        )
      })}
    </div>
  )
}
