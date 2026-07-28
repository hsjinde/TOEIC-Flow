import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { parseQuestions } from '../scripts/build-content/parse-questions'
import { NOTES_DIR, VAULT_AVAILABLE, VAULT_SKIP_REASON } from './support/vault'

if (!VAULT_AVAILABLE) console.warn(`[parse-questions.real.test.ts] ${VAULT_SKIP_REASON}`)

const GRAMMAR_DIR = join(NOTES_DIR, '文法')

// 下限：目前筆記的實際章節數／題數。低於這個數字代表題庫縮水，而不是筆記變動——直接 fail。
const FLOOR_CHAPTERS = 69
const FLOOR_TOTAL_QUESTIONS = 745

function eachChapter(fn: (chapterId: string, categoryId: string, md: string) => void): void {
  for (const category of readdirSync(GRAMMAR_DIR, { withFileTypes: true }).filter((d) => d.isDirectory())) {
    const dir = join(GRAMMAR_DIR, category.name)
    for (const file of readdirSync(dir).filter((f) => f.endsWith('.md'))) {
      fn(`grammar/${category.name}/${file.replace(/\.md$/, '')}`, category.name, readFileSync(join(dir, file), 'utf8'))
    }
  }
}

describe.skipIf(!VAULT_AVAILABLE)('parseQuestions against every real chapter', () => {
  it('finds either 5 (original) or 15 (expansion) questions in each chapter', () => {
    const results: { chapter: string; count: number }[] = []
    eachChapter((chapterId, categoryId, md) => {
      results.push({ chapter: chapterId, count: parseQuestions(md, chapterId, categoryId).length })
    })

    const bad = results.filter((r) => r.count !== 5 && r.count !== 15)
    expect(bad, `chapters without 5 or 15 questions: ${JSON.stringify(bad, null, 2)}`).toEqual([])
  })

  it('gives every blank at least two options', () => {
    const bad: string[] = []
    eachChapter((chapterId, categoryId, md) => {
      for (const q of parseQuestions(md, chapterId, categoryId)) {
        q.blanks.forEach((blank, index) => {
          if (blank.options.length < 2) {
            bad.push(`${q.id} blank ${index} has ${blank.options.length} option(s)`)
          }
        })
      }
    })
    expect(bad, `blanks with too few options:\n${bad.join('\n')}`).toEqual([])
  })

  it('uses distinct option keys within each blank', () => {
    const bad: string[] = []
    eachChapter((chapterId, categoryId, md) => {
      for (const q of parseQuestions(md, chapterId, categoryId)) {
        for (const blank of q.blanks) {
          const keys = blank.options.map((o) => o.key)
          if (new Set(keys).size !== keys.length) bad.push(`${q.id}: ${keys.join(',')}`)
        }
      }
    })
    expect(bad, `blanks with duplicate option keys:\n${bad.join('\n')}`).toEqual([])
  })

  it('leaves no stem containing option markers or the wikilink footer', () => {
    const bad: string[] = []
    eachChapter((chapterId, categoryId, md) => {
      for (const q of parseQuestions(md, chapterId, categoryId)) {
        if (/\([A-D]\)/.test(q.stem)) bad.push(`${q.id} stem still holds options: ${q.stem.slice(0, 80)}`)
        if (q.stem.includes('詳解請見')) bad.push(`${q.id} stem holds the footer`)
      }
    })
    expect(bad, `malformed stems:\n${bad.join('\n')}`).toEqual([])
  })

  it(`covers at least ${FLOOR_CHAPTERS} chapters and ${FLOOR_TOTAL_QUESTIONS} questions total (floor — a drop below this means the question bank shrank, likely by accident)`, () => {
    let chapterCount = 0
    let total = 0
    eachChapter((chapterId, categoryId, md) => {
      chapterCount += 1
      total += parseQuestions(md, chapterId, categoryId).length
    })

    expect(
      chapterCount,
      `章節數縮水，疑似誤刪：目前只解析出 ${chapterCount} 章，門檻是 ${FLOOR_CHAPTERS} 章`,
    ).toBeGreaterThanOrEqual(FLOOR_CHAPTERS)
    expect(
      total,
      `題庫縮水，疑似誤刪：目前只解析出 ${total} 題，門檻是 ${FLOOR_TOTAL_QUESTIONS} 題`,
    ).toBeGreaterThanOrEqual(FLOOR_TOTAL_QUESTIONS)
  })

  it('reports the exact chapter/question count (informative — not a red light when notes legitimately grow)', () => {
    let chapterCount = 0
    let total = 0
    eachChapter((chapterId, categoryId, md) => {
      chapterCount += 1
      total += parseQuestions(md, chapterId, categoryId).length
    })

    if (chapterCount !== FLOOR_CHAPTERS || total !== FLOOR_TOTAL_QUESTIONS) {
      console.warn(
        `[parse-questions.real.test.ts] 章節數/題數已從 ${FLOOR_CHAPTERS}/${FLOOR_TOTAL_QUESTIONS} ` +
          `變為 ${chapterCount}/${total}。若是筆記合法新增，請更新這個檔案裡的 FLOOR_CHAPTERS / FLOOR_TOTAL_QUESTIONS。`,
      )
    }
  })
})
