'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Check } from 'lucide-react'
import type { VocabItem } from '../../../../scripts/build-content/types'
import { getRandomVocabItems, getVocabItems } from '../../../lib/content'
import {
  bumpVocabMastery,
  getVocabMasteryMap,
  recordTaskCompletion,
  updateVocabMastery,
} from '../../../lib/storage'
import { VocabFlashcard } from '../../../components/VocabFlashcard'
import { VocabQuiz } from '../../../components/VocabQuiz'
import { Button } from '../../../components/ui/Button'
import { cn } from '../../../lib/utils'

const SESSION_SIZE = 10

type Mode = 'flip' | 'quiz'

export default function VocabPracticePage() {
  const [vocabList, setVocabList] = useState<VocabItem[] | null>(null)
  const [pool, setPool] = useState<VocabItem[]>([])
  const [levels, setLevels] = useState<Record<string, number>>({})
  const [currentIndex, setCurrentIndex] = useState(0)
  const [mode, setMode] = useState<Mode>('flip')
  const [isFinished, setIsFinished] = useState(false)

  useEffect(() => {
    const list = getRandomVocabItems(SESSION_SIZE)
    setVocabList(list)
    const map = getVocabMasteryMap()
    setLevels(Object.fromEntries(Object.entries(map).map(([k, v]) => [k, v.level])))
    // 誘答項從全庫抽，但排除本回會出現的字，避免「兩個選項都對」。
    const sessionIds = new Set(list.map((v) => v.id))
    setPool(
      getVocabItems()
        .filter((v) => !sessionIds.has(v.id))
        .sort(() => 0.5 - Math.random())
        .slice(0, 60)
    )
  }, [])

  const total = vocabList?.length ?? 0
  const currentItem = vocabList?.[currentIndex]

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

  const handleQuizAnswer = useCallback(
    (isCorrect: boolean) => {
      if (!currentItem) return
      const next = bumpVocabMastery(currentItem.id, isCorrect)
      setLevels((prev) => ({ ...prev, [currentItem.id]: next }))
      // 判定後停在原地，由使用者按「下一張」或空白鍵前進。
    },
    [currentItem]
  )

  if (!vocabList) return <VocabSkeleton />

  // 題庫抽不到字是資料缺失，不是「今天練完了」。共用完成畫面會把空題庫報告成任務成功。
  if (vocabList.length === 0) {
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
          <h2 className="text-lg font-bold text-[var(--tx)]">單字複習完成</h2>
          <p className="text-sm text-[var(--mu)]">
            {total} 個字 · 其中 {mastered} 個已達熟悉
          </p>
        </div>
        <Link href="/" className="w-full max-w-[280px] pt-1">
          <Button variant="primary">返回今日任務</Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <Link
          href="/"
          aria-label="返回今日任務"
          className="-ml-2 flex h-11 w-11 items-center justify-center rounded-xl text-[var(--mu)] hover:bg-[var(--sf2)]"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <span className="text-sm font-bold text-[var(--tx)]">
          單字複習 {currentIndex + 1} / {total}
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
        className="mx-auto w-full max-w-xl"
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
