// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest'
import { FALLBACK_STEM, PLACEHOLDER_STEM, contextSentence, resolveStem } from '../src/lib/stem'
import { getQuestionStem } from '../src/lib/content'
import mockData from '../content/mock-exams.json'
import type { MockExam } from '../scripts/build-content/types'
import readingData from '../content/reading.json'
import type { ReadingPassage } from '../scripts/build-content/types'

const reading = readingData as unknown as ReadingPassage[]

describe('paragraph reading data', () => {
  it('uses placeholder stems for passage-based questions', () => {
    // 這是 ReadingPassageView 改抓文章上下文的前提。
    const paragraphs = reading.filter((p) => p.kind !== 'single')
    expect(paragraphs.length).toBeGreaterThan(0)
    expect(
      paragraphs.flatMap((p) => p.questions.filter((q) => PLACEHOLDER_STEM.test(q.stem))).length
    ).toBeGreaterThan(0)
  })

  it('gives single-sentence questions a real stem instead of a placeholder', () => {
    for (const p of reading.filter((x) => x.kind === 'single')) {
      for (const q of p.questions) expect(PLACEHOLDER_STEM.test(q.stem)).toBe(false)
    }
  })
})

describe('contextSentence', () => {
  const passage =
    'Notice to All Staff\n\nStarting next Monday, the office will ______(1) to a new floor plan. The IT team has begun relocating equipment. We appreciate your patience ______(3) this transition period.'

  it('pulls out the sentence that contains the blank', () => {
    expect(contextSentence(passage, 1)).toBe(
      'Starting next Monday, the office will ___ to a new floor plan.'
    )
  })

  it('works for a blank in the final sentence', () => {
    expect(contextSentence(passage, 3)).toBe(
      'We appreciate your patience ___ this transition period.'
    )
  })

  it('returns null when the passage has no such blank', () => {
    expect(contextSentence(passage, 9)).toBeNull()
  })

  it('finds a context sentence for every placeholder question in the bundle', () => {
    for (const p of reading.filter((x) => x.kind !== 'single')) {
      for (const q of p.questions) {
        if (!PLACEHOLDER_STEM.test(q.stem)) continue
        const sentence = contextSentence(p.passage, q.number)
        expect(sentence, `${p.id} #${q.number}`).toBeTruthy()
        expect(sentence).toContain('___')
      }
    }
  })

  it('tolerates the space the mock exam bank puts before the blank number', () => {
    // 閱讀題庫寫 `______(1)`，模擬考題庫寫 `______ (16)`。只認其中一種就會有一半的題
    // 目在畫面上永遠是「題目 16」。
    const spaced = 'We will meet on Monday. Staff members currently ______ (16) upstairs move.'
    expect(contextSentence(spaced, 16)).toBe('Staff members currently ___ upstairs move.')
  })
})

describe('resolveStem', () => {
  it('leaves a real stem untouched', () => {
    expect(resolveStem('What is the purpose of this notice?', 3, 'irrelevant')).toBe(
      'What is the purpose of this notice?'
    )
  })

  it('falls back to a usable instruction when the blank is missing from the passage', () => {
    expect(resolveStem('題目 18', 18, 'A passage with no numbered blank.')).toBe(FALLBACK_STEM)
  })

  it('keeps the placeholder when there is no passage at all to read from', () => {
    expect(resolveStem('題目 18', 18, undefined)).toBe('題目 18')
  })
})

describe('getQuestionStem over the real bundle', () => {
  const mocks = mockData as unknown as MockExam[]

  it('never shows a bare 「題目 N」 for a mock question that has a passage', () => {
    for (const exam of mocks) {
      for (const section of exam.sections) {
        if (!section.passage) continue
        for (const q of section.questions) {
          expect(PLACEHOLDER_STEM.test(getQuestionStem(q)), `${q.id}`).toBe(false)
        }
      }
    }
  })

  it('never shows a bare 「題目 N」 for a passage-based reading question', () => {
    for (const p of reading) {
      if (!p.passage) continue
      for (const q of p.questions) {
        expect(PLACEHOLDER_STEM.test(getQuestionStem(q)), `${q.id}`).toBe(false)
      }
    }
  })
})
