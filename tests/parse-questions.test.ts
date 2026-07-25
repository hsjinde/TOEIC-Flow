import { describe, it, expect } from 'vitest'
import { parseQuestions, extractOptions } from '../scripts/build-content/parse-questions'

const MD = `## 💪 練習題（5 題）

**1.** Please make sure your ___ is accurate before submitting the form.
(A) inform (B) informative (C) information (D) informational

**2.** The board members will introduce ___ before the meeting begins.
(A) they (B) them (C) themselves (D) their

**5.** The company published a survey to measure employee ___ regarding the policy.（第一空）In addition, managers should improve their ___ with staff.（第二空）
第一空：(A) satisfy (B) satisfied (C) satisfaction (D) satisfactorily
第二空：(A) communicate (B) communication (C) communicative (D) communicator

📖 詳解請見：[[詳解/01_八大詞性與句型結構/01_名詞與代名詞]]
`

describe('extractOptions', () => {
  it('splits four inline options', () => {
    expect(extractOptions('(A) inform (B) informative (C) information (D) informational')).toEqual([
      { key: 'A', text: 'inform' },
      { key: 'B', text: 'informative' },
      { key: 'C', text: 'information' },
      { key: 'D', text: 'informational' },
    ])
  })

  it('keeps multi-word option text intact', () => {
    const options = extractOptions('(A) another (B) other (C) others (D) the other')
    expect(options[3]).toEqual({ key: 'D', text: 'the other' })
  })

  it('strips a 第一空： prefix', () => {
    const options = extractOptions('第一空：(A) satisfy (B) satisfied (C) satisfaction (D) satisfactorily')
    expect(options).toHaveLength(4)
    expect(options[0]?.text).toBe('satisfy')
  })

  it('returns an empty array for a non-option line', () => {
    expect(extractOptions('**1.** Please make sure your ___ is accurate.')).toEqual([])
  })
})

describe('parseQuestions', () => {
  const questions = parseQuestions(MD, 'grammar/01_八大詞性與句型結構/01_名詞與代名詞', '01_八大詞性與句型結構')

  it('parses every numbered question', () => {
    expect(questions.map((q) => q.number)).toEqual([1, 2, 5])
  })

  it('builds stable ids from the chapter and question number', () => {
    expect(questions[0]?.id).toBe('grammar/01_八大詞性與句型結構/01_名詞與代名詞#q1')
  })

  it('keeps the stem free of option text', () => {
    expect(questions[0]?.stem).toBe('Please make sure your ___ is accurate before submitting the form.')
  })

  it('gives single-blank questions exactly one blank with a null label', () => {
    expect(questions[0]?.blanks).toHaveLength(1)
    expect(questions[0]?.blanks[0]?.label).toBeNull()
  })

  it('gives multi-blank questions one blank per labelled option line', () => {
    const q5 = questions.find((q) => q.number === 5)
    expect(q5?.blanks).toHaveLength(2)
    expect(q5?.blanks.map((b) => b.label)).toEqual(['第一空', '第二空'])
    expect(q5?.blanks[1]?.options[1]?.text).toBe('communication')
  })

  it('excludes the wikilink footer from the last stem', () => {
    const q5 = questions.find((q) => q.number === 5)
    expect(q5?.stem).not.toContain('詳解請見')
  })

  it('records source, chapter and category on every question', () => {
    expect(questions[0]).toMatchObject({
      source: 'note',
      chapterId: 'grammar/01_八大詞性與句型結構/01_名詞與代名詞',
      categoryId: '01_八大詞性與句型結構',
    })
  })

  it('returns an empty array when the section is missing', () => {
    expect(parseQuestions('## 核心概念\n內容', 'grammar/01_x/01_y', '01_x')).toEqual([])
  })
})

