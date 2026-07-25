import { describe, it, expect } from 'vitest'
import { chapterIdFromPath, questionId, vocabId, formulaId } from '../scripts/build-content/id'

describe('chapterIdFromPath', () => {
  it('converts a windows relative path to a stable id', () => {
    expect(chapterIdFromPath('文法\\01_八大詞性與句型結構\\01_名詞與代名詞.md')).toBe(
      'grammar/01_八大詞性與句型結構/01_名詞與代名詞',
    )
  })

  it('converts a posix relative path identically', () => {
    expect(chapterIdFromPath('文法/01_八大詞性與句型結構/01_名詞與代名詞.md')).toBe(
      'grammar/01_八大詞性與句型結構/01_名詞與代名詞',
    )
  })

  it('maps reading and mock roots to english prefixes', () => {
    expect(chapterIdFromPath('閱讀理解/02_段落填空題/01_綜合練習一.md')).toBe(
      'reading/02_段落填空題/01_綜合練習一',
    )
    expect(chapterIdFromPath('模擬考試/模擬測驗一.md')).toBe('mock/模擬測驗一')
  })

  it('throws on an unknown note root', () => {
    expect(() => chapterIdFromPath('未知資料夾/檔案.md')).toThrow(/unknown note root/)
  })
})

describe('questionId', () => {
  it('is stable and readable', () => {
    expect(questionId('grammar/01_八大詞性與句型結構/01_名詞與代名詞', 3)).toBe(
      'grammar/01_八大詞性與句型結構/01_名詞與代名詞#q3',
    )
  })
})

describe('vocabId', () => {
  it('slugifies the word', () => {
    expect(vocabId('grammar/01_x/01_y', 'each other')).toBe('grammar/01_x/01_y#v-each-other')
  })

  it('lowercases for stability', () => {
    expect(vocabId('grammar/01_x/01_y', 'Information')).toBe('grammar/01_x/01_y#v-information')
  })
})

describe('formulaId', () => {
  it('uses an f prefix', () => {
    expect(formulaId('grammar/01_x/01_y', 2)).toBe('grammar/01_x/01_y#f2')
  })
})
