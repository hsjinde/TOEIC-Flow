# 跳轉邏輯與手機／電腦版型優化 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 讓每一個練習回合結束後都回到「使用者實際是從哪一頁點進來的」，並讓 `/path`、`/profile`、`/vocab-review` 三頁與 768–1023 平板帶真正用上可用寬度。

**Architecture:** 抽一個純函式 `resolveOrigin(params, fallback)` 到 `src/lib/origin.ts`，五個練習頁共用。它是**覆寫層**而不是分支——只換 `backHref`／`backLabel`，絕不碰 `questions`／`source`／`countsAsDailyTask`。版型部分沿用專案既有的桌機語彙（`lg:grid-cols-*` ＋ `lg:sticky lg:top-20`），不引進新機制。

**Tech Stack:** Next.js App Router（`output: 'export'`）、Tailwind v4（無 config 檔，token 在 `globals.css` 的 `@theme inline`）、vitest。

## Global Constraints

- 所有使用者可見文字為繁體中文。
- 單一強調色（藍／靛）；綠／紅**只**用於答題對錯回饋。
- 動效僅限答題回饋／進度環／詳解展開，且一律 ≤300ms。
- **Tailwind v4 沒有 `tailwind.config.ts`。** 新的顏色／半徑／動畫必須寫進 `globals.css` 的 `@theme inline`，否則編譯出來是空的。本計畫只用 arbitrary value（如 `max-w-[var(--measure)]`），不新增語意 utility。
- tsconfig 是 `strict` ＋ `noUncheckedIndexedAccess`：陣列與 Record 的索引存取型別都會帶 `undefined`，必須處理。
- 型別檢查靠 `pnpm build`（`noEmit`），沒有獨立 lint 步驟。
- 本機跑完整堆疊用 `npx wrangler pages dev out --port 8788`（`next dev` 沒有 Functions）。
- `content/*.json` 由 `.gitattributes` 強制 LF，本計畫不碰。

---

# Phase 1 — 跳轉邏輯（主軸）

### Task 1: `resolveOrigin()` 純函式

**Files:**
- Create: `src/lib/origin.ts`
- Test: `tests/origin.test.ts`

**Interfaces:**
- Consumes: `getChapterById`、`stripOrderPrefix`（皆來自 `src/lib/content.ts`）
- Produces:
  - `interface Origin { backHref: string; backLabel: string }`
  - `chapterHref(id: string): string`
  - `resolveOrigin(params: URLSearchParams, fallback: Origin): Origin`

- [ ] **Step 1: 寫失敗的測試**

建立 `tests/origin.test.ts`：

```ts
import { describe, it, expect } from 'vitest'
import { resolveOrigin, chapterHref, type Origin } from '../src/lib/origin'
import chaptersData from '../content/chapters.json'

const FALLBACK: Origin = { backHref: '/', backLabel: '今日任務' }

const sampleChapterId = (chaptersData as { id: string }[])[0]?.id
if (!sampleChapterId) throw new Error('chapters.json 沒有可用的章節樣本')

describe('resolveOrigin', () => {
  it('沒帶 from 時原封不動回傳 fallback', () => {
    expect(resolveOrigin(new URLSearchParams(), FALLBACK)).toEqual(FALLBACK)
  })

  it('白名單命中時回傳該來源', () => {
    expect(resolveOrigin(new URLSearchParams({ from: 'practice' }), FALLBACK)).toEqual({
      backHref: '/practice',
      backLabel: '練習中心',
    })
    expect(resolveOrigin(new URLSearchParams({ from: 'stats' }), FALLBACK)).toEqual({
      backHref: '/stats',
      backLabel: '統計',
    })
  })

  // 直接把 from 當 href 用會變成開放重導向，所以查不到一律退回 fallback。
  it('未知的 from 退回 fallback', () => {
    expect(resolveOrigin(new URLSearchParams({ from: 'evil' }), FALLBACK)).toEqual(FALLBACK)
  })

  it('外部網址形式的 from 退回 fallback，不得原樣採用', () => {
    const out = resolveOrigin(new URLSearchParams({ from: 'https://example.com' }), FALLBACK)
    expect(out).toEqual(FALLBACK)
    expect(out.backHref.startsWith('/')).toBe(true)
  })

  it('from=chapter 時用同一組 params 裡的 chapter 解析出該章', () => {
    const params = new URLSearchParams({ from: 'chapter', chapter: sampleChapterId })
    const out = resolveOrigin(params, FALLBACK)
    expect(out.backHref).toBe(chapterHref(sampleChapterId))
    expect(out.backLabel.length).toBeGreaterThan(0)
  })

  it('from=chapter 但缺 chapter 參數時退回 fallback', () => {
    expect(resolveOrigin(new URLSearchParams({ from: 'chapter' }), FALLBACK)).toEqual(FALLBACK)
  })

  it('from=chapter 但章節不存在時退回 fallback', () => {
    const params = new URLSearchParams({ from: 'chapter', chapter: 'grammar/不存在/不存在' })
    expect(resolveOrigin(params, FALLBACK)).toEqual(FALLBACK)
  })
})

describe('chapterHref', () => {
  it('逐段編碼，不把斜線編掉', () => {
    expect(chapterHref('grammar/01_甲/02_乙')).toBe(
      `/chapters/grammar/${encodeURIComponent('01_甲')}/${encodeURIComponent('02_乙')}`
    )
  })
})
```

- [ ] **Step 2: 執行測試確認失敗**

```bash
pnpm vitest run tests/origin.test.ts
```

Expected: FAIL — `Failed to resolve import "../src/lib/origin"`

- [ ] **Step 3: 寫最小實作**

建立 `src/lib/origin.ts`：

