import { describe, it, expect } from 'vitest'
import {
  normalizeStem,
  stemTokens,
  jaccard,
  normalizeAnswer,
  groupKeyOf,
  checkDuplicates,
  hasDuplicateFindings,
  formatDuplicateReport,
  type QuestionRef,
} from '../scripts/build-content/duplicate-guard'

function q(over: Partial<QuestionRef> & Pick<QuestionRef, 'id'>): QuestionRef {
  return {
    chapterId: 'grammar/01_八大詞性與句型結構/01_名詞與代名詞',
    categoryId: '01_八大詞性與句型結構',
    stem: 'Please submit the ___ before Friday.',
    answerTexts: ['report'],
    ...over,
  }
}

describe('normalizeStem', () => {
  it('lowercases, masks the blank and collapses punctuation', () => {
    expect(normalizeStem('Please make SURE your ___ is accurate, OK?')).toBe(
      'please make sure your is accurate ok',
    )
  })

  it('treats every blank spelling as the same mask', () => {
    const a = normalizeStem('The ___ was approved.')
    const b = normalizeStem('The _____ was approved.')
    const c = normalizeStem('The ______ was approved.')
    expect(a).toBe(b)
    expect(b).toBe(c)
  })

  it('drops the 第N空 markers so multi-blank stems compare on prose alone', () => {
    expect(normalizeStem('The ___ （第一空） and the ___ （第二空） differ.')).toBe(
      'the and the differ',
    )
  })
})

describe('jaccard', () => {
  it('is 1 for identical token sets and 0 for disjoint ones', () => {
    expect(jaccard(stemTokens('the report is ready'), stemTokens('the report is ready'))).toBe(1)
    expect(jaccard(stemTokens('alpha beta'), stemTokens('gamma delta'))).toBe(0)
  })

  it('scores a shared sentence frame high even when the target word differs', () => {
    const a = stemTokens('Please make sure your ___ is accurate before submitting the form.')
    const b = stemTokens('Please make sure your ___ is complete before submitting the form.')
    expect(jaccard(a, b)).toBeGreaterThan(0.8)
  })

  it('is 0 when either side has no tokens, never NaN', () => {
    expect(jaccard(stemTokens(''), stemTokens('anything'))).toBe(0)
    expect(jaccard(stemTokens(''), stemTokens(''))).toBe(0)
  })
})

describe('normalizeAnswer', () => {
  it('lowercases and collapses whitespace', () => {
    expect(normalizeAnswer('  On His  OWN ')).toBe('on his own')
  })
})

describe('groupKeyOf', () => {
  it('uses the category for chapters with no declared overlap', () => {
    expect(
      groupKeyOf('grammar/02_動詞時態與語態/01_基本時態與進行式', '02_動詞時態與語態'),
    ).toBe('02_動詞時態與語態')
  })

  it('puts cross-category overlapping chapters in one group', () => {
    const a = groupKeyOf('grammar/01_八大詞性與句型結構/05_介系詞', '01_八大詞性與句型結構')
    const b = groupKeyOf(
      'grammar/06_其他多益必考進階題型/05_易混淆介系詞片語',
      '06_其他多益必考進階題型',
    )
    expect(a).toBe(b)
  })
})

describe('checkDuplicates — 題幹相似度', () => {
  it('reports a pair whose stems differ only in the target word', () => {
    const report = checkDuplicates([
      q({ id: 'a#q1', stem: 'Please make sure your ___ is accurate before submitting the form.' }),
      q({
        id: 'b#q1',
        chapterId: 'grammar/01_八大詞性與句型結構/13_不可數名詞陷阱進階',
        stem: 'Please make sure your ___ is accurate before submitting the form.',
        answerTexts: ['information'],
      }),
    ])
    expect(report.stemFindings).toHaveLength(1)
    expect(report.stemFindings[0]?.score).toBe(1)
    expect(report.stemFindings[0]?.ids).toEqual(['a#q1', 'b#q1'])
  })

  it('compares across chapters, not only within one', () => {
    const report = checkDuplicates([
      q({ id: 'a#q1', chapterId: 'grammar/x/01', categoryId: 'x' }),
      q({ id: 'b#q1', chapterId: 'grammar/y/02', categoryId: 'y' }),
    ])
    expect(report.stemFindings).toHaveLength(1)
  })

  it('leaves genuinely different stems alone', () => {
    const report = checkDuplicates([
      q({ id: 'a#q1', stem: 'The board approved the ___ budget last Tuesday.' }),
      q({
        id: 'b#q1',
        stem: 'Visitors must present a valid ___ at the reception desk.',
        answerTexts: ['badge'],
      }),
    ])
    expect(report.stemFindings).toEqual([])
  })

  it('skips stems with no comparable prose (blank lives in the passage)', () => {
    const report = checkDuplicates([
      q({ id: 'a#p1q1', stem: '題目 1', answerTexts: ['however'] }),
      q({
        id: 'b#p1q1',
        chapterId: 'reading/02_段落填空題/02_綜合練習二',
        categoryId: '02_段落填空題',
        stem: '題目 1',
        answerTexts: ['therefore'],
      }),
    ])
    expect(report.stemFindings).toEqual([])
  })

  it('honours a custom threshold', () => {
    const questions = [
      q({ id: 'a#q1', stem: 'The manager reviewed the ___ carefully.' }),
      q({ id: 'b#q1', stem: 'The manager reviewed the ___ quickly.', answerTexts: ['proposal'] }),
    ]
    expect(checkDuplicates(questions, { stemThreshold: 0.99 }).stemFindings).toEqual([])
    expect(checkDuplicates(questions, { stemThreshold: 0.5 }).stemFindings).toHaveLength(1)
  })
})

