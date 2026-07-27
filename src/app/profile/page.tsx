'use client'

import { useEffect, useMemo, useState } from 'react'
import { LogOut } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import {
  DEFAULT_PROFILE,
  getCategoryStats,
  getProfile,
  getVocabMasteryMap,
  saveProfile,
  type UserProfile,
} from '../../lib/storage'
import { estimateToeicScore } from '../../lib/toeicScore'
import { Button } from '../../components/ui/Button'
import { ThemeToggle } from '../../components/ThemeToggle'
import { cn } from '../../lib/utils'

const DAILY_GOALS = [10, 15, 25, 40]
const GOAL_BREAKDOWN: Record<number, string> = {
  10: '單字 10 個＋文法 3 題',
  15: '單字 10 個＋文法 5 題＋閱讀 1 篇',
  25: '單字 15 個＋文法 8 題＋閱讀 2 篇',
  40: '單字 20 個＋文法 12 題＋閱讀 3 篇',
}

const SECTIONS = [
  { id: 'identity', label: '個人資料' },
  { id: 'goal', label: '學習目標' },
  { id: 'reminder', label: '提醒與通知' },
] as const

function initialsOf(name: string): string {
  const trimmed = name.trim()
  if (!trimmed) return '—'
  return trimmed.length <= 2 ? trimmed : trimmed.slice(0, 2)
}

function daysUntil(dateStr: string): number | null {
  const target = new Date(`${dateStr}T00:00:00`)
  if (Number.isNaN(target.getTime())) return null
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return Math.round((target.getTime() - today.getTime()) / 86_400_000)
}

