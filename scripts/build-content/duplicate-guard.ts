/**
 * 題目查重護欄。
 *
 * 起因：把 29 個章節從 5 題補到 15 題，等於針對同一個文法點一口氣寫 10 題。這種
 * 規模下真正會發生的重複不是抄同一個句子，而是「換句話再考一次同一個字」——
 * 兩題都在考 `information` 是不可數名詞，只是主詞從經理換成客戶。所以這裡查兩軸：
 *
 *   1. **題幹相似度**：正規化後的 token 集合 Jaccard，跨全庫兩兩比。
 *   2. **正解目標詞碰撞**：同章（或同一組主題重疊的章節）裡同一個正解重複出現。
 *
 * 第二軸必須分組，不能全庫一視同仁：`information` 在名詞章與不可數名詞章各出現一次
 * 是合理的教學安排，在同一章出現兩次才是抄自己。分組預設用「分類」，另外用
 * RELATED_CHAPTER_GROUPS 補上跨分類的主題重疊（介系詞那三章就是這種）。
 *
 * 這個模組刻意保持純函式：不碰檔案系統。讀 content/*.json 那段放在
 * scripts/check-duplicates.ts，測試才不用準備檔案。
 */

/** 查重的輸入。多空格題的每個空各貢獻一個 answerText。 */
export interface QuestionRef {
  id: string
  chapterId: string
  categoryId: string
  stem: string
  answerTexts: string[]
}

export interface DuplicateOptions {
  /** 題幹 Jaccard 超過這個值就回報。「超過」是大於等於。 */
  stemThreshold?: number
}

export const DEFAULT_STEM_THRESHOLD = 0.75

/**
 * 題幹正規化後不足這麼多 token 就不參與相似度比對。
 *
 * 段落填空題與 Part 6 的空格長在文章裡，題幹只是「題目 1」這種標籤，正規化後只
 * 剩一個數字。這種題兩兩都是 1.00 相似，但那不是重複，是沒有可比的內容——放進去
 * 只會用幾百組雜訊淹掉真正的發現。
 */
export const MIN_STEM_TOKENS = 4

export interface StemFinding {
  ids: [string, string]
  score: number
  stems: [string, string]
}

export interface AnswerFinding {
  answer: string
  /** chapter：同一章重複；group：同一組主題重疊的章節之間重複 */
  scope: 'chapter' | 'group'
  key: string
  ids: string[]
}

export interface DuplicateReport {
  total: number
  stemThreshold: number
  stemFindings: StemFinding[]
  answerFindings: AnswerFinding[]
}

/**
 * 主題重疊、必須跨分類一起查的章節。同一組內共用一個 group key，第二軸才看得到
 * 「介系詞章考過 because of，易混淆介系詞片語章又考一次」這種碰撞。
 *
 * 用章節 id 的尾段（分類/章節）比對，因為 grammar/ 前綴在每個 id 上都一樣。
 */
export const RELATED_CHAPTER_GROUPS: readonly (readonly string[])[] = [
  [
    '01_八大詞性與句型結構/05_介系詞',
    '01_八大詞性與句型結構/14_介系詞片語作修飾語',
    '06_其他多益必考進階題型/05_易混淆介系詞片語',
  ],
  ['01_八大詞性與句型結構/07_冠詞與數量詞', '01_八大詞性與句型結構/08_數量詞與數詞用法'],
  ['01_八大詞性與句型結構/03_形容詞與副詞', '01_八大詞性與句型結構/10_分詞形容詞與複合形容詞'],
  ['03_動狀詞_非謂語動詞/03_分詞與分詞構句', '03_動狀詞_非謂語動詞/09_獨立分詞構句'],
  ['03_動狀詞_非謂語動詞/04_情緒動詞與分詞', '03_動狀詞_非謂語動詞/10_過去分詞形容詞固定搭配'],
  ['04_特殊動詞用法/01_使役動詞', '04_特殊動詞用法/09_知覺使役動詞被動式'],
  ['04_特殊動詞用法/02_感官動詞', '04_特殊動詞用法/09_知覺使役動詞被動式'],
  ['02_動詞時態與語態/03_被動語態', '02_動詞時態與語態/07_被動語態進階'],
  ['02_動詞時態與語態/02_完成式', '02_動詞時態與語態/06_過去完成式與時間副詞子句'],
  ['05_子句與假設語氣/04_假設語氣', '05_子句與假設語氣/10_假設語氣倒裝省略if'],
  ['05_子句與假設語氣/01_名詞子句', '05_子句與假設語氣/05_名詞子句受詞同位語'],
  [
    '05_子句與假設語氣/02_關係子句_形容詞子句',
    '05_子句與假設語氣/06_關係代名詞省略非限定用法',
    '05_子句與假設語氣/07_複合關係代名詞',
  ],
  ['06_其他多益必考進階題型/02_倒裝句', '06_其他多益必考進階題型/10_否定副詞倒裝'],
  ['06_其他多益必考進階題型/03_主動詞一致性', '06_其他多益必考進階題型/07_主詞動詞一致性進階'],
  ['06_其他多益必考進階題型/01_比較級與最高級', '06_其他多益必考進階題型/06_倍數比較句型進階'],
]

