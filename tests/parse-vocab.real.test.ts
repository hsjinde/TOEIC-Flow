import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { parseVocab } from '../scripts/build-content/parse-vocab'

const NOTES_DIR = process.env.NOTES_DIR ?? 'D:\\my-note\\個人學習\\多益'
const GRAMMAR_DIR = join(NOTES_DIR, '文法')

describe('parseVocab against real notes', () => {
  it('extracts 13 items from 01_名詞與代名詞', () => {
    const path = join(NOTES_DIR, '文法', '01_八大詞性與句型結構', '01_名詞與代名詞.md')
    const items = parseVocab(readFileSync(path, 'utf8'), 'grammar/01_八大詞性與句型結構/01_名詞與代名詞')
    expect(items.length).toBe(13)
    expect(items.every((i) => i.word.length > 0 && i.meaning.length > 0)).toBe(true)
  })

  it('extracts 352 items across all 29 chapters, none empty', () => {
    let total = 0
    const counts: { chapter: string; count: number }[] = []

    for (const category of readdirSync(GRAMMAR_DIR, { withFileTypes: true }).filter((d) => d.isDirectory())) {
      const dir = join(GRAMMAR_DIR, category.name)
      for (const file of readdirSync(dir).filter((f) => f.endsWith('.md'))) {
        const chapterId = `grammar/${category.name}/${file.replace(/\.md$/, '')}`
        const items = parseVocab(readFileSync(join(dir, file), 'utf8'), chapterId)
        counts.push({ chapter: chapterId, count: items.length })
        total += items.length
      }
    }

    expect(counts).toHaveLength(29)
    // A chapter with a handful of entries means the parser matched the section
    // but missed a bullet or descriptor variant inside it.
    const thin = counts.filter((c) => c.count < 5)
    expect(thin, `chapters with suspiciously few vocab entries: ${JSON.stringify(thin)}`).toEqual([])
    expect(total).toBe(352)
  })

  it('leaves no entry with an empty pos or a meaning that swallowed the example', () => {
    const bad: string[] = []

    for (const category of readdirSync(GRAMMAR_DIR, { withFileTypes: true }).filter((d) => d.isDirectory())) {
      const dir = join(GRAMMAR_DIR, category.name)
      for (const file of readdirSync(dir).filter((f) => f.endsWith('.md'))) {
        const chapterId = `grammar/${category.name}/${file.replace(/\.md$/, '')}`
        for (const item of parseVocab(readFileSync(join(dir, file), 'utf8'), chapterId)) {
          if (!item.pos) bad.push(`${item.id} 沒有詞性`)
          // An unmatched `)` — one appearing before any `(` — means splitPos cut
          // inside the bracket. A balanced pair is legitimate: meanings such as
          // 「經濟(學)的」 contain brackets of their own.
          const close = item.meaning.indexOf(')')
          const open = item.meaning.indexOf('(')
          if (close !== -1 && (open === -1 || close < open)) {
            bad.push(`${item.id} 意思含孤立右括號：${item.meaning}`)
          }
        }
      }
    }

    expect(bad, `malformed vocabulary entries:\n${bad.join('\n')}`).toEqual([])
  })

  it('produces unique ids within each chapter', () => {
    const dir = join(GRAMMAR_DIR, '01_八大詞性與句型結構')
    for (const file of readdirSync(dir).filter((f) => f.endsWith('.md'))) {
      const chapterId = `grammar/01_八大詞性與句型結構/${file.replace(/\.md$/, '')}`
      const ids = parseVocab(readFileSync(join(dir, file), 'utf8'), chapterId).map((i) => i.id)
      expect(new Set(ids).size, `duplicate vocab ids in ${chapterId}`).toBe(ids.length)
    }
  })
})
