import type { BuildStats } from './report'

/**
 * 內容縮水護欄。
 *
 * 起因：一個叫 `fix(mobile): optimize mobile homepage layout` 的 commit 夾帶了
 * content/*.json 五萬行刪除（題庫 745 → 145 題）直接進 main，整整一天沒人發現。
 * 題庫是這個 app 唯一不可重建的資產（筆記在別台機器上），所以任何一類數量掉超過
 * 門檻就必須擋下來，而不是安靜地寫出去。
 *
 * 兩道檢查：**數量縮水**（掉超過 10%）與 **id 汰換**（總數沒少但 id 換掉超過 10%，
 * 也就是筆記改名／搬移的樣子）。後者擋的是另一種損失——題目還在，但使用者存在 D1
 * 的錯題本與 SRS 記錄全部對不到題目了。
 *
 * 這個模組刻意保持純函式：不碰 git、不碰檔案系統。取基準（git show）與讀檔那段
 * 放在 baseline.ts，測試才不用 shell out。
 */

/** 要盯的類別，直接綁在 BuildStats 上，數量口徑就不會跟 build report 走鐘。 */
export type ContentCategory = Exclude<keyof BuildStats, 'vocabExampleZh'>

export const CATEGORY_LABELS: Record<ContentCategory, string> = {
  chapters: '章節',
  grammar: '文法題',
  vocab: '單字',
  formulas: '秒殺公式',
  readingPassages: '閱讀篇章',
  readingQuestions: '閱讀題',
  mockExams: '模擬考',
  mockQuestions: '模擬考題',
}

const CATEGORIES = Object.keys(CATEGORY_LABELS) as ContentCategory[]

/** 掉超過這個百分比就擋。「超過」是嚴格大於：剛好 10% 放行。 */
export const SHRINK_THRESHOLD_PERCENT = 10

/**
 * 總數沒明顯少、但 id 換掉超過這個百分比也要擋——那是筆記被改名或搬走的樣子。
 * id 存在 D1 的錯題本與 SRS 記錄裡，換掉等於使用者的練習記錄直接孤兒化。
 *
 * 訂 10% 的依據是實測整段 git 歷史：正常變更（包含題庫擴充 4-5 倍、+414%）汰換率
 * 一律是 0.0%，因為 id 是「筆記路徑#題號」，新增只會往後長；唯一非零的是題庫
 * 745 → 145 那次事故（58–81%）。留 10% 的餘裕是給「章節中間插題造成後面重新編號」
 * 這種合理情況——插一次大約動到全體的 3%。
 */
export const CHURN_THRESHOLD_PERCENT = 10

/** 覆寫方式，出現在錯誤訊息與覆寫橫幅裡。 */
export const OVERRIDE_ENV = 'ALLOW_CONTENT_SHRINK'
export const OVERRIDE_FLAG = '--allow-shrink'

/** 一次 build（或一份 content/*.json）裡每一類的 id 清單。 */
export type ContentIds = Record<ContentCategory, string[]>

/** 基準可能缺角：某個檔案不在該 ref 上（例如第一次 build）。 */
export type BaselineIds = Partial<Record<ContentCategory, string[] | undefined>>

/** collectIds 的輸入——build 出來的 bundle 與讀進來的 JSON 都符合這個形狀。 */
export interface ContentArrays {
  chapters: readonly { id: string }[]
  grammar: readonly { id: string }[]
  vocab: readonly { id: string }[]
  formulas: readonly { id: string }[]
  reading: readonly { id: string; questions: readonly { id: string }[] }[]
  mockExams: readonly { id: string; sections: readonly { questions: readonly { id: string }[] }[] }[]
}

/**
 * 基準那側可能只讀到部分檔案（某個 content/*.json 不在該 ref 上）。讀不到的類別
 * 留 undefined，交給 checkContentShrink 記成「沒有基準」而不是當成 0 筆——把缺檔
 * 當成歸零會反過來噴出一堆假縮水。
 */