const GROUP_BY_CHAPTER_SUFFIX = new Map<string, string>()
for (const group of RELATED_CHAPTER_GROUPS) {
  const key = `related:${group[0]}`
  for (const suffix of group) GROUP_BY_CHAPTER_SUFFIX.set(suffix, key)
}

/**
 * 正解是純功能字時不算碰撞。`by` / `to` / `of` 這種本來就會在不同題裡當正解，
 * 報出來只有雜訊；真正要抓的是實詞與片語。
 */
const FUNCTION_WORD_ANSWERS = new Set([
  'a',
  'an',
  'the',
  'to',
  'of',
  'in',
  'on',
  'at',
  'by',
  'for',
  'with',
  'from',
  'as',
  'is',
  'are',
  'was',
  'were',
  'be',
  'been',
  'being',
  'do',
  'does',
  'did',
  'has',
  'have',
  'had',
  'it',
  'its',
  'that',
  'this',
  'and',
  'or',
  'but',
  'not',
  'no',
])

/**
 * 分桶 key 的分隔符。正解可能是含空白的片語（`because of`），章節 id 含斜線，
 * 所以要用一個不可能出現在兩者裡的字元，拆回來才不會斷錯位置。
 */
const KEY_SEP = '\u0000'

/** 空格標記的各種寫法：三個以上底線、全形底線、連續破折號。 */
const BLANK_RE = /[_＿]{2,}|-{3,}/g
/** 多空格題在題幹裡留下的 `（第一空）` 標記，比對時不算內容。 */
const BLANK_LABEL_RE = /[（(]\s*第[一二三四1-4]空\s*[）)]/g

/**
 * 題幹正規化：轉小寫、遮掉空格標記與第N空標籤、把所有非英數字元收成空白。
 * 中文一併被收掉——文法題的題幹本體是英文句子，中文只出現在標記裡。
 */
export function normalizeStem(stem: string): string {
  return stem
    .replace(BLANK_LABEL_RE, ' ')
    .replace(BLANK_RE, ' ')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

export function stemTokens(stem: string): Set<string> {
  const normalized = normalizeStem(stem)
  if (!normalized) return new Set()
  return new Set(normalized.split(' ').filter(Boolean))
}

/** 兩個 token 集合的 Jaccard。任一邊為空一律回 0，不回 NaN。 */
export function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0
  let shared = 0
  for (const token of a) if (b.has(token)) shared += 1
  const union = a.size + b.size - shared
  return union === 0 ? 0 : shared / union
}

export function normalizeAnswer(text: string): string {
  return text.toLowerCase().replace(/\s+/g, ' ').trim()
}

/** 章節所屬的比對組：有登記主題重疊的用該組，其餘用分類。 */
export function groupKeyOf(chapterId: string, categoryId: string): string {
  const suffix = chapterId.split('/').slice(-2).join('/')
  return GROUP_BY_CHAPTER_SUFFIX.get(suffix) ?? categoryId
}

function pushTo<T>(map: Map<string, T[]>, key: string, value: T): void {
  const bucket = map.get(key)
  if (bucket) bucket.push(value)
  else map.set(key, [value])
}

/**
 * 題幹相似度：全庫兩兩比。1500 題約 110 萬次比較，實測不到一秒，不需要 blocking。
 */
function findStemDuplicates(questions: readonly QuestionRef[], threshold: number): StemFinding[] {
  // 題幹沒有可比內容的題（空格在文章裡）先剔掉，否則它們兩兩滿分把訊號淹掉。
  const comparable = questions.filter((q) => stemTokens(q.stem).size >= MIN_STEM_TOKENS)
  const tokens = comparable.map((q) => stemTokens(q.stem))
  const findings: StemFinding[] = []

  for (let i = 0; i < comparable.length; i += 1) {
    for (let j = i + 1; j < comparable.length; j += 1) {
      const score = jaccard(tokens[i]!, tokens[j]!)
      if (score < threshold) continue
      findings.push({
        ids: [comparable[i]!.id, comparable[j]!.id],
        score,
        stems: [comparable[i]!.stem, comparable[j]!.stem],
      })
    }
  }
  return findings.sort((a, b) => b.score - a.score)
}

