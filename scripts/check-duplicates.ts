import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  checkDuplicates,
  formatDuplicateReport,
  hasDuplicateFindings,
  DEFAULT_STEM_THRESHOLD,
  type QuestionRef,
} from './build-content/duplicate-guard'

/**
 * 全庫查重。讀 content/*.json（build:content 的產出），對文法題、閱讀題與模擬考題
 * 一起做兩軸比對：題幹相似度、正解目標詞碰撞。
 *
 *   pnpm check:duplicates                     # 文法題（預設）
 *   pnpm check:duplicates --threshold 0.65    # 放寬／收緊題幹相似度門檻
 *   pnpm check:duplicates --scope all         # 併入閱讀與模擬考
 *
 * 預設只看文法題，是因為閱讀與模擬考的題幹本來就是模板——「What is the main purpose
 * of this email?」在每篇文章下都要問一次，答案取決於文章而不是題幹。把它們算進題幹
 * 相似度只會得到一百多組必然的滿分，把真正的發現淹掉。
 *
 * 這支不進 CI：它是寫題時的工具，回報的是「值得看一眼」而不是「一定錯」。真正的
 * 硬護欄是 check:content 那道內容縮水檢查。
 */

interface RawBlank {
  options: { key: string; text: string }[]
  answer: string
}
interface RawQuestion {
  id: string
  chapterId: string
  categoryId: string
  stem: string
  blanks: RawBlank[]
}

function argValue(argv: readonly string[], name: string): string | undefined {
  const index = argv.indexOf(name)
  if (index === -1) return undefined
  return argv[index + 1] || undefined
}

function readJson<T>(dir: string, file: string): T {
  return JSON.parse(readFileSync(join(dir, file), 'utf8')) as T
}

/** 正解選項的文字。找不到對應選項就跳過——那種題 build 早就擋掉了。 */
function answerTextsOf(question: RawQuestion): string[] {
  return question.blanks
    .map((blank) => blank.options.find((o) => o.key === blank.answer)?.text)
    .filter((text): text is string => Boolean(text))
}

function toRef(question: RawQuestion): QuestionRef {
  return {
    id: question.id,
    chapterId: question.chapterId,
    categoryId: question.categoryId,
    stem: question.stem,
    answerTexts: answerTextsOf(question),
  }
}

function main(): void {
  const argv = process.argv.slice(2)
  const dir = argValue(argv, '--dir') ?? join(process.cwd(), 'content')
  const scope = argValue(argv, '--scope') ?? 'grammar'
  const threshold = Number(argValue(argv, '--threshold') ?? DEFAULT_STEM_THRESHOLD)

  if (!Number.isFinite(threshold) || threshold <= 0 || threshold > 1) {
    console.error(`✗ --threshold 要介於 0 與 1 之間，收到 ${argValue(argv, '--threshold')}`)
    process.exit(1)
  }

  const refs: QuestionRef[] = []

  if (scope === 'all' || scope === 'grammar') {
    refs.push(...readJson<RawQuestion[]>(dir, 'grammar.json').map(toRef))
  }
  if (scope === 'all' || scope === 'reading') {
    const passages = readJson<{ questions: RawQuestion[] }[]>(dir, 'reading.json')
    refs.push(...passages.flatMap((p) => p.questions.map(toRef)))
  }
  if (scope === 'all' || scope === 'mock') {
    const exams = readJson<{ sections: { questions: RawQuestion[] }[] }[]>(dir, 'mock-exams.json')
    refs.push(...exams.flatMap((e) => e.sections.flatMap((s) => s.questions.map(toRef))))
  }

  if (refs.length === 0) {
    console.error(`✗ --scope ${scope} 讀不到任何題目，檢查等於沒跑`)
    process.exit(1)
  }

  const report = checkDuplicates(refs, { stemThreshold: threshold })
  const text = formatDuplicateReport(report)

  if (hasDuplicateFindings(report)) {
    console.error(text)
    process.exit(1)
  }
  console.log(text)
}

main()
