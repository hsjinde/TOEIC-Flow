import { describe, it, expect } from 'vitest'
import { parseReading } from '../scripts/build-content/parse-reading'

describe('parseReading with paragraph-cloze notes', () => {
  const MD = `# 01_綜合練習一

## 📝 答題策略 🌟
1.  時態一致原則。

---

## 短文一：公司內部公告

Notice to All Staff

Starting next Monday, the office will ______(1) to a new floor plan.

### 題目 1
(A) move
(B) moving
(C) moved
(D) has moved

### 題目 2（細節題）
(A) The cafeteria will remain open.
(B) All desks must be packed by Friday.
(C) The company was founded years ago.
(D) Please bring your own lunch.

## 短文二：客戶信件

Dear Ms. Lee, thank you for your ______(3) order.

### 題目 3
(A) recent
(B) recently
(C) recency
(D) recentness
`

  const passages = parseReading(MD, 'reading/02_段落填空題/01_綜合練習一', 'paragraph')

  it('skips the strategy section and keeps only passages', () => {
    expect(passages.map((p) => p.title)).toEqual(['短文一：公司內部公告', '短文二：客戶信件'])
  })

  it('keeps the passage body without its questions', () => {
    expect(passages[0]?.passage).toContain('Notice to All Staff')
    expect(passages[0]?.passage).not.toContain('題目 1')
    expect(passages[0]?.passage).not.toContain('(A) move')
  })

  it('assigns each question to the passage it sits under', () => {
    expect(passages[0]?.questions.map((q) => q.number)).toEqual([1, 2])
    expect(passages[1]?.questions.map((q) => q.number)).toEqual([3])
  })

  it('parses one option per line', () => {
    expect(passages[0]?.questions[0]?.blanks[0]?.options).toHaveLength(4)
    expect(passages[0]?.questions[0]?.blanks[0]?.options[1]?.text).toBe('moving')
  })

  it('keeps full-sentence options intact', () => {
    expect(passages[0]?.questions[1]?.blanks[0]?.options[1]?.text).toBe(
      'All desks must be packed by Friday.',
    )
  })

  it('falls back to the heading as the stem when the question has no text of its own', () => {
    expect(passages[0]?.questions[0]?.stem).toBe('題目 1')
  })

  it('builds ids that include the passage index', () => {
    expect(passages[0]?.id).toBe('reading/02_段落填空題/01_綜合練習一#p1')
    expect(passages[0]?.questions[0]?.id).toBe('reading/02_段落填空題/01_綜合練習一#p1q1')
    expect(passages[1]?.id).toBe('reading/02_段落填空題/01_綜合練習一#p2')
  })

  it('records the reading kind', () => {
    expect(passages[0]?.kind).toBe('paragraph')
  })
})

describe('parseReading with single-sentence notes', () => {
  // Part 5 practice files have no `## 短文` layer at all: the questions hang
  // directly off the file, after the strategy section.
  const MD = `# 01_綜合練習一

## 📝 答題策略 🌟
1.  看選項判斷詞性。

---

### 題目 1
The quarterly sales report must be submitted ______ the end of this week.

(A) at
(B) by
(C) on
(D) since

### 題目 2
Ms. Chen ______ the marketing department for over ten years.

(A) manages
(B) managed
(C) has managed
(D) had managed
`

  const passages = parseReading(MD, 'reading/01_單句填空題/01_綜合練習一', 'single')

  it('still yields the questions instead of dropping them', () => {
    expect(passages).toHaveLength(1)
    expect(passages[0]?.questions.map((q) => q.number)).toEqual([1, 2])
  })

  it('leaves the passage body empty', () => {
    expect(passages[0]?.passage).toBe('')
  })

  it('uses the sentence itself as the stem', () => {
    expect(passages[0]?.questions[0]?.stem).toBe(
      'The quarterly sales report must be submitted ______ the end of this week.',
    )
  })

  it('does not leak the strategy text into a question', () => {
    expect(passages[0]?.questions.some((q) => q.stem.includes('看選項判斷詞性'))).toBe(false)
  })
})

describe('parseReading with article notes', () => {
  const MD = `# 01_綜合練習一

## 📝 答題策略 🌟
1.  先看題目再看文章。

## 文章：電子郵件

Dear team, the annual review will take place next month.

### 題目 1（主旨題）
What is the purpose of the email?

(A) To announce a review
(B) To cancel a meeting
(C) To hire staff
(D) To request payment
`

  const passages = parseReading(MD, 'reading/03_篇章閱讀題/01_綜合練習一', 'article')

  it('keeps the article body', () => {
    expect(passages[0]?.passage).toContain('annual review will take place')
  })

  it('uses the question sentence as the stem', () => {
    expect(passages[0]?.questions[0]?.stem).toBe('What is the purpose of the email?')
  })

  it('records the article kind', () => {
    expect(passages[0]?.kind).toBe('article')
  })
})

describe('parseReading edge cases', () => {
  it('returns an empty array when there are no questions', () => {
    expect(parseReading('# T\n\n## 📝 答題策略\n只有策略。', 'reading/01_x/01_y', 'single')).toEqual([])
  })

  it('drops a passage that carries no questions', () => {
    const md = `## 短文一：沒有題目
Only prose here.

## 短文二：有題目
Text.

### 題目 1
(A) a
(B) b
`
    const passages = parseReading(md, 'reading/02_x/01_y', 'paragraph')
    expect(passages.map((p) => p.title)).toEqual(['短文二：有題目'])
  })
})