export function collectBaselineIds(content: Partial<ContentArrays>): BaselineIds {
  return {
    chapters: content.chapters?.map((c) => c.id),
    grammar: content.grammar?.map((q) => q.id),
    vocab: content.vocab?.map((v) => v.id),
    formulas: content.formulas?.map((f) => f.id),
    readingPassages: content.reading?.map((p) => p.id),
    readingQuestions: content.reading?.flatMap((p) => p.questions.map((q) => q.id)),
    mockExams: content.mockExams?.map((e) => e.id),
    mockQuestions: content.mockExams?.flatMap((e) =>
      e.sections.flatMap((s) => s.questions.map((q) => q.id)),
    ),
  }
}

/** 同上，但輸入是完整的一份內容，所以每一類都必定有值。 */
export function collectIds(content: ContentArrays): ContentIds {
  return collectBaselineIds(content) as ContentIds
}

/**
 * 把缺角補成空陣列。用在「現況」那側：檔案讀不到就是 0 筆，那是 100% 縮水，
 * 正是要擋的情況——不是「沒有基準」。
 */
export function withMissingAsEmpty(ids: BaselineIds): ContentIds {
  return Object.fromEntries(CATEGORIES.map((c) => [c, ids[c] ?? []])) as ContentIds
}

/** 覆寫開關：命令列旗標或環境變數，兩個都吃。 */
export function isShrinkOverridden(
  argv: readonly string[],
  env: Record<string, string | undefined>,
): boolean {
  if (argv.includes(OVERRIDE_FLAG)) return true
  const value = env[OVERRIDE_ENV]
  return !!value && value !== '0'
}

export interface CategoryShrink {
  category: ContentCategory
  label: string
  baseline: number
  current: number
  dropped: number
  /** 縮水百分比，0–100。 */
  percent: number
  /** 基準有、這次沒有的 id（完整清單，印的時候才截斷）。 */
  missingIds: string[]
  /** 消失的 id 佔基準的百分比，0–100。跟數量無關：改名會讓它衝高但 percent 是 0。 */
  churnPercent: number
}

export interface ShrinkCheck {
  /** 掉超過門檻的類別。 */
  shrunk: CategoryShrink[]
  /** 總數沒明顯少、但 id 被大量換掉的類別（改名／搬移筆記的樣子）。 */
  churned: CategoryShrink[]
  /** 沒有基準可比的類別（檔案不在該 ref 上，或基準本來就是 0）。 */
  noBaseline: ContentCategory[]
}

export function checkContentShrink(
  baseline: BaselineIds | null,
  current: ContentIds,
  thresholdPercent: number = SHRINK_THRESHOLD_PERCENT,
  churnThresholdPercent: number = CHURN_THRESHOLD_PERCENT,
): ShrinkCheck {
  const shrunk: CategoryShrink[] = []
  const churned: CategoryShrink[] = []
  const noBaseline: ContentCategory[] = []

  for (const category of CATEGORIES) {
    const before = baseline?.[category]
    if (!before || before.length === 0) {
      noBaseline.push(category)
      continue
    }

    const after = current[category]
    const stillHere = new Set(after)
    const missingIds = before.filter((id) => !stillHere.has(id))
    const dropped = before.length - after.length

    const detail: CategoryShrink = {
      category,
      label: CATEGORY_LABELS[category],
      baseline: before.length,
      current: after.length,
      dropped,
      percent: (dropped / before.length) * 100,
      missingIds,
      churnPercent: (missingIds.length / before.length) * 100,
    }

    // 整數比較，避開浮點數在剛好落在門檻上時的毛邊。
    if (dropped > 0 && dropped * 100 > before.length * thresholdPercent) {
      shrunk.push(detail)
      continue // 縮水那條訊息已經列出消失的 id，不用再報一次 churn。
    }
    if (missingIds.length * 100 > before.length * churnThresholdPercent) {
      churned.push(detail)
    }
  }

  return { shrunk, churned, noBaseline }
}

/** 有沒有任何該擋的發現（縮水或 id 大量更動）。 */
export function hasFindings(check: ShrinkCheck): boolean {
  return check.shrunk.length > 0 || check.churned.length > 0
}

/**
 * 一類都沒比到。對指定 ref 的檢查來說這是硬錯誤：一道永遠綠、其實什麼都沒驗的
 * 檢查，跟當初那個沒人擋下的 commit 是同一種失敗模式。
 */
export function hasNoBaselineAtAll(check: ShrinkCheck): boolean {
  return check.noBaseline.length === CATEGORIES.length
}

