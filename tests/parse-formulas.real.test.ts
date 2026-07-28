import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { parseFormulas } from '../scripts/build-content/parse-formulas'
import { NOTES_DIR, VAULT_AVAILABLE, VAULT_SKIP_REASON } from './support/vault'

if (!VAULT_AVAILABLE) console.warn(`[parse-formulas.real.test.ts] ${VAULT_SKIP_REASON}`)

const GRAMMAR_DIR = join(NOTES_DIR, '文法')

// 下限：目前筆記的實際章節數／公式數。低於這個數字代表資料縮水，不是筆記變動——直接 fail。
const FLOOR_CHAPTERS = 69
const FLOOR_TOTAL_FORMULAS = 622

function eachChapter(fn: (chapterId: string, md: string) => void): void {
  for (const category of readdirSync(GRAMMAR_DIR, { withFileTypes: true }).filter((d) => d.isDirectory())) {
    const dir = join(GRAMMAR_DIR, category.name)
    for (const file of readdirSync(dir).filter((f) => f.endsWith('.md'))) {
      fn(`grammar/${category.name}/${file.replace(/\.md$/, '')}`, readFileSync(join(dir, file), 'utf8'))
    }
  }
}

describe.skipIf(!VAULT_AVAILABLE)('parseFormulas against real notes', () => {
  it('finds formulas in every chapter', () => {
    const counts: { chapter: string; count: number }[] = []
    eachChapter((chapterId, md) => {
      counts.push({ chapter: chapterId, count: parseFormulas(md, chapterId).length })
    })

    const empty = counts.filter((c) => c.count === 0)
    expect(empty, `chapters with no formulas: ${JSON.stringify(empty)}`).toEqual([])
  })

  it(`covers at least ${FLOOR_CHAPTERS} chapters and ${FLOOR_TOTAL_FORMULAS} formulas total (floor — a drop below this means the formula bank shrank, likely by accident)`, () => {
    let chapterCount = 0
    let total = 0
    eachChapter((chapterId, md) => {
      chapterCount += 1
      total += parseFormulas(md, chapterId).length
    })

    expect(
      chapterCount,
      `章節數縮水，疑似誤刪：目前只解析出 ${chapterCount} 章，門檻是 ${FLOOR_CHAPTERS} 章`,
    ).toBeGreaterThanOrEqual(FLOOR_CHAPTERS)
    expect(
      total,
      `秒殺公式縮水，疑似誤刪：目前只解析出 ${total} 條，門檻是 ${FLOOR_TOTAL_FORMULAS} 條`,
    ).toBeGreaterThanOrEqual(FLOOR_TOTAL_FORMULAS)
  })

  it('reports the exact chapter/formula count (informative — not a red light when notes legitimately grow)', () => {
    let chapterCount = 0
    let total = 0
    eachChapter((chapterId, md) => {
      chapterCount += 1
      total += parseFormulas(md, chapterId).length
    })

    if (chapterCount !== FLOOR_CHAPTERS || total !== FLOOR_TOTAL_FORMULAS) {
      console.warn(
        `[parse-formulas.real.test.ts] 章節數/公式數已從 ${FLOOR_CHAPTERS}/${FLOOR_TOTAL_FORMULAS} ` +
          `變為 ${chapterCount}/${total}。若是筆記合法新增，請更新這個檔案裡的 FLOOR_CHAPTERS / FLOOR_TOTAL_FORMULAS。`,
      )
    }
  })

  it('numbers entries consecutively from 1 within each chapter', () => {
    const bad: string[] = []
    eachChapter((chapterId, md) => {
      const numbers = parseFormulas(md, chapterId).map((f) => f.number)
      const expected = Array.from({ length: numbers.length }, (_, i) => i + 1)
      if (JSON.stringify(numbers) !== JSON.stringify(expected)) {
        bad.push(`${chapterId}: ${numbers.join(',')}`)
      }
    })
    expect(bad, `chapters with non-sequential formula numbers:\n${bad.join('\n')}`).toEqual([])
  })

  it('leaves no entry with an empty body', () => {
    const bad: string[] = []
    eachChapter((chapterId, md) => {
      for (const formula of parseFormulas(md, chapterId)) {
        if (!formula.body.trim()) bad.push(formula.id)
      }
    })
    expect(bad, `formulas with an empty body:\n${bad.join('\n')}`).toEqual([])
  })
})