```ts
import { getChapterById, stripOrderPrefix } from './content'

export interface Origin {
  backHref: string
  backLabel: string
}

/**
 * 練習回合的來源白名單。
 *
 * 一定要走白名單、不能直接把 `from` 當 href 用——那等於開放重導向，任何人都能
 * 造一條 /practice/grammar?from=https://… 的連結，讓使用者練完被送到站外。
 */
const STATIC_ORIGINS: Record<string, Origin> = {
  home: { backHref: '/', backLabel: '今日任務' },
  practice: { backHref: '/practice', backLabel: '練習中心' },
  stats: { backHref: '/stats', backLabel: '統計' },
  'vocab-review': { backHref: '/vocab-review', backLabel: '單字複習本' },
  'wrong-questions': { backHref: '/wrong-questions', backLabel: '錯題本' },
  path: { backHref: '/path', backLabel: '學習路徑' },
}

/** 章節 id 形如 `grammar/01_甲/02_乙`，斜線是路徑分隔，只能逐段編碼。 */
export function chapterHref(id: string): string {
  return `/chapters/${id.split('/').map(encodeURIComponent).join('/')}`
}

/**
 * 依 `from` 參數決定這一回合練完要回哪裡。
 *
 * 這是**覆寫層**，不是 buildSession 的分支：它只換 backHref/backLabel，
 * 絕不碰 questions/source/countsAsDailyTask。理由見
 * docs/superpowers/specs/2026-07-31-navigation-and-responsive-design.md——
 * 唯一 countsAsDailyTask:true 的是無參數的預設分支，任何以 from 為 key 的
 * 提前 return 都會攔在它前面，讓從練習中心進來的回合不再算今日任務。
 *
 * 來源優先於推論：chapter/stage/mode 決定的是題目來源，出口只是它們順帶給的
 * 預設值；使用者實際從哪一頁點進來是更強的事實，所以解析成功就覆寫。
 */
export function resolveOrigin(params: URLSearchParams, fallback: Origin): Origin {
  const from = params.get('from')
  if (!from) return fallback

  if (from === 'chapter') {
    const chapterId = params.get('chapter')
    if (!chapterId) return fallback
    const chapter = getChapterById(chapterId)
    if (!chapter) return fallback
    return { backHref: chapterHref(chapterId), backLabel: stripOrderPrefix(chapter.title) }
  }

  return STATIC_ORIGINS[from] ?? fallback
}
```

- [ ] **Step 4: 執行測試確認通過**

```bash
pnpm vitest run tests/origin.test.ts
```

Expected: PASS，9 個測試全綠

- [ ] **Step 5: Commit**

```bash
git add src/lib/origin.ts tests/origin.test.ts
git commit -m "feat(nav): 加入走白名單的 resolveOrigin 純函式"
```

---

### Task 2: 文法練習接上 `resolveOrigin`（含每日任務迴歸測試）

這一題最容易改壞：`buildSession()` 裡**只有最後那個無參數的預設分支是 `countsAsDailyTask: true`**。先寫迴歸測試把它釘死。

**Files:**
- Modify: `src/app/practice/grammar/page.tsx`（`chapterHref` 於 56–58 行、`buildSession` 於 60–123 行）
- Test: `tests/grammar-page-session.test.ts`（既有檔，追加 describe 區塊）

**Interfaces:**
- Consumes: Task 1 的 `resolveOrigin`、`chapterHref`、`Origin`
- Produces: `buildSession(params)` 行為不變，僅 `backHref`／`backLabel` 會被 `from` 覆寫

- [ ] **Step 1: 寫失敗的測試**

在 `tests/grammar-page-session.test.ts` 檔尾追加：

```ts
describe('buildSession 的 from 覆寫層', () => {
  const q = grammarData as unknown as Question[]
  const chapterId = q[0]!.chapterId
  const categoryId = q[0]!.categoryId

  it('沒帶 from 時預設回合仍回今日任務', () => {
    const s = buildSession(new URLSearchParams())
    expect(s.backHref).toBe('/')
    expect(s.backLabel).toBe('今日任務')
  })

  it('from=practice 讓預設回合改回練習中心', () => {
    const s = buildSession(new URLSearchParams({ from: 'practice' }))
    expect(s.backHref).toBe('/practice')
    expect(s.backLabel).toBe('練習中心')
  })

  // 這是本次最容易改壞的地方：唯一 countsAsDailyTask:true 的是無參數的預設分支，
  // 而練習中心正是規定要列出三項每日任務的那一頁。from 絕不能攔在它前面。
  it('from=practice 仍然算今日任務', () => {
    const s = buildSession(new URLSearchParams({ from: 'practice' }))
    expect(s.countsAsDailyTask).toBe(true)
  })

  it('from 只換出口，不動題目來源與計數', () => {
    const plain = buildSession(new URLSearchParams({ chapter: chapterId }))
    const withFrom = buildSession(new URLSearchParams({ chapter: chapterId, from: 'practice' }))
    expect(withFrom.source).toBe(plain.source)
    expect(withFrom.countsAsDailyTask).toBe(plain.countsAsDailyTask)
    expect(withFrom.chapterId).toBe(plain.chapterId)
    expect(withFrom.questions.length).toBe(plain.questions.length)
    expect(withFrom.backHref).toBe('/practice')
  })

  it('from=stats 讓弱項加練回統計而不是首頁', () => {
    const s = buildSession(new URLSearchParams({ category: categoryId, from: 'stats' }))
    expect(s.backHref).toBe('/stats')
    expect(s.countsAsDailyTask).toBe(false)
  })

  // 章節頁的「重練這章的錯題」：題目來自 ids，但使用者是從該章進來的。
  it('from=chapter 讓錯題回合回該章而不是錯題本', () => {
    const ids = q.slice(0, 3).map((x) => x.id).join(',')
    const s = buildSession(new URLSearchParams({ mode: 'wrong', ids, from: 'chapter', chapter: chapterId }))
    expect(s.backHref).toBe(`/chapters/${chapterId.split('/').map(encodeURIComponent).join('/')}`)
    expect(s.source).toBe('wrong')
  })

  it('未知的 from 退回該分支原本的出口', () => {
    const s = buildSession(new URLSearchParams({ stage: 'stage-01', from: 'evil' }))
    expect(s.backHref).toBe('/path')
  })
})
```

- [ ] **Step 2: 執行測試確認失敗**

```bash
pnpm vitest run tests/grammar-page-session.test.ts
```

Expected: FAIL — `from=practice` 的案例得到 `/` 而非 `/practice`

- [ ] **Step 3: 寫最小實作**

在 `src/app/practice/grammar/page.tsx`：

1. 加入 import（放在既有的 `../../../lib/learning-path` import 之後）：

```ts
import { resolveOrigin, chapterHref } from '../../../lib/origin'
```

