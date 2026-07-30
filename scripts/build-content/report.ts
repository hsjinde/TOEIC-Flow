import type { Issue } from './merge'

export interface BuildStats {
  chapters: number
  grammar: number
  vocab: number
  /** 其中有例句中文翻譯的筆數 */
  vocabExampleZh: number
  formulas: number
  /** 手寫的章節速查卡張數（data/formula-cards.json） */
  formulaCards: number
  /** 已排進學習路徑的章節數（data/learning-path.json） */
  pathChapters: number
  readingPassages: number
  readingQuestions: number
  mockExams: number
  mockQuestions: number
}

export function hasBlockingIssues(issues: Issue[]): boolean {
  return issues.some((i) => i.level === 'error')
}

export function formatReport(stats: BuildStats, issues: Issue[]): string {
  const lines: string[] = []
  lines.push('=== 題庫 build report ===')
  lines.push(`章節：${stats.chapters}`)
  lines.push(`文法題：${stats.grammar}`)
  lines.push(`單字：${stats.vocab}（${stats.vocabExampleZh} 筆有例句中文）`)
  lines.push(`秒殺公式：${stats.formulas}`)
  lines.push(`章節速查卡：${stats.formulaCards} / ${stats.chapters} 章`)
  lines.push(`學習路徑：${stats.pathChapters} / ${stats.chapters} 章已排入`)
  lines.push(`閱讀篇章：${stats.readingPassages}（${stats.readingQuestions} 題）`)
  lines.push(`模擬考：${stats.mockExams}（${stats.mockQuestions} 題）`)
  lines.push('')

  const errors = issues.filter((i) => i.level === 'error')
  const warnings = issues.filter((i) => i.level === 'warn')

  if (errors.length === 0 && warnings.length === 0) {
    lines.push('沒有發現問題。')
    return lines.join('\n')
  }

  if (errors.length > 0) {
    lines.push(`錯誤（${errors.length}）— build 會失敗：`)
    for (const issue of errors) lines.push(`  ✗ ${issue.message}`)
    lines.push('')
  }
  if (warnings.length > 0) {
    lines.push(`警告（${warnings.length}）：`)
    for (const issue of warnings) lines.push(`  ! ${issue.message}`)
  }
  return lines.join('\n')
}
