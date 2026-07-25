import React from 'react'
import Link from 'next/link'
import { AlertCircle, ChevronRight, CheckCircle } from 'lucide-react'
import type { CategoryStat } from '../lib/storage'

interface WeaknessCardsProps {
  stats: CategoryStat[]
}

export const WeaknessCards: React.FC<WeaknessCardsProps> = ({ stats }) => {
  if (stats.length === 0) {
    return (
      <div className="p-4 rounded-2xl bg-card border border-muted text-center text-xs text-muted-foreground">
        尚無答題歷史紀錄，完成題目練習後即可生成分析報告。
      </div>
    )
  }

  const sorted = [...stats].sort((a, b) => a.accuracyRate - b.accuracyRate)

  return (
    <div className="space-y-3">
      {sorted.map((item) => {
        const isWeak = item.accuracyRate < 70

        return (
          <Link
            key={item.categoryId}
            href="/practice/grammar"
            className="block p-4 rounded-2xl bg-card border border-muted/80 hover:border-primary/40 transition-all shadow-sm"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {isWeak ? (
                  <div className="p-2 rounded-xl bg-wrong/10 text-wrong">
                    <AlertCircle className="w-5 h-5" />
                  </div>
                ) : (
                  <div className="p-2 rounded-xl bg-correct/10 text-correct">
                    <CheckCircle className="w-5 h-5" />
                  </div>
                )}
                <div>
                  <h4 className="text-sm font-bold">{item.categoryId}</h4>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    已答 {item.totalAnswered} 題 · 正確率 {item.accuracyRate}%
                  </p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-muted-foreground" />
            </div>

            {/* Accuracy Progress Bar */}
            <div className="w-full bg-muted h-1.5 rounded-full mt-3 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  isWeak ? 'bg-wrong' : 'bg-correct'
                }`}
                style={{ width: `${item.accuracyRate}%` }}
              />
            </div>
          </Link>
        )
      })}
    </div>
  )
}
