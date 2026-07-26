'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import type { ReadingPassage } from '../../../../scripts/build-content/types'
import { getRandomReadingPassages } from '../../../lib/content'
import { recordTaskCompletion } from '../../../lib/storage'
import { ReadingPassageView } from '../../../components/ReadingPassageView'
import { SummaryModal } from '../../../components/SummaryModal'
import { Button } from '../../../components/ui/Button'

const KIND_LABELS: Record<ReadingPassage['kind'], string> = {
  single: '單句填空',
  paragraph: '短文填空',
  article: '文章閱讀',
}

export default function ReadingPracticePage() {
  const [passage, setPassage] = useState<ReadingPassage | null>(null)
  // 「還沒抽」與「抽不到」是兩個狀態。共用 passage === null 的話，題庫空了就會是一片
  // 永遠在跳動的骨架屏，使用者不知道發生什麼事。
  const [loaded, setLoaded] = useState(false)
  const [result, setResult] = useState<{ correct: number; total: number } | null>(null)

  useEffect(() => {
    setPassage(getRandomReadingPassages(1)[0] ?? null)
    setLoaded(true)
  }, [])

  const handleComplete = (correctCount: number) => {
    recordTaskCompletion('reading')
    setResult({ correct: correctCount, total: passage?.questions.length ?? 0 })
  }

  if (!loaded) return <ReadingSkeleton />

  if (!passage) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-[var(--ln)] bg-[var(--sf)] px-6 py-14 text-center">
        <h2 className="text-base font-bold text-[var(--tx)]">目前沒有可練的閱讀題</h2>
        <p className="text-xs text-[var(--mu)]">閱讀題庫是空的，重新建置題庫後再回來。</p>
        <Link href="/" className="w-full max-w-[240px] pt-1">
          <Button variant="primary">回到今日任務</Button>
        </Link>
      </div>
    )
  }

  if (result) {
    return (
      <SummaryModal
        correctCount={result.correct}
        totalCount={result.total}
        title="閱讀任務完成"
      />
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex min-w-0 items-center gap-2">
          <Link
            href="/"
            aria-label="返回今日任務"
            className="-ml-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-[var(--mu)] hover:bg-[var(--sf2)]"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <h1 className="truncate text-sm font-bold text-[var(--tx)]">
            閱讀理解 · {KIND_LABELS[passage.kind]}
          </h1>
        </div>
        <span className="shrink-0 text-xs text-[var(--mu)]">{passage.questions.length} 題</span>
      </div>

      <ReadingPassageView passage={passage} onComplete={handleComplete} />
    </div>
  )
}

function ReadingSkeleton() {
  return (
    <div className="flex animate-pulse flex-col gap-4">
      <div className="h-9 w-full rounded-md bg-[var(--sf2)]" />
      <div className="h-10 rounded-xl bg-[var(--sf2)]" />
      <div className="h-[320px] rounded-2xl bg-[var(--sf2)]" />
    </div>
  )
}
