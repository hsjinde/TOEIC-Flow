import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { parseReading } from '../scripts/build-content/parse-reading'
import { parseAnswers } from '../scripts/build-content/parse-answers'

const NOTES_DIR = process.env.NOTES_DIR ?? 'D:\\my-note\\個人學習\\多益'
const READING_DIR = join(NOTES_DIR, '閱讀理解')

const KINDS: Record<string, 'single' | 'paragraph' | 'article'> = {
  '01_單句填空題': 'single',
  '02_段落填空題': 'paragraph',
  '03_篇章閱讀題': 'article',
}

function eachFile(fn: (kindDir: string, file: string, chapterId: string, md: string) => void): void {
  for (const kindDir of readdirSync(READING_DIR, { withFileTypes: true }).filter((d) => d.isDirectory())) {
    const dir = join(READING_DIR, kindDir.name)
    for (const file of readdirSync(dir).filter((f) => f.endsWith('.md'))) {
      const chapterId = `reading/${kindDir.name}/${file.replace(/\.md$/, '')}`
      fn(kindDir.name, file, chapterId, readFileSync(join(dir, file), 'utf8'))
    }
  }
}

describe('parseReading against real notes', () => {
  it('covers all 6 reading files', () => {
    const files: string[] = []
    eachFile((_, __, chapterId) => files.push(chapterId))
    expect(files).toHaveLength(6)
  })

  it('yields questions from every file, including single-sentence ones', () => {
    const empty: string[] = []
    eachFile((kindDir, _, chapterId, md) => {
      const kind = KINDS[kindDir]
      if (!kind) return
      const total = parseReading(md, chapterId, kind).reduce((n, p) => n + p.questions.length, 0)
      if (total === 0) empty.push(chapterId)
    })
    expect(empty, `reading files with no questions: ${empty.join(', ')}`).toEqual([])
  })

  it('gives every question at least two options', () => {
    const bad: string[] = []
    eachFile((kindDir, _, chapterId, md) => {
      const kind = KINDS[kindDir]
      if (!kind) return
      for (const passage of parseReading(md, chapterId, kind)) {
        for (const q of passage.questions) {
          const count = q.blanks[0]?.options.length ?? 0
          if (count < 2) bad.push(`${q.id} has ${count} option(s)`)
        }
      }
    })
    expect(bad, `questions with too few options:\n${bad.join('\n')}`).toEqual([])
  })

  it('produces unique question ids within each file', () => {
    const bad: string[] = []
    eachFile((kindDir, _, chapterId, md) => {
      const kind = KINDS[kindDir]
      if (!kind) return
      const ids = parseReading(md, chapterId, kind).flatMap((p) => p.questions.map((q) => q.id))
      if (new Set(ids).size !== ids.length) bad.push(chapterId)
    })
    expect(bad, `files with duplicate question ids: ${bad.join(', ')}`).toEqual([])
  })

  it('numbers questions continuously across passages within a file', () => {
    // The explanation file numbers questions 1..N for the whole file, so the
    // parsed numbers must line up with it or the merge step cannot pair them.
    const bad: string[] = []
    eachFile((kindDir, file, chapterId, md) => {
      const kind = KINDS[kindDir]
      if (!kind) return
      const numbers = parseReading(md, chapterId, kind)
        .flatMap((p) => p.questions.map((q) => q.number))
        .sort((a, b) => a - b)
      const expected = Array.from({ length: numbers.length }, (_, i) => i + 1)
      if (JSON.stringify(numbers) !== JSON.stringify(expected)) {
        bad.push(`${chapterId}: ${numbers.join(',')}`)
      }
    })
    expect(bad, `files whose question numbers are not 1..N:\n${bad.join('\n')}`).toEqual([])
  })

  it('has an explanation entry for every parsed question', () => {
    const bad: string[] = []
    eachFile((kindDir, file, chapterId, md) => {
      const kind = KINDS[kindDir]
      if (!kind) return
      const parsed = parseReading(md, chapterId, kind).flatMap((p) => p.questions.map((q) => q.number))
      const explainPath = join(NOTES_DIR, '詳解', '閱讀理解', kindDir, file)
      const answered = new Set(parseAnswers(readFileSync(explainPath, 'utf8')).map((e) => e.number))
      const missing = parsed.filter((n) => !answered.has(n))
      if (missing.length > 0) bad.push(`${chapterId}: 題目 ${missing.join(',')} 沒有詳解`)
    })
    expect(bad, `questions without explanations:\n${bad.join('\n')}`).toEqual([])
  })
})
