import type { Formula } from './types'
import { formulaId } from './id'
import { splitSections, findSection } from './markdown'

/** `1.  **Title**：body` — the numbered-list marker starts a new entry. */
const ENTRY_RE = /^(\d+)\.\s+(.*)$/
const TITLE_RE = /^\*\*(.+?)\*\*[：:]\s*([\s\S]*)$/

export function parseFormulas(md: string, chapterId: string): Formula[] {
  const section = findSection(splitSections(md), '補充秒殺公式')
  if (!section) return []

  const formulas: Formula[] = []
  let current: { number: number; lines: string[] } | null = null

  const flush = () => {
    if (!current) return
    const raw = current.lines.join('\n').trim()
    const titleMatch = TITLE_RE.exec(raw)
    const title = titleMatch ? (titleMatch[1] ?? '').trim() : ''
    const body = titleMatch ? (titleMatch[2] ?? '').trim() : raw
    if (body) {
      formulas.push({ id: formulaId(chapterId, current.number), chapterId, number: current.number, title, body })
    }
    current = null
  }

  for (const rawLine of section.body.split(/\r?\n/)) {
    const line = rawLine.trim()
    const match = ENTRY_RE.exec(line)
    if (match) {
      flush()
      current = { number: Number(match[1]), lines: [match[2] ?? ''] }
      continue
    }
    if (current && line) current.lines.push(line)
  }
  flush()
  return formulas
}
