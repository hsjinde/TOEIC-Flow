'use client'

import { useEffect, useState } from 'react'
import { ArrowLeft, BookOpen, ChevronRight, Zap } from 'lucide-react'
import Link from 'next/link'
import type { Chapter } from '../../../scripts/build-content/types'
import { getChapters } from '../../../src/lib/content'

export default function ChaptersPage() {
  const [chapters, setChapters] = useState<Chapter[]>([])

  useEffect(() => {
    setChapters(getChapters())
  }, [])

  // Group chapters by category
  const categoriesMap: Record<string, Chapter[]> = {}
  for (const c of chapters) {
    if (!categoriesMap[c.categoryId]) categoriesMap[c.categoryId] = []
    categoriesMap[c.categoryId]!.push(c)
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Link href="/" className="p-2 -ml-2 rounded-xl text-muted-foreground hover:bg-muted">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <h1 className="text-xl font-bold">文法章節與秒殺公式</h1>
      </div>

      {/* Chapters Tree */}
      <div className="space-y-6">
        {Object.entries(categoriesMap).map(([catId, items]) => (
          <div key={catId} className="space-y-3">
            <h2 className="text-xs font-semibold text-primary uppercase tracking-wider px-1">
              📚 {catId} ({items.length} 章)
            </h2>
            <div className="space-y-2">
              {items.map((chap) => {
                const encodeId = chap.id.split('/')
                return (
                  <Link
                    key={chap.id}
                    href={`/chapters/${encodeId.map(encodeURIComponent).join('/')}`}
                    className="flex items-center justify-between p-4 rounded-2xl bg-card border border-muted/80 hover:border-primary/40 transition-all shadow-sm"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-xl bg-primary/10 text-primary">
                        <BookOpen className="w-4 h-4" />
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold">{chap.title}</h3>
                        {chap.quickTips && (
                          <span className="inline-flex items-center gap-1 text-[10px] text-amber-500 font-medium mt-0.5">
                            <Zap className="w-3 h-3 fill-amber-500" /> 含秒殺公式
                          </span>
                        )}
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  </Link>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
