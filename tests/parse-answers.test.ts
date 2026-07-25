import { describe, it, expect } from 'vitest'
import { parseAnswers, extractAnswerKeys } from '../scripts/build-content/parse-answers'

describe('extractAnswerKeys', () => {
  it('reads a bare single answer', () => {
    expect(extractAnswerKeys('C')).toEqual(['C'])
  })

  it('reads numbered answers separated by an ideographic space', () => {
    expect(extractAnswerKeys('(1) B　(2) A')).toEqual(['B', 'A'])
  })

  it('reads numbered answers separated by a comma', () => {
    expect(extractAnswerKeys('(1) A, (2) B')).toEqual(['A', 'B'])
  })

  it('reads chinese blank labels', () => {
    expect(extractAnswerKeys('第一空 C　第二空 B')).toEqual(['C', 'B'])
  })

  it('reads answers spread over multiple lines', () => {
    expect(extractAnswerKeys('\n(1) B\n(2) A\n')).toEqual(['B', 'A'])
  })

  it('ignores stray letters inside prose', () => {
    expect(extractAnswerKeys('B（注意 A 選項是陷阱）')).toEqual(['B'])
  })

  it('returns an empty array when nothing parses', () => {
    expect(extractAnswerKeys('（待補）')).toEqual([])
  })
})

const MD = `# 01_名詞與代名詞 - 詳細解答

## 題目 1：詞性題 - 名詞字尾判斷
**答案**: C

**詳細解析**:
空格在所有格 \`your\` 之後，需要填入名詞。

**相關文法點**:
對應「1. 必背名詞字尾」。

**相似題型提醒**:
information 不可數，不可加 -s。

---

## 題目 5：段落填空（Part 6 風格）
**答案**:
(1) C
(2) B

**詳細解析**:
第一空需要名詞；第二空同理。
`

describe('parseAnswers', () => {
  const entries = parseAnswers(MD)

  it('parses one entry per question heading', () => {
    expect(entries.map((e) => e.number)).toEqual([1, 5])
  })

  it('keeps the question type as the explanation title', () => {
    expect(entries[0]?.title).toBe('詞性題 - 名詞字尾判斷')
  })

  it('parses a single answer', () => {
    expect(entries[0]?.answers).toEqual(['C'])
  })

  it('parses multi-line answers', () => {
    expect(entries[1]?.answers).toEqual(['C', 'B'])
  })

  it('captures the analysis body', () => {
    expect(entries[0]?.explanation.analysis).toContain('空格在所有格')
  })

  it('does not let the analysis swallow the following field', () => {
    expect(entries[0]?.explanation.analysis).not.toContain('必背名詞字尾')
  })

  it('captures optional grammar point and similar-question note', () => {
    expect(entries[0]?.explanation.grammarPoint).toContain('必背名詞字尾')
    expect(entries[0]?.explanation.similarNote).toContain('不可數')
  })

  it('strips the trailing horizontal rule from the last field', () => {
    expect(entries[0]?.explanation.similarNote).not.toContain('---')
  })

  it('sets optional fields to null when absent', () => {
    expect(entries[1]?.explanation.grammarPoint).toBeNull()
    expect(entries[1]?.explanation.similarNote).toBeNull()
  })
})
