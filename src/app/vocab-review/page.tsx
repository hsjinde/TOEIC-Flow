'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, BookOpen, ChevronDown, RotateCcw, Volume2 } from 'lucide-react'
import type { VocabItem } from '../../../scripts/build-content/types'
import {
  LEECH_WRONG_THRESHOLD,
  VOCAB_STATUS_LABELS,
  getQuestionHistory,
  getSrsIntervalLabel,
  getVocabStats,
  type AnswerHistoryEntry,
  type VocabStat,
  type VocabStatus,
} from '../../lib/storage'
import { getChapterLabel, getVocabById, getVocabItems } from '../../lib/content'
import { Button } from '../../components/ui/Button'
import { MasteryDots } from '../../components/MasteryDots'
import { EmphasisText } from '../../components/EmphasisText'
import { speakWord } from '../../lib/speech'
import { useIsDesktop } from '../../lib/useIsDesktop'
import { cn } from '../../lib/utils'

/** 一鍵複習抓幾個字，跟每日單字任務同一個量。 */
const SESSION_SIZE = 10

const ALL = '__all__'
const STATUS_ORDER: VocabStatus[] = ['leech', 'due', 'learning', 'mastered']

interface VocabRow {
  stat: VocabStat
  item: VocabItem
}

function relativePast(ts: number): string {
  if (!ts) return '還沒練過'
  const days = Math.floor((Date.now() - ts) / 86_400_000)
  if (days <= 0) return '今天複習過'
  if (days === 1) return '昨天複習過'
  return `${days} 天前複習過`
}

function relativeDue(stat: VocabStat): string {
  if (!stat.dueAt) return `下次 ${getSrsIntervalLabel(stat.level)}`
  const diff = stat.dueAt - Date.now()
  if (diff <= 0) return '該複習了'
  const days = Math.ceil(diff / 86_400_000)
  if (days <= 1) return '明天要複習'
  return `${days} 天後複習`
}

