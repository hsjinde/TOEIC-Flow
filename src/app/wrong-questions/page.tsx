'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, BookOpen, ChevronDown, RotateCcw, Trash2 } from 'lucide-react'
import {
  ANSWER_SOURCE_LABELS,
  getQuestionHistory,
  getWrongQuestionList,
  removeWrongQuestions,
  type AnswerHistoryEntry,
  type WrongQuestionRecord,
} from '../../lib/storage'
import {
  getCategoryLabel,
  getCategoryShortLabel,
  getChapterLabel,
  getQuestionById,
  getQuestionPassage,
  getQuestionStem,
} from '../../lib/content'
import type { Question } from '../../../scripts/build-content/types'
import { Button } from '../../components/ui/Button'
import { GraduationDots } from '../../components/GraduationDots'
import { ExplanationCard } from '../../components/ExplanationCard'
import { MarkdownRenderer } from '../../components/MarkdownRenderer'
import { useIsDesktop } from '../../lib/useIsDesktop'
import { cn } from '../../lib/utils'
import { PAGE_SIZE, takePage } from '../../lib/paging'

interface WrongItem {
  record: WrongQuestionRecord
  question: Question | null
  chapterId: string
}

const ALL = '__all__'

function toItems(records: WrongQuestionRecord[]): WrongItem[] {
  return records.map((record) => {
    const hashAt = record.questionId.indexOf('#')
    return {
      record,
      question: getQuestionById(record.questionId),
      chapterId: hashAt > 0 ? record.questionId.slice(0, hashAt) : '',
    }
  })
}

function relativeDay(ts: number): string {
  const days = Math.floor((Date.now() - ts) / 86_400_000)
  if (days <= 0) return '今天'
  if (days === 1) return '昨天'
  return `${days} 天前`
}

