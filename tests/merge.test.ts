import { describe, it, expect } from 'vitest'
import { mergeQuestions } from '../scripts/build-content/merge'
import type { ParsedQuestion } from '../scripts/build-content/parse-questions'
import type { AnswerEntry } from '../scripts/build-content/parse-answers'

const question = (number: number, blankCount: number): ParsedQuestion => ({
  id: `grammar/x/y#q${number}`,
  source: 'note',
  chapterId: 'grammar/x/y',
  categoryId: 'x',
  number,
  stem: `stem ${number}`,
  blanks: Array.from({ length: blankCount }, (_, i) => ({
    label: blankCount > 1 ? `第${'一二'[i]}空` : null,
    options: [
      { key: 'A' as const, text: 'a' },
      { key: 'B' as const, text: 'b' },
      { key: 'C' as const, text: 'c' },
      { key: 'D' as const, text: 'd' },
    ],
  })),
})

const answer = (number: number, answers: ('A' | 'B' | 'C' | 'D')[]): AnswerEntry => ({
  number,
  title: 't',
  answers,
  explanation: { title: 't', analysis: 'why', grammarPoint: null, similarNote: null },
})

describe('mergeQuestions', () => {
  it('attaches the answer key to each blank', () => {
    const result = mergeQuestions([question(1, 1)], [answer(1, ['C'])], 'chapter')
    expect(result.issues).toEqual([])
    expect(result.questions[0]?.blanks[0]?.answer).toBe('C')
    expect(result.questions[0]?.explanation?.analysis).toBe('why')
  })

  it('maps multi-blank answers in order', () => {
    const result = mergeQuestions([question(5, 2)], [answer(5, ['C', 'B'])], 'chapter')
    expect(result.questions[0]?.blanks.map((b) => b.answer)).toEqual(['C', 'B'])
  })

  it('errors when a question has no explanation', () => {
    const result = mergeQuestions([question(1, 1)], [], 'chapter')
    expect(result.questions).toEqual([])
    expect(result.issues).toContainEqual({
      level: 'error',
      questionId: 'grammar/x/y#q1',
      message: 'chapter：題目 1 找不到對應詳解',
    })
  })

  it('errors when the answer count does not match the blank count', () => {
    const result = mergeQuestions([question(5, 2)], [answer(5, ['C'])], 'chapter')
    expect(result.questions).toEqual([])
    expect(result.issues[0]?.level).toBe('error')
    expect(result.issues[0]?.message).toContain('答案數 1 與空格數 2 不符')
  })

  it('errors when an answer letter is not among the options', () => {
    const q = question(1, 1)
    q.blanks[0]!.options = [
      { key: 'A', text: 'a' },
      { key: 'B', text: 'b' },
    ]
    const result = mergeQuestions([q], [answer(1, ['D'])], 'chapter')
    expect(result.questions).toEqual([])
    expect(result.issues[0]?.message).toContain('答案 D 不在選項中')
  })

  it('warns about an explanation with no matching question', () => {
    const result = mergeQuestions([question(1, 1)], [answer(1, ['A']), answer(9, ['B'])], 'chapter')
    expect(result.questions).toHaveLength(1)
    expect(result.issues).toContainEqual({
      level: 'warn',
      questionId: 'grammar/x/y#q9',
      message: 'chapter：詳解 題目 9 沒有對應的題目',
    })
  })

  it('warns about an empty analysis but still keeps the question', () => {
    const a = answer(1, ['A'])
    a.explanation.analysis = ''
    const result = mergeQuestions([question(1, 1)], [a], 'chapter')
    expect(result.questions).toHaveLength(1)
    expect(result.issues[0]?.level).toBe('warn')
  })

  it('preserves input order in the output', () => {
    const result = mergeQuestions(
      [question(3, 1), question(1, 1), question(2, 1)],
      [answer(1, ['A']), answer(2, ['B']), answer(3, ['C'])],
      'chapter',
    )
    expect(result.questions.map((q) => q.number)).toEqual([3, 1, 2])
  })
})
