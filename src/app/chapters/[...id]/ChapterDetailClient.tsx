'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, ArrowRight, CheckCircle2, Sparkles, Zap } from 'lucide-react'
import type { Chapter, Formula, Question } from '../../../../scripts/build-content/types'
import {
  getCategoryMeta,
  getChapterById,
  getFormulasByChapter,
  getChapterNumber,
  getGrammarQuestionsByChapter,
  stripOrderPrefix,
} from '../../../lib/content'
import {
  getChapterMasteryMap,
  getWrongQuestionList,
  isChapterCompleted,
  type ChapterMastery,
} from '../../../lib/storage'
import { Button } from '../../../components/ui/Button'
import { MarkdownRenderer } from '../../../components/MarkdownRenderer'
import { GraduationDots } from '../../../components/GraduationDots'

interface ChapterDetailClientProps {
  id: string[] | string
}

interface ChapterView {
  chapter: Chapter
  formulas: Formula[]
  questionCount: number
  mastery: ChapterMastery | null
  wrong: { question: Question; failCount: number; consecutiveCorrect: number }[]
  siblings: Chapter[]
  categoryTitle: string
}

function chapterHref(id: string): string {
  return `/chapters/${id.split('/').map(encodeURIComponent).join('/')}`
}

export default function ChapterDetailClient({ id }: ChapterDetailClientProps) {
  const [view, setView] = useState<ChapterView | null>(null)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    const rawId = Array.isArray(id) ? id.map(decodeURIComponent).join('/') : id
    const chapter = getChapterById(rawId)
    if (!chapter) {
      setNotFound(true)
      return
    }

    const category = getCategoryMeta(chapter.categoryId)
    const chapterQuestions = getGrammarQuestionsByChapter(chapter.id)
    const questionIds = new Set(chapterQuestions.map((q) => q.id))
    const wrong = getWrongQuestionList()
      .filter((w) => questionIds.has(w.questionId))
      .map((w) => ({
        question: chapterQuestions.find((q) => q.id === w.questionId)!,
        failCount: w.failCount,
        consecutiveCorrect: w.consecutiveCorrect,
      }))

    setView({
      chapter,
      formulas: getFormulasByChapter(chapter.id),
      questionCount: chapterQuestions.length,
      mastery: getChapterMasteryMap()[chapter.id] ?? null,
      wrong,
      siblings: category?.chapters ?? [],
      categoryTitle: category?.title ?? stripOrderPrefix(chapter.categoryId),
    })
  }, [id])

  if (notFound) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-[var(--ln)] bg-[var(--sf)] px-6 py-14 text-center">
        <h2 className="text-base font-bold text-[var(--tx)]">找不到這一章</h2>
        <Link href="/chapters" className="w-full max-w-[240px] pt-1">
          <Button variant="primary">回到章節列表</Button>
        </Link>
      </div>
    )
  }

  if (!view) return <ChapterSkeleton />

  const { chapter, formulas, mastery, wrong, siblings, categoryTitle, questionCount } = view
  const position = siblings.findIndex((c) => c.id === chapter.id)
  const nextChapter = position >= 0 ? siblings[position + 1] : undefined
  const practiceHref = `/practice/grammar?chapter=${encodeURIComponent(chapter.id)}`

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-2">
        <Link
          href="/chapters"
          aria-label="回到章節列表"
          className="-ml-2 rounded-xl p-2 text-[var(--mu)] hover:bg-[var(--sf2)]"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <span className="text-xs font-semibold text-[var(--pr)]">章節列表</span>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,620px)_minmax(0,300px)] lg:justify-center">
        {/* 內文欄：寬度限制在 620px 以維持閱讀行長（設計 15） */}
        <article className="min-w-0 space-y-5">
          <header>
            <p className="font-mono text-[11px] font-bold tracking-widest text-[var(--fa)]">
              CHAPTER {String(getChapterNumber(chapter.id) ?? chapter.order).padStart(2, '0')} ·{' '}
              {categoryTitle}
            </p>
            <h1 className="mt-1 text-2xl font-bold text-[var(--tx)]">
              {stripOrderPrefix(chapter.title)}
            </h1>
          </header>

          {/*
            秒殺公式。原本靠 3px 的左側色條標示，那是 DESIGN.md 明文禁止的裝飾色條；
            改成整圈主色髮絲框，強調同樣做到，而且不必破例。
          */}
          {formulas.length > 0 && (
            <section className="space-y-2.5">
              <h2 className="flex items-center gap-1.5 text-xs font-bold tracking-wider text-[var(--pr)]">
                <Zap className="h-3.5 w-3.5" /> 秒殺公式
              </h2>
              {formulas.map((formula) => (
                <div
                  key={formula.id}
                  className="rounded-xl border border-[var(--pr-ln)] bg-[var(--sf)] p-4"
                >
                  <h3 className="text-sm font-bold text-[var(--tx)]">{formula.title}</h3>
                  <MarkdownRenderer content={formula.body} className="mt-2 text-[13px]" />
                </div>
              ))}
            </section>
          )}

          {chapter.quickTips && (
            <section className="rounded-2xl border border-[var(--pr-ln)] bg-[var(--pr-sf)] p-4">
              <h2 className="flex items-center gap-1.5 text-xs font-bold text-[var(--pr)]">
                <Zap className="h-3.5 w-3.5" /> 多益秒殺解題技巧
              </h2>
              <MarkdownRenderer content={chapter.quickTips} className="mt-2 text-[13px]" />
            </section>
          )}

          <section className="rounded-2xl border border-[var(--ln)] bg-[var(--sf)] p-5">
            <MarkdownRenderer content={chapter.teaching} />
          </section>

        </article>

        {/*
          該章數據與練習入口。先前整欄是 hidden lg:flex——手機使用者看不到自己這章的
          正確率，也看不到「你在這章的錯題」，那是通勤情境下最該看到的兩塊。手機改成
          接在內文後面（讀完 → 看成績 → 開始練），並拿掉原本重複一份的手機專用按鈕。
        */}
        <aside className="flex flex-col gap-4 lg:sticky lg:top-20 lg:self-start">
          <section className="rounded-2xl border border-[var(--ln)] bg-[var(--sf)] p-5">
            <h2 className="text-xs font-bold tracking-wider text-[var(--fa)]">本章正確率</h2>
            {mastery ? (
              <>
                {(() => {
                  const uniqueDone = mastery.uniqueAnsweredCount ?? 0
                  const isDone = isChapterCompleted(mastery, questionCount)
                  return (
                    <>
                      <div className="flex items-baseline justify-between gap-2">
                        <p className="mt-1 text-2xl font-bold text-[var(--pr)]">
                          {mastery.accuracyRate}%
                        </p>
                        {isDone ? (
                          // 「已完成」是進度，不是答題判定——綠色在這裡會稀釋掉「答對」的反射。
                          <span className="flex items-center gap-1 rounded-full border border-[var(--pr-ln)] bg-[var(--pr-sf)] px-2 py-0.5 text-[11px] font-bold text-[var(--pr)]">
                            <CheckCircle2 className="h-3 w-3" /> 已完成 (≥80%)
                          </span>
                        ) : (
                          <span className="rounded-full bg-[var(--sf2)] px-2 py-0.5 text-[11px] text-[var(--mu)]">
                            {uniqueDone < questionCount
                              ? `進行中 (${uniqueDone}/${questionCount}題)`
                              : '未達標 (<80%)'}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-[var(--mu)]">
                        已答 {uniqueDone} / {questionCount} 題 · 作答 {mastery.totalAnswered} 題對 {mastery.correctCount} 題
                      </p>
                      <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-[var(--sf2)]">
                        <div
                          className="h-full rounded-full bg-[var(--pr)] transition-all duration-300"
                          style={{ width: `${mastery.accuracyRate}%` }}
                        />
                      </div>
                    </>
                  )
                })()}
              </>
            ) : (
              <p className="mt-1 text-xs text-[var(--mu)]">還沒練過這一章</p>
            )}
            <Link href={practiceHref} className="mt-4 block">
              <Button variant="primary" className="text-sm lg:min-h-[44px] lg:text-xs">
                <Sparkles className="h-4 w-4" /> 練這章 · {Math.min(5, questionCount)} 題
              </Button>
            </Link>
            {nextChapter && (
              <Link href={chapterHref(nextChapter.id)} className="mt-2 block">
                <Button variant="outline" className="text-xs lg:min-h-[40px]">
                  下一章 · {stripOrderPrefix(nextChapter.title)}
                  <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </Link>
            )}
          </section>

          {wrong.length > 0 && (
            <section className="space-y-2 rounded-2xl border border-[var(--ln)] bg-[var(--sf)] p-5">
              <h2 className="text-xs font-bold tracking-wider text-[var(--fa)]">
                你在這章的錯題 · {wrong.length} 題
              </h2>
              {wrong.slice(0, 4).map((w) => (
                <div key={w.question.id} className="border-t border-[var(--ln)] pt-2 first:border-0 first:pt-0">
                  <p className="line-clamp-2 text-xs leading-relaxed text-[var(--tx)]">
                    {w.question.stem}
                  </p>
                  <p className="mt-1 flex items-center gap-1.5 text-[11px] text-[var(--mu)]">
                    錯 {w.failCount} 次
                    <GraduationDots consecutiveCorrect={w.consecutiveCorrect} />
                  </p>
                </div>
              ))}
              <Link
                href={`/practice/grammar?mode=wrong&ids=${encodeURIComponent(wrong.map((w) => w.question.id).join(','))}`}
                className="flex min-h-[44px] items-center text-xs font-semibold text-[var(--pr)] hover:opacity-80"
              >
                複習這 {wrong.length} 題 →
              </Link>
            </section>
          )}
        </aside>
      </div>
    </div>
  )
}

function ChapterSkeleton() {
  return (
    <div className="flex animate-pulse flex-col gap-4">
      <div className="h-8 w-40 rounded-md bg-[var(--sf2)]" />
      <div className="h-24 rounded-2xl bg-[var(--sf2)]" />
      <div className="h-96 rounded-2xl bg-[var(--sf2)]" />
    </div>
  )
}
