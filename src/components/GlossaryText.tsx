'use client'

import React, { useMemo, useState } from 'react'
import { Check, Plus } from 'lucide-react'
import type { VocabItem } from '../../scripts/build-content/types'
import { getVocabItems } from '../lib/content'
import { getVocabMasteryMap, updateVocabMastery } from '../lib/storage'
import { parseMarkdownToBlocks } from './MarkdownRenderer'

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
  const [added, setAdded] = useState<Set<string>>(new Set())

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
        <span key={i} className="relative inline-block">
          <button
            type="button"
            onClick={() => setOpenKey(isOpen ? null : tokenKey)}
            aria-expanded={isOpen}
            className="cursor-pointer underline decoration-[var(--pr-ln)] decoration-dotted underline-offset-4 hover:decoration-[var(--pr)]"
          >
            {token.text}
          </button>
          {isOpen && (
            <span className="absolute left-0 top-full z-30 mt-1.5 block w-60 animate-fade-in rounded-xl border border-[var(--ln2)] bg-[var(--sf)] p-3 text-left shadow-lg">
              <span className="flex items-baseline gap-2">
                <span className="font-bold text-[var(--tx)]">{item.word}</span>
                <span className="text-[11px] text-[var(--mu)]">{item.pos}</span>
              </span>
              <span className="mt-1 block text-xs leading-relaxed text-[var(--mu)]">
                {item.meaning}
              </span>
              <button
                type="button"
                onClick={() => handleAdd(item)}
                disabled={added.has(item.id)}
                className="mt-2 flex min-h-[32px] w-full items-center justify-center gap-1 rounded-lg border border-[var(--pr-ln)] bg-[var(--pr-sf)] text-[11px] font-bold text-[var(--pr)] disabled:opacity-60"
              >
                {added.has(item.id) ? (
                  <>
                    <Check className="h-3 w-3" /> 已加入單字本
                  </>
                ) : (
                  <>
                    <Plus className="h-3 w-3" /> 加入單字本
                  </>
                )}
              </button>
            </span>
          )}
        </span>
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
              className="my-4 overflow-x-auto rounded-xl border border-[var(--ln)] bg-[var(--sf)] shadow-sm"
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
            <blockquote key={idx} className="p-3 rounded-lg bg-[var(--pr-sf)] border-l-4 border-[var(--pr)] text-xs leading-relaxed text-[var(--mu)] my-2">
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
    </div>
  )
}

