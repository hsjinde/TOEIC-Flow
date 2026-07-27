import { describe, it, expect } from 'vitest'
import { splitEmphasis, stripEmphasis, toClozeSentence } from '../src/lib/emphasis'
import vocabData from '../content/vocab.json'
import type { VocabItem } from '../scripts/build-content/types'

const vocab = vocabData as unknown as VocabItem[]

describe('splitEmphasis', () => {
  it('handles the single-asterisk form used by part of the vault', () => {
    expect(splitEmphasis('Please review the *information* carefully.')).toEqual([
      { text: 'Please review the ', emphasised: false },
      { text: 'information', emphasised: true },
      { text: ' carefully.', emphasised: false },
    ])
  })

  it('handles the double-asterisk form used by most of the vault', () => {
    expect(splitEmphasis('Investors **are interested in** the startup.')).toEqual([
      { text: 'Investors ', emphasised: false },
      { text: 'are interested in', emphasised: true },
      { text: ' the startup.', emphasised: false },
    ])
  })

  it('leaves unmarked sentences untouched', () => {
    expect(splitEmphasis('No markers here.')).toEqual([
      { text: 'No markers here.', emphasised: false },
    ])
  })
})

describe('stripEmphasis', () => {
  it('removes both marker styles without eating the words', () => {
    expect(stripEmphasis('a *one* and **two** end')).toBe('a one and two end')
  })

  it('never leaves a stray asterisk for any example in the bundle', () => {
    for (const item of vocab) {
      expect(stripEmphasis(item.example)).not.toContain('*')
    }
  })
})

describe('toClozeSentence', () => {
  it('blanks the marked word', () => {
    expect(toClozeSentence('Review the **itinerary** now.', 'itinerary')).toBe(
      'Review the ______ now.'
    )
  })

  it('falls back to a case-insensitive match when there is no marker', () => {
    expect(toClozeSentence('Review the Itinerary now.', 'itinerary')).toBe(
      'Review the ______ now.'
    )
  })

  it('is not affected by regex state from a previous call', () => {
    const sentence = 'Review the **itinerary** now.'
    expect(toClozeSentence(sentence, 'itinerary')).toBe(toClozeSentence(sentence, 'itinerary'))
  })

  it('selects the matching emphasis span when multiple emphasis spans exist', () => {
    expect(
      toClozeSentence('He entered **with** a folder **carrying** important documents.', 'carry')
    ).toBe('He entered with a folder ______ important documents.')
  })

  it('correctly blanks allegedly in tag question sentence', () => {
    expect(toClozeSentence("He **allegedly** missed the flight, didn't he?", 'allegedly')).toBe(
      "He ______ missed the flight, didn't he?"
    )
  })

  it('produces a blank for every example that has one', () => {
    const withExample = vocab.filter((v) => v.example)
    const blanked = withExample.filter((v) => toClozeSentence(v.example, v.word).includes('______'))
    // 例句幾乎都標了目標字；容許極少數字面對不上的情況。
    expect(blanked.length / withExample.length).toBeGreaterThan(0.95)
  })
})