2. **刪掉** 56–58 行本地重複的 `chapterHref`（已改由 `lib/origin` 提供，簽章相同）：

```ts
function chapterHref(id: string): string {
  return `/chapters/${id.split('/').map(encodeURIComponent).join('/')}`
}
```

3. 把 `buildSession` 改成：先把原本的邏輯抽成 `buildBaseSession`（**原封不動搬過去，一個字都不改**），再由 `buildSession` 套上覆寫層：

```ts
/** 原本的分支邏輯。題目來源、source、countsAsDailyTask 全部由它決定。 */
function buildBaseSession(params: URLSearchParams): Session {
  // …原本 60–123 行的內容原封不動搬到這裡…
}

/**
 * 出口覆寫層。base 決定「練什麼」，from 決定「練完回哪」——
 * 兩者不可以合成一個 if 鏈，見 lib/origin.ts 的註解。
 */
export function buildSession(params: URLSearchParams): Session {
  const base = buildBaseSession(params)
  const origin = resolveOrigin(params, { backHref: base.backHref, backLabel: base.backLabel })
  return { ...base, ...origin }
}
```

- [ ] **Step 4: 執行測試確認通過**

```bash
pnpm vitest run tests/grammar-page-session.test.ts
```

Expected: PASS，既有案例與新增 7 個案例全綠

- [ ] **Step 5: 型別檢查**

```bash
pnpm build
```

Expected: 成功，無 TypeScript 錯誤

- [ ] **Step 6: Commit**

```bash
git add src/app/practice/grammar/page.tsx tests/grammar-page-session.test.ts
git commit -m "feat(nav): 文法練習改用 resolveOrigin 決定出口"
```

---

### Task 3: 單字與速查卡接上 `resolveOrigin`

**Files:**
- Modify: `src/app/practice/vocab/page.tsx`（`buildSession` 於 47–68 行）
- Modify: `src/app/practice/formulas/page.tsx`（`chapterHref` 於 34–36 行、`buildSession` 於 38–60 行）
- Test: `tests/practice-origin.test.ts`（新檔）

**Interfaces:**
- Consumes: Task 1 的 `resolveOrigin`、`chapterHref`
- Produces: 兩頁的 `buildSession` 皆改為 `export`，供測試呼叫

- [ ] **Step 1: 寫失敗的測試**

建立 `tests/practice-origin.test.ts`：

```ts
import { describe, it, expect } from 'vitest'
import { buildSession as buildVocabSession } from '../src/app/practice/vocab/page'
import { buildSession as buildCardSession } from '../src/app/practice/formulas/page'

describe('單字練習的出口', () => {
  it('預設回合沒帶 from 時回今日任務', () => {
    const s = buildVocabSession(new URLSearchParams())
    expect(s.backHref).toBe('/')
  })

  it('from=practice 讓預設回合回練習中心', () => {
    const s = buildVocabSession(new URLSearchParams({ from: 'practice' }))
    expect(s.backHref).toBe('/practice')
    expect(s.backLabel).toBe('練習中心')
  })

  // /stats 有一條 /practice/vocab?mode=weak，練完不該掉回首頁。
  it('from=stats 讓弱點複習回統計', () => {
    const s = buildVocabSession(new URLSearchParams({ mode: 'weak', from: 'stats' }))
    expect(s.backHref).toBe('/stats')
  })

  it('from 不改變題目數量', () => {
    const a = buildVocabSession(new URLSearchParams())
    const b = buildVocabSession(new URLSearchParams({ from: 'practice' }))
    expect(b.items.length).toBe(a.items.length)
  })
})

describe('速查卡的出口', () => {
  it('預設回合沒帶 from 時回今日任務', () => {
    const s = buildCardSession(new URLSearchParams())
    expect(s.backHref).toBe('/')
  })

  it('from=practice 讓預設回合回練習中心', () => {
    const s = buildCardSession(new URLSearchParams({ from: 'practice' }))
    expect(s.backHref).toBe('/practice')
  })
})
```

- [ ] **Step 2: 執行測試確認失敗**

```bash
pnpm vitest run tests/practice-origin.test.ts
```

Expected: FAIL — `buildSession` 未被 export

- [ ] **Step 3: 寫最小實作**

`src/app/practice/vocab/page.tsx`：

1. 加 import：

```ts
import { resolveOrigin } from '../../../lib/origin'
```

2. 把 47 行的 `function buildSession(` 改名為 `function buildBaseSession(`（內容不動），並在其後新增：

```ts
/** 出口覆寫層：base 決定練哪些字，from 決定練完回哪。 */
export function buildSession(params: URLSearchParams): VocabSession {
  const base = buildBaseSession(params)
  const origin = resolveOrigin(params, { backHref: base.backHref, backLabel: base.backLabel })
  return { ...base, ...origin }
}
```

`src/app/practice/formulas/page.tsx`：

1. 加 import 並**刪掉** 34–36 行本地重複的 `chapterHref`：

```ts
import { resolveOrigin, chapterHref } from '../../../lib/origin'
```

2. 把 38 行的 `function buildSession(` 改名為 `function buildBaseSession(`（內容不動），並在其後新增：

```ts
/** 出口覆寫層：base 決定發哪幾張卡，from 決定看完回哪。 */
export function buildSession(params: URLSearchParams): CardSession {
  const base = buildBaseSession(params)
  const origin = resolveOrigin(params, { backHref: base.backHref, backLabel: base.backLabel })
  return { ...base, ...origin }
}
```

- [ ] **Step 4: 執行測試確認通過**

```bash
pnpm vitest run tests/practice-origin.test.ts
```

Expected: PASS，6 個測試全綠

- [ ] **Step 5: Commit**

```bash
git add src/app/practice/vocab/page.tsx src/app/practice/formulas/page.tsx tests/practice-origin.test.ts
git commit -m "feat(nav): 單字與速查卡改用 resolveOrigin 決定出口"
```

---

### Task 4: 閱讀與模擬考補上出口機制

這兩頁**完全沒有參數機制**，各有三處寫死 `href="/"`。

**Files:**
- Modify: `src/app/practice/reading/page.tsx`（43 行、65 行，以及 `SummaryModal` 呼叫處 52–58 行）
- Modify: `src/app/practice/mock/page.tsx`（318 行、377 行、397 行）