export default function ProfilePage() {
  const { user, logout } = useAuth()
  const [saved, setSaved] = useState<UserProfile | null>(null)
  const [draft, setDraft] = useState<UserProfile | null>(null)
  const [estimated, setEstimated] = useState<number | null>(null)
  const [justSaved, setJustSaved] = useState(false)

  useEffect(() => {
    const stored = getProfile()
    const withNickname: UserProfile = {
      ...stored,
      nickname: stored.nickname || user?.nickname || '',
    }
    setSaved(withNickname)
    setDraft(withNickname)

    const stats = getCategoryStats()
    const total = stats.reduce((a, c) => a + c.totalAnswered, 0)
    const correct = stats.reduce((a, c) => a + c.correctCount, 0)
    const vocabCount = Object.values(getVocabMasteryMap()).filter((v) => v.level >= 2).length
    setEstimated(
      estimateToeicScore({
        totalAnswered: total,
        overallAccuracy: total > 0 ? Math.round((correct / total) * 100) : 0,
        vocabMasteryRate: vocabCount > 0 ? Math.min(100, Math.round((vocabCount / 352) * 100)) : 0,
      }).score
    )
  }, [user])

  const changedKeys = useMemo(() => {
    if (!saved || !draft) return []
    return (Object.keys(DEFAULT_PROFILE) as (keyof UserProfile)[]).filter(
      (key) => saved[key] !== draft[key]
    )
  }, [saved, draft])

  if (!draft || !saved) return <ProfileSkeleton />

  const set = <K extends keyof UserProfile>(key: K, value: UserProfile[K]) => {
    setDraft((prev) => (prev ? { ...prev, [key]: value } : prev))
    setJustSaved(false)
  }

  const handleSave = () => {
    const nickname = draft.nickname.trim()
    if (nickname.length > 20) return
    const next = { ...draft, nickname }
    saveProfile(next)
    setSaved(next)
    setDraft(next)
    setJustSaved(true)
  }

  const gap = estimated !== null ? draft.targetScore - estimated : null
  // 約每週 +12 分是保守估計，只用來給一個有感的時間尺度。
  const weeksToTarget = gap !== null && gap > 0 ? Math.ceil(gap / 12) : null
  const examCountdown = draft.examDate ? daysUntil(draft.examDate) : null

  return (
    // 底部的儲存列是 fixed 的，內容要自己讓出它的高度，否則最後一顆按鈕永遠被蓋住。
    <div className="flex flex-col gap-5 pb-24 lg:pb-20">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-[var(--tx)]">帳號設定</h1>
        <div className="lg:hidden">
          <ThemeToggle />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[180px_minmax(0,1fr)] lg:items-start">
        {/* 桌機左側分頁導航（設計 18） */}
        <nav className="hidden lg:sticky lg:top-20 lg:block" aria-label="設定分頁">
          <div className="mb-4 flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-full border border-[var(--pr-ln)] bg-[var(--pr-sf)] text-sm font-bold text-[var(--pr)]">
              {initialsOf(draft.nickname || user?.email || '')}
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold text-[var(--tx)]">
                {draft.nickname || '未命名'}
              </span>
            </span>
          </div>
          <ul className="space-y-0.5">
            {SECTIONS.map((section) => (
              <li key={section.id}>
                <a
                  href={`#${section.id}`}
                  className="block rounded-lg px-3 py-2 text-[13px] text-[var(--mu)] transition-colors hover:bg-[var(--sf2)] hover:text-[var(--tx)]"
                >
                  {section.label}
                </a>
              </li>
            ))}
          </ul>
          <ThemeToggle />
        </nav>

        <div className="space-y-5">
          {/* 身分 */}
          <section
            id="identity"
            className="space-y-4 rounded-2xl border border-[var(--ln)] bg-[var(--sf)] p-5"
          >
            <div>
              <h2 className="text-sm font-bold text-[var(--tx)]">個人資料</h2>
              <p className="mt-0.5 text-xs text-[var(--mu)]">
                這些資訊只用於顯示與估分，不會公開。
              </p>
            </div>

            <div className="flex items-center gap-4">
              <span className="flex h-14 w-14 items-center justify-center rounded-full border border-[var(--pr-ln)] bg-[var(--pr-sf)] text-lg font-bold text-[var(--pr)]">
                {initialsOf(draft.nickname || user?.email || '')}
              </span>
              <p className="text-xs text-[var(--mu)]">頭像由暱稱前兩個字產生</p>
            </div>

            <label className="block">
              <span className="flex items-baseline justify-between text-xs font-semibold text-[var(--mu)]">
                暱稱
                <span className={cn('font-mono', draft.nickname.length > 20 && 'text-[var(--bad)]')}>
                  {draft.nickname.length}/20
                </span>
              </span>
              <input
                type="text"
                value={draft.nickname}
                onChange={(e) => set('nickname', e.target.value)}
                maxLength={40}
                className="mt-1.5 w-full rounded-lg border border-[var(--ln)] bg-[var(--bg)] px-3 py-2.5 text-sm text-[var(--tx)] focus:border-[var(--pr)]"
              />
              {draft.nickname.length > 20 && (
                <span className="mt-1 block text-xs text-[var(--bad)]">暱稱最多 20 個字</span>
              )}
            </label>

            <label className="block">
              <span className="text-xs font-semibold text-[var(--mu)]">電子信箱</span>
              <input
                type="email"
                value={user?.email ?? ''}
                readOnly
                className="mt-1.5 w-full cursor-not-allowed rounded-lg border border-[var(--ln)] bg-[var(--sf2)] px-3 py-2.5 font-mono text-sm text-[var(--mu)]"
              />
              <span className="mt-1 block text-xs text-[var(--fa)]">
                信箱是登入帳號，目前無法在應用內變更。
              </span>
            </label>
          </section>

          {/* 學習目標 */}
          <section
            id="goal"
            className="space-y-5 rounded-2xl border border-[var(--ln)] bg-[var(--sf)] p-5"
          >
            <h2 className="text-sm font-bold text-[var(--tx)]">學習目標</h2>

            <div>
              <div className="flex items-baseline justify-between text-xs">
                <span className="font-semibold text-[var(--mu)]">目標分數</span>
                <span className="text-[var(--mu)]">
                  目前預估 {estimated ?? '--'}
                </span>
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-3xl font-extrabold text-[var(--pr)]">{draft.targetScore}</span>
                {gap !== null && (
                  <span className="text-xs text-[var(--mu)]">
                    {gap > 0
                      ? `還差 ${gap} 分${weeksToTarget ? ` · 約 ${weeksToTarget} 週` : ''}`
                      : '已達成目標'}
                  </span>
                )}
              </div>
              <input
                type="range"
                min={400}
                max={990}
                step={5}
                value={draft.targetScore}
                onChange={(e) => set('targetScore', Number(e.target.value))}
                aria-label="目標分數"
                className="mt-3 w-full accent-[var(--pr)]"
              />
              <div className="flex justify-between text-[11px] text-[var(--fa)]">
                <span>400</span>
                <span>990</span>
              </div>
            </div>

            <div>
              <span className="text-xs font-semibold text-[var(--mu)]">每日目標</span>
              <div className="mt-2 grid grid-cols-4 gap-2">
                {DAILY_GOALS.map((minutes) => (
                  <button
                    key={minutes}
                    type="button"
                    onClick={() => set('dailyGoalMinutes', minutes)}
                    aria-pressed={draft.dailyGoalMinutes === minutes}
                    className={cn(
                      'min-h-[42px] rounded-lg border text-sm font-semibold transition-colors',
                      draft.dailyGoalMinutes === minutes
                        ? 'border-[var(--pr)] bg-[var(--pr-sf)] text-[var(--pr)]'
                        : 'border-[var(--ln)] text-[var(--mu)] hover:text-[var(--tx)]'
                    )}
                  >
                    {minutes} 分
                  </button>
                ))}
              </div>
              <p className="mt-2 text-xs text-[var(--mu)]">
                {draft.dailyGoalMinutes} 分 ≒ {GOAL_BREAKDOWN[draft.dailyGoalMinutes] ?? '自訂組合'}
              </p>
            </div>

            <label className="block">
              <span className="text-xs font-semibold text-[var(--mu)]">考試日期</span>
              <input
                type="date"
                value={draft.examDate ?? ''}
                onChange={(e) => set('examDate', e.target.value || null)}
                className="mt-1.5 w-full rounded-lg border border-[var(--ln)] bg-[var(--bg)] px-3 py-2.5 text-sm text-[var(--tx)] focus:border-[var(--pr)]"
              />
              {examCountdown !== null && (
                <span className="mt-1 block text-xs text-[var(--mu)]">
                  {examCountdown > 0
                    ? `${examCountdown} 天後`
                    : examCountdown === 0
                      ? '就是今天'
                      : `已過 ${-examCountdown} 天`}
                </span>
              )}
            </label>
          </section>

          {/* 提醒 */}
          <section
            id="reminder"
            className="space-y-4 rounded-2xl border border-[var(--ln)] bg-[var(--sf)] p-5"
          >
            <h2 className="text-sm font-bold text-[var(--tx)]">提醒與通知</h2>

            <ToggleRow
              label="每日提醒"
              description={`尚未完成任務時於 ${draft.reminderTime} 提醒`}
              checked={draft.reminderEnabled}
              onChange={(v) => set('reminderEnabled', v)}
            />

            <label className="flex items-center justify-between gap-4">
              <span className="text-sm text-[var(--tx)]">提醒時間</span>
              <input
                type="time"
                value={draft.reminderTime}
                disabled={!draft.reminderEnabled}
                onChange={(e) => set('reminderTime', e.target.value)}
                className="rounded-lg border border-[var(--ln)] bg-[var(--bg)] px-3 py-2 font-mono text-sm text-[var(--tx)] focus:border-[var(--pr)] disabled:opacity-50"
              />
            </label>

            <ToggleRow
              label="連續天數保護"
              description="每月一次，忘記練習不中斷"
              checked={draft.streakShield}
              onChange={(v) => set('streakShield', v)}
            />

            <ToggleRow
              label="每週成績報告"
              description="週日晚間整理弱項摘要"
              checked={draft.weeklyReport}
              onChange={(v) => set('weeklyReport', v)}
            />

            <p className="border-t border-[var(--ln)] pt-3 text-[11px] leading-relaxed text-[var(--fa)]">
              提醒設定會存到你的帳號，實際推播需要瀏覽器授權通知權限。
            </p>
          </section>

          <button
            type="button"
            onClick={() => logout()}
            className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl border border-[var(--ln)] text-sm font-semibold text-[var(--mu)] transition-colors hover:text-[var(--bad)]"
          >
            <LogOut className="h-4 w-4" /> 登出
          </button>
        </div>
      </div>

      {/* 儲存列固定在底部，未變更時停用（設計 10） */}
      <div className="fixed bottom-[calc(var(--nav-h)+0.5rem)] left-0 right-0 z-30 mx-auto max-w-md px-4 md:max-w-2xl lg:max-w-[1180px] lg:px-6">
        <div className="flex items-center gap-3 rounded-2xl border border-[var(--ln2)] bg-[var(--sf)] p-3 shadow-lg">
          <span className="flex-1 text-xs text-[var(--mu)]">
            {changedKeys.length > 0
              ? `已變更 ${changedKeys.length} 項 · 尚未儲存`
              : justSaved
                ? '已儲存'
                : '沒有未儲存的變更'}
          </span>
          {changedKeys.length > 0 && (
            <button
              type="button"
              onClick={() => setDraft(saved)}
              className="min-h-[38px] rounded-lg border border-[var(--ln)] px-3 text-xs font-semibold text-[var(--mu)] hover:text-[var(--tx)]"
            >
              取消
            </button>
          )}
          <Button
            variant="primary"
            onClick={handleSave}
            disabled={changedKeys.length === 0 || draft.nickname.trim().length > 20}
            className={cn(
              'min-h-[38px] w-auto px-5 text-xs',
              (changedKeys.length === 0 || draft.nickname.trim().length > 20) &&
                'cursor-not-allowed opacity-50'
            )}
          >
            儲存變更
          </Button>
        </div>
      </div>
    </div>
  )
}

function ToggleRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string
  description: string
  checked: boolean
  onChange: (value: boolean) => void
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="min-w-0">
        <span className="block text-sm text-[var(--tx)]">{label}</span>
        <span className="block text-xs text-[var(--mu)]">{description}</span>
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative h-6 w-11 shrink-0 rounded-full border transition-colors duration-200',
          checked ? 'border-[var(--pr)] bg-[var(--pr)]' : 'border-[var(--ln2)] bg-[var(--sf2)]'
        )}
      >
        <span
          className={cn(
            'absolute top-0.5 h-4.5 w-4.5 rounded-full transition-all duration-200',
            checked ? 'left-[22px] bg-[var(--pr-tx)]' : 'left-0.5 bg-[var(--mu)]'
          )}
          style={{ height: 18, width: 18 }}
        />
      </button>
    </div>
  )
}

function ProfileSkeleton() {
  return (
    <div className="flex animate-pulse flex-col gap-5">
      <div className="h-8 w-32 rounded-md bg-[var(--sf2)]" />
      <div className="h-64 rounded-2xl bg-[var(--sf2)]" />
      <div className="h-72 rounded-2xl bg-[var(--sf2)]" />
    </div>
  )
}
