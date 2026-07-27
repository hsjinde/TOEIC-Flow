import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { parseQuestions } from '../scripts/build-content/parse-questions'

const NOTES_DIR = process.env.NOTES_DIR ?? 'D:\\my-note\\個人學習\\多益'
const GRAMMAR_DIR = join(NOTES_DIR, '文法')

function eachChapter(fn: (chapterId: string, categoryId: string, md: string) => void): void {
  for (const category of readdirSync(GRAMMAR_DIR, { withFileTypes: true }).filter((d) => d.isDirectory())) {
    const dir = join(GRAMMAR_DIR, category.name)
    for (const file of readdirSync(dir).filter((f) => f.endsWith('.md'))) {
      fn(`grammar/${category.name}/${file.replace(/\.md$/, '')}`, category.name, readFileSync(join(dir, file), 'utf8'))
    }
  }
}

describe('parseQuestions against every real chapter', () => {
  it('finds either 5 (original) or 15 (expansion) questions in each of the 69 chapters', () => {
    const results: { chapter: string; count: number }[] = []
    eachChapter((chapterId, categoryId, md) => {
      results.push({ chapter: chapterId, count: parseQuestions(md, chapterId, categoryId).length })
    })

    expect(results).toHaveLength(69)
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

  it('produces 745 questions in total', () => {
    let total = 0
    eachChapter((chapterId, categoryId, md) => {
      total += parseQuestions(md, chapterId, categoryId).length
    })
    expect(total).toBe(745)
  })
})
