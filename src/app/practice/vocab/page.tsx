'use client'

import { Suspense, useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { ArrowLeft, Check, RotateCcw } from 'lucide-react'
import type { VocabItem } from '../../../../scripts/build-content/types'
import {
  getRandomVocabItems,
  getVocabByIds,
  getVocabItems,
} from '../../../lib/content'
import {
  bumpVocabMastery,
  getVocabMasteryMap,
  getWeakVocabIds,
  recordTaskCompletion,
  updateVocabMastery,
} from '../../../lib/storage'
import { resolveOrigin } from '../../../lib/origin'
import { VocabFlashcard } from '../../../components/VocabFlashcard'
import { VocabQuiz } from '../../../components/VocabQuiz'
import { Button } from '../../../components/ui/Button'
import { useScrollToTopOnChange } from '../../../lib/scroll'
import { cn } from '../../../lib/utils'

const SESSION_SIZE = 10

type Mode = 'flip' | 'quiz'

interface VocabSession {
  items: VocabItem[]
  title: string
  /** 專攻是從單字複習本進來的，返回鍵要回得去那一頁而不是首頁。 */
  backHref: string
  backLabel: string
}

const HOME: Pick<VocabSession, 'backHref' | 'backLabel'> = {
  backHref: '/',
  backLabel: '今日任務',
}
const BOOK: Pick<VocabSession, 'backHref' | 'backLabel'> = {
  backHref: '/vocab-review',
  backLabel: '單字複習本',
}

function buildBaseSession(params: URLSearchParams): VocabSession {
  const ids = params.get('ids')
  const mode = params.get('mode')

  if (ids) {
    const items = getVocabByIds(ids.split(',').filter(Boolean))
    return { items, title: '單字專攻', ...BOOK }
  }

  if (mode === 'weak') {
    // 弱點不足 10 個時補隨機字，否則按下「開始複習」只練到兩張卡就結束了。
    const weak = getVocabByIds(getWeakVocabIds(SESSION_SIZE))
    const picked = new Set(weak.map((v) => v.id))
    const filler = getVocabItems()
      .filter((v) => !picked.has(v.id))
      .sort(() => 0.5 - Math.random())
      .slice(0, Math.max(0, SESSION_SIZE - weak.length))
    return { items: [...weak, ...filler], title: '弱點單字複習', ...BOOK }
  }

  return { items: getRandomVocabItems(SESSION_SIZE), title: '單字複習', ...HOME }
}

/** 出口覆寫層：base 決定練哪些字，from 決定練完回哪。 */
export function buildSession(params: URLSearchParams): VocabSession {
  const base = buildBaseSession(params)
  const origin = resolveOrigin(params, { backHref: base.backHref, backLabel: base.backLabel })
  return { ...base, ...origin }
}

export default function VocabPracticePageWrapper() {
  return (
    <Suspense fallback={<VocabSkeleton />}>
      <VocabPracticePage />
    </Suspense>
  )
}

function VocabPracticePage() {
  const searchParams = useSearchParams()
  const [session, setSession] = useState<VocabSession | null>(null)
  const [pool, setPool] = useState<VocabItem[]>([])
  const [levels, setLevels] = useState<Record<string, number>>({})
  const [currentIndex, setCurrentIndex] = useState(0)
  const [mode, setMode] = useState<Mode>('flip')
  const [isFinished, setIsFinished] = useState(false)

  /** 抽一組新的字並把回合歸零；掛載時跑一次，結算頁的「再練一輪」也用它。 */
  const start = useCallback(() => {
    const built = buildSession(new URLSearchParams(searchParams.toString()))
    setSession(built)
    setCurrentIndex(0)
    setIsFinished(false)
    const map = getVocabMasteryMap()
    setLevels(Object.fromEntries(Object.entries(map).map(([k, v]) => [k, v.level])))
    // 誘答項從全庫抽，但排除本回會出現的字，避免「兩個選項都對」。
    const sessionIds = new Set(built.items.map((v) => v.id))
    setPool(
      getVocabItems()
        .filter((v) => !sessionIds.has(v.id))
        .sort(() => 0.5 - Math.random())
        .slice(0, 60)
    )
  }, [searchParams])

  useEffect(() => {
    start()
  }, [start])

  const vocabList = session?.items ?? []
  const total = vocabList.length
  const currentItem = vocabList[currentIndex]

  const advance = useCallback(() => {
    setCurrentIndex((prev) => {
      if (prev + 1 < total) return prev + 1
      recordTaskCompletion('vocab')
      setIsFinished(true)
      return prev
    })
  }, [total])

  const handleGrade = useCallback(
    (level: number) => {
      if (!currentItem) return
      updateVocabMastery(currentItem.id, level)
      setLevels((prev) => ({ ...prev, [currentItem.id]: level }))
      advance()
    },
    [currentItem, advance]
  )

  // 四選一作答後解析卡會展開，「下一張」被推到畫面外；按下去之後如果不回到頂端，
  // 新的一張題面就落在視窗上方看不見的地方。翻卡模式切換也一樣要重置。
  useScrollToTopOnChange(`${currentIndex}|${mode}|${isFinished}`)

  const handleQuizAnswer = useCallback(
    (isCorrect: boolean) => {
      if (!currentItem) return
      const next = bumpVocabMastery(currentItem.id, isCorrect)
      setLevels((prev) => ({ ...prev, [currentItem.id]: next }))
      // 判定後停在原地，由使用者按「下一張」或空白鍵前進。
    },
    [currentItem]
  )

  if (!session) return <VocabSkeleton />

  // 題庫抽不到字是資料缺失，不是「今天練完了」。共用完成畫面會把空題庫報告成任務成功。
  if (total === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-[var(--ln)] bg-[var(--sf)] px-6 py-14 text-center">
        <h2 className="text-base font-bold text-[var(--tx)]">目前沒有可複習的單字</h2>
        <p className="text-xs text-[var(--mu)]">單字題庫是空的，重新建置題庫後再回來。</p>
        <Link href="/" className="w-full max-w-[240px] pt-1">
          <Button variant="primary">回到今日任務</Button>
        </Link>
      </div>
    )
  }

  if (isFinished || !currentItem) {
    const mastered = vocabList.filter((v) => (levels[v.id] ?? 0) >= 2).length
    return (
      <div className="flex flex-col items-center gap-4 rounded-2xl border border-[var(--ln)] bg-[var(--sf)] px-6 py-12 text-center">
        {/* 完成是「進度」，不是「你答對了」。綠色留給答題判定。 */}
        <div className="flex h-14 w-14 items-center justify-center rounded-full border border-[var(--pr-ln)] bg-[var(--pr-sf)] text-[var(--pr)]">
          <Check className="h-7 w-7" />
        </div>
        <div className="space-y-1">
          <h2 className="text-lg font-bold text-[var(--tx)]">{session.title}完成</h2>
          <p className="text-sm text-[var(--mu)]">
            {total} 個字 · 其中 {mastered} 個已達熟悉
          </p>
        </div>
        <div className="flex w-full max-w-[280px] flex-col gap-2 pt-1">
          {/* 練完最常見的下一步是再來一輪，不是離開。 */}
          <Button variant="primary" onClick={start}>
            <RotateCcw className="h-4 w-4" /> 再練一輪
          </Button>
          <Link href={session.backHref}>
            <Button variant="outline">返回{session.backLabel}</Button>
          </Link>
        </div>
      </div>
    )
  }

  return (
    /*
     * 手機撐滿一屏。翻卡模式的卡片只有 264px，剩下的半個螢幕是空的，自評三顆按鈕就
     * 卡在畫面中段——單手拿著時那是最難按到的位置。卡片改成吃掉剩餘高度，按鈕自然
     * 落到拇指區。
     */
    <div className="flex min-h-[calc(100dvh-var(--nav-h)-3.5rem)] flex-col gap-4 lg:min-h-0">
      <div className="flex items-center justify-between">
        <Link
          href={session.backHref}
          aria-label={`返回${session.backLabel}`}
          className="-ml-2 flex h-11 w-11 items-center justify-center rounded-xl text-[var(--mu)] hover:bg-[var(--sf2)]"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <span className="text-sm font-bold text-[var(--tx)]">
          {session.title} {currentIndex + 1} / {total}
        </span>
      </div>

      <div className="flex items-center gap-1.5">
        {vocabList.map((_, i) => (
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

      {/* 設計 03：翻卡自測／四選一測驗兩種模式 */}
      <div
        role="tablist"
        aria-label="練習模式"
        className="flex rounded-xl border border-[var(--ln)] bg-[var(--sf)] p-1"
      >
        {(
          [
            ['flip', '翻卡自測'],
            ['quiz', '四選一測驗'],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            role="tab"
            id={`vocab-tab-${value}`}
            aria-selected={mode === value}
            aria-controls="vocab-tabpanel"
            onClick={() => setMode(value)}
            className={cn(
              'min-h-[44px] flex-1 rounded-lg text-xs font-semibold transition-colors',
              mode === value
                ? 'bg-[var(--pr-sf)] text-[var(--pr)]'
                : 'text-[var(--mu)] hover:text-[var(--tx)]'
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <div
        id="vocab-tabpanel"
        role="tabpanel"
        aria-labelledby={`vocab-tab-${mode}`}
        className="mx-auto flex w-full max-w-xl flex-1 flex-col"
      >
        {mode === 'flip' ? (
          <VocabFlashcard
            item={currentItem}
            onGrade={handleGrade}
            currentLevel={levels[currentItem.id] ?? 0}
          />
        ) : (
          <VocabQuiz
            item={currentItem}
            pool={pool}
            index={currentIndex}
            currentLevel={levels[currentItem.id] ?? 0}
            onAnswer={handleQuizAnswer}
            onNext={advance}
          />
        )}
      </div>
    </div>
  )
}

function VocabSkeleton() {
  return (
    <div className="flex animate-pulse flex-col gap-4">
      <div className="h-9 w-full rounded-md bg-[var(--sf2)]" />
      <div className="h-1.5 w-full rounded-full bg-[var(--sf2)]" />
      <div className="h-10 rounded-xl bg-[var(--sf2)]" />
      <div className="h-[264px] rounded-2xl bg-[var(--sf2)]" />
    </div>
  )
}
