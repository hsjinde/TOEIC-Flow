import { describe, it, expect } from 'vitest'
import {
  getCategories,
  getCategoryLabel,
  getCategoryMeta,
  getCategoryShortLabel,
  getChapterById,
  getChapterLabel,
  getChapterNumber,
  getChapters,
  getFormulasByChapter,
  getGrammarQuestionsByCategory,
  getGrammarQuestionsByChapter,
  getQuestionById,
  getQuestionsByIds,
  getFormulaCards,
  getRandomFormulaCards,
  getVocabByChapter,
  stripOrderPrefix,
} from '../src/lib/content'
import grammarData from '../content/grammar.json'
import readingData from '../content/reading.json'
import mockData from '../content/mock-exams.json'
import type { Question, ReadingPassage, MockExam } from '../scripts/build-content/types'

const grammar = grammarData as unknown as Question[]
const reading = readingData as unknown as ReadingPassage[]
const mocks = mockData as unknown as MockExam[]

describe('question index', () => {
  it('finds grammar, reading and mock questions by id', () => {
    const grammarId = grammar[0]!.id
    const readingId = reading[0]!.questions[0]!.id
    const mockId = mocks[0]!.sections[0]!.questions[0]!.id

    expect(getQuestionById(grammarId)?.id).toBe(grammarId)
    expect(getQuestionById(readingId)?.id).toBe(readingId)
    expect(getQuestionById(mockId)?.id).toBe(mockId)
  })

  it('returns null rather than throwing for an orphaned id', () => {
    expect(getQuestionById('grammar/gone/gone#q1')).toBeNull()
  })

  it('skips orphaned ids when resolving a batch', () => {
    const known = grammar[0]!.id
    expect(getQuestionsByIds([known, 'nope#q9']).map((q) => q.id)).toEqual([known])
  })
})

describe('categories', () => {
  it('exposes the six grammar categories only', () => {
    const categories = getCategories()
    expect(categories).toHaveLength(6)
    for (const cat of categories) {
      expect(cat.id).toMatch(/^\d\d_/)
      expect(cat.chapters.length).toBeGreaterThan(0)
      expect(cat.questionCount).toBeGreaterThan(0)
    }
  })

  it('keeps chapters ordered inside a category', () => {
    for (const cat of getCategories()) {
      const orders = cat.chapters.map((c) => c.order)
      expect([...orders].sort((a, b) => a - b)).toEqual(orders)
    }
  })

  it('strips the numeric prefix for display', () => {
    expect(stripOrderPrefix('01_八大詞性與句型結構')).toBe('八大詞性與句型結構')
    expect(stripOrderPrefix('09_不定詞')).toBe('不定詞')
    expect(stripOrderPrefix('沒有前綴')).toBe('沒有前綴')
  })

  it('gives every category a short radar label that fits on a phone', () => {
    for (const cat of getCategories()) {
      expect(cat.shortTitle.length).toBeLessThanOrEqual(4)
    }
  })

  it('labels non-grammar categories used by reading and mock records', () => {
    expect(getCategoryLabel('single')).toBe('單句填空')
    expect(getCategoryLabel('mock')).toBe('模擬考')
    expect(getCategoryShortLabel('01_八大詞性與句型結構')).toBe('八大詞性')
  })
})

describe('chapter lookups', () => {
  const sample = getCategories()[0]!.chapters[0]!

  it('resolves a chapter by its full id', () => {
    expect(getChapterById(sample.id)?.id).toBe(sample.id)
    expect(getChapterById('grammar/nope')).toBeNull()
  })

  it('formats a chapter label with its global number', () => {
    expect(getChapterLabel(sample.id)).toBe(
      `第 ${getChapterNumber(sample.id)} 章 · ${stripOrderPrefix(sample.title)}`
    )
  })

  it('falls back to the raw title for an id that is not in the bundle', () => {
    expect(getChapterLabel('grammar/gone/07_某章')).toBe('某章')
  })

  it('finds the questions, vocab and formulas that belong to a chapter', () => {
    const questions = getGrammarQuestionsByChapter(sample.id)
    expect(questions.length).toBeGreaterThan(0)
    for (const q of questions) expect(q.chapterId).toBe(sample.id)

    for (const v of getVocabByChapter(sample.id)) expect(v.chapterId).toBe(sample.id)
    for (const f of getFormulasByChapter(sample.id)) expect(f.chapterId).toBe(sample.id)
  })

  it('limits a category draw to the requested count', () => {
    const catId = getCategories()[0]!.id
    const drawn = getGrammarQuestionsByCategory(catId, 5)
    expect(drawn).toHaveLength(5)
    for (const q of drawn) expect(q.categoryId).toBe(catId)
  })
})

describe('wrong-question ids stay resolvable', () => {
  it('every chapter id is the prefix of its questions ids', () => {
    // 錯題本與章節掌握度都靠 `id.split('#')[0] === chapterId` 這個約定。
    for (const q of grammar) {
      expect(q.id.startsWith(`${q.chapterId}#`)).toBe(true)
    }
  })

  it('resolves the chapter of every mock question id that has one', () => {
    for (const m of mocks) {
      for (const s of m.sections) {
        for (const q of s.questions) expect(q.id).toContain('#')
      }
    }
  })
})

describe('random formula card draws', () => {
  it('draws distinct cards, never more than exist', () => {
    const total = getFormulaCards().length
    const drawn = getRandomFormulaCards(total)
    expect(drawn).toHaveLength(total)
    expect(new Set(drawn.map((c) => c.chapterId)).size).toBe(total)
  })

  it('caps the draw at however many cards actually exist', () => {
    const total = getFormulaCards().length
    expect(getRandomFormulaCards(total + 100)).toHaveLength(total)
  })

  // 速查卡模式是照章節順序發的，隨機模式才洗牌——getFormulaCards() 的順序要跟
  // chapters.json 一致，不是 data/formula-cards.json 的 key 順序。
  it('lists cards in chapter order', () => {
    const cards = getFormulaCards()
    const order = getChapters().map((c) => c.id)
    const positions = cards.map((c) => order.indexOf(c.chapterId))
    expect(positions.every((p) => p >= 0)).toBe(true)
    expect([...positions].sort((a, b) => a - b)).toEqual(positions)
  })
})

describe('category meta', () => {
  it('returns null for an unknown category', () => {
    expect(getCategoryMeta('99_不存在')).toBeNull()
  })
})

describe('global chapter numbering', () => {
  it('numbers chapters consecutively across categories', () => {
    // Chapter.order 在每個分類底下都從 1 重新起算，直接顯示會出現兩個「第 1 章」。
    const numbers = getCategories().flatMap((c) => c.chapters.map((ch) => getChapterNumber(ch.id)))
    expect(numbers).toEqual(numbers.map((_, i) => i + 1))
  })

  it('labels the first chapter of the second category with a number past the first category', () => {
    const [first, second] = getCategories()
    const target = second!.chapters[0]!
    expect(getChapterNumber(target.id)).toBe(first!.chapters.length + 1)
    expect(getChapterLabel(target.id)).toBe(
      `第 ${first!.chapters.length + 1} 章 · ${stripOrderPrefix(target.title)}`
    )
  })

  it('returns null for an unknown chapter instead of guessing a number', () => {
    expect(getChapterNumber('grammar/nope/nope')).toBeNull()
  })
})
