'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { ArrowLeft, Zap, Sparkles } from 'lucide-react'
import Link from 'next/link'
import type { Chapter } from '../../../../scripts/build-content/types'
import { getChapters } from '../../../../src/lib/content'
import { Button } from '../../../../src/components/ui/Button'

export default function ChapterDetailPage() {
  const params = useParams()
  const [chapter, setChapter] = useState<Chapter | null>(null)

  useEffect(() => {
    const rawId = Array.isArray(params.id) ? params.id.map(decodeURIComponent).join('/') : params.id
    const all = getChapters()
    const found = all.find((c) => c.id === rawId || c.id.endsWith(rawId || ''))
    if (found) setChapter(found)
  }, [params.id])

  if (!chapter) return null

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Link href="/chapters" className="p-2 -ml-2 rounded-xl text-muted-foreground hover:bg-muted">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <span className="text-xs font-semibold text-primary">{chapter.categoryId}</span>
      </div>

      <h1 className="text-xl font-bold">{chapter.title}</h1>

      {/* Quick Tips Highlight Card */}
      {chapter.quickTips && (
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-500 space-y-2">
          <div className="flex items-center gap-1.5 font-bold text-sm">
            <Zap className="w-4 h-4 fill-amber-500" /> 多益秒殺解題技巧
          </div>
          <div className="text-xs leading-relaxed whitespace-pre-line text-foreground/90">
            {chapter.quickTips}
          </div>
        </div>
      )}

      {/* Teaching Body */}
      <div className="p-5 rounded-3xl bg-card border border-muted/80 text-sm leading-relaxed space-y-4 whitespace-pre-line font-serif shadow-sm">
        {chapter.teaching}
      </div>

      {/* Practice CTA */}
      <Link href="/practice/grammar" className="block pt-2">
        <Button variant="primary">
          <Sparkles className="w-4 h-4" /> 開始本章文法練習 (5 題)
        </Button>
      </Link>
    </div>
  )
}
