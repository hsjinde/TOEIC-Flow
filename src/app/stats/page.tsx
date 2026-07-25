'use client'

import { useEffect, useState } from 'react'
import { ArrowLeft, Flame, Award, Target, BookOpen, LogOut, User as UserIcon } from 'lucide-react'
import Link from 'next/link'
import { useAuth } from '../../context/AuthContext'
import {
  getCategoryStats,
  getDailyProgress,
  getVocabMasteryMap,
  type CategoryStat,
  type DailyProgress,
} from '../../lib/storage'
import { WeaknessCards } from '../../components/WeaknessCards'

export default function StatsPage() {
  const { user, logout } = useAuth()
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

  // TOEIC Score Estimation Formula (10-990 pts, rounded to nearest 5 pts)
  const estimatedScore = totalAnswered > 0
    ? Math.round((10 + (overallAccuracy / 100) * 980) / 5) * 5
    : '--'

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Link href="/" className="p-2 -ml-2 rounded-xl text-[var(--mu)] hover:bg-[var(--sf2)]">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <h1 className="text-xl font-bold text-[var(--tx)]">學習統計與弱項分析</h1>
        </div>
        {user && (
          <button
            onClick={() => logout()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[var(--sf)] border border-[var(--ln)] text-[var(--mu)] hover:text-[var(--bad)] text-xs font-bold transition-all"
          >
            <LogOut className="w-3.5 h-3.5" /> 登出
          </button>
        )}
      </div>

      {/* User Info Card */}
      {user && (
        <div className="p-4 rounded-2xl bg-[var(--sf)] border border-[var(--ln)] flex items-center justify-between text-xs">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[var(--pr-sf)] border border-[var(--pr-ln)] text-[var(--pr)] flex items-center justify-center">
              <UserIcon className="w-4 h-4" />
            </div>
            <div>
              <div className="font-bold text-[var(--tx)] text-sm">{user.nickname}</div>
              <div className="text-[var(--mu)] font-mono text-xs">{user.email}</div>
            </div>
          </div>
          <span className="px-2.5 py-1 rounded-full bg-[var(--pr-sf)] border border-[var(--pr-ln)] text-[var(--pr)] font-bold text-[10px]">
            Cloudflare D1 已連線
          </span>
        </div>
      )}

      {/* TOEIC Score Estimate Banner */}
      <div className="p-6 rounded-3xl bg-[var(--sf)] border border-[var(--ln)] flex items-center justify-between shadow-sm">
        <div>
          <span className="text-xs font-semibold text-[var(--mu)] uppercase tracking-wider">預估 TOEIC 分數</span>
          <div className="text-3xl font-extrabold text-[var(--pr)] mt-1">
            {estimatedScore} <span className="text-sm font-normal text-[var(--mu)]">/ 990</span>
          </div>
          <p className="text-xs text-[var(--mu)] mt-1">
            {totalAnswered > 0 ? `基於答題正確率 ${overallAccuracy}% 動態估算` : '尚無答題紀錄，請開始練習！'}
          </p>
        </div>
        <div className="w-14 h-14 rounded-2xl bg-[var(--pr-sf)] text-[var(--pr)] flex items-center justify-center">
          <Award className="w-7 h-7" />
        </div>
      </div>

      {/* Key Numbers Grid */}
      <div className="grid grid-cols-3 gap-3 text-center">
        <div className="p-3.5 rounded-2xl bg-[var(--sf)] border border-[var(--ln)] shadow-sm">
          <div className="text-xs text-[var(--mu)] mb-1">連續天數</div>
          <div className="text-lg font-bold text-[var(--pr)] flex items-center justify-center gap-1">
            <Flame className="w-4 h-4 fill-[var(--pr)]" /> {progress?.streak || 1}
          </div>
        </div>
        <div className="p-3.5 rounded-2xl bg-[var(--sf)] border border-[var(--ln)] shadow-sm">
          <div className="text-xs text-[var(--mu)] mb-1">總答題數</div>
          <div className="text-lg font-bold text-[var(--pr)] flex items-center justify-center gap-1">
            <Target className="w-4 h-4" /> {totalAnswered}
          </div>
        </div>
        <div className="p-3.5 rounded-2xl bg-[var(--sf)] border border-[var(--ln)] shadow-sm">
          <div className="text-xs text-[var(--mu)] mb-1">掌握單字</div>
          <div className="text-lg font-bold text-[var(--ok)] flex items-center justify-center gap-1">
            <BookOpen className="w-4 h-4" /> {vocabCount}
          </div>
        </div>
      </div>

      {/* Weakness Categories Section */}
      <div className="space-y-3">
        <h2 className="text-xs font-semibold text-[var(--fa)] uppercase tracking-wider px-1">
          文法類別正確率與弱項列表
        </h2>
        <WeaknessCards stats={stats} />
      </div>
    </div>
  )
}
