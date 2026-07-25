import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { parseMockExam } from '../scripts/build-content/parse-mock'
import { parseAnswers } from '../scripts/build-content/parse-answers'

const NOTES_DIR = process.env.NOTES_DIR ?? 'D:\\my-note\\個人學習\\多益'
const MOCK_DIR = join(NOTES_DIR, '模擬考試')

function eachExam(fn: (file: string, exam: ReturnType<typeof parseMockExam>) => void): void {
  for (const file of readdirSync(MOCK_DIR).filter((f) => f.endsWith('.md'))) {
    const title = file.replace(/\.md$/, '')
    fn(file, parseMockExam(readFileSync(join(MOCK_DIR, file), 'utf8'), `mock/${title}`, title))
  }
}

describe('parseMockExam against real notes', () => {
  it('covers both mock exams', () => {
    const titles: string[] = []
    eachExam((_, exam) => titles.push(exam.title))
    expect(titles).toHaveLength(2)
  })

  it('finds all three parts in each exam', () => {
    eachExam((file, exam) => {
      const parts = new Set(exam.sections.map((s) => s.part.split('：')[0]?.trim()))
      expect([...parts].sort(), `parts found in ${file}`).toEqual(['Part 5', 'Part 6', 'Part 7'])
    })
  })

  it('numbers questions 1..N continuously across parts', () => {
    const bad: string[] = []
    eachExam((file, exam) => {
      const numbers = exam.sections.flatMap((s) => s.questions.map((q) => q.number)).sort((a, b) => a - b)
      const expected = Array.from({ length: numbers.length }, (_, i) => i + 1)
      if (JSON.stringify(numbers) !== JSON.stringify(expected)) bad.push(`${file}: ${numbers.join(',')}`)
    })
    expect(bad, `exams whose question numbers are not 1..N:\n${bad.join('\n')}`).toEqual([])
  })

  it('gives every Part 6 and Part 7 section a non-empty passage', () => {
    const bad: string[] = []
    eachExam((file, exam) => {
      for (const section of exam.sections) {
        if (/Part [67]/.test(section.part) && !section.passage.trim()) {
          bad.push(`${file} ${section.part} / ${section.title} 沒有短文`)
        }
      }
    })
    expect(bad, `cloze sections with no passage:\n${bad.join('\n')}`).toEqual([])
  })

  it('gives every question at least two options', () => {
    const bad: string[] = []
    eachExam((file, exam) => {
      for (const section of exam.sections) {
        for (const q of section.questions) {
          const count = q.blanks[0]?.options.length ?? 0
          if (count < 2) bad.push(`${q.id} has ${count} option(s)`)
        }
      }
    })
    expect(bad, `questions with too few options:\n${bad.join('\n')}`).toEqual([])
  })

  it('has an explanation entry for every parsed question', () => {
    const bad: string[] = []
    eachExam((file, exam) => {
      const answered = new Set(
        parseAnswers(readFileSync(join(NOTES_DIR, '詳解', '模擬考試', file), 'utf8')).map((e) => e.number),
      )
      const missing = exam.sections
        .flatMap((s) => s.questions.map((q) => q.number))
        .filter((n) => !answered.has(n))
      if (missing.length > 0) bad.push(`${file}: 題目 ${missing.join(',')} 沒有詳解`)
    })
    expect(bad, `questions without explanations:\n${bad.join('\n')}`).toEqual([])
  })
})
