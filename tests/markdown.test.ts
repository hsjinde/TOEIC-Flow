import { describe, it, expect } from 'vitest'
import { splitSections, findSection } from '../scripts/build-content/markdown'

const SAMPLE = `# 01_名詞與代名詞

## 核心概念
名詞是句子骨幹。

## 📚 補充秒殺公式
1.  **可數陷阱**：information 不可數。

## 🔤 相關單字和片語
### 名詞字尾相關
*   **information** 名詞 資訊 | Example one.

### 代名詞與片語
*   **each other** 片語 彼此 | Example two.

## 💪 練習題（5 題）

**1.** Please make sure your ___ is accurate.
(A) inform (B) informative (C) information (D) informational
`

describe('splitSections at the default level 2', () => {
  it('splits on level-2 headings only', () => {
    expect(splitSections(SAMPLE).map((s) => s.heading)).toEqual([
      '核心概念',
      '📚 補充秒殺公式',
      '🔤 相關單字和片語',
      '💪 練習題（5 題）',
    ])
  })

  it('keeps level-3 sub-headings inside the level-2 body', () => {
    // Regression guard: splitting on ### would truncate the vocabulary section
    // at the first sub-heading and silently drop every entry beneath it.
    const vocab = findSection(splitSections(SAMPLE), '相關單字和片語')
    expect(vocab?.body).toContain('### 名詞字尾相關')
    expect(vocab?.body).toContain('**information**')
    expect(vocab?.body).toContain('### 代名詞與片語')
    expect(vocab?.body).toContain('**each other**')
  })

  it('excludes the heading line from the body', () => {
    expect(splitSections(SAMPLE)[0]?.body.trim()).toBe('名詞是句子骨幹。')
  })

  it('ignores the level-1 title', () => {
    expect(splitSections(SAMPLE).some((s) => s.heading.includes('01_名詞'))).toBe(false)
  })

  it('reports the requested level on every section', () => {
    expect(splitSections(SAMPLE).every((s) => s.level === 2)).toBe(true)
  })
})

describe('splitSections at level 3', () => {
  const PASSAGE_BODY = `Notice to All Staff

The office will move next Monday.

### 題目 1
(A) move
(B) moving

### 題目 2（細節題）
(A) The cafeteria stays open.
(B) Desks must be packed.
`

  it('splits on level-3 headings', () => {
    expect(splitSections(PASSAGE_BODY, 3).map((s) => s.heading)).toEqual([
      '題目 1',
      '題目 2（細節題）',
    ])
  })

  it('does not treat level-2 headings as boundaries', () => {
    expect(splitSections('## 短文一\n內容\n### 題目 1\n(A) x', 3).map((s) => s.heading)).toEqual([
      '題目 1',
    ])
  })

  it('returns an empty array when no heading of that level exists', () => {
    expect(splitSections('沒有任何標題的內容', 3)).toEqual([])
  })
})

describe('findSection', () => {
  it('matches by substring so emoji variants still resolve', () => {
    expect(findSection(splitSections(SAMPLE), '練習題')?.heading).toBe('💪 練習題（5 題）')
  })

  it('returns null when absent', () => {
    expect(findSection(splitSections(SAMPLE), '不存在的區塊')).toBeNull()
  })
})
