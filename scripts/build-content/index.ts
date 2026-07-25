import { readFileSync, readdirSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { join, relative } from 'node:path'
import { parseQuestions } from './parse-questions'
import { parseVocab } from './parse-vocab'
import { parseFormulas } from './parse-formulas'
import { parseAnswers, type AnswerEntry } from './parse-answers'
import { parseReading } from './parse-reading'
import { parseMockExam } from './parse-mock'
import { parseChapter } from './parse-chapter'
import { mergeQuestions, mergeGroupedQuestions, type Issue } from './merge'
import { chapterIdFromPath } from './id'
import { formatReport, hasBlockingIssues, type BuildStats } from './report'
import type { Question, VocabItem, Formula, ReadingPassage, MockExam, Chapter } from './types'

const NOTES_DIR = process.env.NOTES_DIR ?? 'D:\\my-note\\個人學習\\多益'
const OUT_DIR = join(process.cwd(), 'content')

const READING_KINDS: Record<string, 'single' | 'paragraph' | 'article'> = {
  '01_單句填空題': 'single',
  '02_段落填空題': 'paragraph',
  '03_篇章閱讀題': 'article',
}

function mdFiles(dir: string): string[] {
  return readdirSync(dir)
    .filter((f) => f.endsWith('.md'))
    .sort()
}

function subDirs(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort()
}

/** Read an explanation file, recording an error instead of throwing if absent. */
function readAnswers(path: string, label: string, issues: Issue[]): AnswerEntry[] {
  if (!existsSync(path)) {
    issues.push({ level: 'error', questionId: label, message: `${label}：找不到詳解檔 ${path}` })
    return []
  }
  return parseAnswers(readFileSync(path, 'utf8'))
}

function main(): void {
  const issues: Issue[] = []
  const chapterList: Chapter[] = []
  const grammar: Question[] = []
  const vocab: VocabItem[] = []
  const formulas: Formula[] = []
  const reading: ReadingPassage[] = []
  const mockExams: MockExam[] = []

  // --- grammar chapters ---
  const grammarDir = join(NOTES_DIR, '文法')
  for (const category of subDirs(grammarDir)) {
    for (const file of mdFiles(join(grammarDir, category))) {
      const notePath = join(grammarDir, category, file)
      const chapterId = chapterIdFromPath(relative(NOTES_DIR, notePath))
      const md = readFileSync(notePath, 'utf8')

      const order = Number(/^(\d+)/.exec(file)?.[1] ?? 0)
      chapterList.push(parseChapter(md, chapterId, category, order))
      vocab.push(...parseVocab(md, chapterId))
      formulas.push(...parseFormulas(md, chapterId))

      const answers = readAnswers(join(NOTES_DIR, '詳解', category, file), chapterId, issues)
      const merged = mergeQuestions(parseQuestions(md, chapterId, category), answers, chapterId)
      grammar.push(...merged.questions)
      issues.push(...merged.issues)
    }
  }

  // --- reading ---
  const readingDir = join(NOTES_DIR, '閱讀理解')
  for (const kindDir of subDirs(readingDir)) {
    const kind = READING_KINDS[kindDir]
    if (!kind) {
      issues.push({ level: 'warn', questionId: kindDir, message: `未知的閱讀分類資料夾：${kindDir}` })
      continue
    }
    for (const file of mdFiles(join(readingDir, kindDir))) {
      const notePath = join(readingDir, kindDir, file)
      const chapterId = chapterIdFromPath(relative(NOTES_DIR, notePath))
      const passages = parseReading(readFileSync(notePath, 'utf8'), chapterId, kind)
      const answers = readAnswers(join(NOTES_DIR, '詳解', '閱讀理解', kindDir, file), chapterId, issues)

      // One merge for the whole file: its questions are numbered 1..N across
      // every passage and share a single explanation file.
      const merged = mergeGroupedQuestions(passages, answers, chapterId)
      issues.push(...merged.issues)
      reading.push(...merged.groups.filter((p) => p.questions.length > 0))
    }
  }

  // --- mock exams ---
  const mockDir = join(NOTES_DIR, '模擬考試')
  for (const file of mdFiles(mockDir)) {
    const notePath = join(mockDir, file)
    const chapterId = chapterIdFromPath(relative(NOTES_DIR, notePath))
    const title = file.replace(/\.md$/, '')
    const exam = parseMockExam(readFileSync(notePath, 'utf8'), chapterId, title)
    const answers = readAnswers(join(NOTES_DIR, '詳解', '模擬考試', file), chapterId, issues)

    // Same rule as reading: numbering runs across parts, so merge the whole paper.
    const merged = mergeGroupedQuestions(exam.sections, answers, chapterId)
    issues.push(...merged.issues)
    mockExams.push({
      id: exam.id,
      title: exam.title,
      sections: merged.groups.filter((s) => s.questions.length > 0),
    })
  }

  const stats: BuildStats = {
    chapters: chapterList.length,
    grammar: grammar.length,
    vocab: vocab.length,
    formulas: formulas.length,
    readingPassages: reading.length,
    readingQuestions: reading.reduce((n, p) => n + p.questions.length, 0),
    mockExams: mockExams.length,
    mockQuestions: mockExams.reduce(
      (n, e) => n + e.sections.reduce((m, s) => m + s.questions.length, 0),
      0,
    ),
  }

  console.log(formatReport(stats, issues))

  if (hasBlockingIssues(issues)) {
    console.error('\nbuild 失敗：請先修正上列錯誤。')
    process.exit(1)
  }

  mkdirSync(OUT_DIR, { recursive: true })
  const write = (name: string, data: unknown) =>
    writeFileSync(join(OUT_DIR, name), `${JSON.stringify(data, null, 2)}\n`, 'utf8')

  write('chapters.json', chapterList)
  write('grammar.json', grammar)
  write('vocab.json', vocab)
  write('formulas.json', formulas)
  write('reading.json', reading)
  write('mock-exams.json', mockExams)

  console.log(`\n已輸出至 ${OUT_DIR}`)
}

main()
