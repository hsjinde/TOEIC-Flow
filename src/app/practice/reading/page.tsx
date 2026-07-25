'use client'

import { useEffect, useState } from 'react'
import { ArrowLeft, CheckCircle2 } from 'lucide-react'
import Link from 'next/link'
import type { ReadingPassage } from '../../../../scripts/build-content/types'
import { getRandomReadingPassages } from '../../../../src/lib/content'
import { recordTaskCompletion } from '../../../../src/lib/storage'
import { ReadingPassageView } from '../../../../src/components/ReadingPassageView'
import { Button } from '../../../../src/components/ui/Button'

export default function ReadingPracticePage() {
  const [passages, setPassages] = useState<ReadingPassage[]>([])
  const [isFinished, setIsFinished] = useState(false)

  useEffect(() => {
    setPassages(getRandomReadingPassages(1))
  }, [])

  const currentPassage = passages[0]

  const handleComplete = () => {
    recordTaskCompletion('reading')
    setIsFinished(true)
  }

  if (!currentPassage && !isFinished) return null

  return (
    <div className="flex flex-col justify-between h-full min-h-[80vh]">
      <div>
        <div className="flex items-center justify-between mb-4">
          <Link href="/" className="p-2 -ml-2 rounded-xl text-muted-foreground hover:bg-muted">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <span className="text-sm font-semibold">閱讀理解</span>
        </div>

        {!isFinished && currentPassage ? (
          <ReadingPassageView passage={currentPassage} onComplete={handleComplete} />
        ) : (
          <div className="flex flex-col items-center justify-center p-8 bg-card border border-muted rounded-3xl text-center space-y-4 my-auto shadow-md">
            <CheckCircle2 className="w-16 h-16 text-correct" />
            <h2 className="text-xl font-bold">閱讀任務完成！</h2>
            <p className="text-sm text-muted-foreground">已為您記錄閱讀測驗結果，今日閱讀任務完成。</p>
            <Link href="/" className="block w-full pt-2">
              <Button variant="primary">返回今日任務</Button>
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
