'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { ArrowLeft, Zap, Sparkles } from 'lucide-react'
import Link from 'next/link'
import type { Chapter } from '../../../../scripts/build-content/types'
import { getChapters } from '../../../../src/lib/content'
import { Button } from '../../../../src/components/ui/Button'
import { MarkdownRenderer } from '../../../../src/components/MarkdownRenderer'

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
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <Link href="/chapters" className="p-2 -ml-2 rounded-xl text-[var(--mu)] hover:bg-[var(--sf2)]">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <span className="text-xs font-semibold text-[var(--pr)]">{chapter.categoryId}</span>
      </div>

      <h1 className="text-xl md:text-2xl font-bold text-[var(--tx)]">{chapter.title}</h1>

      {/* Quick Tips Highlight Card */}
      {chapter.quickTips && (
        <div className="p-5 rounded-3xl bg-[var(--pr-sf)] border border-[var(--pr-ln)] text-[var(--pr)] space-y-3 shadow-sm">
          <div className="flex items-center gap-2 font-bold text-sm">
            <Zap className="w-4 h-4 fill-[var(--pr)]" /> 多益秒殺解題技巧
          </div>
          <MarkdownRenderer content={chapter.quickTips} className="text-[var(--tx)] text-xs" />
        </div>
      )}

      {/* Teaching Body */}
      <div className="p-6 rounded-3xl bg-[var(--sf)] border border-[var(--ln)] shadow-sm">
        <MarkdownRenderer content={chapter.teaching} />
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
