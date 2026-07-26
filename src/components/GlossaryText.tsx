'use client'

import React, { useMemo, useState } from 'react'
import { Check, Plus, X } from 'lucide-react'
import type { VocabItem } from '../../scripts/build-content/types'
import { getVocabItems } from '../lib/content'
import { getVocabMasteryMap, updateVocabMastery } from '../lib/storage'
import { parseMarkdownToBlocks } from './MarkdownRenderer'
import { cn } from '../lib/utils'

interface GlossaryTextProps {
  text: string
  onGlossaryCount?: (count: number) => void
}

/** word（小寫）→ 單字資料。同字取第一筆即可。 */
function buildLexicon(): Map<string, VocabItem> {
  const map = new Map<string, VocabItem>()
  for (const v of getVocabItems()) {
    const key = v.word.toLowerCase()
    if (!map.has(key)) map.set(key, v)
  }
  return map
}

let lexiconCache: Map<string, VocabItem> | null = null
function lexicon(): Map<string, VocabItem> {
  if (!lexiconCache) lexiconCache = buildLexicon()
  return lexiconCache
}

interface Token {
  text: string
  item: VocabItem | null
}

/**
 * 設計 04/13：文章內難字可點，出簡明釋義浮層並能加入單字本。
 * 只比對整個單詞（以非字母切分），避免 "at" 命中 "later" 這種誤標。
 */
