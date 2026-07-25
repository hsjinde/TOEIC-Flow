import { describe, it, expect } from 'vitest'
import { parseChapter } from '../scripts/build-content/parse-chapter'

const MD = `# 01_名詞與代名詞

## 核心概念
名詞與代名詞是句子的核心骨幹。

## 1. 必背名詞字尾 (字尾判斷法) 🌟
*   **-tion / -sion**：information, decision

### 子標題也要保留
補充說明。

## 📝 多益秒殺解題技巧
1.  詞性題：介系詞後面常接名詞。

## 📚 補充秒殺公式
1.  **可數陷阱**：information 不可數。

## 🔤 相關單字和片語
*   **information** 名詞 資訊 | Example.

## 💪 練習題（5 題）
**1.** Question text.
(A) a (B) b (C) c (D) d
`

describe('parseChapter', () => {
  const chapter = parseChapter(MD, 'grammar/01_八大詞性與句型結構/01_名詞與代名詞', '01_八大詞性與句型結構', 1)

  it('takes the title from the level-1 heading', () => {
    expect(chapter.title).toBe('01_名詞與代名詞')
  })

  it('keeps teaching sections', () => {
    expect(chapter.teaching).toContain('核心概念')
    expect(chapter.teaching).toContain('必背名詞字尾')
  })

  it('keeps level-3 sub-headings inside the teaching content', () => {
    expect(chapter.teaching).toContain('### 子標題也要保留')
    expect(chapter.teaching).toContain('補充說明')
  })

  it('excludes practice, vocab and supplementary formula sections', () => {
    expect(chapter.teaching).not.toContain('練習題')
    expect(chapter.teaching).not.toContain('相關單字和片語')
    expect(chapter.teaching).not.toContain('補充秒殺公式')
  })

  it('does not leak question or vocabulary content into teaching', () => {
    expect(chapter.teaching).not.toContain('Question text')
    expect(chapter.teaching).not.toContain('(A) a')
  })

  it('extracts quick tips into their own field', () => {
    expect(chapter.quickTips).toContain('介系詞後面常接名詞')
    expect(chapter.teaching).not.toContain('多益秒殺解題技巧')
  })

  it('records id, category and order', () => {
    expect(chapter.id).toBe('grammar/01_八大詞性與句型結構/01_名詞與代名詞')
    expect(chapter.categoryId).toBe('01_八大詞性與句型結構')
    expect(chapter.order).toBe(1)
  })

  it('re-emits headings so the teaching content stays valid markdown', () => {
    expect(chapter.teaching).toMatch(/^## 核心概念/m)
  })

  it('sets quickTips to null when the section is absent', () => {
    const plain = parseChapter('# T\n\n## 核心概念\n內容', 'grammar/x/y', 'x', 2)
    expect(plain.quickTips).toBeNull()
    expect(plain.teaching).toContain('核心概念')
  })

  it('matches the 秒殺技巧 heading variant', () => {
    const md = `# T

## 核心概念
內容。

## 📝 多益必考重點 (秒殺技巧)
1.  變體標題也要抓到。
`
    const parsed = parseChapter(md, 'grammar/x/y', 'x', 3)
    expect(parsed.quickTips).toContain('變體標題也要抓到')
    expect(parsed.teaching).not.toContain('秒殺技巧')
  })
})
