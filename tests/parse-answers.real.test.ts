import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { parseAnswers } from '../scripts/build-content/parse-answers'

const NOTES_DIR = process.env.NOTES_DIR ?? 'D:\\my-note\\個人學習\\多益'
const EXPLAIN_DIR = join(NOTES_DIR, '詳解')

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

describe('parseAnswers against every real explanation file', () => {
  it('covers all 69 grammar explanation files', () => {
    const files: string[] = []
    eachGrammarExplanation((label) => files.push(label))
    expect(files).toHaveLength(69)
  })

  it('finds 5 (original) or 15 (expansion) entries in each file', () => {
    const bad: string[] = []
    eachGrammarExplanation((label, md) => {
      const count = parseAnswers(md).length
      if (count !== 5 && count !== 15) bad.push(`${label}: ${count} entries`)
    })
    expect(bad, `explanation files without 5 or 15 entries:\n${bad.join('\n')}`).toEqual([])
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
