import { describe, it, expect } from 'vitest'
import { mergeQuestions, mergeGroupedQuestions } from '../scripts/build-content/merge'
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

describe('mergeGroupedQuestions', () => {
  // A reading file numbers its questions 1..N across every passage and ships a
  // single explanation file for all of them. Merging one passage at a time
  // would report every other passage's explanations as orphaned.
  const passageA = { title: '短文一', questions: [question(1, 1), question(2, 1)] }
  const passageB = { title: '短文二', questions: [question(3, 1), question(4, 1)] }
  const answers = [answer(1, ['A']), answer(2, ['B']), answer(3, ['C']), answer(4, ['D'])]

  it('raises no orphan warnings when answers span several groups', () => {
    const result = mergeGroupedQuestions([passageA, passageB], answers, 'file')
    expect(result.issues).toEqual([])
  })

  it('returns each question to the group it came from', () => {
    const result = mergeGroupedQuestions([passageA, passageB], answers, 'file')
    expect(result.groups[0]?.questions.map((q) => q.number)).toEqual([1, 2])
    expect(result.groups[1]?.questions.map((q) => q.number)).toEqual([3, 4])
  })

  it('preserves the other group fields', () => {
    const result = mergeGroupedQuestions([passageA, passageB], answers, 'file')
    expect(result.groups.map((g) => g.title)).toEqual(['短文一', '短文二'])
  })

  it('attaches the right answer to each question', () => {
    const result = mergeGroupedQuestions([passageA, passageB], answers, 'file')
    expect(result.groups.flatMap((g) => g.questions.map((q) => q.blanks[0]?.answer))).toEqual([
      'A',
      'B',
      'C',
      'D',
    ])
  })

  it('still reports a genuinely orphaned explanation once', () => {
    const result = mergeGroupedQuestions([passageA, passageB], [...answers, answer(99, ['A'])], 'file')
    expect(result.issues).toHaveLength(1)
    expect(result.issues[0]).toMatchObject({ level: 'warn' })
    expect(result.issues[0]?.message).toContain('題目 99')
  })

  it('drops a question that failed validation from its group', () => {
    const result = mergeGroupedQuestions([passageA, passageB], [answer(1, ['A'])], 'file')
    expect(result.groups[0]?.questions.map((q) => q.number)).toEqual([1])
    expect(result.groups[1]?.questions).toEqual([])
    expect(result.issues.filter((i) => i.level === 'error')).toHaveLength(3)
  })
})