**Interfaces:**
- Consumes: Task 1 的 `resolveOrigin`

- [ ] **Step 1: 閱讀頁加入出口解析**

在 `src/app/practice/reading/page.tsx` 加 import：

```ts
import { resolveOrigin } from '../../../lib/origin'
```

在元件內（`useSearchParams()` 取得 params 之後；若該頁尚未使用 `useSearchParams`，需一併加入 `import { useSearchParams } from 'next/navigation'` 並確認元件已包在既有的 `Suspense` 內）：

```ts
const searchParams = useSearchParams()
// 閱讀沒有 chapter/stage/mode 之類的來源參數，出口完全由 from 決定，預設今日任務。
const origin = resolveOrigin(
  new URLSearchParams(searchParams.toString()),
  { backHref: '/', backLabel: '今日任務' }
)
```

- [ ] **Step 2: 閱讀頁三處改用 origin**

43 行（空題庫狀態）：

```tsx
<Link href={origin.backHref} className="w-full max-w-[240px] pt-1">
  <Button variant="primary">回到{origin.backLabel}</Button>
</Link>
```

52–58 行（結算）改為把出口傳給 `SummaryModal`：

```tsx
<SummaryModal
  correctCount={result.correct}
  totalCount={result.total}
  title="閱讀任務完成"
  backHref={origin.backHref}
  backLabel={origin.backLabel}
/>
```

65 行（頂部返回鍵）：

```tsx
<Link
  href={origin.backHref}
  aria-label={`返回${origin.backLabel}`}
  className="-ml-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-[var(--mu)] hover:bg-[var(--sf2)]"
>
```

- [ ] **Step 3: 模擬考三處改用 origin**

`/practice/mock` **首頁根本沒有連到它**（手機只從練習中心進、桌機只從 TopNav 進），所以 fallback 直接就是練習中心，不需要任何入口帶參數。

加 import 與解析：

```ts
import { resolveOrigin } from '../../../lib/origin'
```

```ts
const searchParams = useSearchParams()
// 首頁沒有連到模擬考，唯一入口是練習中心與桌機 TopNav，所以預設出口就是練習中心。
const origin = resolveOrigin(
  new URLSearchParams(searchParams.toString()),
  { backHref: '/practice', backLabel: '練習中心' }
)
```

318 行（空題庫狀態）：

```tsx
<Link href={origin.backHref} className="w-full max-w-[240px] pt-1">
  <Button variant="primary">回到{origin.backLabel}</Button>
</Link>
```

377 行（開始前的離開連結）：

```tsx
<Link href={origin.backHref} className="text-xs text-[var(--mu)] hover:text-[var(--tx)]">
  先回{origin.backLabel}
</Link>
```

397 行（作答中的離開連結，**保留既有的 `aria-label` 與 `window.confirm`**）：

```tsx
<Link
  href={origin.backHref}
  aria-label="離開模擬考"
  onClick={(e) => {
    if (!window.confirm('離開模擬考？作答會暫存，可以稍後接續。')) e.preventDefault()
  }}
```

- [ ] **Step 4: 全站測試與型別檢查**

```bash
pnpm test
```

Expected: 全綠（`*.real.test.ts` 需要 Obsidian vault，沒有 vault 的機器上這幾支會失敗，屬預期）

```bash
pnpm build
```

Expected: 成功

- [ ] **Step 5: Commit**

```bash
git add src/app/practice/reading/page.tsx src/app/practice/mock/page.tsx
git commit -m "feat(nav): 閱讀與模擬考補上出口解析，模擬考預設改回練習中心"
```

---

### Task 5: 入口連結帶上 `from`

**Files:**
- Modify: `src/app/practice/page.tsx`（`DAILY_TASKS` 的 30／37／44 行、188 行速查卡、199 行模擬考）
- Modify: `src/app/stats/page.tsx`（281 行、329 行）
- Modify: `src/components/WeaknessCards.tsx`（52 行）
- Modify: `src/app/chapters/[...id]/ChapterDetailClient.tsx`（265 行）

**Interfaces:**
- Consumes: Task 1–4 已接好的各頁出口解析
- Produces: `WeaknessCards` 新增必填 prop `from: string`

- [ ] **Step 1: 練習中心的五個入口**

`src/app/practice/page.tsx` 的 `DAILY_TASKS`（25 行起）三條 href：

```ts
href: '/practice/vocab?from=practice',
href: '/practice/grammar?from=practice',
href: '/practice/reading?from=practice',
```

188 行速查卡：

```tsx
href="/practice/formulas?from=practice"
```

199 行模擬考**不動**——它的預設出口已經是練習中心（Task 4），加參數只是多餘。

- [ ] **Step 2: 統計頁的兩個入口**

`src/app/stats/page.tsx` 281 行：

```tsx
<Link href="/practice/grammar?from=stats" className="flex-1">
```

329 行：

```tsx
<Link href="/practice/vocab?mode=weak&from=stats" className="flex-1">
```

- [ ] **Step 3: `WeaknessCards` 加 `from` prop**

這個元件同時被首頁與統計頁用，出口必須跟著呼叫端走。

`src/components/WeaknessCards.tsx` 的 `WeaknessCardsProps`（7 行起）加一欄：

```ts
/** 這張卡是在哪一頁上顯示的——決定使用者練完要回哪。見 lib/origin.ts。 */
from: string
```

元件簽章（19 行起）解構出 `from`，並把 52 行改成：

```tsx
href={`/practice/grammar?category=${encodeURIComponent(item.categoryId)}&from=${from}`}
```

呼叫端補上：`src/app/stats/page.tsx:265` 加 `from="stats"`；`src/app/page.tsx` 的 `<WeaknessCards` 加 `from="home"`。

用 grep 確認沒有漏掉的呼叫端：

```bash
grep -rn "<WeaknessCards" src/
```

- [ ] **Step 4: 章節頁的「重練這章錯題」**

`src/app/chapters/[...id]/ChapterDetailClient.tsx:265`：題目來自 ids，但使用者是從該章進來的，所以要帶 `from=chapter` 與 `chapter`。

```tsx
href={`/practice/grammar?mode=wrong&ids=${encodeURIComponent(
  wrong.map((w) => w.question.id).join(',')
)}&from=chapter&chapter=${encodeURIComponent(chapter.id)}`}
```

