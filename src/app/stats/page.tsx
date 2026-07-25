'use client'

import { useEffect, useState } from 'react'
import { ArrowLeft, Flame, Award, Target, BookOpen } from 'lucide-react'
import Link from 'next/link'
import {
  getCategoryStats,
  getDailyProgress,
  getVocabMasteryMap,
  type CategoryStat,
  type DailyProgress,
} from '../../lib/storage'
import { WeaknessCards } from '../../components/WeaknessCards'

export default function StatsPage() {
  const [stats, setStats] = useState<CategoryStat[]>([])
  const [progress, setProgress] = useState<DailyProgress | null>(null)
  const [vocabCount, setVocabCount] = useState(0)

  useEffect(() => {
    setStats(getCategoryStats())
    setProgress(getDailyProgress())
    const vocabMap = getVocabMasteryMap()
    setVocabCount(Object.values(vocabMap).filter((v) => v.level >= 2).length)
  }, [])

  const totalAnswered = stats.reduce((acc, cur) => acc + cur.totalAnswered, 0)
  const totalCorrect = stats.reduce((acc, cur) => acc + cur.correctCount, 0)
  const overallAccuracy = totalAnswered > 0 ? Math.round((totalCorrect / totalAnswered) * 100) : 0

  // TOEIC Score Estimation Formula
  const estimatedScore = Math.min(990, Math.max(200, 300 + overallAccuracy * 6))

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Link href="/" className="p-2 -ml-2 rounded-xl text-muted-foreground hover:bg-muted">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <h1 className="text-xl font-bold">學習統計與弱項分析</h1>
      </div>

      {/* TOEIC Score Estimate Banner */}
      <div className="p-6 rounded-3xl bg-card border border-muted/80 flex items-center justify-between shadow-md">
        <div>
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">預估 TOEIC 分數</span>
          <div className="text-3xl font-extrabold text-primary mt-1">{estimatedScore} <span className="text-sm font-normal text-muted-foreground">/ 990</span></div>
          <p className="text-xs text-muted-foreground mt-1">基於近期答題對率 {overallAccuracy}% 動態估算</p>
        </div>
        <div className="w-14 h-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
          <Award className="w-7 h-7" />
        </div>
      </div>

      {/* Key Numbers Grid */}
      <div className="grid grid-cols-3 gap-3 text-center">
        <div className="p-3.5 rounded-2xl bg-card border border-muted/80 shadow-sm">
          <div className="text-xs text-muted-foreground mb-1">連續天數</div>
          <div className="text-lg font-bold text-amber-500 flex items-center justify-center gap-1">
            <Flame className="w-4 h-4 fill-amber-500" /> {progress?.streak || 1}
          </div>
        </div>
        <div className="p-3.5 rounded-2xl bg-card border border-muted/80 shadow-sm">
          <div className="text-xs text-muted-foreground mb-1">總答題數</div>
          <div className="text-lg font-bold text-primary flex items-center justify-center gap-1">
            <Target className="w-4 h-4" /> {totalAnswered}
          </div>
        </div>
        <div className="p-3.5 rounded-2xl bg-card border border-muted/80 shadow-sm">
          <div className="text-xs text-muted-foreground mb-1">掌握單字</div>
          <div className="text-lg font-bold text-correct flex items-center justify-center gap-1">
            <BookOpen className="w-4 h-4" /> {vocabCount}
          </div>
        </div>
      </div>

      {/* Weakness Categories Section */}
      <div className="space-y-3">
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1">
          文法類別正確率與弱項列表
        </h2>
        <WeaknessCards stats={stats} />
      </div>
    </div>
  )
}
