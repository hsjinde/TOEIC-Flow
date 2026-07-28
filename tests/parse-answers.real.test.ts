import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { parseAnswers } from '../scripts/build-content/parse-answers'
import { NOTES_DIR, VAULT_AVAILABLE, VAULT_SKIP_REASON } from './support/vault'

if (!VAULT_AVAILABLE) console.warn(`[parse-answers.real.test.ts] ${VAULT_SKIP_REASON}`)

const EXPLAIN_DIR = join(NOTES_DIR, '詳解')

// 下限：目前筆記的實際文法詳解檔數／條目數。低於這個數字代表資料縮水，不是筆記變動——直接 fail。
const FLOOR_FILES = 69
const FLOOR_TOTAL_ENTRIES = 745

function eachGrammarExplanation(fn: (label: string, md: string) => void): void {
  const categories = readdirSync(EXPLAIN_DIR, { withFileTypes: true }).filter(
    (d) => d.isDirectory() && /^\d/.test(d.name),
  )
  for (const category of categories) {
    const dir = join(EXPLAIN_DIR, category.name)
    for (const file of readdirSync(dir).filter((f) => f.endsWith('.md'))) {
      fn(`${category.name}/${file}`, readFileSync(join(dir, file), 'utf8'))
    }
  }
}

describe.skipIf(!VAULT_AVAILABLE)('parseAnswers against every real explanation file', () => {
  it('finds 5 (original) or 15 (expansion) entries in each file', () => {
    const bad: string[] = []
    eachGrammarExplanation((label, md) => {
      const count = parseAnswers(md).length
      if (count !== 5 && count !== 15) bad.push(`${label}: ${count} entries`)
    })
    expect(bad, `explanation files without 5 or 15 entries:\n${bad.join('\n')}`).toEqual([])
  })

  it(`covers at least ${FLOOR_FILES} grammar explanation files and ${FLOOR_TOTAL_ENTRIES} entries total (floor — a drop below this means explanations shrank, likely by accident)`, () => {
    let fileCount = 0
    let total = 0
    eachGrammarExplanation((_, md) => {
      fileCount += 1
      total += parseAnswers(md).length
    })

    expect(
      fileCount,
      `詳解檔數縮水，疑似誤刪：目前只找到 ${fileCount} 個檔案，門檻是 ${FLOOR_FILES} 個`,
    ).toBeGreaterThanOrEqual(FLOOR_FILES)
    expect(
      total,
      `詳解條目縮水，疑似誤刪：目前只解析出 ${total} 條，門檻是 ${FLOOR_TOTAL_ENTRIES} 條`,
    ).toBeGreaterThanOrEqual(FLOOR_TOTAL_ENTRIES)
  })

  it('reports the exact file/entry count (informative — not a red light when notes legitimately grow)', () => {
    let fileCount = 0
    let total = 0
    eachGrammarExplanation((_, md) => {
      fileCount += 1
      total += parseAnswers(md).length
    })

    if (fileCount !== FLOOR_FILES || total !== FLOOR_TOTAL_ENTRIES) {
      console.warn(
        `[parse-answers.real.test.ts] 檔案數/條目數已從 ${FLOOR_FILES}/${FLOOR_TOTAL_ENTRIES} ` +
          `變為 ${fileCount}/${total}。若是筆記合法新增，請更新這個檔案裡的 FLOOR_FILES / FLOOR_TOTAL_ENTRIES。`,
      )
    }
  })

  it('leaves no entry without an answer key', () => {
    const empty: string[] = []
    eachGrammarExplanation((label, md) => {
      for (const entry of parseAnswers(md)) {
        if (entry.answers.length === 0) empty.push(`${label} 題目 ${entry.number}`)
      }
    })
    expect(empty, `entries with no parsable answer:\n${empty.join('\n')}`).toEqual([])
  })

  it('leaves no entry without analysis text', () => {
    const empty: string[] = []
    eachGrammarExplanation((label, md) => {
      for (const entry of parseAnswers(md)) {
        if (!entry.explanation.analysis.trim()) empty.push(`${label} 題目 ${entry.number}`)
      }
    })
    expect(empty, `entries with no analysis:\n${empty.join('\n')}`).toEqual([])
  })

  it('never lets a field swallow the next one', () => {
    const bad: string[] = []
    eachGrammarExplanation((label, md) => {
      for (const entry of parseAnswers(md)) {
        const { analysis, grammarPoint, similarNote } = entry.explanation
        for (const [name, value] of [
          ['analysis', analysis],
          ['grammarPoint', grammarPoint ?? ''],
          ['similarNote', similarNote ?? ''],
        ] as const) {
          if (/\*\*(答案|詳細解析|相關文法點|相似題型提醒)\*\*/.test(value)) {
            bad.push(`${label} 題目 ${entry.number} 的 ${name} 含有下一個欄位標題`)
          }
        }
      }
    })
    expect(bad, `fields that swallowed a neighbour:\n${bad.join('\n')}`).toEqual([])
  })
})
