import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { parseMockExam } from '../scripts/build-content/parse-mock'
import { parseAnswers } from '../scripts/build-content/parse-answers'
import { NOTES_DIR, VAULT_AVAILABLE, VAULT_SKIP_REASON } from './support/vault'

if (!VAULT_AVAILABLE) console.warn(`[parse-mock.real.test.ts] ${VAULT_SKIP_REASON}`)

const MOCK_DIR = join(NOTES_DIR, '模擬考試')

// 下限：目前筆記的實際模擬考份數／題數。低於這個數字代表資料縮水，不是筆記變動——直接 fail。
const FLOOR_EXAMS = 6
const FLOOR_TOTAL_QUESTIONS = 186

function eachExam(fn: (file: string, exam: ReturnType<typeof parseMockExam>) => void): void {
  for (const file of readdirSync(MOCK_DIR).filter((f) => f.endsWith('.md'))) {
    const title = file.replace(/\.md$/, '')
    fn(file, parseMockExam(readFileSync(join(MOCK_DIR, file), 'utf8'), `mock/${title}`, title))
  }
}

describe.skipIf(!VAULT_AVAILABLE)('parseMockExam against real notes', () => {
  it('finds all three parts in each exam', () => {
    eachExam((file, exam) => {
      const parts = new Set(exam.sections.map((s) => s.part.split('：')[0]?.trim()))
      expect([...parts].sort(), `parts found in ${file}`).toEqual(['Part 5', 'Part 6', 'Part 7'])
    })
  })

  it(`covers at least ${FLOOR_EXAMS} mock exams and ${FLOOR_TOTAL_QUESTIONS} questions total (floor — a drop below this means the mock-exam bank shrank, likely by accident)`, () => {
    let examCount = 0
    let total = 0
    eachExam((_, exam) => {
      examCount += 1
      total += exam.sections.reduce((n, s) => n + s.questions.length, 0)
    })

    expect(
      examCount,
      `模擬考份數縮水，疑似誤刪：目前只找到 ${examCount} 份，門檻是 ${FLOOR_EXAMS} 份`,
    ).toBeGreaterThanOrEqual(FLOOR_EXAMS)
    expect(
      total,
      `模擬考題數縮水，疑似誤刪：目前只解析出 ${total} 題，門檻是 ${FLOOR_TOTAL_QUESTIONS} 題`,
    ).toBeGreaterThanOrEqual(FLOOR_TOTAL_QUESTIONS)
  })

  it('reports the exact exam/question count (informative — not a red light when notes legitimately grow)', () => {
    let examCount = 0
    let total = 0
    eachExam((_, exam) => {
      examCount += 1
      total += exam.sections.reduce((n, s) => n + s.questions.length, 0)
    })

    if (examCount !== FLOOR_EXAMS || total !== FLOOR_TOTAL_QUESTIONS) {
      console.warn(
        `[parse-mock.real.test.ts] 份數/題數已從 ${FLOOR_EXAMS}/${FLOOR_TOTAL_QUESTIONS} ` +
          `變為 ${examCount}/${total}。若是筆記合法新增，請更新這個檔案裡的 FLOOR_EXAMS / FLOOR_TOTAL_QUESTIONS。`,
      )
    }
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
