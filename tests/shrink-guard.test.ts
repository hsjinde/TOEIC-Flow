import { describe, it, expect } from 'vitest'
import {
  collectIds,
  collectBaselineIds,
  checkContentShrink,
  formatShrinkFailure,
  formatShrinkOverride,
  formatShrinkPassed,
  hasNoBaselineAtAll,
  isShrinkOverridden,
  withMissingAsEmpty,
  type ContentIds,
} from '../scripts/build-content/shrink-guard'

/** n 筆連號 id，方便寫出「745 → 145」這種比例。 */
function ids(prefix: string, n: number, from = 1): string[] {
  return Array.from({ length: n }, (_, i) => `${prefix}${from + i}`)
}

function contentIds(overrides: Partial<ContentIds> = {}): ContentIds {
  return {
    chapters: ids('c', 10),
    grammar: ids('g', 100),
    vocab: ids('v', 100),
    formulas: ids('f', 100),
    readingPassages: ids('p', 10),
    readingQuestions: ids('rq', 100),
    mockExams: ids('m', 10),
    mockQuestions: ids('mq', 100),
    ...overrides,
  }
}

describe('collectIds', () => {
  it('reads ids out of nested reading passages and mock sections', () => {
    const collected = collectIds({
      chapters: [{ id: 'ch1' }],
      grammar: [{ id: 'g1' }, { id: 'g2' }],
      vocab: [{ id: 'v1' }],
      formulas: [{ id: 'f1' }],
      reading: [{ id: 'p1', questions: [{ id: 'p1#q1' }, { id: 'p1#q2' }] }],
      mockExams: [
        { id: 'm1', sections: [{ questions: [{ id: 'm1#q1' }] }, { questions: [{ id: 'm1#q2' }] }] },
      ],
    })

    expect(collected.grammar).toEqual(['g1', 'g2'])
    expect(collected.readingPassages).toEqual(['p1'])
    expect(collected.readingQuestions).toEqual(['p1#q1', 'p1#q2'])
    expect(collected.mockExams).toEqual(['m1'])
    expect(collected.mockQuestions).toEqual(['m1#q1', 'm1#q2'])
  })
})

describe('collectBaselineIds', () => {
  it('leaves categories undefined when their file was not readable', () => {
    const baseline = collectBaselineIds({ grammar: [{ id: 'g1' }] })

    expect(baseline.grammar).toEqual(['g1'])
    expect(baseline.vocab).toBeUndefined()
    expect(baseline.readingPassages).toBeUndefined()
    expect(baseline.readingQuestions).toBeUndefined()
    expect(baseline.mockQuestions).toBeUndefined()
  })
})

describe('withMissingAsEmpty', () => {
  it('turns an unreadable file into 0 筆 on the current side, which is a 100% drop', () => {
    const current = withMissingAsEmpty(collectBaselineIds({ grammar: [{ id: 'g1' }] }))
    expect(current.vocab).toEqual([])

    const check = checkContentShrink(contentIds(), current)
    expect(check.shrunk.map((s) => s.category)).toContain('vocab')
  })
})

describe('checkContentShrink', () => {
  it('flags nothing and marks every category unchecked when there is no baseline', () => {
    const check = checkContentShrink(null, contentIds())
    expect(check.shrunk).toEqual([])
    expect(check.noBaseline).toContain('grammar')
    expect(check.noBaseline).toHaveLength(8)
  })

  it('skips a category whose baseline is absent, still checking the others', () => {
    const baseline = contentIds()
    const check = checkContentShrink(
      { ...baseline, grammar: undefined },
      contentIds({ grammar: ids('g', 1), vocab: ids('v', 50) }),
    )

    expect(check.noBaseline).toEqual(['grammar'])
    expect(check.shrunk.map((s) => s.category)).toEqual(['vocab'])
  })

  it('never divides by a zero baseline', () => {
    const check = checkContentShrink(
      { ...contentIds(), mockExams: [] },
      contentIds({ mockExams: [] }),
    )
    expect(check.shrunk).toEqual([])
    expect(check.noBaseline).toEqual(['mockExams'])
  })

  it('lets an exactly-10% drop through', () => {
    const check = checkContentShrink(contentIds(), contentIds({ grammar: ids('g', 90) }))
    expect(check.shrunk).toEqual([])
  })

  it('blocks a drop of more than 10%', () => {
    const check = checkContentShrink(contentIds(), contentIds({ grammar: ids('g', 89) }))
    expect(check.shrunk.map((s) => s.category)).toEqual(['grammar'])
  })

  it('reports how much was lost and which ids disappeared', () => {
    const check = checkContentShrink(contentIds(), contentIds({ grammar: ids('g', 20) }))
    const [shrink] = check.shrunk

    expect(shrink?.baseline).toBe(100)
    expect(shrink?.current).toBe(20)
    expect(shrink?.dropped).toBe(80)
    expect(shrink?.percent).toBeCloseTo(80, 5)
    expect(shrink?.missingIds.slice(0, 3)).toEqual(['g21', 'g22', 'g23'])
    expect(shrink?.missingIds).toHaveLength(80)
  })

  it('counts ids that vanished even when the total grew', () => {
    // 換掉一半的題目：總數不變，所以不算縮水。
    const check = checkContentShrink(contentIds(), contentIds({ grammar: ids('g', 100, 101) }))
    expect(check.shrunk).toEqual([])
  })

  it('ignores growth', () => {
    const check = checkContentShrink(contentIds(), contentIds({ grammar: ids('g', 745) }))
    expect(check.shrunk).toEqual([])
  })

  it('lists every category that shrank', () => {
    const check = checkContentShrink(
      contentIds(),
      contentIds({ grammar: ids('g', 1), vocab: ids('v', 1), chapters: ids('c', 1) }),
    )
    expect(check.shrunk.map((s) => s.category).sort()).toEqual(['chapters', 'grammar', 'vocab'])
  })
})

