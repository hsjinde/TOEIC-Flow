import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { parseReading } from '../scripts/build-content/parse-reading'
import { parseAnswers } from '../scripts/build-content/parse-answers'
import { NOTES_DIR, VAULT_AVAILABLE, VAULT_SKIP_REASON } from './support/vault'

if (!VAULT_AVAILABLE) console.warn(`[parse-reading.real.test.ts] ${VAULT_SKIP_REASON}`)

const READING_DIR = join(NOTES_DIR, '閱讀理解')

// 下限：目前筆記的實際閱讀檔數／題數。低於這個數字代表資料縮水，不是筆記變動——直接 fail。
const FLOOR_FILES = 24
const FLOOR_TOTAL_QUESTIONS = 208

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

describe.skipIf(!VAULT_AVAILABLE)('parseReading against real notes', () => {
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

  it(`covers at least ${FLOOR_FILES} reading files and ${FLOOR_TOTAL_QUESTIONS} questions total (floor — a drop below this means the reading bank shrank, likely by accident)`, () => {
    let fileCount = 0
    let total = 0
    eachFile((kindDir, _, chapterId, md) => {
      const kind = KINDS[kindDir]
      if (!kind) return
      fileCount += 1
      total += parseReading(md, chapterId, kind).reduce((n, p) => n + p.questions.length, 0)
    })

    expect(
      fileCount,
      `閱讀檔案數縮水，疑似誤刪：目前只找到 ${fileCount} 個檔案，門檻是 ${FLOOR_FILES} 個`,
    ).toBeGreaterThanOrEqual(FLOOR_FILES)
    expect(
      total,
      `閱讀題數縮水，疑似誤刪：目前只解析出 ${total} 題，門檻是 ${FLOOR_TOTAL_QUESTIONS} 題`,
    ).toBeGreaterThanOrEqual(FLOOR_TOTAL_QUESTIONS)
  })

  it('reports the exact file/question count (informative — not a red light when notes legitimately grow)', () => {
    let fileCount = 0
    let total = 0
    eachFile((kindDir, _, chapterId, md) => {
      const kind = KINDS[kindDir]
      if (!kind) return
      fileCount += 1
      total += parseReading(md, chapterId, kind).reduce((n, p) => n + p.questions.length, 0)
    })

    if (fileCount !== FLOOR_FILES || total !== FLOOR_TOTAL_QUESTIONS) {
      console.warn(
        `[parse-reading.real.test.ts] 檔案數/題數已從 ${FLOOR_FILES}/${FLOOR_TOTAL_QUESTIONS} ` +
          `變為 ${fileCount}/${total}。若是筆記合法新增，請更新這個檔案裡的 FLOOR_FILES / FLOOR_TOTAL_QUESTIONS。`,
      )
    }
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
