import { describe, it, expect } from 'vitest'
import { formatReport, hasBlockingIssues, type BuildStats } from '../scripts/build-content/report'

const stats: BuildStats = {
  chapters: 29,
  grammar: 145,
  vocab: 352,
  vocabExampleZh: 352,
  formulas: 145,
  readingPassages: 8,
  readingQuestions: 46,
  mockExams: 2,
  mockQuestions: 62,
}

describe('formatReport', () => {
  it('lists every count', () => {
    const output = formatReport(stats, [])
    expect(output).toContain('章節：29')
    expect(output).toContain('文法題：145')
    expect(output).toContain('單字：352（352 筆有例句中文）')
    expect(output).toContain('秒殺公式：145')
    expect(output).toContain('閱讀篇章：8')
    expect(output).toContain('模擬考：2')
  })

  it('says so when there are no issues', () => {
    expect(formatReport(stats, [])).toContain('沒有發現問題')
  })

  it('lists errors before warnings', () => {
    const output = formatReport(stats, [
      { level: 'warn', questionId: 'a#q1', message: 'warn message' },
      { level: 'error', questionId: 'b#q2', message: 'error message' },
    ])
    expect(output.indexOf('error message')).toBeLessThan(output.indexOf('warn message'))
  })

  it('reports the counts of each severity', () => {
    const output = formatReport(stats, [
      { level: 'error', questionId: 'a', message: 'e1' },
      { level: 'error', questionId: 'b', message: 'e2' },
      { level: 'warn', questionId: 'c', message: 'w1' },
    ])
    expect(output).toContain('錯誤（2）')
    expect(output).toContain('警告（1）')
  })
})

describe('hasBlockingIssues', () => {
  it('is true when any error exists', () => {
    expect(hasBlockingIssues([{ level: 'error', questionId: 'x', message: 'm' }])).toBe(true)
  })

  it('is false when only warnings exist', () => {
    expect(hasBlockingIssues([{ level: 'warn', questionId: 'x', message: 'm' }])).toBe(false)
  })

  it('is false when there are no issues', () => {
    expect(hasBlockingIssues([])).toBe(false)
  })
})
