'use client'

import { useEffect, useState, useCallback } from 'react'
import { ArrowLeft, CheckCircle2 } from 'lucide-react'
import Link from 'next/link'
import type { VocabItem } from '../../../../scripts/build-content/types'
import { getRandomVocabItems } from '../../../../src/lib/content'
import { updateVocabMastery, recordTaskCompletion } from '../../../../src/lib/storage'
import { VocabFlashcard } from '../../../../src/components/VocabFlashcard'
import { Button } from '../../../../src/components/ui/Button'

export default function VocabPracticePage() {
  const [vocabList, setVocabList] = useState<VocabItem[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isFinished, setIsFinished] = useState(false)

  useEffect(() => {
    setVocabList(getRandomVocabItems(10))
  }, [])

  const currentItem = vocabList[currentIndex]

  const handleGrade = useCallback((level: number) => {
    if (!currentItem) return
    updateVocabMastery(currentItem.id, level)

    if (currentIndex + 1 < vocabList.length) {
      setCurrentIndex((prev) => prev + 1)
    } else {
      recordTaskCompletion('vocab')
      setIsFinished(true)
    }
  }, [currentItem, currentIndex, vocabList.length])

  if (!currentItem && !isFinished) return null

  return (
    <div className="flex flex-col justify-between h-full min-h-[80vh]">
      {/* Top Header */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <Link href="/" className="p-2 -ml-2 rounded-xl text-muted-foreground hover:bg-muted">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <span className="text-sm font-semibold">
            {currentIndex + 1} / {vocabList.length}
          </span>
        </div>

        {!isFinished && currentItem ? (
          <VocabFlashcard item={currentItem} onGrade={handleGrade} />
        ) : (
          /* Finished Card */
          <div className="flex flex-col items-center justify-center p-8 bg-card border border-muted rounded-3xl text-center space-y-4 my-auto shadow-md">
            <CheckCircle2 className="w-16 h-16 text-correct" />
            <h2 className="text-xl font-bold">單字卡複習完成！</h2>
            <p className="text-sm text-muted-foreground">已為您更新 SRS 記憶間隔，今日單字任務完成。</p>
            <Link href="/" className="block w-full pt-2">
              <Button variant="primary">返回今日任務</Button>
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