export default function VocabReviewPage() {
  const isDesktop = useIsDesktop()
  const [rows, setRows] = useState<VocabRow[] | null>(null)
  const [filter, setFilter] = useState<string>(ALL)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [checked, setChecked] = useState<Set<string>>(new Set())

  const reload = useCallback(() => {
    // 改過筆記檔名的舊紀錄會查不到字，直接略過——複習本沒有「移除」動作可以給。
    const next: VocabRow[] = []
    for (const stat of getVocabStats()) {
      const item = getVocabById(stat.vocabId)
      if (item) next.push({ stat, item })
    }
    setRows(next)
    // 手機就地展開，預設收合；桌機右欄的 fallback 在下面。
    setSelectedId((prev) => (prev && next.some((r) => r.stat.vocabId === prev) ? prev : null))
  }, [])

  useEffect(() => {
    reload()
  }, [reload])

  const counts = useMemo(() => {
    const map: Record<string, number> = {}
    for (const row of rows ?? []) map[row.stat.status] = (map[row.stat.status] ?? 0) + 1
    return map
  }, [rows])

  const visible = useMemo(
    () => (rows ?? []).filter((r) => filter === ALL || r.stat.status === filter),
    [rows, filter]
  )

  const openRow = useMemo(
    () => visible.find((r) => r.stat.vocabId === selectedId) ?? null,
    [visible, selectedId]
  )
  /** 桌機右欄永遠有內容；沒點過就顯示第一個字。 */
  const selected = openRow ?? visible[0] ?? null

  if (!rows) return <VocabReviewSkeleton />

  const totalVocab = getVocabItems().length
  const weakCount = rows.filter((r) => r.stat.status !== 'mastered').length

  if (rows.length === 0) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader weakCount={0} practiced={0} totalVocab={totalVocab} />
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-[var(--ln)] bg-[var(--sf)] px-6 py-14 text-center">
          <h2 className="text-base font-bold text-[var(--tx)]">還沒有單字紀錄</h2>
          <p className="max-w-sm text-xs leading-relaxed text-[var(--mu)]">
            練過的字會自動收進這裡，答錯或自評「不會」{LEECH_WRONG_THRESHOLD} 次以上就會被標成常錯，
            隔一段時間沒複習的字也會排到前面。
          </p>
          <Link href="/practice/vocab" className="w-full max-w-[240px] pt-1">
            <Button variant="primary">開始單字複習</Button>
          </Link>
        </div>
      </div>
    )
  }

  const toggleCheck = (id: string) => {
    setChecked((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const reviewIds =
    checked.size > 0 ? [...checked] : visible.slice(0, SESSION_SIZE).map((r) => r.stat.vocabId)

  return (
    <div className="flex flex-col gap-4">
      <PageHeader weakCount={weakCount} practiced={rows.length} totalVocab={totalVocab} />

      {/* 四個分組的數量：常錯／待複習／不熟／已熟 */}
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        {STATUS_ORDER.map((status) => (
          <StatusTile key={status} status={status} count={counts[status] ?? 0} />
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        <FilterChip
          label="全部"
          count={rows.length}
          active={filter === ALL}
          onClick={() => setFilter(ALL)}
        />
        {STATUS_ORDER.filter((s) => (counts[s] ?? 0) > 0).map((status) => (
          <FilterChip
            key={status}
            label={VOCAB_STATUS_LABELS[status]}
            count={counts[status] ?? 0}
            active={filter === status}
            onClick={() => setFilter(status)}
          />
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:items-start">
        {/* 清單 */}
        <div className="space-y-2.5">
          {visible.map((row) => {
            const { stat, item } = row
            const isSelected = selected?.stat.vocabId === stat.vocabId
            const isOpen = openRow?.stat.vocabId === stat.vocabId
            const panelId = `vocab-detail-${encodeURIComponent(stat.vocabId)}`
            return (
              <div
                key={stat.vocabId}
                className={cn(
                  'overflow-hidden rounded-2xl border bg-[var(--sf)] transition-colors',
                  isSelected ? 'border-[var(--pr-ln)]' : 'border-[var(--ln)]'
                )}
              >
                <div className="flex items-start gap-1 p-4">
                  <label className="-m-1.5 flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center">
                    <input
                      type="checkbox"
                      aria-label={`選取 ${item.word}`}
                      checked={checked.has(stat.vocabId)}
                      onChange={() => toggleCheck(stat.vocabId)}
                      className="h-4 w-4 accent-[var(--pr)]"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => setSelectedId(isOpen && !isDesktop ? null : stat.vocabId)}
                    aria-expanded={isDesktop ? undefined : isOpen}
                    aria-controls={isDesktop ? undefined : panelId}
                    className="min-w-0 flex-1 py-0.5 text-left"
                  >
                    <p className="flex flex-wrap items-center gap-2">
                      <span className="font-option text-[15px] font-bold text-[var(--tx)]">
                        {item.word}
                      </span>
                      {item.pos && (
                        <span className="rounded-md bg-[var(--sf2)] px-1.5 py-0.5 text-[11px] text-[var(--mu)]">
                          {item.pos}
                        </span>
                      )}
                      <StatusBadge status={stat.status} />
                    </p>
                    <p className="mt-1 truncate text-[13px] text-[var(--mu)]">{item.meaning}</p>
                    <p className="mt-1.5 text-[11px] text-[var(--mu)]">
                      {relativePast(stat.lastReviewed)}
                      {stat.attempts > 0 &&
                        ` · 練過 ${stat.attempts} 次 · 正確率 ${stat.accuracyRate}%`}
                    </p>
                  </button>
                  <div className="flex shrink-0 flex-col items-end gap-1 pl-2">
                    {stat.wrongCount > 0 && (
                      <span className="text-[11px] text-[var(--mu)]">錯 {stat.wrongCount} 次</span>
                    )}
                    <MasteryDots level={stat.level} className="text-sm" />
                    <ChevronDown
                      aria-hidden
                      className={cn(
                        'h-4 w-4 text-[var(--mu)] transition-transform duration-200 lg:hidden',
                        isOpen && 'rotate-180'
                      )}
                    />
                  </div>
                </div>

                {/* 手機：字義與例句就地展開在該字底下，不必捲到整份清單的最後面。 */}
                {!isDesktop && isOpen && (
                  <InlinePanel id={panelId}>
                    <VocabDetail row={row} />
                  </InlinePanel>
                )}
              </div>
            )
          })}

          {/* 批次動作 */}
          <div className="sticky bottom-[calc(var(--nav-h)+0.5rem)] z-10 flex items-center gap-2 rounded-2xl border border-[var(--ln)] bg-[var(--sf)] p-3 lg:bottom-4">
            <span className="flex-1 text-xs text-[var(--mu)]">
              {checked.size > 0 ? `已選 ${checked.size} 個字` : `共 ${visible.length} 個字`}
            </span>
            <Link
              href={`/practice/vocab?ids=${encodeURIComponent(reviewIds.join(','))}`}
              className={cn(reviewIds.length === 0 && 'pointer-events-none opacity-50')}
            >
              <Button variant="primary" className="min-h-[36px] w-auto px-4 py-2 text-xs">
                <RotateCcw className="h-3.5 w-3.5" />
                {checked.size > 0 ? '複習選取的字' : `開始複習 ${reviewIds.length} 個`}
              </Button>
            </Link>
          </div>
        </div>

        {/* 桌機：右欄常駐預覽 */}
        {isDesktop && selected && (
          <aside className="space-y-4 rounded-2xl border border-[var(--ln)] bg-[var(--sf)] p-5 lg:sticky lg:top-20">
            <VocabDetail row={selected} />
          </aside>
        )}
      </div>
    </div>
  )
}

/** 就地展開的容器。與錯題本同一種行為：展開後把面板帶進視窗。 */
function InlinePanel({ id, children }: { id: string; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    ref.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [])

  return (
    <div
      ref={ref}
      id={id}
      className="animate-fade-in space-y-4 border-t border-[var(--ln)] px-4 py-4"
    >
      {children}
    </div>
  )
}

function PageHeader({
  weakCount,
  practiced,
  totalVocab,
}: {
  weakCount: number
  practiced: number
  totalVocab: number
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="flex items-center gap-2">
        {/* 與錯題本同一條規則：返回鍵指向底部 tab 上正在亮著的那一格（練習中心）。 */}
        <Link
          href="/practice"
          aria-label="返回練習中心"
          className="-ml-2 rounded-xl p-2 text-[var(--mu)] hover:bg-[var(--sf2)] lg:hidden"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-xl font-bold text-[var(--tx)]">單字複習本</h1>
      </div>
      <span className="text-xs font-semibold text-[var(--mu)]">
        {weakCount} 個字要加強 · 已練過 {practiced} / {totalVocab}
      </span>
    </div>
  )
}

const STATUS_HINTS: Record<VocabStatus, string> = {
  leech: `錯 ${LEECH_WRONG_THRESHOLD} 次以上`,
  due: '間隔到了',
  learning: '還沒記熟',
  mastered: '時間未到',
}

function StatusTile({ status, count }: { status: VocabStatus; count: number }) {
  return (
    <div className="rounded-2xl border border-[var(--ln)] bg-[var(--sf)] p-3.5">
      <div className="text-xs text-[var(--mu)]">{VOCAB_STATUS_LABELS[status]}</div>
      <div className="mt-1 text-lg font-bold text-[var(--tx)]">{count}</div>
      <div className="text-[11px] text-[var(--fa)]">{STATUS_HINTS[status]}</div>
    </div>
  )
}

/** 單色系統：狀態只用主色與中性色區分，綠／紅留給答題判定。 */
function StatusBadge({ status }: { status: VocabStatus }) {
  if (status === 'mastered') return null
  return (
    <span
      className={cn(
        'rounded-md px-1.5 py-0.5 text-[11px] font-bold',
        status === 'learning'
          ? 'bg-[var(--sf2)] text-[var(--mu)]'
          : 'bg-[var(--pr-sf)] text-[var(--pr)]'
      )}
    >
      {VOCAB_STATUS_LABELS[status]}
    </span>
  )
}

function FilterChip({
  label,
  count,
  active,
  onClick,
}: {
  label: string
  count: number
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'min-h-[44px] rounded-full border px-3.5 text-xs font-medium transition-colors',
        active
          ? 'border-[var(--pr-ln)] bg-[var(--pr-sf)] font-bold text-[var(--pr)]'
          : 'border-[var(--ln)] text-[var(--mu)] hover:text-[var(--tx)]'
      )}
    >
      {label} <span className="opacity-70">{count}</span>
    </button>
  )
}

/** 單字詳情本體。手機接在該字底下、桌機放右欄，兩邊是同一段內容。 */
function VocabDetail({ row }: { row: VocabRow }) {
  const { stat, item } = row
  const [history, setHistory] = useState<AnswerHistoryEntry[]>([])

  useEffect(() => {
    setHistory(getQuestionHistory(stat.vocabId))
  }, [stat.vocabId])

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <span className="font-semibold text-[var(--mu)]">{getChapterLabel(item.chapterId)}</span>
        <span className="flex items-center gap-1.5 text-[var(--mu)]">
          熟悉度 <MasteryDots level={stat.level} className="text-sm" /> · {relativeDue(stat)}
        </span>
      </div>

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          {/*
            44px 的 Display 是「該畫面唯一的主角」才有的待遇。桌機右欄成立，手機不
            成立——就地展開時，這個字已經印在正上方那一列了，再用兩行 44px 複述一次
            只是把例句擠出畫面。
          */}
          <h2 className="hidden font-display text-[var(--tx)] lg:block">{item.word}</h2>
          <p className="text-sm font-bold text-[var(--pr)] lg:mt-1">{item.meaning}</p>
        </div>
        <button
          type="button"
          onClick={() => speakWord(item.word)}
          title="朗讀發音"
          aria-label={`朗讀 ${item.word}`}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[var(--pr)] transition-colors hover:bg-[var(--pr-sf)]"
        >
          <Volume2 className="h-5 w-5" />
        </button>
      </div>

      {item.example && (
        <div className="space-y-1.5 border-t border-[var(--ln)] pt-3">
          <p className="font-option text-[13px] leading-relaxed text-[var(--mu)]">
            <EmphasisText text={item.example} />
          </p>
          {item.exampleZh && (
            <p className="text-[13px] leading-relaxed text-[var(--mu)] opacity-80">
              {item.exampleZh}
            </p>
          )}
        </div>
      )}

      <div className="grid grid-cols-3 gap-2 border-t border-[var(--ln)] pt-3 text-center">
        <MiniStat label="練過" value={`${stat.attempts} 次`} />
        <MiniStat label="答錯" value={`${stat.wrongCount} 次`} />
        <MiniStat label="正確率" value={stat.attempts > 0 ? `${stat.accuracyRate}%` : '—'} />
      </div>

      {history.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs font-bold text-[var(--tx)]">複習歷程</h3>
          <ul className="space-y-1 text-[11px] text-[var(--mu)]">
            {history.slice(0, 6).map((h, i) => (
              <li key={i} className="flex items-center gap-2">
                <span className="font-mono">
                  {new Date(h.timestamp).toLocaleString('zh-TW', {
                    month: 'numeric',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
                <span className={h.isCorrect ? 'text-[var(--ok)]' : 'text-[var(--bad)]'}>
                  {h.isCorrect ? '記得' : '沒記住'}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex flex-wrap gap-2 pt-1">
        <Link href={`/chapters/${item.chapterId}`} className="flex-1">
          <Button variant="outline" className="min-h-[42px] text-xs">
            <BookOpen className="h-3.5 w-3.5" /> 讀這一章
          </Button>
        </Link>
        <Link
          href={`/practice/vocab?ids=${encodeURIComponent(stat.vocabId)}`}
          className="flex-1"
        >
          <Button variant="primary" className="min-h-[42px] text-xs">
            現在複習這個字
          </Button>
        </Link>
      </div>
    </>
  )
}

function MiniStat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-sm font-bold text-[var(--tx)]">{value}</div>
      <div className="text-[11px] text-[var(--mu)]">{label}</div>
    </div>
  )
}

function VocabReviewSkeleton() {
  return (
    <div className="flex animate-pulse flex-col gap-4">
      <div className="h-6 w-32 rounded-md bg-[var(--sf2)]" />
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-[74px] rounded-2xl bg-[var(--sf2)]" />
        ))}
      </div>
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="h-[92px] rounded-2xl bg-[var(--sf2)]" />
      ))}
    </div>
  )
}