/**
 * 正解目標詞碰撞。同章重複是 chapter scope，同組（主題重疊的章節之間）是 group
 * scope；同一個碰撞不會兩邊都報，同章的優先。
 */
function findAnswerDuplicates(questions: readonly QuestionRef[]): AnswerFinding[] {
  // 正解可能是含空白的片語（`because of`），所以 key 用不會出現在內容裡的分隔符。
  const byChapter = new Map<string, string[]>()
  const byGroup = new Map<string, string[]>()
  const chapterOf = new Map<string, string>()

  for (const question of questions) {
    chapterOf.set(question.id, question.chapterId)
    const seen = new Set<string>()
    for (const raw of question.answerTexts) {
      const answer = normalizeAnswer(raw)
      if (!answer || FUNCTION_WORD_ANSWERS.has(answer)) continue
      // 同一題的多個空剛好同字不算碰撞，那是題目自己的事。
      if (seen.has(answer)) continue
      seen.add(answer)
      pushTo(byChapter, `${question.chapterId}${KEY_SEP}${answer}`, question.id)
      pushTo(byGroup, `${groupKeyOf(question.chapterId, question.categoryId)}${KEY_SEP}${answer}`, question.id)
    }
  }

  const findings: AnswerFinding[] = []

  for (const [key, ids] of byChapter) {
    if (ids.length < 2) continue
    const [chapterId = '', answer = ''] = key.split(KEY_SEP)
    findings.push({ answer, scope: 'chapter', key: chapterId, ids })
  }

  for (const [key, ids] of byGroup) {
    if (ids.length < 2) continue
    const [groupKey = '', answer = ''] = key.split(KEY_SEP)
    // 同組的碰撞若整批來自同一章，已經以 chapter scope 報過了。
    const chapters = new Set(ids.map((id) => chapterOf.get(id) ?? ''))
    if (chapters.size < 2) continue
    findings.push({ answer, scope: 'group', key: groupKey, ids })
  }

  return findings.sort((a, b) => b.ids.length - a.ids.length || a.answer.localeCompare(b.answer))
}

export function checkDuplicates(
  questions: readonly QuestionRef[],
  options: DuplicateOptions = {},
): DuplicateReport {
  const stemThreshold = options.stemThreshold ?? DEFAULT_STEM_THRESHOLD
  return {
    total: questions.length,
    stemThreshold,
    stemFindings: findStemDuplicates(questions, stemThreshold),
    answerFindings: findAnswerDuplicates(questions),
  }
}

export function hasDuplicateFindings(report: DuplicateReport): boolean {
  return report.stemFindings.length > 0 || report.answerFindings.length > 0
}

const SCOPE_LABEL: Record<AnswerFinding['scope'], string> = {
  chapter: '同章',
  group: '同組主題',
}

export function formatDuplicateReport(report: DuplicateReport, limit = 40): string {
  if (!hasDuplicateFindings(report)) {
    return `✓ 查重通過：${report.total} 題，沒有重複（題幹相似度門檻 ${report.stemThreshold}）`
  }

  const lines: string[] = [`✗ 查重發現問題（共 ${report.total} 題）`]

  if (report.stemFindings.length > 0) {
    lines.push('', `題幹過於相似（${report.stemFindings.length} 組）：`)
    for (const finding of report.stemFindings.slice(0, limit)) {
      lines.push(
        `  ${finding.score.toFixed(2)}  ${finding.ids[0]}`,
        `        ${finding.ids[1]}`,
        `        A: ${finding.stems[0]}`,
        `        B: ${finding.stems[1]}`,
      )
    }
    if (report.stemFindings.length > limit) {
      lines.push(`  …另外還有 ${report.stemFindings.length - limit} 組`)
    }
  }

  if (report.answerFindings.length > 0) {
    lines.push('', `正解目標詞重複（${report.answerFindings.length} 組）：`)
    for (const finding of report.answerFindings.slice(0, limit)) {
      lines.push(
        `  [${SCOPE_LABEL[finding.scope]}] ${finding.answer} ×${finding.ids.length}  ${finding.key}`,
        `        ${finding.ids.join(', ')}`,
      )
    }
    if (report.answerFindings.length > limit) {
      lines.push(`  …另外還有 ${report.answerFindings.length - limit} 組`)
    }
  }

  return lines.join('\n')
}