describe('checkDuplicates — 正解目標詞碰撞', () => {
  it('reports the same target word tested twice in one chapter', () => {
    const report = checkDuplicates([
      q({ id: 'a#q1', stem: 'The ___ was helpful.', answerTexts: ['information'] }),
      q({ id: 'a#q2', stem: 'Employees need reliable ___ every day.', answerTexts: ['information'] }),
    ])
    expect(report.answerFindings).toHaveLength(1)
    expect(report.answerFindings[0]?.answer).toBe('information')
    expect(report.answerFindings[0]?.scope).toBe('chapter')
    expect(report.answerFindings[0]?.ids).toEqual(['a#q1', 'a#q2'])
  })

  it('reports a collision between overlapping chapters as group scope', () => {
    const report = checkDuplicates([
      q({
        id: 'a#q1',
        chapterId: 'grammar/01_八大詞性與句型結構/05_介系詞',
        categoryId: '01_八大詞性與句型結構',
        stem: 'The meeting was postponed ___ the storm.',
        answerTexts: ['because of'],
      }),
      q({
        id: 'b#q1',
        chapterId: 'grammar/06_其他多益必考進階題型/05_易混淆介系詞片語',
        categoryId: '06_其他多益必考進階題型',
        stem: 'Sales dropped sharply ___ the supply shortage last quarter.',
        answerTexts: ['because of'],
      }),
    ])
    expect(report.answerFindings).toHaveLength(1)
    expect(report.answerFindings[0]?.scope).toBe('group')
  })

  it('does not report the same word across unrelated categories', () => {
    const report = checkDuplicates([
      q({
        id: 'a#q1',
        chapterId: 'grammar/01_八大詞性與句型結構/01_名詞與代名詞',
        categoryId: '01_八大詞性與句型結構',
        stem: 'The ___ was helpful to everyone involved.',
        answerTexts: ['information'],
      }),
      q({
        id: 'b#q1',
        chapterId: 'grammar/04_特殊動詞用法/01_使役動詞',
        categoryId: '04_特殊動詞用法',
        stem: 'Nothing in the briefing made the ___ any clearer.',
        answerTexts: ['information'],
      }),
    ])
    expect(report.answerFindings).toEqual([])
  })

  it('ignores answers that are bare function words', () => {
    const report = checkDuplicates([
      q({ id: 'a#q1', stem: 'She travelled ___ train to the conference.', answerTexts: ['by'] }),
      q({ id: 'a#q2', stem: 'The parcel arrived ___ noon on Monday.', answerTexts: ['by'] }),
    ])
    expect(report.answerFindings).toEqual([])
  })
})

describe('report helpers', () => {
  it('hasDuplicateFindings is false for a clean bank', () => {
    const report = checkDuplicates([q({ id: 'a#q1' })])
    expect(hasDuplicateFindings(report)).toBe(false)
    expect(formatDuplicateReport(report)).toContain('沒有重複')
  })

  it('keeps the headline green when only the answer axis has findings', () => {
    const report = checkDuplicates([
      q({ id: 'a#q1', stem: 'The board approved the ___ without further discussion.', answerTexts: ['proposal'] }),
      q({ id: 'a#q2', stem: 'Two suppliers withdrew their ___ before the deadline.', answerTexts: ['proposal'] }),
    ])
    expect(report.stemFindings).toEqual([])
    expect(report.answerFindings).toHaveLength(1)
    const text = formatDuplicateReport(report)
    expect(text).toContain('✓ 題幹查重通過')
    expect(text).toContain('（提示）正解目標詞重複')
    expect(text).not.toContain('✗')
  })

  it('formats both axes with ids so the offending questions can be found', () => {
    const report = checkDuplicates([
      q({ id: 'a#q1', stem: 'The ___ was approved by the board.', answerTexts: ['proposal'] }),
      q({ id: 'a#q2', stem: 'The ___ was approved by the board.', answerTexts: ['proposal'] }),
    ])
    expect(hasDuplicateFindings(report)).toBe(true)
    const text = formatDuplicateReport(report)
    expect(text).toContain('a#q1')
    expect(text).toContain('a#q2')
    expect(text).toContain('題幹')
    expect(text).toContain('proposal')
  })
})
