import type { VocabItem } from './types'
import { vocabId } from './id'
import { splitSections, findSection } from './markdown'

/** `*   **word** pos meaning | example` — notes use both `*` and `-` bullets. */
const LINE_RE = /^[-*]\s+\*\*(.+?)\*\*\s*(.*)$/

function splitOnFirstSpace(text: string): { pos: string; meaning: string } {
  const spaceIndex = text.search(/\s/)
  if (spaceIndex === -1) return { pos: text, meaning: '' }
  return { pos: text.slice(0, spaceIndex), meaning: text.slice(spaceIndex).trim() }
}

/**
 * Split a descriptor into part of speech and meaning. The notes use three
 * notations, distinguished by what follows the closing bracket:
 *
 *   名詞 資訊（不可數）      → no brackets; pos is the first token
 *   (v. 不及物) 組成         → text after `)`; the brackets hold only the pos
 *   (adv. 很少地)            → nothing after `)`; the brackets hold pos + meaning
 *
 * Outer brackets are dropped so the field holds a bare marker in every case.
 */
function splitPos(descriptor: string): { pos: string; meaning: string } {
  if (descriptor.startsWith('(')) {
    const close = descriptor.indexOf(')')
    if (close !== -1) {
      const inside = descriptor.slice(1, close).trim()
      const after = descriptor.slice(close + 1).trim()
      return after ? { pos: inside, meaning: after } : splitOnFirstSpace(inside)
    }
  }
  return splitOnFirstSpace(descriptor)
}

export function parseVocab(md: string, chapterId: string): VocabItem[] {
  // Level 2 keeps the `### 名詞字尾相關` sub-headings inside this body, so every
  // entry under them is reachable.
  const section = findSection(splitSections(md), '相關單字和片語')
  if (!section) return []

  const items: VocabItem[] = []
  for (const rawLine of section.body.split(/\r?\n/)) {
    const line = rawLine.trim()
    const match = LINE_RE.exec(line)
    if (!match) continue

    const word = (match[1] ?? '').trim()
    const rest = (match[2] ?? '').trim()
    const [beforeExample, ...exampleParts] = rest.split('|')
    const example = exampleParts.join('|').trim()

    const { pos, meaning } = splitPos((beforeExample ?? '').trim())

    if (!word || !meaning) continue
    // exampleZh 不在筆記裡，由 index.ts 從 data/vocab-example-zh.json 併入。
    items.push({ id: vocabId(chapterId, word), chapterId, word, pos, meaning, example, exampleZh: '' })
  }
  return items
}