- [ ] **Step 5: 型別檢查與測試**

```bash
pnpm build
```

Expected: 成功。若出現 `Property 'from' is missing`，代表還有 `WeaknessCards` 呼叫端沒補。

```bash
pnpm test
```

Expected: 全綠（`*.real.test.ts` 除外，理由同上）

- [ ] **Step 6: 實機驗證**

```bash
npx wrangler pages dev out --port 8788
```

逐一走過並確認返回鍵文字與去向：

| 從 | 點 | 練完返回應為 |
|---|---|---|
| `/practice` | 文法練習 | 返回**練習中心** |
| `/practice` | 單字複習 | 返回**練習中心** |
| `/practice` | 閱讀理解 | 返回**練習中心** |
| `/practice` | 速查卡 | 返回**練習中心** |
| `/practice` | 模擬考 | 先回**練習中心** |
| `/stats` | 弱項的「加練」 | 返回**統計** |
| `/stats` | 弱點單字複習 | 返回**統計** |
| `/` | 文法練習 | 返回**今日任務**（不變） |
| 章節頁 | 練這章 | 返回**該章**（不變） |
| 章節頁 | 重練這章錯題 | 返回**該章**（原為錯題本） |
| `/wrong-questions` | 開始複習 | 返回**錯題本**（不變） |
| `/path` | 路徑驗收 | 返回**學習路徑**（不變） |

另外確認：從 `/practice` 進去做完文法練習後，回到 `/practice`，**該項每日任務要顯示已完成**。這是 Task 2 迴歸測試守的那條線，也要用眼睛看一次。

- [ ] **Step 7: Commit**

```bash
git add src/app/practice/page.tsx src/app/stats/page.tsx src/components/WeaknessCards.tsx src/app/page.tsx "src/app/chapters/[...id]/ChapterDetailClient.tsx"
git commit -m "feat(nav): 練習中心、統計、章節錯題的入口帶上來源"
```

---

# Phase 2 — 版型（配套）

### Task 6: 平板帶流體化與可讀行長

**Files:**
- Modify: `src/app/layout.tsx:44`
- Modify: `src/app/globals.css`（`:root` 區塊，59 行附近）
- Modify: `src/app/chapters/page.tsx:137`
- Modify: `src/app/practice/page.tsx:230`
- Modify: `src/app/path/page.tsx`、`src/app/practice/page.tsx` 的說明段落

- [ ] **Step 1: 加入行長 token**

`src/app/globals.css` 現有的 `:root`（59 行）加一行：

```css
:root {
  --nav-h: calc(3.8125rem + env(safe-area-inset-bottom, 0px));
  /* 可讀行長上限：672px，中文約 40 字/行。桌機主欄有 1180px，長說明段落
     若跟著撐滿，眼睛在行末找不回行首。 */
  --measure: 42rem;
}
```

- [ ] **Step 2: 主容器在平板帶改為流體**

`src/app/layout.tsx:44`，把 `md:max-w-2xl` 換成 `md:max-w-none md:px-8`：

```tsx
<main className="flex w-full max-w-md flex-col overflow-x-clip px-4 pt-4 pb-[calc(var(--nav-h)+2.5rem)] md:max-w-none md:px-8 lg:max-w-[1180px] lg:px-6 lg:pt-6">
```

- [ ] **Step 3: 把既有的兩欄格線下放到 `md`**

容器變寬換來的必須是密度，不是更長的行。

`src/app/chapters/page.tsx:137`：

```tsx
<div className="space-y-2.5 md:grid md:grid-cols-2 md:gap-3 md:space-y-0">
```

`src/app/practice/page.tsx:230`：

```tsx
<div className="grid gap-2.5 md:grid-cols-2">{children}</div>
```

- [ ] **Step 4: 長說明段落套上行長上限**

`src/app/path/page.tsx` 的開頭說明段落（「這條路徑不照文法章節的編號順序⋯」）與 `src/app/practice/page.tsx` 的副標（「所有練習與複習的入口都在這一頁⋯」），在既有 className 後面加 `max-w-[var(--measure)]`。

用 grep 定位：

```bash
grep -n "這條路徑不照\|所有練習與複習的入口" src/app/path/page.tsx src/app/practice/page.tsx
```

- [ ] **Step 5: 驗證**

```bash
pnpm build
npx wrangler pages dev out --port 8788
```

在瀏覽器把視窗調到 **1023px** 寬，確認：主欄佔滿（左右留白約 64px 而非 351px）、章節列表與練習中心是兩欄、說明段落沒有被拉到滿版。再調到 **768px** 與 **1440px** 各看一次，確認沒有破版。

- [ ] **Step 6: Commit**

```bash
git add src/app/layout.tsx src/app/globals.css src/app/chapters/page.tsx src/app/practice/page.tsx src/app/path/page.tsx
git commit -m "feat(layout): 平板帶主欄流體化並加上可讀行長上限"
```

---

### Task 7: `/path` 桌機兩欄

`/path` 是全站唯一 `multiColGrids: 0` 的頁，1440 頁高 ÷ 375 頁高 = 0.95，等於完全沒為桌機重排。

**Files:**
- Modify: `src/app/path/page.tsx`

- [ ] **Step 1: 給每一站加錨點**

`src/app/path/page.tsx:85` 的 `<li>` 加上 `id`，讓左欄索引跳得過去：

```tsx
<li key={stage.id} id={`stage-${stage.id}`} className="relative pl-10 sm:pl-12">
```

- [ ] **Step 2: 改成索引 ＋ 內容兩欄**

沿用 `/practice/grammar:334` 已有的桌機語彙。把 75 行的 `<ol>` 外面包一層兩欄格線，並在左欄放索引。
`progress.stages` 的每個元素是 `StageProgress`，有 `stage`、`achievedCount`、`totalCount`、`hasPracticed`、`nextChapterId` 可用。

