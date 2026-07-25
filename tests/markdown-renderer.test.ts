import { describe, it, expect } from 'vitest'
import { parseMarkdownToBlocks } from '../src/components/MarkdownRenderer'

describe('parseMarkdownToBlocks', () => {
  it('parses headings, bold text and list items', () => {
    const md = `## 核心概念\n名詞與代名詞是句子的核心。\n\n### 1. 必背名詞字尾\n*   **-tion / -sion**：information, decision\n*   \`information\` 不可數。`
    const blocks = parseMarkdownToBlocks(md)

    expect(blocks.length).toBeGreaterThan(0)
    expect(blocks[0]?.type).toBe('h2')
    expect(blocks[0]?.content).toBe('核心概念')
  })
})