describe('parseQuestions with the 第 N 題 layout', () => {
  const MD_ALT = `## 💪 練習題（5 題）

**第 1 題**
The accounting department _____ all invoices at the end of every month.
(A) review
(B) reviews
(C) is reviewing
(D) will review

**第 2 題**
While the technician _____ the server, the office lost power.
(A) repairs
(B) repaired
(C) was repairing
(D) has repaired
`

  const questions = parseQuestions(MD_ALT, 'grammar/02_動詞時態與語態/01_基本時態與進行式', '02_動詞時態與語態')

  it('parses the 第 N 題 numbering', () => {
    expect(questions.map((q) => q.number)).toEqual([1, 2])
  })

  it('merges one-option-per-line into a single blank', () => {
    expect(questions[0]?.blanks).toHaveLength(1)
    expect(questions[0]?.blanks[0]?.options).toHaveLength(4)
    expect(questions[0]?.blanks[0]?.options.map((o) => o.key)).toEqual(['A', 'B', 'C', 'D'])
  })

  it('takes the stem from the line below the heading', () => {
    expect(questions[0]?.stem).toBe(
      'The accounting department _____ all invoices at the end of every month.',
    )
  })

  it('builds the same id shape as the **1.** layout', () => {
    expect(questions[0]?.id).toBe('grammar/02_動詞時態與語態/01_基本時態與進行式#q1')
  })
})

describe('parseQuestions with the 題目 N layout', () => {
  const MD = `## 💪 練習題（5 題）

**題目 1**
The board decided ___ the merger proposal until further review.
(A) postpone
(B) postponing
(C) to postpone
(D) postponed
`

  it('parses the 題目 N numbering', () => {
    const questions = parseQuestions(MD, 'grammar/03_x/01_不定詞', '03_x')
    expect(questions).toHaveLength(1)
    expect(questions[0]?.number).toBe(1)
    expect(questions[0]?.blanks[0]?.options).toHaveLength(4)
  })
})

describe('parseQuestions with plain numbering and indented options', () => {
  const MD = `## 💪 練習題（5 題）
1.  ______ the merger will proceed as planned remains uncertain among shareholders.
    (A) What
    (B) Whether
    (C) If
    (D) That which

2.  The board recommended that the proposal ______ reviewed by legal counsel.
    (A) is
    (B) was
    (C) be
    (D) being
`

  const questions = parseQuestions(MD, 'grammar/05_x/01_名詞子句', '05_x')

  it('parses plain numbering with the stem on the same line', () => {
    expect(questions.map((q) => q.number)).toEqual([1, 2])
    expect(questions[0]?.stem).toBe(
      '______ the merger will proceed as planned remains uncertain among shareholders.',
    )
  })

  it('collects indented options into one blank', () => {
    expect(questions[0]?.blanks).toHaveLength(1)
    expect(questions[0]?.blanks[0]?.options.map((o) => o.text)).toEqual([
      'What',
      'Whether',
      'If',
      'That which',
    ])
  })
})

describe('parseQuestions with a parenthesised note in the heading', () => {
  const MD = `## 💪 練習題（5 題）

**第 5 題（短文填空）**
The team is currently (1) _____ a new system. Every request now (2) _____ automatically.

(1)
(A) test
(B) tests
(C) testing
(D) to test

(2)
(A) route
(B) routes
(C) is routing
(D) routed
`

  const question = parseQuestions(MD, 'grammar/02_x/01_y', '02_x')[0]

  it('parses the number despite the trailing note', () => {
    expect(question?.number).toBe(5)
  })

  it('still splits the two blanks', () => {
    expect(question?.blanks).toHaveLength(2)
    expect(question?.blanks.map((b) => b.label)).toEqual(['第一空', '第二空'])
  })

  it('keeps the stem intact', () => {
    expect(question?.stem).toContain('The team is currently')
    expect(question?.stem).not.toContain('短文填空')
  })
})

describe('parseQuestions with standalone (N) blank markers', () => {
  const MD = `## 💪 練習題（5 題）

**5.** Deliveries were rescheduled ______ the storm, and the team apologised ______ the delay.
(1)
(A) in accordance with
(B) instead of
(C) regardless of
(D) in addition to

(2)
(A) of
(B) for
(C) with
(D) to
`

  const question = parseQuestions(MD, 'grammar/06_x/05_y', '06_x')[0]

  it('splits into one blank per marker instead of merging them', () => {
    expect(question?.blanks).toHaveLength(2)
  })

  it('normalises the markers to 第N空 labels', () => {
    expect(question?.blanks.map((b) => b.label)).toEqual(['第一空', '第二空'])
  })

  it('keeps each blank to its own four options', () => {
    expect(question?.blanks[0]?.options.map((o) => o.key)).toEqual(['A', 'B', 'C', 'D'])
    expect(question?.blanks[1]?.options.map((o) => o.text)).toEqual(['of', 'for', 'with', 'to'])
  })

  it('does not leak the markers into the stem', () => {
    expect(question?.stem).not.toContain('(1)')
    expect(question?.stem).not.toContain('(2)')
  })
})