```tsx
<div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] lg:items-start">
  {/*
    左欄索引。top-20 對齊 TopNav 的 57px 高度。
    刻意不是「兩欄並排卡片」：路徑有先後順序，左右交錯閱讀會破壞它；
    索引 ＋ 內容既填滿了寬度又保住順序。
  */}
  <nav aria-label="學習路徑索引" className="hidden lg:sticky lg:top-20 lg:block">
    <ol className="flex flex-col gap-0.5 rounded-2xl border border-[var(--ln)] bg-[var(--sf)] p-2">
      {progress.stages.map((sp) => {
        const done = sp.nextChapterId === null
        const current = sp.stage.id === progress.currentStageId && progress.next !== null
        return (
          <li key={sp.stage.id}>
            <a
              href={`#stage-${sp.stage.id}`}
              aria-current={current ? 'step' : undefined}
              className={cn(
                'flex min-h-11 items-center gap-2.5 rounded-xl px-2.5 text-xs transition-colors',
                current
                  ? 'bg-[var(--pr-sf)] font-bold text-[var(--pr)]'
                  : 'text-[var(--mu)] hover:bg-[var(--sf2)] hover:text-[var(--tx)]'
              )}
            >
              <span className="w-5 shrink-0 text-right tabular-nums">{sp.stage.order}</span>
              <span className="min-w-0 flex-1 truncate">{sp.stage.title}</span>
              {/* 完成狀態只用主色，不用綠色——綠色專屬於答題對錯回饋 */}
              <span className="shrink-0 tabular-nums text-[11px] text-[var(--fa)]">
                {done ? '✓' : `${sp.achievedCount}/${sp.totalCount}`}
              </span>
            </a>
          </li>
        )
      })}
    </ol>
  </nav>

  {/* 右欄：既有的 <ol>（75 行起）原封不動搬進來，維持單欄垂直排列 */}
  <ol className="flex flex-col">
    {/* …既有的 progress.stages.map(...) 內容… */}
  </ol>
</div>
```

若該檔尚未 import `cn`，補上：

```ts
import { cn } from '../../lib/utils'
```

- [ ] **Step 3: 驗證**

```bash
pnpm build
npx wrangler pages dev out --port 8788
```

1440px 寬開 `/path`：確認左欄索引釘住不動、右欄可捲、點索引會跳到對應站點。375px 寬確認左欄整個消失（`hidden lg:block`）、版面與改動前一致。

- [ ] **Step 4: Commit**

```bash
git add src/app/path/page.tsx
git commit -m "feat(path): 桌機改為索引加內容兩欄"
```

---

### Task 8: `/profile` 桌機兩欄與開關觸控區

**Files:**
- Modify: `src/app/profile/page.tsx`

- [ ] **Step 1: 設定區塊兩欄**

把各設定 section 的外層容器改成：

```tsx
<div className="space-y-3 lg:grid lg:grid-cols-2 lg:gap-4 lg:space-y-0 lg:items-start">
```

- [ ] **Step 2: 開關的可點區撐到 44 高**

實測開關本身是 44×24。**保持視覺尺寸不變**（那是設計檔的樣子），只把外層 `<label>` 的可點高度撐到 44：把包住開關的 label 加上 `flex min-h-11 items-center`。

用 grep 定位所有開關：

```bash
grep -n "每日提醒\|連續天數保護\|每週成績報告" src/app/profile/page.tsx
```

- [ ] **Step 3: 驗證**

```bash
pnpm build
npx wrangler pages dev out --port 8788
```

1440px 確認設定分兩欄；375px 確認回到單欄，且三個開關的可點範圍上下各比開關本身大一些（用瀏覽器 DevTools 檢視 label 的高度應為 44）。

- [ ] **Step 4: Commit**

```bash
git add src/app/profile/page.tsx
git commit -m "feat(profile): 桌機兩欄設定並把開關可點區撐到 44px"
```

---

### Task 9: 錯題本與單字複習本——預設頁籤、分頁、桌機多欄、返回鍵

實測：`/wrong-questions` 92 筆全量渲染（手機 12533px、桌機 10868px）、`/vocab-review` 140 筆（18266px／16889px），兩頁桌機仍單欄，返回鍵 36×36。

**Files:**
- Modify: `src/app/vocab-review/page.tsx`（56 行 `useState<string>(ALL)`、返回鍵 293 行附近、清單渲染）
- Modify: `src/app/wrong-questions/page.tsx`（59 行 `useState<string>(ALL)`、返回鍵、160 行 `visible.map`）
- Test: `tests/list-paging.test.ts`（新檔）

**Interfaces:**
- Produces: `src/lib/paging.ts` 匯出 `PAGE_SIZE = 20` 與 `takePage(items, page)`

- [ ] **Step 1: 寫失敗的測試**

建立 `tests/list-paging.test.ts`：

```ts
import { describe, it, expect } from 'vitest'
import { PAGE_SIZE, takePage } from '../src/lib/paging'

describe('takePage', () => {
  const items = Array.from({ length: 95 }, (_, i) => i)

  it('第 1 頁給前 20 筆', () => {
    expect(takePage(items, 1)).toHaveLength(20)
    expect(takePage(items, 1)[0]).toBe(0)
  })

  it('第 3 頁給前 60 筆——是累積顯示，不是換頁', () => {
    expect(takePage(items, 3)).toHaveLength(60)
  })

  it('頁數超過總量時給全部，不會爆', () => {
    expect(takePage(items, 99)).toHaveLength(95)
  })

  it('空清單回空陣列', () => {
    expect(takePage([], 1)).toEqual([])
  })

  it('PAGE_SIZE 是 20', () => {
    expect(PAGE_SIZE).toBe(20)
  })
})
```

- [ ] **Step 2: 執行測試確認失敗**

```bash
pnpm vitest run tests/list-paging.test.ts
```

Expected: FAIL — `Failed to resolve import "../src/lib/paging"`

- [ ] **Step 3: 寫最小實作**

建立 `src/lib/paging.ts`：

```ts
/**
 * 錯題本與單字複習本的漸進顯示。
 *
 * 用累積顯示而不是虛擬捲動：虛擬捲動會破壞瀏覽器 Ctrl-F 與錨點定位，
 * 而且回收時的閃爍很難壓在 DESIGN-PROMPT 的 300ms 動效上限內。
 */
export const PAGE_SIZE = 20

