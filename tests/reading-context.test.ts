// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest'
import { PLACEHOLDER_STEM, contextSentence } from '../src/components/ReadingPassageView'
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
})
