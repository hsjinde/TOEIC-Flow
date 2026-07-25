import type { MockExam, MockExamSection } from './types'
import type { ParsedQuestion } from './parse-questions'
import { parseQuestionBody } from './parse-reading'
import { splitSections } from './markdown'
import { questionId } from './id'

export type ParsedMockSection = Omit<MockExamSection, 'questions'> & { questions: ParsedQuestion[] }
export type ParsedMockExam = Omit<MockExam, 'sections'> & { sections: ParsedMockSection[] }

const QUESTION_HEADING_RE = /^題目\s*(\d+)/
const SKIP_HEADING_RE = /(測驗說明|答題策略|解題技巧)/

/**
 * Within a Part, level-3 headings alternate between passages and questions:
 * Part 5 is questions only, Part 6/7 open a passage then list its questions.
 * A question always belongs to the most recent passage heading, or to an
 * implicit passage-less section when none has appeared yet.
 */
function sectionsOfPart(
  part: string,
  body: string,
  chapterId: string,
): ParsedMockSection[] {
  const sections: ParsedMockSection[] = []
  let current: ParsedMockSection | null = null

  const open = (title: string, passage: string) => {
    current = { part, title, passage, questions: [] }
    sections.push(current)
  }

  for (const section of splitSections(body, 3)) {
    const heading = section.heading.trim()
    const questionMatch = QUESTION_HEADING_RE.exec(heading)

    if (!questionMatch) {
      open(heading, section.body.replace(/^-{3,}$/gm, '').trim())
      continue
    }

    const number = Number(questionMatch[1])
    const { stem, options } = parseQuestionBody(section.body)
    if (options.length < 2) continue

    if (!current) open('', '')
    current!.questions.push({
      id: questionId(chapterId, number),
      source: 'note',
      chapterId,
      categoryId: 'mock',
      number,
      // Cloze questions carry no text of their own — the blank is in the passage.
      stem: stem || heading,
      blanks: [{ label: null, options }],
    })
  }

  return sections.filter((s) => s.questions.length > 0)
}

export function parseMockExam(md: string, chapterId: string, title: string): ParsedMockExam {
  const sections: ParsedMockSection[] = []

  for (const part of splitSections(md, 2)) {
    if (SKIP_HEADING_RE.test(part.heading)) continue
    sections.push(...sectionsOfPart(part.heading.trim(), part.body, chapterId))
  }

  return { id: chapterId, title, sections }
}