export function takePage<T>(items: T[], page: number): T[] {
  return items.slice(0, page * PAGE_SIZE)
}
```

- [ ] **Step 4: 執行測試確認通過**

```bash
pnpm vitest run tests/list-paging.test.ts
```

Expected: PASS，5 個測試全綠

- [ ] **Step 5: 單字複習本預設頁籤改「待複習」**

`src/app/vocab-review/page.tsx:56`：實測「全部」是 140 筆、「待複習」是 77 筆，換預設值直接砍掉 45% 頁高。

```ts
// 預設落在「待複習」而不是「全部」：全部有 140 筆、頁高 18000px 以上，
// 而使用者打開這一頁的目的九成是「今天該複習哪些」。
const [filter, setFilter] = useState<string>(DUE)
```

`DUE` 用該檔已有的「待複習」常數（與 142 行 `label="全部"` 那一組頁籤同源）；若尚未抽成常數，先比照 `ALL` 抽一個。

- [ ] **Step 6: 兩頁接上分頁與桌機多欄**

兩頁做法相同。以 `src/app/wrong-questions/page.tsx` 為例：

```ts
import { PAGE_SIZE, takePage } from '../../lib/paging'
```

```ts
const [page, setPage] = useState(1)
// 換篩選條件要回到第 1 頁，否則從 92 筆的分類切到 3 筆的分類會看到空白。
useEffect(() => { setPage(1) }, [filter])
```

把 160 行的 `visible.map(...)` 改成 `takePage(visible, page).map(...)`，並在清單後面加：

```tsx
{takePage(visible, page).length < visible.length && (
  <button
    type="button"
    onClick={() => setPage((p) => p + 1)}
    className="min-h-11 w-full rounded-2xl border border-[var(--ln)] text-xs font-semibold text-[var(--mu)] hover:bg-[var(--sf2)]"
  >
    顯示更多（還有 {visible.length - takePage(visible, page).length} 筆）
  </button>
)}
```

清單容器加桌機多欄。單字複習本：

```tsx
<div className="space-y-2.5 md:grid md:grid-cols-2 md:gap-3 md:space-y-0 xl:grid-cols-3">
```

錯題本：

```tsx
<div className="space-y-2.5 md:grid md:grid-cols-2 md:gap-3 md:space-y-0">
```

`src/app/vocab-review/page.tsx` 重複同樣四步（import、`page` state、`useEffect` 重設、`takePage` ＋ 顯示更多按鈕）。

- [ ] **Step 7: 返回鍵放大到 44×44**

兩頁的返回鍵實測 36×36。把 `h-9 w-9` 改成 `h-11 w-11`（44px），並確認 `aria-label` 保留：

```bash
grep -n "返回練習中心" src/app/wrong-questions/page.tsx src/app/vocab-review/page.tsx
```

章節詳情頁的返回鍵（`ChapterDetailClient.tsx:113`）同樣處理。

- [ ] **Step 8: 驗證**

```bash
pnpm test
pnpm build
npx wrangler pages dev out --port 8788
```

375px 開 `/vocab-review`：確認預設頁籤是「待複習」、只顯示 20 筆、有「顯示更多」按鈕、按下去多出 20 筆。切到「全部」確認回到第 1 頁。1440px 確認單字卡三欄、錯題兩欄。用 DevTools 量返回鍵應為 44×44。

- [ ] **Step 9: Commit**

```bash
git add src/lib/paging.ts tests/list-paging.test.ts src/app/vocab-review/page.tsx src/app/wrong-questions/page.tsx "src/app/chapters/[...id]/ChapterDetailClient.tsx"
git commit -m "feat(lists): 錯題本與單字複習本加上漸進顯示、桌機多欄與 44px 返回鍵"
```

---

### Task 10: 首頁練習日曆的格子尺寸

實測：首頁 8 欄、容器 286px、格子固定 13px，**只用掉 51% 的可用寬度**。`/stats` 是 14 欄、佔用 91%，已無空間，維持不動。

**Files:**
- Modify: `src/components/PracticeCalendar.tsx`（`PracticeCalendarProps` 於 5 行、元件簽章 48 行、格子與軸標籤 128–152 行）
- Modify: `src/app/page.tsx:352`

- [ ] **Step 1: 加 `cellSize` prop**

`src/components/PracticeCalendar.tsx` 的 props（5 行）加一欄：

```ts
interface PracticeCalendarProps {
  days: CalendarDay[]
  /**
   * 熱區格邊長。首頁只放 42 天（8 欄），286px 的容器裡 13px 只用掉一半寬度，
   * 所以放大到 22px；/stats 放 84 天（14 欄），13px 已經佔掉 91%，沒有空間。
   * 44px 的觸控標準在這裡物理上做不到：42 格 × 44px = 1848px，放不進 375px 的螢幕。
   */
  cellSize?: 13 | 22
}
```

- [ ] **Step 2: 讓格子、佔位與軸標籤吃同一個尺寸**

元件簽章（48 行）改成 `({ days, cellSize = 13 })`，並在元件內算出樣式：

```ts
const cell = { height: `${cellSize}px`, width: `${cellSize}px` }
const labelStyle = { height: `${cellSize}px` }
```

三處套用（把原本寫死的 `h-[13px] w-[13px]` 換掉）：

- 軸標籤（130 行）：`className="flex items-center text-[9px] leading-none text-[var(--mu)]"` ＋ `style={labelStyle}`
- 空白佔位（140 行）：`<span key={di} style={cell} />`
- 熱區格（146 行起）：把 className 裡的 `h-[13px] w-[13px]` 拿掉，改為 `style={{ ...style, ...cell }}`（`style` 是既有的 `LEVEL_STYLE` 顏色）

- [ ] **Step 3: 首頁改用大格子**

`src/app/page.tsx:352`：

```tsx
<PracticeCalendar days={snap.calendar.slice(-42)} cellSize={22} />
```

`src/app/stats/page.tsx:348` **不動**，維持預設 13。

- [ ] **Step 4: 驗證**

```bash
pnpm build
npx wrangler pages dev out --port 8788
```

375px 與 320px 各看一次首頁：格子明顯變大、整條熱力圖不超出卡片、軸標籤仍與格子行對齊。開 `/stats` 確認 84 天的熱力圖外觀完全沒變。點一格確認 tooltip 仍正常出現。

- [ ] **Step 5: Commit**

```bash
git add src/components/PracticeCalendar.tsx src/app/page.tsx
git commit -m "feat(calendar): 首頁熱力圖格子放大到 22px"
```

---

### Task 11: 保留可重跑的版型量測

spec 記錄的數字要能在改動後重驗。這支腳本**不引進任何相依套件**——它是貼進瀏覽器 console 的片段，因為量測必須在真的排版引擎裡做。

**Files:**
- Create: `scripts/audit-layout.js`

- [ ] **Step 1: 建立量測片段**

建立 `scripts/audit-layout.js`，開頭寫明用法：

```js
/**
 * 版型量測片段——不是 node 腳本，是貼進瀏覽器 console 的東西。
 *
 * 用法：
 *   1. pnpm build && npx wrangler pages dev out --port 8788
 *   2. 瀏覽器開 http://localhost:8788 並登入
 *   3. 把整份檔案貼進 console，然後執行：
 *        await __audit(375, 812)      // 單一寬度
 *        await __audit(1440, 900)
 *
 * 為什麼用 iframe：iframe 自身的寬度就是 media query 的依據，所以一頁就能把
 * 14 條路由 × 多個寬度全部量完，不必逐頁重載、也不必動瀏覽器視窗。
 *
 * 已知限制：iframe 裡 env(safe-area-inset-bottom) 恆為 0、dvh 是靜態值，
 * 所以真機的瀏海與網址列收合行為**量不到**，那部分只能實機確認。
 */
