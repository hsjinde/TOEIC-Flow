'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import type { VocabItem } from '../../scripts/build-content/types'
import { MAX_VOCAB_LEVEL, getSrsIntervalLabel } from '../lib/storage'
import { stripEmphasis, toClozeSentence } from '../lib/emphasis'
import { Button } from './ui/Button'
import { EmphasisText } from './EmphasisText'
import { MasteryDots } from './MasteryDots'
import { cn } from '../lib/utils'

export type QuizKind = 'en2zh' | 'zh2en' | 'cloze'

interface VocabQuizProps {
  item: VocabItem
  /** 抽誘答項的來源，至少要有 4 個字才湊得滿四選一 */
  pool: VocabItem[]
  index: number
  currentLevel: number
  onAnswer: (isCorrect: boolean) => void
  /** 作答後由使用者主動觸發前進，不再自動跳卡 */
  onNext: () => void
}

const KIND_LABELS: Record<QuizKind, string> = {
  en2zh: '英 → 中',
  zh2en: '中 → 英',
  cloze: '例句填空',
}

/** 設計 03：三種題型輪替，用題序決定，避免同一輪一直出同一型。 */
export function quizKindFor(index: number, item: VocabItem): QuizKind {
  const kinds: QuizKind[] = item.example ? ['en2zh', 'zh2en', 'cloze'] : ['en2zh', 'zh2en']
  return kinds[index % kinds.length]!
}

/**
 * 依 id 產生穩定的洗牌序，讓同一題在重新渲染（例如作答後）時選項不會跳位。
 */
function stableShuffle<T>(items: T[], seed: string): T[] {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0
  const out = [...items]
  for (let i = out.length - 1; i > 0; i--) {
    h = (h * 1103515245 + 12345) >>> 0
    const j = h % (i + 1)
    ;[out[i], out[j]] = [out[j]!, out[i]!]
  }
  return out
}

/** 選項連著它出自哪個字一起帶，解析才講得出「你選的那個其實是什麼意思」。 */
interface QuizOption {
  text: string
  item: VocabItem
}

