import { readFileSync, readdirSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { join, relative } from 'node:path'
import { pathToFileURL } from 'node:url'
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
import {
  checkContentShrink,
  collectIds,
  formatShrinkFailure,
  formatShrinkOverride,
  formatShrinkPassed,
  hasFindings,
  isShrinkOverridden,
} from './shrink-guard'
import { readBaselineFromGit } from './baseline'
import type { Question, VocabItem, Formula, ReadingPassage, MockExam, Chapter } from './types'

const NOTES_DIR = process.env.NOTES_DIR ?? 'D:\\my-note\\個人學習\\多益'
const OUT_DIR = join(process.cwd(), 'content')
/** 縮水護欄的比較基準：已 commit 的題庫。 */
const BASELINE_REF = 'HEAD'

export interface ContentBundle {
  chapters: Chapter[]
  grammar: Question[]
  vocab: VocabItem[]
  formulas: Formula[]
  reading: ReadingPassage[]
  mockExams: MockExam[]
  issues: Issue[]
  stats: BuildStats
}

/** 例句中文翻譯的側車檔（筆記裡沒有這份資料），key 是單字 id。 */
const EXAMPLE_ZH_PATH = join(process.cwd(), 'data', 'vocab-example-zh.json')

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

/**
 * 把例句中文併進單字，並把對不上的字記成警告。
 *
 * id 是從筆記路徑推出來的，改檔名就會讓翻譯無聲脫鉤——所以這裡一定要報出數量，
 * 不能靜靜地退回空字串（同 merge.ts 的原則：解析器要吵，不能沉默）。
 */
function attachExampleZh(vocab: VocabItem[], issues: Issue[]): void {
  const table: Record<string, string> = existsSync(EXAMPLE_ZH_PATH)
    ? JSON.parse(readFileSync(EXAMPLE_ZH_PATH, 'utf8'))
    : {}

  const missing: string[] = []
  for (const item of vocab) {
    const zh = table[item.id]?.trim()
    if (zh) item.exampleZh = zh
    else if (item.example) missing.push(item.id)
  }

  if (missing.length > 0) {
    issues.push({
      level: 'warn',
      questionId: 'vocab-example-zh',
      message: `${missing.length} 個單字缺少例句中文（${EXAMPLE_ZH_PATH}）：${missing
        .slice(0, 5)
        .join('、')}${missing.length > 5 ? ' …' : ''}`,
    })
  }

  const orphans = Object.keys(table).filter((id) => !vocab.some((v) => v.id === id))
  if (orphans.length > 0) {
    issues.push({
      level: 'warn',
      questionId: 'vocab-example-zh',
      message: `${orphans.length} 筆例句中文對不到任何單字（筆記可能改名）：${orphans
        .slice(0, 5)
        .join('、')}${orphans.length > 5 ? ' …' : ''}`,
    })
  }
}

/**
 * Parse the whole vault into a content bundle, without touching disk output.
 * Pure function of `notesDir` — used both by the CLI build below and by the
 * consistency real-tests, which run it against the same vault the committed
 * `content/*.json` is supposed to reflect and diff the two.
 */
export function buildContent(notesDir: string): ContentBundle {
  const issues: Issue[] = []
  const chapterList: Chapter[] = []
  const grammar: Question[] = []
  const vocab: VocabItem[] = []
  const formulas: Formula[] = []
  const reading: ReadingPassage[] = []
  const mockExams: MockExam[] = []

  // --- grammar chapters ---
  const grammarDir = join(notesDir, '文法')
  for (const category of subDirs(grammarDir)) {
    for (const file of mdFiles(join(grammarDir, category))) {
      const notePath = join(grammarDir, category, file)
      const chapterId = chapterIdFromPath(relative(notesDir, notePath))
      const md = readFileSync(notePath, 'utf8')

      const order = Number(/^(\d+)/.exec(file)?.[1] ?? 0)
      chapterList.push(parseChapter(md, chapterId, category, order))
      vocab.push(...parseVocab(md, chapterId))
      formulas.push(...parseFormulas(md, chapterId))

      const answers = readAnswers(join(notesDir, '詳解', category, file), chapterId, issues)
      const merged = mergeQuestions(parseQuestions(md, chapterId, category), answers, chapterId)
      grammar.push(...merged.questions)
      issues.push(...merged.issues)
    }
  }

  // --- reading ---
  const readingDir = join(notesDir, '閱讀理解')
  for (const kindDir of subDirs(readingDir)) {
    const kind = READING_KINDS[kindDir]
    if (!kind) {
      issues.push({ level: 'warn', questionId: kindDir, message: `未知的閱讀分類資料夾：${kindDir}` })
      continue
    }
    for (const file of mdFiles(join(readingDir, kindDir))) {
      const notePath = join(readingDir, kindDir, file)
      const chapterId = chapterIdFromPath(relative(notesDir, notePath))
      const passages = parseReading(readFileSync(notePath, 'utf8'), chapterId, kind)
      const answers = readAnswers(join(notesDir, '詳解', '閱讀理解', kindDir, file), chapterId, issues)

      // One merge for the whole file: its questions are numbered 1..N across
      // every passage and share a single explanation file.
      const merged = mergeGroupedQuestions(passages, answers, chapterId)
      issues.push(...merged.issues)
      reading.push(...merged.groups.filter((p) => p.questions.length > 0))
    }
  }

  // --- mock exams ---
  const mockDir = join(notesDir, '模擬考試')
  for (const file of mdFiles(mockDir)) {
    const notePath = join(mockDir, file)
    const chapterId = chapterIdFromPath(relative(notesDir, notePath))
    const title = file.replace(/\.md$/, '')
    const exam = parseMockExam(readFileSync(notePath, 'utf8'), chapterId, title)
    const answers = readAnswers(join(notesDir, '詳解', '模擬考試', file), chapterId, issues)

    // Same rule as reading: numbering runs across parts, so merge the whole paper.
    const merged = mergeGroupedQuestions(exam.sections, answers, chapterId)
    issues.push(...merged.issues)
    mockExams.push({
      id: exam.id,
      title: exam.title,
      sections: merged.groups.filter((s) => s.questions.length > 0),
    })
  }

  attachExampleZh(vocab, issues)

  const stats: BuildStats = {
    chapters: chapterList.length,
    grammar: grammar.length,
    vocab: vocab.length,
    vocabExampleZh: vocab.filter((v) => v.exampleZh).length,
    formulas: formulas.length,
    readingPassages: reading.length,
    readingQuestions: reading.reduce((n, p) => n + p.questions.length, 0),
    mockExams: mockExams.length,
    mockQuestions: mockExams.reduce(
      (n, e) => n + e.sections.reduce((m, s) => m + s.questions.length, 0),
      0,
    ),
  }

  return { chapters: chapterList, grammar, vocab, formulas, reading, mockExams, issues, stats }
}

function main(): void {
  const bundle = buildContent(NOTES_DIR)

  console.log(formatReport(bundle.stats, bundle.issues))

  if (hasBlockingIssues(bundle.issues)) {
    console.error('\nbuild 失敗：請先修正上列錯誤。')
    process.exit(1)
  }

  // 縮水護欄：跟 git HEAD 上已 commit 的題庫比。一定要在寫檔之前——寫下去之後才
  // 擋，工作目錄裡的題庫已經被蓋掉了，擋了也沒用。
  const check = checkContentShrink(readBaselineFromGit(BASELINE_REF), collectIds(bundle))
  if (hasFindings(check)) {
    if (!isShrinkOverridden(process.argv.slice(2), process.env)) {
      console.error(formatShrinkFailure(check))
      process.exit(1)
    }
    console.log(formatShrinkOverride(check))
  } else {
    console.log(formatShrinkPassed(check, BASELINE_REF))
  }

  mkdirSync(OUT_DIR, { recursive: true })
  const write = (name: string, data: unknown) =>
    writeFileSync(join(OUT_DIR, name), `${JSON.stringify(data, null, 2)}\n`, 'utf8')

  write('chapters.json', bundle.chapters)
  write('grammar.json', bundle.grammar)
  write('vocab.json', bundle.vocab)
  write('formulas.json', bundle.formulas)
  write('reading.json', bundle.reading)
  write('mock-exams.json', bundle.mockExams)

  console.log(`\n已輸出至 ${OUT_DIR}`)
}

// Only run the CLI build when this file is executed directly (`tsx
// scripts/build-content/index.ts`), not when `buildContent` is imported
// elsewhere (e.g. the content-consistency real test) — importing it must
// never have the side effect of writing content/*.json or exiting the process.
if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main()
}
