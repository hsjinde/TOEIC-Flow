'use client'

import { Suspense, useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { ArrowLeft, ArrowRight, Check } from 'lucide-react'
import type { Formula } from '../../../../scripts/build-content/types'
import {
  getChapterById,
  getChapterLabel,
  getFormulasByChapter,
  getRandomFormulas,
  stripOrderPrefix,
} from '../../../lib/content'
import { FormulaFlashcard } from '../../../components/FormulaFlashcard'
import { Button } from '../../../components/ui/Button'
import { cn } from '../../../lib/utils'

/** 30 秒一輪的通勤節奏：20 條約 10 分鐘，刷完可以再刷一輪，不強制停在固定張數。 */
const SESSION_SIZE = 20

interface FormulaSession {
  items: Formula[]
  title: string
  /** 從章節頁進來的返回鍵要回得去那一章，不是首頁。 */
  backHref: string
  backLabel: string
}

function chapterHref(id: string): string {
  return `/chapters/${id.split('/').map(encodeURIComponent).join('/')}`
}

function buildSession(params: URLSearchParams): FormulaSession {
  const chapterId = params.get('chapter')

  if (chapterId) {
    const chapter = getChapterById(chapterId)
    const items = [...getFormulasByChapter(chapterId)].sort((a, b) => a.number - b.number)
    return {
      items,
      title: `${chapter ? getChapterLabel(chapterId) : '秒殺公式'} 秒殺公式`,
      backHref: chapterHref(chapterId),
      backLabel: chapter ? stripOrderPrefix(chapter.title) : '章節內容',
    }
  }

  return {
    items: getRandomFormulas(SESSION_SIZE),
    title: '秒殺公式閃卡',
    backHref: '/',
    backLabel: '今日任務',
  }
}

export default function FormulaFlashcardPageWrapper() {
  return (
    <Suspense fallback={<FormulaSkeleton />}>
      <FormulaFlashcardPage />
    </Suspense>
  )
}

function FormulaFlashcardPage() {
  const searchParams = useSearchParams()
  const [session, setSession] = useState<FormulaSession | null>(null)
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

  if (!session) return <FormulaSkeleton />

  if (total === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-[var(--ln)] bg-[var(--sf)] px-6 py-14 text-center">
        <h2 className="text-base font-bold text-[var(--tx)]">這裡還沒有秒殺公式</h2>
        <p className="text-xs text-[var(--mu)]">換一章，或從首頁隨機刷一輪。</p>
        <Link href={session.backHref} className="w-full max-w-[240px] pt-1">
          <Button variant="primary">返回{session.backLabel}</Button>
        </Link>
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
          <p className="text-sm text-[var(--mu)]">共 {total} 條</p>
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
        {items.map((_, i) => (
          <span
            key={i}
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
        <FormulaFlashcard formula={currentItem} />

        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" onClick={goBack} disabled={currentIndex === 0}>
            <ArrowLeft className="h-4 w-4" /> 上一條
          </Button>
          <Button variant="primary" onClick={advance}>
            下一條 <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}

function FormulaSkeleton() {
  return (
    <div className="flex animate-pulse flex-col gap-4">
      <div className="h-9 w-full rounded-md bg-[var(--sf2)]" />
      <div className="h-1.5 w-full rounded-full bg-[var(--sf2)]" />
      <div className="h-[264px] rounded-2xl bg-[var(--sf2)]" />
    </div>
  )
}
