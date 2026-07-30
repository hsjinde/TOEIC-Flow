'use client'

import { Suspense, useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { ArrowLeft, ArrowRight, Check } from 'lucide-react'
import type { FormulaCard as FormulaCardData } from '../../../../scripts/build-content/types'
import {
  getChapterById,
  getChapterLabel,
  getFormulaCard,
  getRandomFormulaCards,
  getFormulaCards,
  stripOrderPrefix,
} from '../../../lib/content'
import { FormulaCard } from '../../../components/FormulaCard'
import { Button } from '../../../components/ui/Button'
import { cn } from '../../../lib/utils'

/**
 * 一輪的張數上限。速查卡目前只有 11 張，所以隨機模式實際上就是整套洗牌後全發；
 * 留這個上限是為了將來卡片變多時，通勤一輪仍然停在可以刷完的長度。
 */
const SESSION_SIZE = 20

interface CardSession {
  items: FormulaCardData[]
  title: string
  /** 從章節頁進來的返回鍵要回得去那一章，不是首頁。 */
  backHref: string
  backLabel: string
}

function chapterHref(id: string): string {
  return `/chapters/${id.split('/').map(encodeURIComponent).join('/')}`
}

function buildSession(params: URLSearchParams): CardSession {
  const chapterId = params.get('chapter')

  if (chapterId) {
    const chapter = getChapterById(chapterId)
    const card = getFormulaCard(chapterId)
    return {
      items: card ? [card] : [],
      title: `${chapter ? getChapterLabel(chapterId) : '章節'} 速查卡`,
      backHref: chapterHref(chapterId),
      backLabel: chapter ? stripOrderPrefix(chapter.title) : '章節內容',
    }
  }

  return {
    items: getRandomFormulaCards(SESSION_SIZE),
    title: '章節速查卡',
    backHref: '/',
    backLabel: '今日任務',
  }
}

export default function FormulaCardPageWrapper() {
  return (
    <Suspense fallback={<FormulaCardSkeleton />}>
      <FormulaCardPage />
    </Suspense>
  )
}

function FormulaCardPage() {
  const searchParams = useSearchParams()
  const [session, setSession] = useState<CardSession | null>(null)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isFinished, setIsFinished] = useState(false)

  const reload = useCallback(() => {
    setSession(buildSession(new URLSearchParams(searchParams.toString())))
    setCurrentIndex(0)
    setIsFinished(false)
  }, [searchParams])

  useEffect(() => {
    reload()
  }, [reload])

  const items = session?.items ?? []
  const total = items.length
  const currentItem = items[currentIndex]

  const advance = useCallback(() => {
    setCurrentIndex((prev) => {
      if (prev + 1 < total) return prev + 1
      setIsFinished(true)
      return prev
    })
  }, [total])

  const goBack = useCallback(() => {
    setCurrentIndex((prev) => Math.max(0, prev - 1))
  }, [])

  // 通勤單手操作：方向鍵／空白鍵直接前後翻，不必每次都點準按鈕。
  useEffect(() => {
    if (!session || total === 0 || isFinished) return
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return
      if (e.code === 'Space' || e.key === 'ArrowRight') {
        e.preventDefault()
        advance()
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault()
        goBack()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [session, total, isFinished, advance, goBack])

  if (!session) return <FormulaCardSkeleton />

  if (total === 0) {
    // 69 章裡只有少數幾章寫了速查卡，所以「這一章沒有」是常態而不是錯誤，
    // 出口要指回整套隨機模式，不是把使用者留在死路上。
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-[var(--ln)] bg-[var(--sf)] px-6 py-14 text-center">
        <h2 className="text-base font-bold text-[var(--tx)]">這一章還沒有速查卡</h2>
        <p className="text-xs text-[var(--mu)]">
          目前有 {getFormulaCards().length} 章寫了速查卡，可以直接刷整套。
        </p>
        <div className="flex w-full max-w-[240px] flex-col gap-2 pt-1">
          <Link href="/practice/formulas" className="w-full">
            <Button variant="primary">刷整套速查卡</Button>
          </Link>
          <Link href={session.backHref} className="w-full">
            <Button variant="outline">返回{session.backLabel}</Button>
          </Link>
        </div>
      </div>
    )
  }

  if (isFinished || !currentItem) {
    return (
      <div className="flex flex-col items-center gap-4 rounded-2xl border border-[var(--ln)] bg-[var(--sf)] px-6 py-12 text-center">
        {/* 完成是進度，不是答題判定——綠色留給答題判定。 */}
        <div className="flex h-14 w-14 items-center justify-center rounded-full border border-[var(--pr-ln)] bg-[var(--pr-sf)] text-[var(--pr)]">
          <Check className="h-7 w-7" />
        </div>
        <div className="space-y-1">
          <h2 className="text-lg font-bold text-[var(--tx)]">{session.title}刷完了</h2>
          <p className="text-sm text-[var(--mu)]">共 {total} 張</p>
        </div>
        <div className="flex w-full max-w-[280px] flex-col gap-2 pt-1">
          <Button variant="primary" onClick={reload}>
            再刷一輪
          </Button>
          <Link href={session.backHref} className="w-full">
            <Button variant="outline">返回{session.backLabel}</Button>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-[calc(100dvh-var(--nav-h)-3.5rem)] flex-col gap-4 lg:min-h-0">
      <div className="flex items-center justify-between gap-2">
        <Link
          href={session.backHref}
          aria-label={`返回${session.backLabel}`}
          className="-ml-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-[var(--mu)] hover:bg-[var(--sf2)]"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <span className="truncate text-sm font-bold text-[var(--tx)]">
          {session.title} {currentIndex + 1} / {total}
        </span>
      </div>

      <div className="flex items-center gap-1.5">
        {items.map((item, i) => (
          <span
            key={item.chapterId}
            aria-hidden
            className={cn(
              'h-1.5 flex-1 rounded-full transition-colors duration-200',
              i < currentIndex
                ? 'bg-[var(--pr)]'
                : i === currentIndex
                  ? 'bg-[var(--pr-ln)]'
                  : 'bg-[var(--sf2)]'
            )}
          />
        ))}
      </div>

      <div className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-4">
        <FormulaCard card={currentItem} />

        {/* 速查卡不是「猜完就過」的閃卡，看完想細讀就進該章——所以留一個回章節的出口。 */}
        <Link
          href={chapterHref(currentItem.chapterId)}
          className="text-center text-[11px] font-semibold text-[var(--pr)] hover:opacity-80"
        >
          看 {getChapterLabel(currentItem.chapterId)} 完整章節 →
        </Link>

        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" onClick={goBack} disabled={currentIndex === 0}>
            <ArrowLeft className="h-4 w-4" /> 上一張
          </Button>
          <Button variant="primary" onClick={advance}>
            下一張 <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}

function FormulaCardSkeleton() {
  return (
    <div className="flex animate-pulse flex-col gap-4">
      <div className="h-9 w-full rounded-md bg-[var(--sf2)]" />
      <div className="h-1.5 w-full rounded-full bg-[var(--sf2)]" />
      <div className="h-[420px] rounded-2xl bg-[var(--sf2)]" />
    </div>
  )
}
