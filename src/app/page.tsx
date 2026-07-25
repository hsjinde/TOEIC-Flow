'use client'

import { useEffect, useState } from 'react'
import { BookOpen, Sparkles, FileText, Flame } from 'lucide-react'
import { getDailyProgress, type DailyProgress } from '../lib/storage'
import { ProgressRing } from '../components/ui/ProgressRing'
import { DailyTaskCard } from '../components/DailyTaskCard'
import { ThemeToggle } from '../components/ThemeToggle'

export default function HomePage() {
  const [progress, setProgress] = useState<DailyProgress | null>(null)

  useEffect(() => {
    setProgress(getDailyProgress())
  }, [])

  if (!progress) return null

  const completedCount = [
    progress.vocabCompleted,
    progress.grammarCompleted,
    progress.readingCompleted,
  ].filter(Boolean).length

  return (
    <div className="flex flex-col gap-6">
      {/* Top Header Bar */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-[var(--tx)]">TOEIC 每日練習</h1>
          <p className="text-xs md:text-sm text-[var(--mu)] mt-0.5">
            {new Date().toLocaleDateString('zh-TW', { month: 'long', day: 'numeric', weekday: 'short' })}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-[var(--pr-ln)] bg-[var(--pr-sf)] text-[var(--pr)] font-bold text-sm">
            <Flame className="w-4 h-4 fill-[var(--pr)]" />
            <span>{progress.streak} 天</span>
          </div>
        </div>
      </div>

      {/* Progress Ring Hero */}
      <div className="flex flex-col items-center justify-center py-8 bg-[var(--sf)] rounded-3xl border border-[var(--ln)] shadow-sm">
        <ProgressRing completed={completedCount} total={3} size={168} strokeWidth={11} />
        {completedCount === 3 ? (
          <p className="text-sm font-medium text-[var(--ok)] mt-4 animate-fade-in">
            ✨ 今日任務全數完成！明日繼續保持專注。
          </p>
        ) : (
          <p className="text-xs text-[var(--mu)] mt-4">
            再 {15 - completedCount * 5} 分鐘即可完成今天
          </p>
        )}
      </div>

      {/* Task List (Responsive Grid for Desktop) */}
      <div className="flex flex-col gap-3">
        <h2 className="text-xs font-bold text-[var(--fa)] uppercase tracking-wider px-1">
          今日練習任務
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <DailyTaskCard
            title="單字複習"
            subtitle="10 個單字"
            timeEstimate="約 4 分鐘"
            icon={<BookOpen className="w-5 h-5" />}
            completed={progress.vocabCompleted}
            href="/practice/vocab"
          />
          <DailyTaskCard
            title="文法練習"
            subtitle="5 題選擇"
            timeEstimate="約 6 分鐘"
            icon={<Sparkles className="w-5 h-5" />}
            completed={progress.grammarCompleted}
            href="/practice/grammar"
          />
          <DailyTaskCard
            title="閱讀理解"
            subtitle="1 篇閱讀"
            timeEstimate="約 5 分鐘"
            icon={<FileText className="w-5 h-5" />}
            completed={progress.readingCompleted}
            href="/practice/reading"
          />
        </div>
      </div>
    </div>
  )
}
