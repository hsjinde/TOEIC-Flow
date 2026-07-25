import { describe, it, expect } from 'vitest'
import { QuestionSchema } from '../scripts/build-content/types'

describe('QuestionSchema', () => {
  it('accepts a single-blank question', () => {
    const q = {
      id: 'grammar/01_八大詞性與句型結構/01_名詞與代名詞#q1',
      source: 'note' as const,
      chapterId: 'grammar/01_八大詞性與句型結構/01_名詞與代名詞',
      categoryId: '01_八大詞性與句型結構',
      number: 1,
      stem: 'Please make sure your ___ is accurate.',
      blanks: [
        {
          label: null,
          options: [
            { key: 'A', text: 'inform' },
            { key: 'B', text: 'informative' },
            { key: 'C', text: 'information' },
            { key: 'D', text: 'informational' },
          ],
          answer: 'C',
        },
      ],
    }
    expect(QuestionSchema.parse(q).blanks).toHaveLength(1)
  })

  it('accepts a multi-blank question', () => {
    const q = {
      id: 'grammar/01_八大詞性與句型結構/01_名詞與代名詞#q5',
      source: 'note' as const,
      chapterId: 'grammar/01_八大詞性與句型結構/01_名詞與代名詞',
      categoryId: '01_八大詞性與句型結構',
      number: 5,
      stem: 'The company published a survey ___ ... improve their ___ with staff.',
      blanks: [
        {
          label: '第一空',
          options: [
            { key: 'A', text: 'satisfy' },
            { key: 'B', text: 'satisfied' },
            { key: 'C', text: 'satisfaction' },
            { key: 'D', text: 'satisfactorily' },
          ],
          answer: 'C',
        },
        {
          label: '第二空',
          options: [
            { key: 'A', text: 'communicate' },
            { key: 'B', text: 'communication' },
            { key: 'C', text: 'communicative' },
            { key: 'D', text: 'communicator' },
          ],
          answer: 'B',
        },
      ],
    }
    expect(QuestionSchema.parse(q).blanks).toHaveLength(2)
  })

  it('rejects a question with no blanks', () => {
    expect(() =>
      QuestionSchema.parse({
        id: 'x#q1',
        source: 'note',
        chapterId: 'x',
        categoryId: 'y',
        number: 1,
        stem: 's',
        blanks: [],
      }),
    ).toThrow()
  })

  it('defaults explanation to null when absent', () => {
    const parsed = QuestionSchema.parse({
      id: 'x#q1',
      source: 'note',
      chapterId: 'x',
      categoryId: 'y',
      number: 1,
      stem: 's',
      blanks: [
        {
          label: null,
          options: [
            { key: 'A', text: 'a' },
            { key: 'B', text: 'b' },
          ],
          answer: 'A',
        },
      ],
    })
    expect(parsed.explanation).toBeNull()
  })
})
