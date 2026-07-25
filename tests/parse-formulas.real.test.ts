import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { parseFormulas } from '../scripts/build-content/parse-formulas'

const NOTES_DIR = process.env.NOTES_DIR ?? 'D:\\my-note\\個人學習\\多益'
const GRAMMAR_DIR = join(NOTES_DIR, '文法')

function eachChapter(fn: (chapterId: string, md: string) => void): void {
  for (const category of readdirSync(GRAMMAR_DIR, { withFileTypes: true }).filter((d) => d.isDirectory())) {
    const dir = join(GRAMMAR_DIR, category.name)
    for (const file of readdirSync(dir).filter((f) => f.endsWith('.md'))) {
      fn(`grammar/${category.name}/${file.replace(/\.md$/, '')}`, readFileSync(join(dir, file), 'utf8'))
    }
  }
}

describe('parseFormulas against real notes', () => {
  it('finds formulas in every one of the 29 chapters', () => {
    const counts: { chapter: string; count: number }[] = []
    eachChapter((chapterId, md) => {
      counts.push({ chapter: chapterId, count: parseFormulas(md, chapterId).length })
    })

    expect(counts).toHaveLength(29)
    const empty = counts.filter((c) => c.count === 0)
    expect(empty, `chapters with no formulas: ${JSON.stringify(empty)}`).toEqual([])
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
