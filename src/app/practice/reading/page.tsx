'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import type { ReadingPassage } from '../../../../scripts/build-content/types'
import { getRandomReadingPassages } from '../../../lib/content'
import { recordTaskCompletion } from '../../../lib/storage'
import { ReadingPassageView } from '../../../components/ReadingPassageView'
import { SummaryModal } from '../../../components/SummaryModal'

const KIND_LABELS: Record<ReadingPassage['kind'], string> = {
  single: '單句填空',
  paragraph: '短文填空',
  article: '文章閱讀',
}

export default function ReadingPracticePage() {
  const [passage, setPassage] = useState<ReadingPassage | null>(null)
  const [result, setResult] = useState<{ correct: number; total: number } | null>(null)

  useEffect(() => {
    setPassage(getRandomReadingPassages(1)[0] ?? null)
  }, [])

  const handleComplete = (correctCount: number) => {
    recordTaskCompletion('reading')
    setResult({ correct: correctCount, total: passage?.questions.length ?? 0 })
  }

  if (!passage) return <ReadingSkeleton />

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
            className="-ml-2 shrink-0 rounded-xl p-2 text-[var(--mu)] hover:bg-[var(--sf2)]"
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
