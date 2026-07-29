import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { parseVocab } from '../scripts/build-content/parse-vocab'
import { NOTES_DIR, VAULT_AVAILABLE, VAULT_SKIP_REASON } from './support/vault'

if (!VAULT_AVAILABLE) console.warn(`[parse-vocab.real.test.ts] ${VAULT_SKIP_REASON}`)

const GRAMMAR_DIR = join(NOTES_DIR, '文法')

// 下限：目前筆記的實際章節數／單字數。低於這個數字代表資料縮水，不是筆記變動——直接 fail。
const FLOOR_CHAPTERS = 69
const FLOOR_TOTAL_VOCAB = 1380

describe.skipIf(!VAULT_AVAILABLE)('parseVocab against real notes', () => {
  it('extracts 13 items from 01_名詞與代名詞', () => {
    const path = join(NOTES_DIR, '文法', '01_八大詞性與句型結構', '01_名詞與代名詞.md')
    const items = parseVocab(readFileSync(path, 'utf8'), 'grammar/01_八大詞性與句型結構/01_名詞與代名詞')
    expect(items.length).toBe(13)
    expect(items.every((i) => i.word.length > 0 && i.meaning.length > 0)).toBe(true)
  })

  it('extracts items across all chapters, none empty, none suspiciously thin', () => {
    let total = 0
    const counts: { chapter: string; count: number }[] = []

    for (const category of readdirSync(GRAMMAR_DIR, { withFileTypes: true }).filter((d) => d.isDirectory())) {
      const dir = join(GRAMMAR_DIR, category.name)
      for (const file of readdirSync(dir).filter((f) => f.endsWith('.md'))) {
        const chapterId = `grammar/${category.name}/${file.replace(/\.md$/, '')}`
        const items = parseVocab(readFileSync(join(dir, file), 'utf8'), chapterId)
        counts.push({ chapter: chapterId, count: items.length })
        total += items.length
      }
    }

    // A chapter with a handful of entries means the parser matched the section
    // but missed a bullet or descriptor variant inside it.
    const thin = counts.filter((c) => c.count < 5)
    expect(thin, `chapters with suspiciously few vocab entries: ${JSON.stringify(thin)}`).toEqual([])
  })

  it(`covers at least ${FLOOR_CHAPTERS} chapters and ${FLOOR_TOTAL_VOCAB} vocab items total (floor — a drop below this means data shrank, likely by accident)`, () => {
    let chapterCount = 0
    let total = 0
    for (const category of readdirSync(GRAMMAR_DIR, { withFileTypes: true }).filter((d) => d.isDirectory())) {
      const dir = join(GRAMMAR_DIR, category.name)
      for (const file of readdirSync(dir).filter((f) => f.endsWith('.md'))) {
        chapterCount += 1
        const chapterId = `grammar/${category.name}/${file.replace(/\.md$/, '')}`
        total += parseVocab(readFileSync(join(dir, file), 'utf8'), chapterId).length
      }
    }

    expect(
      chapterCount,
      `章節數縮水，疑似誤刪：目前只解析出 ${chapterCount} 章，門檻是 ${FLOOR_CHAPTERS} 章`,
    ).toBeGreaterThanOrEqual(FLOOR_CHAPTERS)
    expect(
      total,
      `單字量縮水，疑似誤刪：目前只解析出 ${total} 個單字，門檻是 ${FLOOR_TOTAL_VOCAB} 個`,
    ).toBeGreaterThanOrEqual(FLOOR_TOTAL_VOCAB)
  })

  it('reports the exact chapter/vocab count (informative — not a red light when notes legitimately grow)', () => {
    let chapterCount = 0
    let total = 0
    for (const category of readdirSync(GRAMMAR_DIR, { withFileTypes: true }).filter((d) => d.isDirectory())) {
      const dir = join(GRAMMAR_DIR, category.name)
      for (const file of readdirSync(dir).filter((f) => f.endsWith('.md'))) {
        chapterCount += 1
        const chapterId = `grammar/${category.name}/${file.replace(/\.md$/, '')}`
        total += parseVocab(readFileSync(join(dir, file), 'utf8'), chapterId).length
      }
    }

    if (chapterCount !== FLOOR_CHAPTERS || total !== FLOOR_TOTAL_VOCAB) {
      console.warn(
        `[parse-vocab.real.test.ts] 章節數/單字數已從 ${FLOOR_CHAPTERS}/${FLOOR_TOTAL_VOCAB} ` +
          `變為 ${chapterCount}/${total}。若是筆記合法新增，請更新這個檔案裡的 FLOOR_CHAPTERS / FLOOR_TOTAL_VOCAB。`,
      )
    }
  })

  it('leaves no entry with an empty pos or a meaning that swallowed the example', () => {
    const bad: string[] = []

    for (const category of readdirSync(GRAMMAR_DIR, { withFileTypes: true }).filter((d) => d.isDirectory())) {
      const dir = join(GRAMMAR_DIR, category.name)
      for (const file of readdirSync(dir).filter((f) => f.endsWith('.md'))) {
        const chapterId = `grammar/${category.name}/${file.replace(/\.md$/, '')}`
        for (const item of parseVocab(readFileSync(join(dir, file), 'utf8'), chapterId)) {
          if (!item.pos) bad.push(`${item.id} 沒有詞性`)
          // An unmatched `)` — one appearing before any `(` — means splitPos cut
          // inside the bracket. A balanced pair is legitimate: meanings such as
          // 「經濟(學)的」 contain brackets of their own.
          const close = item.meaning.indexOf(')')
          const open = item.meaning.indexOf('(')
          if (close !== -1 && (open === -1 || close < open)) {
            bad.push(`${item.id} 意思含孤立右括號：${item.meaning}`)
          }
        }
      }
    }

    expect(bad, `malformed vocabulary entries:\n${bad.join('\n')}`).toEqual([])
  })

  it('produces unique ids within each chapter', () => {
    const dir = join(GRAMMAR_DIR, '01_八大詞性與句型結構')
    for (const file of readdirSync(dir).filter((f) => f.endsWith('.md'))) {
      const chapterId = `grammar/01_八大詞性與句型結構/${file.replace(/\.md$/, '')}`
      const ids = parseVocab(readFileSync(join(dir, file), 'utf8'), chapterId).map((i) => i.id)
      expect(new Set(ids).size, `duplicate vocab ids in ${chapterId}`).toBe(ids.length)
    }
  })
})
