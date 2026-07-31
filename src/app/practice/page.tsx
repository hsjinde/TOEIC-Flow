'use client'

import { useEffect, useState } from 'react'
import { BookOpen, FileText, Layers, ListChecks, Sparkles, Timer, Zap } from 'lucide-react'
import {
  getCategories,
  getFormulaCards,
  getMockExams,
  getVocabItems,
} from '../../lib/content'
import {
  getChapterAchievements,
  getChapterMasteryMap,
  getDailyProgress,
  getMockResults,
  getWeakVocabStats,
  getWrongQuestionList,
  isChapterAchieved,
} from '../../lib/storage'
import { getPathProgress, pathChapterTitle } from '../../lib/learning-path'
import { DailyTaskCard } from '../../components/DailyTaskCard'
import { EntryCard } from '../../components/EntryCard'

/** 與首頁同一份定義：15 分鐘 ≒ 單字 10 個＋文法 5 題＋閱讀 1 篇。 */
const DAILY_TASKS = [
  {
    key: 'vocab' as const,
    title: '單字複習',
    subtitle: '10 個 · 約 4 分鐘',
    href: '/practice/vocab?from=practice',
    icon: <BookOpen className="h-5 w-5" />,
  },
  {
    key: 'grammar' as const,
    title: '文法練習',
    subtitle: '5 題 · 約 6 分鐘',
    href: '/practice/grammar?from=practice',
    icon: <Sparkles className="h-5 w-5" />,
  },
  {
    key: 'reading' as const,
    title: '閱讀理解',
    subtitle: '1 篇 · 約 5 分鐘',
    href: '/practice/reading?from=practice',
    icon: <FileText className="h-5 w-5" />,
  },
]

interface HubSnapshot {
  done: Record<'vocab' | 'grammar' | 'reading', boolean>
  chapterCount: number
  categoryCount: number
  achievedChapters: number
  pathText: string
  wrongCount: number
  weakVocabCount: number
  totalVocabCount: number
  formulaCardCount: number
  mockQuestionCount: number
  lastMockScore: number | null
}

function buildSnapshot(): HubSnapshot {
  const categories = getCategories()
  const chapters = categories.flatMap((c) => c.chapters)
  const achievements = getChapterAchievements()
  const masteryMap = getChapterMasteryMap()
  const path = getPathProgress(masteryMap, achievements)
  const progress = getDailyProgress()
  const mockResults = getMockResults()
  const lastMock = mockResults[mockResults.length - 1] ?? null
  const weakVocab = getWeakVocabStats()

  return {
    done: {
      vocab: progress.vocabCompleted,
      grammar: progress.grammarCompleted,
      reading: progress.readingCompleted,
    },
    chapterCount: chapters.length,
    categoryCount: categories.length,
    achievedChapters: chapters.filter((ch) => isChapterAchieved(ch.id, achievements)).length,
    pathText: path.next
      ? `第 ${path.next.stage.order} 站 · ${path.next.stage.title}，下一章是${pathChapterTitle(path.next.chapterId)}`
      : `${path.totalCount} 章全部達標，去模擬考驗收`,
    wrongCount: getWrongQuestionList().filter((w) => w.consecutiveCorrect < 2).length,
    weakVocabCount: weakVocab.length,
    totalVocabCount: getVocabItems().length,
    formulaCardCount: getFormulaCards().length,
    mockQuestionCount: getMockExams()[0]?.sections.reduce((a, s) => a + s.questions.length, 0) ?? 0,
    lastMockScore: lastMock?.estimatedScore ?? null,
  }
}

/**
 * 練習中心：全站所有練習與複習入口的單一目錄。
 *
 * 先前這些入口散在四個地方——模擬考只在「三項任務都做完」之後才出現在首頁、錯題本
 * 與單字複習本只在有東西時才出現、學習路徑只掛在章節頁上——所以手機使用者常常找不到
 * 某個功能，甚至不知道它存在。這一頁的規則相反：**永遠列出全部**，數字為 0 的入口
 * 照樣看得到，只是文案改成「還沒有」。
 */
