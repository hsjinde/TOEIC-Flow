import type { Explanation, OptionKey } from './types'
import { splitSections } from './markdown'

export interface AnswerEntry {
  number: number
  title: string
  answers: OptionKey[]
  explanation: Explanation
}

const HEADING_RE = /^題目\s*(\d+)\s*[：:]?\s*(.*)$/
const FIELD_RE = /\*\*(答案|詳細解析|相關文法點|相似題型提醒)\*\*\s*[：:]?/g

/**
 * Answers appear in five shapes across the notes:
 *   C | (1) B　(2) A | (1) A, (2) B | 第一空 C　第二空 B | newline-separated
 * Strategy: prefer explicitly indexed/labelled answers; fall back to the first
 * standalone letter so prose like "（注意 A 選項是陷阱）" never leaks in.
 */
export function extractAnswerKeys(text: string): OptionKey[] {
  const indexed = [...text.matchAll(/\((\d)\)\s*\(?([A-D])\)?/g)]
  if (indexed.length > 0) return indexed.map((m) => m[2] as OptionKey)

  const labelled = [...text.matchAll(/第[一二三四]空\s*[：:]?\s*\(?([A-D])\)?/g)]
  if (labelled.length > 0) return labelled.map((m) => m[1] as OptionKey)

  const first = /(?:^|[\s：:])\(?([A-D])\)?(?=$|[\s。，,（(])/m.exec(text.trim())
  return first ? [first[1] as OptionKey] : []
}

function fieldValues(body: string): Record<string, string> {
  const values: Record<string, string> = {}
  const matches = [...body.matchAll(FIELD_RE)]
  for (let i = 0; i < matches.length; i += 1) {
    const match = matches[i]
    if (!match) continue
    const name = match[1] ?? ''
    const start = match.index + match[0].length
    const next = matches[i + 1]
    const end = next ? next.index : body.length
    values[name] = body
      .slice(start, end)
      .replace(/^\s*[\r\n]+/, '')
      .replace(/\n?-{3,}\s*$/, '')
      .trim()
  }
  return values
}

export function parseAnswers(md: string): AnswerEntry[] {
  const entries: AnswerEntry[] = []
  for (const section of splitSections(md)) {
    const heading = HEADING_RE.exec(section.heading.trim())
    if (!heading) continue

    const values = fieldValues(section.body)
    const title = (heading[2] ?? '').trim()
    entries.push({
      number: Number(heading[1]),
      title,
      answers: extractAnswerKeys(values['答案'] ?? ''),
      explanation: {
        title,
        analysis: values['詳細解析'] ?? '',
        grammarPoint: values['相關文法點'] ?? null,
        similarNote: values['相似題型提醒'] ?? null,
      },
    })
  }
  return entries
}
