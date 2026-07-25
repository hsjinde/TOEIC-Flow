import type { Question } from './types'
import type { ParsedQuestion } from './parse-questions'
import type { AnswerEntry } from './parse-answers'

export interface Issue {
  level: 'error' | 'warn'
  questionId: string
  message: string
}

export interface MergeResult {
  questions: Question[]
  issues: Issue[]
}

/**
 * Pair parsed questions with their explanation entries by question number.
 * A question that fails any error-level check is dropped from the output so
 * broken data can never reach the app; the build then fails on issue count.
 */
export function mergeQuestions(
  questions: ParsedQuestion[],
  answers: AnswerEntry[],
  sourceLabel: string,
): MergeResult {
  const byNumber = new Map(answers.map((a) => [a.number, a]))
  const usedNumbers = new Set<number>()
  const merged: Question[] = []
  const issues: Issue[] = []

  for (const question of questions) {
    const entry = byNumber.get(question.number)
    if (!entry) {
      issues.push({
        level: 'error',
        questionId: question.id,
        message: `${sourceLabel}：題目 ${question.number} 找不到對應詳解`,
      })
      continue
    }
    usedNumbers.add(question.number)

    if (entry.answers.length !== question.blanks.length) {
      issues.push({
        level: 'error',
        questionId: question.id,
        message: `${sourceLabel}：題目 ${question.number} 答案數 ${entry.answers.length} 與空格數 ${question.blanks.length} 不符`,
      })
      continue
    }

    const blanks = question.blanks.map((blank, index) => ({
      ...blank,
      answer: entry.answers[index]!,
    }))

    const invalid = blanks.find((blank) => !blank.options.some((o) => o.key === blank.answer))
    if (invalid) {
      issues.push({
        level: 'error',
        questionId: question.id,
        message: `${sourceLabel}：題目 ${question.number} 答案 ${invalid.answer} 不在選項中`,
      })
      continue
    }

    if (!entry.explanation.analysis) {
      issues.push({
        level: 'warn',
        questionId: question.id,
        message: `${sourceLabel}：題目 ${question.number} 的詳解沒有解析內容`,
      })
    }

    merged.push({ ...question, blanks, explanation: entry.explanation })
  }

  for (const entry of answers) {
    if (usedNumbers.has(entry.number)) continue
    issues.push({
      level: 'warn',
      questionId: `${questions[0]?.chapterId ?? sourceLabel}#q${entry.number}`,
      message: `${sourceLabel}：詳解 題目 ${entry.number} 沒有對應的題目`,
    })
  }

  return { questions: merged, issues }
}

export interface QuestionGroup {
  questions: ParsedQuestion[]
}

export interface MergeGroupedResult<T extends QuestionGroup> {
  groups: (Omit<T, 'questions'> & { questions: Question[] })[]
  issues: Issue[]
}

/**
 * Merge several groups of questions against one shared explanation set, then
 * hand each question back to the group it came from.
 *
 * Reading files and mock exams number their questions 1..N across every
 * passage and ship a single explanation file for the lot. Merging one group at
 * a time would make every other group's explanations look orphaned and emit a
 * warning per passage, so the pairing has to see the whole file at once.
 */
export function mergeGroupedQuestions<T extends QuestionGroup>(
  groups: T[],
  answers: AnswerEntry[],
  sourceLabel: string,
): MergeGroupedResult<T> {
  const merged = mergeQuestions(
    groups.flatMap((group) => group.questions),
    answers,
    sourceLabel,
  )
  const byId = new Map(merged.questions.map((q) => [q.id, q]))

  return {
    groups: groups.map((group) => ({
      ...group,
      // Questions dropped by validation simply do not come back.
      questions: group.questions
        .map((q) => byId.get(q.id))
        .filter((q): q is Question => q !== undefined),
    })),
    issues: merged.issues,
  }
}