export default function PracticeHubPage() {
  const [snap, setSnap] = useState<HubSnapshot | null>(null)

  useEffect(() => {
    setSnap(buildSnapshot())
    const onUpdate = () => setSnap(buildSnapshot())
    window.addEventListener('toeic_storage_update', onUpdate)
    window.addEventListener('storage', onUpdate)
    return () => {
      window.removeEventListener('toeic_storage_update', onUpdate)
      window.removeEventListener('storage', onUpdate)
    }
  }, [])

  if (!snap) return <HubSkeleton />

  const remainingTasks = DAILY_TASKS.filter((t) => !snap.done[t.key]).length

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-bold text-[var(--tx)]">練習</h1>
        <p className="mt-0.5 text-xs text-[var(--mu)] max-w-[var(--measure)]">
          所有練習與複習的入口都在這一頁
          {remainingTasks > 0 && ` · 今天還有 ${remainingTasks} 項任務`}
        </p>
      </div>

      <Section title="今日任務" hint="每天 15 分鐘">
        {DAILY_TASKS.map((task) => (
          <DailyTaskCard
            key={task.key}
            title={task.title}
            subtitle={task.subtitle}
            icon={task.icon}
            completed={snap.done[task.key]}
            href={task.href}
            resultText="今天已完成 · 可再做一輪"
          />
        ))}
      </Section>

      <Section title="照順序學" hint="不知道從哪開始就看這裡">
        <EntryCard
          href="/path"
          title="學習路徑"
          icon={<ListChecks className="h-3.5 w-3.5 text-[var(--pr)]" />}
          description={snap.pathText}
          action="看順序"
          emphasis
        />
        <EntryCard
          href="/chapters"
          title="文法章節"
          icon={<Layers className="h-3.5 w-3.5 text-[var(--pr)]" />}
          badge={`${snap.achievedChapters} / ${snap.chapterCount} 章達標`}
          description={`${snap.categoryCount} 大類 · 按主題歸檔，適合查；照難度學請走學習路徑。`}
          action="開始讀"
        />
      </Section>

      <Section title="複習" hint="系統幫你記住哪些還沒學會">
        <EntryCard
          href="/wrong-questions"
          title="錯題本"
          badge={snap.wrongCount > 0 ? `${snap.wrongCount} 題待複習` : undefined}
          description={
            snap.wrongCount > 0
              ? '答錯的題目自動收進來，連續答對 2 次才畢業。'
              : '還沒有待複習的錯題。答錯的題目會自動收進來。'
          }
          action={snap.wrongCount > 0 ? '開始複習' : '看看'}
        />
        <EntryCard
          href="/vocab-review"
          title="單字複習本"
          badge={snap.weakVocabCount > 0 ? `${snap.weakVocabCount} 個字要加強` : undefined}
          description={
            snap.weakVocabCount > 0
              ? `常錯與間隔到期的字都排在前面 · 全庫 ${snap.totalVocabCount} 個字`
              : `目前沒有到期的字 · 全庫 ${snap.totalVocabCount} 個字`
          }
          action={snap.weakVocabCount > 0 ? '開始複習' : '看看'}
        />
        <EntryCard
          href="/practice/formulas?from=practice"
          title="章節速查卡"
          icon={<Zap className="h-3.5 w-3.5 text-[var(--pr)]" />}
          badge={`${snap.formulaCardCount} 張`}
          description="決策樹＋用法總表，一章一張，通勤也能刷。"
          action="開始刷卡"
        />
      </Section>

      <Section title="驗收" hint="整份計時，作答期間不顯示對錯">
        <EntryCard
          href="/practice/mock"
          title="模擬考"
          icon={<Timer className="h-3.5 w-3.5 text-[var(--pr)]" />}
          badge={snap.lastMockScore !== null ? `上次 ${snap.lastMockScore} 分` : undefined}
          description={
            snap.mockQuestionCount > 0
              ? `${snap.mockQuestionCount} 題計時測驗，交卷後一次檢討並重新估分。`
              : '模擬考題庫是空的，重新建置題庫後再回來。'
          }
          action="開始考"
        />
      </Section>
    </div>
  )
}

function Section({
  title,
  hint,
  children,
}: {
  title: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <section className="flex flex-col gap-2.5">
      <div className="flex items-baseline justify-between gap-2 px-1">
        <h2 className="text-xs font-bold tracking-wider text-[var(--fa)]">{title}</h2>
        {hint && <span className="truncate text-[11px] text-[var(--fa)]">{hint}</span>}
      </div>
      <div className="grid gap-2.5 md:grid-cols-2">{children}</div>
    </section>
  )
}

function HubSkeleton() {
  return (
    <div className="flex animate-pulse flex-col gap-4">
      <div className="h-10 w-40 rounded-md bg-[var(--sf2)]" />
      {[0, 1, 2, 3, 4, 5, 6].map((i) => (
        <div key={i} className="h-[72px] rounded-2xl bg-[var(--sf2)]" />
      ))}
    </div>
  )
}