```

接在上述註解之後的完整內容：

```js
window.__auditRoutes = [
  '/', '/practice', '/chapters', '/path', '/wrong-questions', '/vocab-review',
  '/stats', '/profile', '/practice/grammar', '/practice/vocab',
  '/practice/formulas', '/practice/reading', '/practice/mock',
  '/chapters/grammar/01_八大詞性與句型結構/01_名詞與代名詞',
]

function sel(e) {
  const raw = e.className
  const cls = String(raw && raw.baseVal !== undefined ? raw.baseVal : raw || '')
  return e.tagName.toLowerCase() + (cls ? '.' + cls.trim().split(/\s+/).slice(0, 6).join('.') : '')
}

function probe(win, doc) {
  const de = doc.documentElement
  const vw = win.innerWidth

  // 真的伸出視窗右緣的元素。注意：放在 overflow-x:auto 容器裡的表格也會被抓到，
  // 那是可捲的、不是缺陷——判讀前要往上追祖先的 overflowX。
  const wide = []
  for (const e of doc.querySelectorAll('body *')) {
    const r = e.getBoundingClientRect()
    if (r.width > 0 && r.right > vw + 1) wide.push(sel(e) + ' →' + Math.round(r.right))
    if (wide.length >= 10) break
  }

  // 觸控目標偏小。同樣要人工判讀：16×16 的 input 若包在 44×44 的 label 裡就是達標的。
  const small = new Set()
  for (const e of doc.querySelectorAll('a,button,[role="button"],input,select,textarea')) {
    const r = e.getBoundingClientRect()
    if (r.height === 0 || r.width === 0) continue
    if (r.height < 40 || r.width < 24) {
      const label = (e.getAttribute('aria-label') || e.textContent || e.tagName)
        .trim().replace(/\s+/g, ' ').slice(0, 16)
      small.add(label + ' ' + Math.round(r.width) + '×' + Math.round(r.height))
    }
    if (small.size >= 10) break
  }

  const main = doc.querySelector('main')
  const mainR = main ? main.getBoundingClientRect() : null
  const topNav = doc.querySelector('header[data-chrome="nav"]')
  const botNav = doc.querySelector('nav[data-chrome="nav"]')

  return {
    overflow: de.scrollWidth - de.clientWidth,
    mainW: mainR ? Math.round(mainR.width) : null,
    gutter: mainR ? Math.round(vw - mainR.width) : null,
    pageH: Math.round(de.scrollHeight),
    topNavH: topNav ? Math.round(topNav.getBoundingClientRect().height) : 0,
    botNavH: botNav ? Math.round(botNav.getBoundingClientRect().height) : 0,
    navHVar: getComputedStyle(de).getPropertyValue('--nav-h').trim(),
    wide,
    small: [...small],
  }
}

window.__audit = async function (width, height, routes) {
  routes = routes || window.__auditRoutes
  const host = document.createElement('div')
  host.style.cssText = 'position:fixed;left:-99999px;top:0;'
  document.body.appendChild(host)
  const out = {}

  for (const route of routes) {
    const f = document.createElement('iframe')
    f.style.cssText = `width:${width}px;height:${height}px;border:0;`
    host.appendChild(f)
    try {
      await new Promise((res, rej) => {
        const t = setTimeout(() => rej(new Error('timeout')), 15000)
        f.onload = () => { clearTimeout(t); res() }
        f.src = route
      })
      // 等 hydration：等到 main 有子節點，最多 1.5 秒
      const t0 = Date.now()
      while (Date.now() - t0 < 1500) {
        const m = f.contentDocument && f.contentDocument.querySelector('main')
        if (m && m.children.length > 0) break
        await new Promise((r) => setTimeout(r, 100))
      }
      await new Promise((r) => setTimeout(r, 350))
      out[route] = probe(f.contentWindow, f.contentDocument)
    } catch (e) {
      out[route] = { error: String((e && e.message) || e) }
    }
    f.remove()
  }
  host.remove()
  return out
}
```

- [ ] **Step 2: 對照 spec 的基準數字**

跑 `await __audit(1023, 800)` 與 `await __audit(1440, 900)`，與 spec 記錄的數字比對，確認：

- `/` 在 1023 的 `gutter` 已從 351 降到約 64
- `/path`、`/profile`、`/vocab-review` 的「1440 頁高 ÷ 375 頁高」比值已明顯低於改動前的 0.95／0.97／0.92
- 所有路由的 `overflow` 仍為 0

- [ ] **Step 3: Commit**

```bash
git add scripts/audit-layout.js
git commit -m "chore: 保留版型量測片段供改動後重驗"
```

---

## 完成後

跑一次完整驗證：

```bash
pnpm test
```

```bash
pnpm build
```

然後用 `npx wrangler pages dev out --port 8788` 走一遍 Task 5 Step 6 的那張跳轉對照表，以及 Task 6／9／10 的視覺確認。

**實機未驗證項目**（自動化測不到，需要真手機）：`env(safe-area-inset-bottom)` 下底部導航的實際高度、網址列收合時 `dvh` 的變化。