export default function WrongQuestionsPage() {
  const isDesktop = useIsDesktop()
  const [items, setItems] = useState<WrongItem[] | null>(null)
  const [filter, setFilter] = useState<string>(ALL)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [checked, setChecked] = useState<Set<string>>(new Set())
  const [page, setPage] = useState(1)

  useEffect(() => {
    setPage(1)
  }, [filter])

  const reload = useCallback(() => {
    const next = toItems(getWrongQuestionList())
    setItems(next)
    setChecked(new Set())
    // 手機是就地展開，預設全部收合；桌機右欄沒有「空」的狀態，改在下面 fallback 到第一題。
    setSelectedId((prev) => (prev && next.some((i) => i.record.questionId === prev) ? prev : null))
  }, [])

  useEffect(() => {
    reload()
  }, [reload])

  const counts = useMemo(() => {
    const map: Record<string, number> = {}
    for (const item of items ?? []) {
      map[item.record.categoryId] = (map[item.record.categoryId] ?? 0) + 1
    }
    return map
  }, [items])

  const visible = useMemo(
    () => (items ?? []).filter((i) => filter === ALL || i.record.categoryId === filter),
    [items, filter]
  )

  const openItem = useMemo(
    () => visible.find((i) => i.record.questionId === selectedId) ?? null,
    [visible, selectedId]
  )
  /** 桌機右欄永遠有內容；沒點過就顯示第一題。 */
  const selected = openItem ?? visible[0] ?? null

  if (!items) return <WrongSkeleton />

  const pending = items.filter((i) => i.record.consecutiveCorrect < 2)
  const reviewIds = (checked.size > 0 ? [...checked] : visible.map((i) => i.record.questionId))

  const toggleCheck = (id: string) => {
    setChecked((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleRemove = () => {
    if (checked.size === 0) return
    removeWrongQuestions([...checked])
    reload()
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader count={0} />
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-[var(--ln)] bg-[var(--sf)] px-6 py-14 text-center">
          <h2 className="text-base font-bold text-[var(--tx)]">錯題都清完了</h2>
          <p className="max-w-sm text-xs leading-relaxed text-[var(--mu)]">
            答錯的題目會自動收進這裡，連續答對 2 次就畢業。今天先做每日任務吧。
          </p>
          <Link href="/" className="w-full max-w-[240px] pt-1">
            <Button variant="primary">回到今日任務</Button>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader count={pending.length} />

      {/* 分類篩選 */}
      <div className="flex flex-wrap gap-2">
        <FilterChip
          label="全部"
          count={items.length}
          active={filter === ALL}
          onClick={() => setFilter(ALL)}
        />
        {Object.entries(counts)
          .sort(([, a], [, b]) => b - a)
          .map(([categoryId, count]) => (
            <FilterChip
              key={categoryId}
              label={getCategoryShortLabel(categoryId)}
              count={count}
              active={filter === categoryId}
              onClick={() => setFilter(categoryId)}
            />
          ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:items-start">
        {/* 清單 */}
        <div className="space-y-2.5">
          <div className="space-y-2.5 md:grid md:grid-cols-2 md:gap-3 md:space-y-0">
            {takePage(visible, page).map((item) => {
              const questionId = item.record.questionId
              const graduated = item.record.consecutiveCorrect >= 2
              const isSelected = selected?.record.questionId === questionId
              const isOpen = openItem?.record.questionId === questionId
              const panelId = `wrong-detail-${encodeURIComponent(questionId)}`
              return (
                <div
                  key={questionId}
                  className={cn(
                    'overflow-hidden rounded-2xl border bg-[var(--sf)] transition-colors',
                    isSelected ? 'border-[var(--pr-ln)]' : 'border-[var(--ln)]'
                  )}
                >
                  <div className="flex items-start gap-1 p-4">
                    {/* 16px 的原生 checkbox 在拇指下根本點不到，靠外層的 44px 熱區補上。 */}
                    <label className="-m-1.5 flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center">
                      <input
                        type="checkbox"
                        aria-label={`選取 ${item.question ? getQuestionStem(item.question) : questionId}`}
                        checked={checked.has(questionId)}
                        onChange={() => toggleCheck(questionId)}
                        className="h-4 w-4 accent-[var(--pr)]"
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() => setSelectedId(isOpen && !isDesktop ? null : questionId)}
                      aria-expanded={isDesktop ? undefined : isOpen}
                      aria-controls={isDesktop ? undefined : panelId}
                      className="min-w-0 flex-1 py-0.5 text-left"
                    >
                      <p className="line-clamp-2 text-sm leading-relaxed text-[var(--tx)]">
                        {/* 段落題的 stem 是「題目 5」，清單上印它等於沒印。 */}
                        {item.question ? getQuestionStem(item.question) : '（題目已不在題庫中）'}
                      </p>
                      <p className="mt-1.5 text-[11px] text-[var(--mu)]">
                        {getCategoryShortLabel(item.record.categoryId)}
                        {item.chapterId && ` · ${getChapterLabel(item.chapterId)}`}
                        {' · '}
                        {graduated ? '已畢業' : `最後答錯 ${relativeDay(item.record.lastFailedAt)}`}
                      </p>
                    </button>
                    <div className="flex shrink-0 flex-col items-end gap-1 pl-2">
                      <span className="text-[11px] text-[var(--mu)]">錯 {item.record.failCount} 次</span>
                      <GraduationDots
                        consecutiveCorrect={item.record.consecutiveCorrect}
                        className="text-sm"
                      />
                      <ChevronDown
                        aria-hidden
                        className={cn(
                          'h-4 w-4 text-[var(--mu)] transition-transform duration-200 lg:hidden',
                          isOpen && 'rotate-180'
                        )}
                      />
                    </div>
                  </div>

                  {/*
                    設計上最要緊的一條：手機的詳解長在該題底下，不是整份清單的最後面。
                    題目一多時，捲到頁尾再往回對題號是這一頁最大的摩擦。
                  */}
                  {!isDesktop && isOpen && (
                    <InlinePanel id={panelId}>
                      <WrongDetail item={item} />
                    </InlinePanel>
                  )}
                </div>
              )
            })}
          </div>

          {takePage(visible, page).length < visible.length && (
            <button
              type="button"
              onClick={() => setPage((p) => p + 1)}
              className="min-h-11 w-full rounded-2xl border border-[var(--ln)] text-xs font-semibold text-[var(--mu)] hover:bg-[var(--sf2)]"
            >
              顯示更多（還有 {visible.length - takePage(visible, page).length} 筆）
            </button>
          )}

          {/* 批次動作 */}
          <div className="sticky bottom-[calc(var(--nav-h)+0.5rem)] z-10 flex items-center gap-2 rounded-2xl border border-[var(--ln)] bg-[var(--sf)] p-3 lg:bottom-4">
            <span className="flex-1 text-xs text-[var(--mu)]">
              {checked.size > 0 ? `已選 ${checked.size} 題` : `共 ${visible.length} 題`}
            </span>
            {checked.size > 0 && (
              <button
                type="button"
                onClick={handleRemove}
                className="flex min-h-[36px] items-center gap-1.5 rounded-lg border border-[var(--ln2)] px-3 text-xs font-semibold text-[var(--mu)] transition-colors hover:text-[var(--bad)]"
              >
                <Trash2 className="h-3.5 w-3.5" /> 移出錯題本
              </button>
            )}
            <Link
              href={`/practice/grammar?mode=wrong&ids=${encodeURIComponent(reviewIds.join(','))}`}
              className={cn(reviewIds.length === 0 && 'pointer-events-none opacity-50')}
            >
              <Button variant="primary" className="min-h-[36px] w-auto px-4 py-2 text-xs">
                <RotateCcw className="h-3.5 w-3.5" />
                {checked.size > 0 ? '複習選取的題目' : `全部開始複習 ${reviewIds.length} 題`}
              </Button>
            </Link>
          </div>
        </div>

        {/* 桌機：右欄常駐預覽，跟著清單選取變動 */}
        {isDesktop && selected && (
          <aside className="space-y-4 rounded-2xl border border-[var(--ln)] bg-[var(--sf)] p-5 lg:sticky lg:top-20">
            <WrongDetail item={selected} />
          </aside>
        )}
      </div>
    </div>
  )
}

/**
 * 就地展開的詳解容器。展開後把面板頂端帶進視窗（block: 'nearest' 只在真的看不到時
 * 才捲），否則點到螢幕下緣的題目時，展開的內容整段在摺線以下。
 */
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

function PageHeader({ count }: { count: number }) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        {/*
          返回鍵指向練習中心而不是首頁：底部 tab 上這一頁亮的是「練習」，返回鍵把人
          送去「今日」就跟導航自己說的話矛盾了。從首頁的錯題卡進來的人按瀏覽器上一頁
          一樣回得去首頁。
        */}
        <Link
          href="/practice"
          aria-label="返回練習中心"
          className="-ml-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-[var(--mu)] hover:bg-[var(--sf2)] lg:hidden"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-xl font-bold text-[var(--tx)]">錯題本</h1>
      </div>
      <span className="text-xs font-semibold text-[var(--mu)]">
        {count} 題待複習 · 連續答對 2 次即畢業
      </span>
    </div>
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

/** 詳解本體。手機接在該題底下、桌機放右欄，兩邊必須是同一段內容。 */
function WrongDetail({ item }: { item: WrongItem }) {
  const [history, setHistory] = useState<AnswerHistoryEntry[]>([])

  useEffect(() => {
    setHistory(getQuestionHistory(item.record.questionId))
  }, [item.record.questionId])

  const question = item.question
  const blank = question?.blanks[0]
  const passage = question ? getQuestionPassage(question.id) : null
  // 設計 16：「你兩次都選這個」——統計每個選項被選過幾次。
  const pickCounts: Record<string, number> = {}
  for (const h of history) if (h.selectedKey) pickCounts[h.selectedKey] = (pickCounts[h.selectedKey] ?? 0) + 1

  const remaining = Math.max(0, 2 - item.record.consecutiveCorrect)

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <span className="font-semibold text-[var(--mu)]">
          {getCategoryLabel(item.record.categoryId)}
          {item.chapterId && ` · ${getChapterLabel(item.chapterId)}`}
        </span>
        <span className="flex items-center gap-1.5 text-[var(--mu)]">
          畢業進度
          <GraduationDots consecutiveCorrect={item.record.consecutiveCorrect} className="text-sm" />
          {remaining > 0 && `· 再答對 ${remaining} 次`}
        </span>
      </div>

      {!question ? (
        <p className="text-sm text-[var(--mu)]">
          這題已不在目前的題庫中（章節可能被改名），可以直接移出錯題本。
        </p>
      ) : (
        <>
          {/*
            段落題複習時看不到文章就等於看不懂題目。只給到文章本文即可——詳解本來就在
            下面，這裡不需要再做一次可作答的閱讀介面。
          */}
          {passage && (
            <details className="rounded-xl border border-[var(--ln)] bg-[var(--sf2)] px-4 py-3">
              <summary className="cursor-pointer text-xs font-semibold text-[var(--mu)]">
                {passage.title || '這一題的文章'}
              </summary>
              <div className="mt-2 max-h-[40dvh] overflow-y-auto">
                <MarkdownRenderer content={passage.passage} />
              </div>
            </details>
          )}

          <p className="font-stem text-[var(--tx)]">{getQuestionStem(question)}</p>

          {blank && (
            <ul className="space-y-1.5">
              {blank.options.map((opt) => {
                const isAnswer = opt.key === blank.answer
                const picked = pickCounts[opt.key] ?? 0
                return (
                  <li
                    key={opt.key}
                    className={cn(
                      'flex items-center gap-2 rounded-lg border px-3 py-2 text-sm',
                      isAnswer
                        ? 'border-[var(--ok)] bg-[var(--ok-sf)] text-[var(--ok)]'
                        : picked > 0
                          ? 'border-[var(--bad)] bg-[var(--bad-sf)] text-[var(--bad)]'
                          : 'border-[var(--ln)] text-[var(--tx)]'
                    )}
                  >
                    <span className="text-xs font-semibold opacity-70">({opt.key})</span>
                    <span className="flex-1">{opt.text}</span>
                    {isAnswer && <span className="text-[11px] font-bold">正解</span>}
                    {!isAnswer && picked > 0 && (
                      <span className="text-[11px] font-bold">
                        {picked > 1 ? `你選過 ${picked} 次` : '你選過這個'}
                      </span>
                    )}
                  </li>
                )
              })}
            </ul>
          )}

          {question.explanation && (
            <ExplanationCard explanation={question.explanation} answerKey={blank?.answer} />
          )}
        </>
      )}

      {history.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs font-bold text-[var(--tx)]">作答歷程</h3>
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
                {h.selectedKey && <span>選 ({h.selectedKey})</span>}
                <span className={h.isCorrect ? 'text-[var(--ok)]' : 'text-[var(--bad)]'}>
                  {h.isCorrect ? '答對' : '答錯'}
                </span>
                {h.source && <span className="opacity-70">{ANSWER_SOURCE_LABELS[h.source]}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex flex-wrap gap-2 pt-1">
        {item.chapterId && (
          <Link href={`/chapters/${item.chapterId}`} className="flex-1">
            <Button variant="outline" className="min-h-[42px] text-xs">
              <BookOpen className="h-3.5 w-3.5" /> 讀這一章
            </Button>
          </Link>
        )}
        <Link
          href={`/practice/grammar?mode=wrong&ids=${encodeURIComponent(item.record.questionId)}`}
          className="flex-1"
        >
          <Button variant="primary" className="min-h-[42px] text-xs">
            現在重做這題
          </Button>
        </Link>
      </div>
    </>
  )
}

function WrongSkeleton() {
  return (
    <div className="flex animate-pulse flex-col gap-4">
      <div className="h-6 w-28 rounded-md bg-[var(--sf2)]" />
      <div className="flex gap-2">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-8 w-20 rounded-full bg-[var(--sf2)]" />
        ))}
      </div>
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="h-[86px] rounded-2xl bg-[var(--sf2)]" />
      ))}
    </div>
  )
}