function tokenize(text: string): Token[] {
  const lex = lexicon()
  const parts = text.split(/([A-Za-z][A-Za-z'-]*)/g)
  return parts
    .filter((p) => p !== '')
    .map((p) => ({ text: p, item: lex.get(p.toLowerCase()) ?? null }))
}

export const GlossaryText: React.FC<GlossaryTextProps> = ({ text, onGlossaryCount }) => {
  const [openKey, setOpenKey] = useState<string | null>(null)
  const [openItem, setOpenItem] = useState<VocabItem | null>(null)
  const [added, setAdded] = useState<Set<string>>(new Set())

  // 文章框是 overflow-hidden 包 overflow-y-auto，inline 的 absolute 浮層再高的 z-index
  // 也逃不出裁切——點在可視區下半部或靠右的字，釋義卡會被切掉一半。改成固定在視窗底部
  // 的釋義列：不受任何祖先 overflow 影響，而且單手拿手機時本來就該落在拇指區。
  React.useEffect(() => {
    if (!openItem) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpenKey(null)
        setOpenItem(null)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [openItem])

  const blocks = useMemo(() => parseMarkdownToBlocks(text), [text])
  const tokens = useMemo(() => tokenize(text), [text])

  const uniqueCount = useMemo(() => {
    const seen = new Set<string>()
    for (const t of tokens) if (t.item) seen.add(t.item.id)
    return seen.size
  }, [tokens])

  React.useEffect(() => {
    onGlossaryCount?.(uniqueCount)
  }, [uniqueCount, onGlossaryCount])

  const handleAdd = (item: VocabItem) => {
    // 加入單字本＝進入 SRS 佇列，熟悉度從「需要複習」起算。
    const current = getVocabMasteryMap()[item.id]?.level ?? 0
    updateVocabMastery(item.id, current > 0 ? current : 1)
    setAdded((prev) => new Set(prev).add(item.id))
  }

  const renderTokens = (inlineText: string, keyPrefix: string) => {
    const inlineTokens = tokenize(inlineText)
    return inlineTokens.map((token, i) => {
      if (!token.item) return <React.Fragment key={i}>{token.text}</React.Fragment>
      const item = token.item
      const tokenKey = `${keyPrefix}-${i}`
      const isOpen = openKey === tokenKey

      return (
        <button
          key={i}
          type="button"
          onClick={() => {
            setOpenKey(isOpen ? null : tokenKey)
            setOpenItem(isOpen ? null : item)
          }}
          aria-expanded={isOpen}
          className={cn(
            'cursor-pointer underline decoration-dotted underline-offset-4',
            isOpen
              ? 'decoration-[var(--pr)] text-[var(--pr)]'
              : 'decoration-[var(--pr-ln)] hover:decoration-[var(--pr)]'
          )}
        >
          {token.text}
        </button>
      )
    })
  }

  return (
    <div className="space-y-3 font-body-text text-[var(--tx)]">
      {blocks.map((block, idx) => {
        if (block.type === 'table' && block.tableHeaders) {
          return (
            <div
              key={idx}
              className="my-4 overflow-x-auto rounded-xl border border-[var(--ln)] bg-[var(--sf)]"
            >
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-[var(--sf2)] border-b border-[var(--ln)] text-[var(--pr)] font-bold">
                    {block.tableHeaders.map((header, hIdx) => (
                      <th key={hIdx} className="px-3.5 py-2.5 whitespace-nowrap">
                        {renderTokens(header, `b${idx}-h${hIdx}`)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--ln2)]">
                  {block.tableRows?.map((row, rIdx) => (
                    <tr key={rIdx} className="hover:bg-[var(--sf2)] transition-colors">
                      {row.map((cell, cIdx) => (
                        <td key={cIdx} className="px-3.5 py-2.5 whitespace-nowrap text-[var(--tx)]">
                          {renderTokens(cell, `b${idx}-r${rIdx}-c${cIdx}`)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        }

        if (block.type === 'h2') {
          return (
            <h2 key={idx} className="text-base font-bold text-[var(--pr)] border-b border-[var(--ln)] pb-1.5 mt-4 mb-2">
              {renderTokens(block.content, `b${idx}`)}
            </h2>
          )
        }

        if (block.type === 'h3') {
          return (
            <h3 key={idx} className="text-sm font-semibold text-[var(--tx)] mt-3 mb-1.5">
              {renderTokens(block.content, `b${idx}`)}
            </h3>
          )
        }

        if (block.type === 'quote') {
          return (
            <blockquote key={idx} className="p-3 rounded-lg bg-[var(--pr-sf)] border border-[var(--pr-ln)] text-xs leading-relaxed text-[var(--mu)] my-2">
              {renderTokens(block.content, `b${idx}`)}
            </blockquote>
          )
        }

        if (block.type === 'ul' && block.items) {
          return (
            <ul key={idx} className="space-y-1.5 my-2 pl-2">
              {block.items.map((item, itemIdx) => (
                <li key={itemIdx} className="flex items-start gap-2 text-xs">
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--pr)] mt-1.5 flex-shrink-0" />
                  <span className="flex-1">{renderTokens(item, `b${idx}-i${itemIdx}`)}</span>
                </li>
              ))}
            </ul>
          )
        }

        if (block.type === 'ol' && block.items) {
          return (
            <ol key={idx} className="space-y-1.5 my-2 pl-2">
              {block.items.map((item, itemIdx) => (
                <li key={itemIdx} className="flex items-start gap-2 text-xs">
                  <span className="font-semibold text-[var(--pr)] text-xs min-w-[16px] pt-0.5">
                    {itemIdx + 1}.
                  </span>
                  <span className="flex-1">{renderTokens(item, `b${idx}-i${itemIdx}`)}</span>
                </li>
              ))}
            </ol>
          )
        }

        return (
          <p key={idx} className="text-sm leading-relaxed whitespace-pre-line">
            {renderTokens(block.content, `b${idx}`)}
          </p>
        )
      })}

      {/*
        釋義列。fixed 相對視窗定位，所以文章框的 overflow 裁不到它；bottom-20 是為了
        讓開位置給手機底部導航。陰影用 DESIGN.md 的 Overlay 值——這是全站唯一
        真正浮在內容之上、因此允許有陰影的元件。
      */}
      {openItem && (
        <div
          role="dialog"
          aria-label={`${openItem.word} 的釋義`}
          className="fixed inset-x-3 bottom-20 z-50 mx-auto max-w-md animate-fade-in rounded-2xl border border-[var(--ln2)] bg-[var(--sf)] p-4 text-left shadow-[0_8px_32px_rgba(0,0,0,0.4)] lg:bottom-6"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="flex items-baseline gap-2">
                <span className="font-bold text-[var(--tx)]">{openItem.word}</span>
                <span className="text-[11px] text-[var(--mu)]">{openItem.pos}</span>
              </p>
              <p className="mt-1 text-xs leading-relaxed text-[var(--mu)]">{openItem.meaning}</p>
            </div>
            <button
              type="button"
              onClick={() => {
                setOpenKey(null)
                setOpenItem(null)
              }}
              aria-label="關閉釋義"
              className="-mr-1 -mt-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-[var(--mu)] hover:bg-[var(--sf2)]"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <button
            type="button"
            onClick={() => handleAdd(openItem)}
            disabled={added.has(openItem.id)}
            className="mt-3 flex min-h-[44px] w-full items-center justify-center gap-1.5 rounded-lg border border-[var(--pr-ln)] bg-[var(--pr-sf)] text-xs font-bold text-[var(--pr)] disabled:opacity-60"
          >
            {added.has(openItem.id) ? (
              <>
                <Check className="h-3.5 w-3.5" /> 已加入單字本
              </>
            ) : (
              <>
                <Plus className="h-3.5 w-3.5" /> 加入單字本
              </>
            )}
          </button>
        </div>
      )}
    </div>
  )
}