export const VocabQuiz: React.FC<VocabQuizProps> = ({
  item,
  pool,
  index,
  currentLevel,
  onAnswer,
  onNext,
}) => {
  const [picked, setPicked] = useState<QuizOption | null>(null)
  const [nextLevel, setNextLevel] = useState(0)
  const kind = quizKindFor(index, item)

  useEffect(() => {
    setPicked(null)
    setNextLevel(0)
  }, [item.id])

  const { prompt, hint, correct, options } = useMemo(() => {
    const answerIsWord = kind !== 'en2zh'
    const correctText = answerIsWord ? item.word : item.meaning

    const distractors: QuizOption[] = pool
      .filter((v) => v.id !== item.id)
      .filter((v) => (answerIsWord ? v.word !== item.word : v.meaning !== item.meaning))
      .slice(0, 3)
      .map((v) => ({ text: answerIsWord ? v.word : v.meaning, item: v }))

    return {
      prompt:
        kind === 'en2zh'
          ? item.word
          : kind === 'zh2en'
            ? item.meaning
            : stripEmphasis(toClozeSentence(item.example, item.word)),
      hint:
        kind === 'en2zh'
          ? '選出正確的中文釋義'
          : kind === 'zh2en'
            ? '選出正確的英文單字'
            : '選出最適合填入空格的字',
      correct: correctText,
      options: stableShuffle([{ text: correctText, item }, ...distractors], item.id),
    }
  }, [item, pool, kind])

  const answered = picked !== null

  const handlePick = useCallback(
    (choice: QuizOption) => {
      if (picked !== null) return
      const isCorrect = choice.text === correct
      // 結果檔位要在通知父層「之前」用當下的 currentLevel 算好並鎖住。
      // onAnswer 會讓父層更新 currentLevel，若之後才從 prop 推導就會多跳一格。
      setPicked(choice)
      setNextLevel(
        isCorrect ? Math.min(MAX_VOCAB_LEVEL, currentLevel + 1) : Math.max(0, currentLevel - 1)
      )
      onAnswer(isCorrect)
    },
    [picked, correct, currentLevel, onAnswer]
  )

  // 其他三個練習流程都有 1/2/3/4 與空白鍵，單字測驗沒有的話同一個動作在同一個 App
  // 裡就有兩套操作方式。
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return

      if (['1', '2', '3', '4'].includes(e.key) && picked === null) {
        const opt = options[Number(e.key) - 1]
        if (opt) handlePick(opt)
      } else if ((e.code === 'Space' || e.key === ' ') && picked !== null) {
        e.preventDefault()
        onNext()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [options, picked, handlePick, onNext])

  return (
    <div className="flex w-full flex-col gap-4">
      <div className="rounded-2xl border border-[var(--ln)] bg-[var(--sf)] p-6 text-center">
        <p className="text-xs font-semibold text-[var(--pr)]">{KIND_LABELS[kind]}</p>
        {/*
          zh2en 的 prompt 是中文，套 font-display（Archivo）會整串 fallback 到系統黑體，
          字重與基線都跟著跳。中文題面走中文字體的大字級，英文題面才用 Display。
        */}
        <p
          className={cn(
            'mt-3 text-[var(--tx)]',
            kind === 'cloze'
              ? 'font-option text-left leading-relaxed'
              : kind === 'zh2en'
                ? 'text-3xl font-bold leading-snug'
                : 'font-display'
          )}
        >
          {prompt}
        </p>
        <p className="mt-3 text-xs text-[var(--mu)]">{hint}</p>
      </div>

      <div className="grid gap-2.5">
        {options.map((opt, i) => {
          const isCorrect = opt.text === correct
          const isPicked = opt === picked
          let variant: 'outline' | 'correct' | 'wrong' = 'outline'
          if (answered) {
            if (isCorrect) variant = 'correct'
            else if (isPicked) variant = 'wrong'
          }
          return (
            <Button
              key={`${opt.text}-${i}`}
              variant={variant}
              softDisabled={answered}
              onClick={() => handlePick(opt)}
              className={cn(
                'justify-start px-5 text-left',
                // en2zh 的選項是中文釋義，套 Archivo 只會逐字 fallback。
                kind === 'en2zh' ? 'text-[15px] leading-relaxed' : 'font-option'
              )}
            >
              <span className="w-6 text-xs font-semibold opacity-70">
                ({String.fromCharCode(65 + i)})
              </span>
              <span className="flex-1">{opt.text}</span>
              {answered && isCorrect && <span className="text-xs font-bold">正解</span>}
              {answered && isPicked && !isCorrect && (
                <span className="text-xs font-bold">你的選擇</span>
              )}
              {!answered && (
                <span className="hidden rounded border border-[var(--ln)] px-1.5 text-[11px] text-[var(--mu)] lg:inline">
                  {i + 1}
                </span>
              )}
            </Button>
          )
        })}
      </div>

      {/*
        選項作答後變成 aria-disabled，結果得靠這條 live region 主動播報。
        只播判定，解析本身是底下可正常瀏覽的靜態內容，不整篇塞進來洗版。
      */}
      <p role="status" aria-live="polite" className="sr-only">
        {answered &&
          (picked.text === correct
            ? `答對，正解 ${correct}`
            : `答錯，你選了 ${picked.text}，正解 ${correct}`)}
      </p>

      {answered && (
        <div className="flex animate-fade-in flex-col gap-3">
          {/*
            設計 14 的解析卡同一個殼：--sf2 底 + 主色標題。這裡沒有筆記寫好的詳解，
            解析就由單字本身組出來——詞性、釋義、完整例句（cloze 要看的是填回去的
            那一句）、例句中文，再加上「你選的那個字其實是什麼」。
          */}
          <div className="space-y-2.5 rounded-2xl border border-[var(--ln)] bg-[var(--sf2)] p-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold text-[var(--pr)]">解析</span>
              <span className="font-option text-sm font-bold text-[var(--tx)]">{item.word}</span>
              {item.pos && (
                <span className="rounded-md bg-[var(--sf)] px-2 py-0.5 text-[11px] text-[var(--mu)]">
                  {item.pos}
                </span>
              )}
            </div>

            <p className="text-sm leading-relaxed text-[var(--tx)]">{item.meaning}</p>

            {item.example && (
              <div className="space-y-1 border-t border-[var(--ln)] pt-2.5">
                <p className="font-option text-[13px] leading-relaxed text-[var(--mu)]">
                  <EmphasisText text={item.example} />
                </p>
                {item.exampleZh && (
                  <p className="text-[13px] leading-relaxed text-[var(--mu)] opacity-80">
                    {item.exampleZh}
                  </p>
                )}
              </div>
            )}

            {/* 錯的那個選項是什麼字、什麼意思，才是這題真正要學的地方。 */}
            {picked.text !== correct && (
              <p className="border-t border-[var(--ln)] pt-2.5 text-xs leading-relaxed text-[var(--mu)]">
                你選的{' '}
                <span className="font-option font-semibold text-[var(--tx)]">
                  {picked.item.word}
                </span>{' '}
                是「{picked.item.meaning}」
                {picked.item.pos ? `（${picked.item.pos}）` : ''}。
              </p>
            )}
          </div>

          <p className="flex items-center justify-center gap-2 text-xs text-[var(--mu)]">
            熟悉度 <MasteryDots level={nextLevel} /> → 下次 {getSrsIntervalLabel(nextLevel)}
          </p>
          {/*
            同文法練習：解析卡一長，「下一張」就會被推出視窗，而手機沒有 SPACE 可按。
            把它釘在拇指區（底部導覽上方），桌機回到文件流。
          */}
          <div className="sticky bottom-[var(--nav-h)] z-30 -mx-4 border-t border-[var(--ln)] bg-[var(--bg)]/95 px-4 pb-3 pt-3 backdrop-blur-md lg:static lg:z-auto lg:mx-0 lg:border-0 lg:bg-transparent lg:p-0 lg:backdrop-blur-none">
            <Button variant="primary" onClick={onNext}>
              下一張
              <span className="hidden text-xs opacity-70 lg:inline">SPACE</span>
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
