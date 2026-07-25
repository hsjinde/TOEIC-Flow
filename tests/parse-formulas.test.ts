import { describe, it, expect } from 'vitest'
import { parseFormulas } from '../scripts/build-content/parse-formulas'

const MD = `## 📚 補充秒殺公式
1.  **可數 vs. 不可數名詞陷阱**：\`information\`, \`advice\` 都是不可數名詞，看到 informations 直接刪掉。
2.  **複合名詞判斷**：兩個名詞相連時，前面的名詞常轉為形容詞用法。
3.  沒有粗體標題的公式也要收進來。

## 🔤 相關單字和片語
*   **information** 名詞 資訊 | Example.
`

describe('parseFormulas', () => {
  it('parses each numbered entry', () => {
    expect(parseFormulas(MD, 'grammar/01_x/01_y')).toHaveLength(3)
  })

  it('extracts the bold title and body separately', () => {
    const first = parseFormulas(MD, 'grammar/01_x/01_y')[0]
    expect(first?.id).toBe('grammar/01_x/01_y#f1')
    expect(first?.chapterId).toBe('grammar/01_x/01_y')
    expect(first?.number).toBe(1)
    expect(first?.title).toBe('可數 vs. 不可數名詞陷阱')
    expect(first?.body).toContain('不可數名詞')
  })

  it('falls back to an empty title when there is no bold prefix', () => {
    const third = parseFormulas(MD, 'grammar/01_x/01_y')[2]
    expect(third?.title).toBe('')
    expect(third?.body).toBe('沒有粗體標題的公式也要收進來。')
  })

  it('does not leak the vocabulary section', () => {
    expect(parseFormulas(MD, 'grammar/01_x/01_y').some((f) => f.body.includes('名詞 資訊'))).toBe(false)
  })

  it('joins continuation lines into the same entry', () => {
    const md = `## 📚 補充秒殺公式
1.  **多行公式**：第一行說明。
    第二行補充說明。
2.  **第二條**：內容。
`
    const formulas = parseFormulas(md, 'grammar/01_x/01_y')
    expect(formulas).toHaveLength(2)
    expect(formulas[0]?.body).toContain('第一行說明')
    expect(formulas[0]?.body).toContain('第二行補充說明')
  })

  it('returns an empty array when the section is missing', () => {
    expect(parseFormulas('## 核心概念\n內容', 'grammar/01_x/01_y')).toEqual([])
  })
})