const SAMPLE_IDS = 5

function describeShrink(shrink: CategoryShrink): string[] {
  const lines = [
    `  ${shrink.label}：${shrink.baseline} → ${shrink.current}` +
      `（少了 ${shrink.dropped}，-${shrink.percent.toFixed(1)}%）`,
  ]
  if (shrink.missingIds.length > 0) {
    const sample = shrink.missingIds.slice(0, SAMPLE_IDS)
    const rest = shrink.missingIds.length > SAMPLE_IDS ? `　等 ${shrink.missingIds.length} 個` : ''
    lines.push(`    消失的 id：${sample.join('、')}${rest}`)
  }
  return lines
}

function describeChurn(churn: CategoryShrink): string[] {
  const lines = [
    `  ${churn.label}：${churn.missingIds.length} 個 id 消失（${churn.churnPercent.toFixed(1)}%），` +
      `總數 ${churn.baseline} → ${churn.current}`,
  ]
  const sample = churn.missingIds.slice(0, SAMPLE_IDS)
  const rest = churn.missingIds.length > SAMPLE_IDS ? `　等 ${churn.missingIds.length} 個` : ''
  lines.push(`    消失的 id：${sample.join('、')}${rest}`)
  return lines
}

/** 縮水與 id 汰換兩段訊息，有才印。 */
function describeFindings(check: ShrinkCheck): string[] {
  const lines: string[] = []
  if (check.shrunk.length > 0) {
    lines.push(`內容縮水（掉超過 ${SHRINK_THRESHOLD_PERCENT}%）：`, '')
    for (const shrink of check.shrunk) lines.push(...describeShrink(shrink))
    lines.push('')
  }
  if (check.churned.length > 0) {
    lines.push(
      `id 大量更動（總數沒明顯少，但換掉超過 ${CHURN_THRESHOLD_PERCENT}%）：`,
      '',
    )
    for (const churn of check.churned) lines.push(...describeChurn(churn))
    lines.push('')
  }
  return lines
}

function describeNoBaseline(check: ShrinkCheck): string[] {
  if (check.noBaseline.length === 0) return []
  const labels = check.noBaseline.map((c) => CATEGORY_LABELS[c]).join('、')
  return ['', `（沒有基準可比、這次略過的類別：${labels}）`]
}

export function formatShrinkFailure(check: ShrinkCheck): string {
  const lines = ['', '✗ 題庫跟已 commit 的 content/*.json 對不起來：', '']
  lines.push(...describeFindings(check))

  if (check.shrunk.length > 0) {
    lines.push(
      '題庫是從別台機器的 Obsidian 筆記產生的，刪掉就回不來了——請先確認筆記是不是被',
      '搬走或改名了。',
      '',
    )
  }
  if (check.churned.length > 0) {
    lines.push(
      '總數對得上但 id 整批換掉，成因通常是兩種：筆記被改名或搬到別的資料夾，或是在',
      '檔案中間插題造成後面的題號全部重新編號（閱讀與模擬考是整份檔案 1..N 連號，',
      '特別容易這樣）。id 是從筆記路徑加題號推出來的，而使用者的錯題本與 SRS 複習',
      '記錄就是用這些 id 存在 D1 裡——id 一換，那些練習記錄就會變成對不到任何題目的',
      '孤兒資料。',
      '',
    )
  }
  lines.push(`確定這就是你要的改動，用 ${OVERRIDE_FLAG} 或 ${OVERRIDE_ENV}=1 再跑一次。`)
  lines.push(...describeNoBaseline(check))
  return lines.join('\n')
}

export function formatShrinkPassed(check: ShrinkCheck, ref: string): string {
  return [`內容護欄檢查通過（對照 ${ref} 上已 commit 的 content/*.json）。`, ...describeNoBaseline(check)]
    .join('\n')
}

export function formatShrinkOverride(check: ShrinkCheck): string {
  const lines = [
    '',
    '!!! 已略過內容護欄檢查 !!!',
    `（${OVERRIDE_FLAG} / ${OVERRIDE_ENV}=1）以下改動是被放行的，請確認這是你要的：`,
    '',
  ]
  lines.push(...describeFindings(check))
  lines.push(...describeNoBaseline(check))
  return lines.join('\n')
}
