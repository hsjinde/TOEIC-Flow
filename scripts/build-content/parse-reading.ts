import type { Option, OptionKey, ReadingPassage } from './types'
import type { ParsedQuestion } from './parse-questions'
import { splitSections } from './markdown'

export type ParsedReadingPassage = Omit<ReadingPassage, 'questions'> & { questions: ParsedQuestion[] }

const QUESTION_HEADING_RE = /^題目\s*(\d+)/
const SKIP_HEADING_RE = /(答題策略|解題技巧)/
const OPTION_RE = /^\(([A-D])\)\s*(.+)$/
const RULE_RE = /^-{3,}$/

/** Reading notes put each option on its own line, unlike grammar chapters. */
function parseQuestionBody(body: string): { stem: string; options: Option[] } {
  const stemLines: string[] = []
  const options: Option[] = []

  for (const rawLine of body.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || RULE_RE.test(line)) continue

    const match = OPTION_RE.exec(line)
    if (match) {
      options.push({ key: match[1] as OptionKey, text: (match[2] ?? '').trim() })
      continue
    }
    // Prose only counts as a stem before the options start; anything after them
    // is a stray note rather than part of the question.
    if (options.length === 0) stemLines.push(line)
  }

  return { stem: stemLines.join(' ').replace(/\s+/g, ' ').trim(), options }
}

function questionsFrom(body: string, passageId: string, chapterId: string, categoryId: string): ParsedQuestion[] {
  const questions: ParsedQuestion[] = []

  for (const section of splitSections(body, 3)) {
    const heading = QUESTION_HEADING_RE.exec(section.heading.trim())
    if (!heading) continue

    const number = Number(heading[1])
    const { stem, options } = parseQuestionBody(section.body)
    if (options.length < 2) continue

    questions.push({
      id: `${passageId}q${number}`,
      source: 'note',
      chapterId,
      categoryId,
      number,
      // Paragraph-cloze questions carry no text of their own: the blank lives in
      // the passage, so the heading is the only label available.
      stem: stem || section.heading.trim(),
      blanks: [{ label: null, options }],
    })
  }

  return questions
}

/** Text above the first `### 題目` heading is the passage itself. */
function passageBodyOf(body: string): string {
  const index = body.search(/^###\s+/m)
  const prose = index === -1 ? body : body.slice(0, index)
  return prose.replace(/^-{3,}$/gm, '').trim()
}

export function parseReading(
  md: string,
  chapterId: string,
  kind: 'single' | 'paragraph' | 'article',
): ParsedReadingPassage[] {
  const passageSections = splitSections(md, 2).filter((s) => !SKIP_HEADING_RE.test(s.heading))

  // Part 5 files have no passage layer — the questions hang directly off the
  // file, below the strategy section — so they are gathered into one synthetic
  // passage with no prose rather than being dropped.
  if (passageSections.length === 0) {
    const passageId = `${chapterId}#p1`
    const questions = questionsFrom(md, passageId, chapterId, kind)
    if (questions.length === 0) return []
    return [{ id: passageId, kind, title: '', passage: '', questions }]
  }

  const passages: ParsedReadingPassage[] = []
  passageSections.forEach((section, index) => {
    const passageId = `${chapterId}#p${index + 1}`
    const questions = questionsFrom(section.body, passageId, chapterId, kind)
    if (questions.length === 0) return
    passages.push({
      id: passageId,
      kind,
      title: section.heading.trim(),
      passage: passageBodyOf(section.body),
      questions,
    })
  })

  return passages
}