describe('formatShrinkFailure', () => {
  const check = checkContentShrink(
    contentIds(),
    contentIds({ grammar: ids('g', 20), vocab: ids('v', 50) }),
  )

  it('names what shrank, by how much, in 繁體中文', () => {
    const output = formatShrinkFailure(check)
    expect(output).toContain('內容縮水')
    expect(output).toContain('文法題：100 → 20（少了 80，-80.0%）')
    expect(output).toContain('單字：100 → 50（少了 50，-50.0%）')
  })

  it('shows the first few ids that disappeared', () => {
    const output = formatShrinkFailure(check)
    expect(output).toContain('g21')
    expect(output).toContain('消失的 id')
    // 只印前幾個，其餘用數量帶過，否則 600 個 id 會洗掉整個畫面。
    expect(output).not.toContain('g99')
    expect(output).toContain('等 80 個')
  })

  it('tells the user how to override it', () => {
    expect(formatShrinkFailure(check)).toContain('ALLOW_CONTENT_SHRINK=1')
    expect(formatShrinkFailure(check)).toContain('--allow-shrink')
  })

  it('mentions categories that had no baseline to compare against', () => {
    const noBase = checkContentShrink({ ...contentIds(), grammar: undefined }, contentIds())
    expect(formatShrinkFailure(noBase)).toContain('沒有基準')
    expect(formatShrinkFailure(noBase)).toContain('文法題')
  })
})

describe('formatShrinkPassed', () => {
  it('says what it compared against', () => {
    const check = checkContentShrink(contentIds(), contentIds())
    expect(formatShrinkPassed(check, 'HEAD')).toContain('HEAD')
    expect(formatShrinkPassed(check, 'HEAD')).toContain('內容縮水檢查通過')
  })

  it('still mentions categories with no baseline', () => {
    const check = checkContentShrink({ ...contentIds(), vocab: undefined }, contentIds())
    expect(formatShrinkPassed(check, 'HEAD')).toContain('沒有基準')
    expect(formatShrinkPassed(check, 'HEAD')).toContain('單字')
  })
})

describe('hasNoBaselineAtAll', () => {
  it('is true when not one category resolved a baseline', () => {
    expect(hasNoBaselineAtAll(checkContentShrink(null, contentIds()))).toBe(true)
  })

  it('is false when at least one category could be compared', () => {
    const check = checkContentShrink({ grammar: ids('g', 100) }, contentIds())
    expect(hasNoBaselineAtAll(check)).toBe(false)
  })
})

describe('isShrinkOverridden', () => {
  it('accepts the flag', () => {
    expect(isShrinkOverridden(['--allow-shrink'], {})).toBe(true)
  })

  it('accepts the env var', () => {
    expect(isShrinkOverridden([], { ALLOW_CONTENT_SHRINK: '1' })).toBe(true)
  })

  it('treats an empty or 0 env var as not set', () => {
    expect(isShrinkOverridden([], { ALLOW_CONTENT_SHRINK: '' })).toBe(false)
    expect(isShrinkOverridden([], { ALLOW_CONTENT_SHRINK: '0' })).toBe(false)
  })

  it('is off by default', () => {
    expect(isShrinkOverridden([], {})).toBe(false)
  })
})

describe('formatShrinkOverride', () => {
  const check = checkContentShrink(contentIds(), contentIds({ grammar: ids('g', 20) }))

  it('shouts the numbers it is letting through, not just that it was skipped', () => {
    const output = formatShrinkOverride(check)
    expect(output).toContain('已略過內容縮水檢查')
    expect(output).toContain('文法題：100 → 20（少了 80，-80.0%）')
  })
})
