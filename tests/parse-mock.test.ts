import { describe, it, expect } from 'vitest'
import { parseMockExam } from '../scripts/build-content/parse-mock'

const MD = `# 模擬測驗一

## 📝 測驗說明
本回模擬測驗仿照多益正式考試題型。

---

## Part 5：單句文法與字彙填空（15 題）

### 題目 1
The marketing team must submit the report ______ Friday afternoon.

(A) at
(B) by
(C) since
(D) among

### 題目 2
Ms. Rodriguez ______ as the regional manager for eight years.

(A) serves
(B) served
(C) has served
(D) had served

## Part 6：短文填空（2 篇，每篇 4 題）

### 短文一：公司內部公告

To: All Staff

Staff currently ______ (16) on the third floor will be relocated.

### 題目 16
(A) work
(B) working
(C) worked
(D) to work

### 短文二：客戶通知

Dear customer, your order ______ (17) shipped.

### 題目 17
(A) is
(B) are
(C) was
(D) were
`

describe('parseMockExam', () => {
  const exam = parseMockExam(MD, 'mock/模擬測驗一', '模擬測驗一')

  it('records the exam id and title', () => {
    expect(exam.id).toBe('mock/模擬測驗一')
    expect(exam.title).toBe('模擬測驗一')
  })

  it('skips the instructions section', () => {
    expect(exam.sections.some((s) => s.part.includes('測驗說明'))).toBe(false)
  })

  it('gives Part 5 a single section with no passage', () => {
    const part5 = exam.sections.filter((s) => s.part.startsWith('Part 5'))
    expect(part5).toHaveLength(1)
    expect(part5[0]?.passage).toBe('')
    expect(part5[0]?.title).toBe('')
    expect(part5[0]?.questions.map((q) => q.number)).toEqual([1, 2])
  })

  it('gives Part 6 one section per passage', () => {
    const part6 = exam.sections.filter((s) => s.part.startsWith('Part 6'))
    expect(part6.map((s) => s.title)).toEqual(['短文一：公司內部公告', '短文二：客戶通知'])
    expect(part6[0]?.questions.map((q) => q.number)).toEqual([16])
    expect(part6[1]?.questions.map((q) => q.number)).toEqual([17])
  })

  it('keeps the passage prose so the blanks are answerable', () => {
    const part6 = exam.sections.filter((s) => s.part.startsWith('Part 6'))
    expect(part6[0]?.passage).toContain('To: All Staff')
    expect(part6[0]?.passage).toContain('third floor')
    expect(part6[0]?.passage).not.toContain('(A) work')
  })

  it('parses the stem and options of a Part 5 question', () => {
    const q1 = exam.sections[0]?.questions[0]
    expect(q1?.stem).toBe('The marketing team must submit the report ______ Friday afternoon.')
    expect(q1?.blanks[0]?.options.map((o) => o.text)).toEqual(['at', 'by', 'since', 'among'])
  })

  it('falls back to the heading as the stem for cloze questions', () => {
    const q16 = exam.sections.find((s) => s.title.startsWith('短文一'))?.questions[0]
    expect(q16?.stem).toBe('題目 16')
  })

  it('builds question ids from the exam chapter', () => {
    expect(exam.sections[0]?.questions[0]?.id).toBe('mock/模擬測驗一#q1')
    const q16 = exam.sections.find((s) => s.title.startsWith('短文一'))?.questions[0]
    expect(q16?.id).toBe('mock/模擬測驗一#q16')
  })

  it('marks every question with the mock category', () => {
    expect(exam.sections[0]?.questions[0]?.categoryId).toBe('mock')
    expect(exam.sections[0]?.questions[0]?.source).toBe('note')
  })

  it('drops a part that has no questions', () => {
    const md = `## Part 5：空的
只有說明文字。

## Part 6：有題目

### 題目 1
Stem here.

(A) a
(B) b
`
    const result = parseMockExam(md, 'mock/x', 'x')
    expect(result.sections.map((s) => s.part)).toEqual(['Part 6：有題目'])
  })
})
