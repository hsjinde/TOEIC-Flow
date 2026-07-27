import type { Option, OptionKey, Question, Blank } from './types'
import { questionId } from './id'
import { splitSections, findSection } from './markdown'

export type ParsedBlank = Omit<Blank, 'answer'>
export type ParsedQuestion = Omit<Question, 'explanation' | 'blanks'> & { blanks: ParsedBlank[] }

/**
 * Bold numbering: `**1.**`, `**第 1 題**`, `**題目 1**`, and variants carrying a
 * parenthesised note such as `**第 5 題（短文填空）**`.
 */
const BOLD_QUESTION_RE = /^\*\*(?:第\s*|題目\s*)?(\d+)\s*(?:\.|題)?[^*]*?\*\*\s*(.*)$/
/** Plain numbering with the stem on the same line: `1.  ______ the merger …`. */
const PLAIN_QUESTION_RE = /^(\d+)\.\s+(.*)$/
const OPTION_LINE_RE = /\([A-D]\)/
/** Inline blank label: `第一空：(A) …`. */
const LABEL_RE = /^(第[一二三四]空)[：:]\s*/
/** Standalone blank marker on its own line: `(1)`. */
const BLANK_MARKER_RE = /^\((\d+)\)$/
const FOOTER_RE = /^(📖|詳解請見|\[\[)/

const BLANK_LABELS = ['第一空', '第二空', '第三空', '第四空']

function markerLabel(index: number): string {
  return BLANK_LABELS[index - 1] ?? `第${index}空`
}

/** Extract `(A) x (B) y (C) z (D) w` from one line, tolerating a 第N空： prefix. */
export function extractOptions(line: string): Option[] {
  const withoutLabel = line.replace(LABEL_RE, '').trim()
  if (!OPTION_LINE_RE.test(withoutLabel)) return []

  const options: Option[] = []
  const re = /\(([A-D])\)\s*([\s\S]*?)(?=\s*\([A-D]\)|$)/g
  let match: RegExpExecArray | null
  while ((match = re.exec(withoutLabel)) !== null) {
    const key = match[1] as OptionKey
    const text = (match[2] ?? '').trim()
    if (text) options.push({ key, text })
  }
  return options
}

function labelOf(line: string): string | null {
  const match = LABEL_RE.exec(line.trim())
  return match ? (match[1] ?? null) : null
}

export function parseQuestions(md: string, chapterId: string, categoryId: string): ParsedQuestion[] {
  const section = findSection(splitSections(md), '練習題')
  if (!section) return []

  interface Current {
    number: number
    stemLines: string[]
    blanks: ParsedBlank[]
    /** options collected since the last blank boundary */
    pending: Option[]
    /** label the pending options belong to, null for an unlabelled blank */
    pendingLabel: string | null
  }

  const questions: ParsedQuestion[] = []
  let current: Current | null = null

  /**
   * Close the pending option group into a blank. Options accumulate whether
   * they arrived on one line — `(A) x (B) y (C) z (D) w` — or on four
   * consecutive lines, so a blank ends only at an explicit label boundary or
   * at the end of the question.
   */
  const closePending = (c: Current) => {
    if (c.pending.length > 0) {
      c.blanks.push({ label: c.pendingLabel, options: c.pending })
      c.pending = []
    }
    c.pendingLabel = null
  }

  const flush = () => {
    if (!current) return
    closePending(current)
    const stem = current.stemLines
      .join(' ')
      .replace(/[（(]\s*第[一二三四1-4]空\s*[）)]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
    if (stem && current.blanks.length > 0) {
      questions.push({
        id: questionId(chapterId, current.number),
        source: 'note',
        chapterId,
        categoryId,
        number: current.number,
        stem,
        blanks: current.blanks,
      })
    }
    current = null
  }

  for (const rawLine of section.body.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line) continue

    const questionMatch = BOLD_QUESTION_RE.exec(line) ?? PLAIN_QUESTION_RE.exec(line)
    if (questionMatch) {
      flush()
      current = {
        number: Number(questionMatch[1]),
        stemLines: [questionMatch[2] ?? ''],
        blanks: [],
        pending: [],
        pendingLabel: null,
      }
      continue
    }
    if (!current) continue
    if (FOOTER_RE.test(line)) continue

    // `(1)` on its own line opens the next blank; it carries no options itself.
    const marker = BLANK_MARKER_RE.exec(line)
    if (marker) {
      closePending(current)
      current.pendingLabel = markerLabel(Number(marker[1]))
      continue
    }

    const options = extractOptions(line)
    if (options.length > 0) {
      const label = labelOf(line)
      if (label !== null) {
        closePending(current)
        current.pendingLabel = label
      }
      current.pending.push(...options)
      continue
    }
    current.stemLines.push(line)
  }
  flush()
  return questions
}
