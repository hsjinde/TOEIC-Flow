# 文法章節完成判定改版 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把文法章節的「已完成」判定從「答完全部題目 + 累積正確率 ≥80%」改成「練這章單一回合正確率 ≥80% 即完成，一旦達標永久保留」。

**Architecture:** 新增一個獨立的「章節達標記錄」（chapterId → 首次達標時間戳），localStorage 為主、fire-and-forget 同步一張新 D1 表；練習頁在「練這章」回合結束時寫入，章節列表／詳情頁改讀這份記錄決定徽章，原本的 `ChapterMastery`/`accuracyRate` 保留但降級為純資訊性質的累積正確率顯示。

**Tech Stack:** Next.js App Router（static export）、TypeScript、localStorage、Cloudflare Pages Functions、D1、Vitest。

## Global Constraints

- 所有 UI 字串（含 API 錯誤訊息）一律繁體中文。
- 單一 accent color（blue/indigo）；green/red 只保留給答題對錯反饋，完成徽章維持現有主色風格，不新增慶祝視覺或動畫。
- localStorage 是寫入的第一入口：先寫本機，再 `fetch('/api/user/action', ...).catch(() => {})` 同步 D1，同步失敗不可擋住 UI 或拋出例外。
- 任何本機新寫入的欄位都要在 `/api/user/action` 有對應 action、並在 `/api/user/data` 一併回傳，否則下次 `syncUserDataFromD1()` 會把它洗掉（見 [storage.ts](../../../src/lib/storage.ts) 的既有慣例）。
- D1 schema 異動一律走新的 migration 檔，不可改動已存在的 migration；新表用 `CREATE TABLE IF NOT EXISTS`。
- `syncUserDataFromD1()` 對「一旦達標永久保留」這類欄位必須是**合併**（本機 ∪ 遠端），不能整段覆蓋，否則會把某一端已經達標的記錄洗掉。

---

### Task 1: storage.ts — 章節達標記錄的基礎函式

**Files:**
- Modify: `src/lib/storage.ts:52`（新增 storage key 常數）、`src/lib/storage.ts:769-777`（`isChapterCompleted` 之後新增三個函式，`isChapterCompleted` 本身暫時保留，避免中途弄壞現有呼叫端）
- Test: `tests/storage-queries.test.ts`

**Interfaces:**
- Produces: `getChapterAchievements(): Record<string, number>`、`isChapterAchieved(chapterId: string, achievements?: Record<string, number>): boolean`、`recordChapterPracticeRound(chapterId: string, correctCount: number, totalCount: number): void`

- [ ] **Step 1: 寫失敗測試**

在 `tests/storage-queries.test.ts` 的 import 清單（第 2-24 行）裡加入三個新函式：

```ts
import {
  DEFAULT_PROFILE,
  MAX_VOCAB_LEVEL,
  bumpVocabMastery,
  fileWrongQuestions,
  getChapterAchievements,
  getChapterMasteryMap,
  getPracticeCalendar,
  getPracticedDayCount,
  getProfile,
  getQuestionHistory,
  getSrsIntervalLabel,
  getWrongQuestionList,
  getWrongQuestionsMap,
  isChapterAchieved,
  recordChapterPracticeRound,
  recordQuestionAnswer,
  removeWrongQuestions,
  saveMockResult,
  getMockResults,
  saveProfile,
  getDeduplicatedAnswerHistory,
  getCategoryStats,
  getVocabStats,
  getAnswerHistory,
} from '../src/lib/storage'
```

在檔案最後（第 326 行之後、檔尾）新增：

```ts

describe('chapter achievements', () => {
  beforeEach(() => localStorage.clear())

  it('marks a chapter achieved when a round scores 80% or higher', () => {
    expect(isChapterAchieved(CHAPTER)).toBe(false)
    recordChapterPracticeRound(CHAPTER, 4, 5) // 80%
    expect(isChapterAchieved(CHAPTER)).toBe(true)
  })

  it('does not mark a chapter achieved when a round scores below 80%', () => {
    recordChapterPracticeRound(CHAPTER, 3, 5) // 60%
    expect(isChapterAchieved(CHAPTER)).toBe(false)
  })

  it('keeps the achievement after a later round scores below 80%', () => {
    recordChapterPracticeRound(CHAPTER, 5, 5) // 100%
    expect(isChapterAchieved(CHAPTER)).toBe(true)

    recordChapterPracticeRound(CHAPTER, 1, 5) // 20%
    expect(isChapterAchieved(CHAPTER)).toBe(true)
  })

  it('ignores rounds with no questions', () => {
    recordChapterPracticeRound(CHAPTER, 0, 0)
    expect(isChapterAchieved(CHAPTER)).toBe(false)
  })

  it('returns an empty map when nothing has been achieved yet', () => {
    expect(getChapterAchievements()).toEqual({})
  })
})
```

- [ ] **Step 2: 執行測試確認失敗**

Run: `pnpm vitest run tests/storage-queries.test.ts -t "chapter achievements"`
Expected: FAIL — `getChapterAchievements`/`isChapterAchieved`/`recordChapterPracticeRound` is not exported by `../src/lib/storage`

- [ ] **Step 3: 實作**

在 `src/lib/storage.ts:52`（`STORAGE_KEY_MOCK` 那一行）之後新增：

```ts
const STORAGE_KEY_CHAPTER_ACHIEVEMENTS = 'toeic_chapter_achievements'
```

在 `src/lib/storage.ts` 的 `isChapterCompleted`（第 769-777 行）之後新增：

```ts
/** chapterId -> 首次達標的時間戳（epoch ms）。 */
export function getChapterAchievements(): Record<string, number> {
  if (typeof window === 'undefined') return {}
  const raw = localStorage.getItem(STORAGE_KEY_CHAPTER_ACHIEVEMENTS)
  if (!raw) return {}
  try {
    return JSON.parse(raw)
  } catch {
    return {}
  }
}

export function isChapterAchieved(
  chapterId: string,
  achievements?: Record<string, number>
): boolean {
  const map = achievements ?? getChapterAchievements()
  return !!map[chapterId]
}

/**
 * 練這章回合結束時呼叫。單輪正確率 ≥80% 才標記達標；一旦達標就永久保留，
 * 之後就算某輪正確率掉到 80% 以下也不會被收回或重算時間戳。
 */
export function recordChapterPracticeRound(
  chapterId: string,
  correctCount: number,
  totalCount: number
): void {
  if (typeof window === 'undefined' || totalCount <= 0) return
  if (isChapterAchieved(chapterId)) return

  const accuracy = Math.round((correctCount / totalCount) * 100)
  if (accuracy < 80) return

  const map = getChapterAchievements()
  map[chapterId] = Date.now()
  localStorage.setItem(STORAGE_KEY_CHAPTER_ACHIEVEMENTS, JSON.stringify(map))
  notifyStorageUpdate()

  fetch('/api/user/action', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'chapter_achievement',
      payload: { chapterId },
    }),
  }).catch(() => {})
}
```

- [ ] **Step 4: 執行測試確認通過**

Run: `pnpm vitest run tests/storage-queries.test.ts -t "chapter achievements"`
Expected: PASS（5 個 test case）

- [ ] **Step 5: Commit**

```bash
git add src/lib/storage.ts tests/storage-queries.test.ts
git commit -m "feat(storage): 新增章節達標記錄（單輪正確率 ≥80% 永久保留）"
```

---

### Task 2: storage.ts — syncUserDataFromD1 合併章節達標記錄

**Files:**
- Modify: `src/lib/storage.ts:966-996`（`syncUserDataFromD1` 的第 5 步之後）
- Test: `tests/storage.test.ts`

**Interfaces:**
- Consumes: Task 1 的 `getChapterAchievements()`（型別 `Record<string, number>`）、既有的 `parseDbTimestamp(value: unknown): number`
- Produces: `syncUserDataFromD1()` 內部行為擴充，不新增對外符號

- [ ] **Step 1: 寫失敗測試**

在 `tests/storage.test.ts` 的 `describe('storage controller', ...)` 區塊最後一個 `it`（第 147-174 行）之後新增：

```ts

  it('merges chapter achievements from D1 instead of overwriting local ones', async () => {
    const { syncUserDataFromD1, getChapterAchievements, recordChapterPracticeRound } = await import('../src/lib/storage')

    globalThis.fetch = (async (url: string) => {
      if (url === '/api/user/data') {
        return {
          ok: true,
          json: async () => ({
            stats: { streak_days: 1 },
            answerHistory: [],
            vocabMastery: [],
            wrongQuestions: [],
            chapterAchievements: [
              { chapter_id: 'grammar/remote-only', achieved_at: '2026-01-01 00:00:00' },
            ],
          }),
        } as any
      }
      return { ok: true, json: async () => ({}) } as any
    }) as any

    // 本機已經有一個達標記錄，D1 的回應完全不知道它（例如卡在離線同步之間）。
    recordChapterPracticeRound('grammar/local-only', 5, 5)
    const localAchievedAt = getChapterAchievements()['grammar/local-only']
    expect(localAchievedAt).toBeGreaterThan(0)

    await syncUserDataFromD1()

    const merged = getChapterAchievements()
    expect(merged['grammar/local-only']).toBe(localAchievedAt)
    expect(merged['grammar/remote-only']).toBeGreaterThan(0)
  })
```

- [ ] **Step 2: 執行測試確認失敗**

Run: `pnpm vitest run tests/storage.test.ts -t "merges chapter achievements"`
Expected: FAIL — `merged['grammar/remote-only']` is `undefined`（`syncUserDataFromD1` 還沒處理 `chapterAchievements`）

- [ ] **Step 3: 實作**

在 `src/lib/storage.ts` 的 `syncUserDataFromD1` 內，「5. Sync Daily Progress / Stats」區塊結尾（第 992 行 `notifyStorageUpdate()` 之後、第 993 行 `} catch (e) {` 之前）新增：

```ts

    // 6. Sync Chapter Achievements（合併，不是覆蓋——任何一端已達標的都要保留）
    if (Array.isArray(data.chapterAchievements)) {
      const merged = getChapterAchievements()
      for (const item of data.chapterAchievements) {
        const remote = parseDbTimestamp(item.achieved_at) || Date.now()
        merged[item.chapter_id] = merged[item.chapter_id]
          ? Math.min(merged[item.chapter_id], remote)
          : remote
      }
      localStorage.setItem(STORAGE_KEY_CHAPTER_ACHIEVEMENTS, JSON.stringify(merged))
    }
```

- [ ] **Step 4: 執行測試確認通過**

Run: `pnpm vitest run tests/storage.test.ts`
Expected: PASS（全部既有 + 新增 test case）

- [ ] **Step 5: Commit**

```bash
git add src/lib/storage.ts tests/storage.test.ts
git commit -m "feat(storage): syncUserDataFromD1 合併章節達標記錄而非覆蓋"
```

---

### Task 3: D1 migration + 後端 action / data endpoint

**Files:**
- Create: `migrations/0005_chapter_achievements.sql`
- Modify: `functions/api/user/action.ts:198-221`（`update_stats` 之後、`Unknown action` 之前）
- Modify: `functions/api/user/data.ts:40-53`
- Modify: `tests/functions-api.test.ts`

**Interfaces:**
- Consumes: Task 1/2 產生的 client 端 `chapter_achievement` action payload 形狀 `{ chapterId: string }`，以及 `syncUserDataFromD1` 預期的 `data.chapterAchievements: { chapter_id: string, achieved_at: string }[]`
- Produces: `POST /api/user/action` 的 `chapter_achievement` action；`GET /api/user/data` 回應新增 `chapterAchievements` 欄位

- [ ] **Step 1: 寫失敗測試**

在 `tests/functions-api.test.ts` 的 `createMockD1()`（第 11-94 行）擴充：

在第 16 行 `const historyTable: any[] = []` 之後新增一個 table：

```ts
  const chapterAchievementsTable = new Map<string, any>()
```

原本第 68-72 行是：

```ts
          } else if (query.includes('INSERT INTO user_answer_history')) {
            const [id, user_id, question_id, category_id, is_correct] = bindings
            historyTable.push({ id, user_id, question_id, category_id, is_correct, created_at: new Date().toISOString() })
          }
          return { success: true }
```

改成（在 `user_answer_history` 分支和 `return { success: true }` 之間插入新分支，注意要補上這個分支自己的收尾 `}`）：

```ts
          } else if (query.includes('INSERT INTO user_answer_history')) {
            const [id, user_id, question_id, category_id, is_correct] = bindings
            historyTable.push({ id, user_id, question_id, category_id, is_correct, created_at: new Date().toISOString() })
          } else if (query.includes('INSERT INTO user_chapter_achievements')) {
            const [user_id, chapter_id] = bindings
            const key = `${user_id}:${chapter_id}`
            // ON CONFLICT DO NOTHING：已存在就不覆寫，保留最早的達標時間。
            if (!chapterAchievementsTable.has(key)) {
              chapterAchievementsTable.set(key, { user_id, chapter_id, achieved_at: new Date().toISOString() })
            }
          }
          return { success: true }
```

在 `all()` 內、`user_answer_history` 分支（第 84-87 行）之後新增：

```ts
          if (query.includes('user_chapter_achievements')) {
            const results = Array.from(chapterAchievementsTable.values()).filter(r => r.user_id === userId)
            return { results }
          }
```

在檔案最後一個 `describe('Cloudflare Pages Functions Auth & User API', ...)` 區塊裡，`it('never files a question...')`（第 189-218 行）之後新增：

```ts

  it('records a chapter achievement once and keeps the earliest timestamp on repeat calls', async () => {
    const regReq = new Request('http://localhost/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'achieve@example.com', password: 'password123', nickname: 'Achiever' }),
    })
    const regRes = await registerHandler({ request: regReq, env })
    const cookieValue = regRes.headers.get('Set-Cookie')?.match(/toeic_session=([^;]+)/)?.[1] || ''

    const actionReq1 = new Request('http://localhost/api/user/action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: `toeic_session=${cookieValue}` },
      body: JSON.stringify({ action: 'chapter_achievement', payload: { chapterId: 'grammar/01_x/01_y' } }),
    })
    const actionRes1 = await userActionHandler({ request: actionReq1, env })
    expect(actionRes1.status).toBe(200)

    // 重複呼叫（例如離線後補同步）不該產生第二筆記錄。
    const actionReq2 = new Request('http://localhost/api/user/action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: `toeic_session=${cookieValue}` },
      body: JSON.stringify({ action: 'chapter_achievement', payload: { chapterId: 'grammar/01_x/01_y' } }),
    })
    const actionRes2 = await userActionHandler({ request: actionReq2, env })
    expect(actionRes2.status).toBe(200)

    const dataReq = new Request('http://localhost/api/user/data', {
      headers: { Cookie: `toeic_session=${cookieValue}` },
    })
    const dataRes = await userDataHandler({ request: dataReq, env })
    const data = await dataRes.json()
    expect(data.chapterAchievements).toHaveLength(1)
    expect(data.chapterAchievements[0].chapter_id).toBe('grammar/01_x/01_y')
  })
```

- [ ] **Step 2: 執行測試確認失敗**

Run: `pnpm vitest run tests/functions-api.test.ts -t "records a chapter achievement"`
Expected: FAIL — `actionRes1.status` 是 400（`Unknown action: chapter_achievement`）

- [ ] **Step 3: 實作 migration**

建立 `migrations/0005_chapter_achievements.sql`：

```sql
-- 章節達標記錄（練這章單輪正確率 ≥80% 即達標，永久保留最早的達標時間）。

CREATE TABLE IF NOT EXISTS user_chapter_achievements (
  user_id TEXT NOT NULL,
  chapter_id TEXT NOT NULL,
  achieved_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, chapter_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
```

- [ ] **Step 4: 實作 action.ts**

在 `functions/api/user/action.ts`，`update_stats` 分支（第 198-220 行）之後、第 222 行的 `return new Response(JSON.stringify({ error: \`Unknown action...` 之前新增：

```ts
    if (act === 'chapter_achievement') {
      const chapterId = data.chapter_id || data.chapterId

      if (!chapterId) {
        return new Response(JSON.stringify({ error: 'Missing chapter_id' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        })
      }

      // ON CONFLICT DO NOTHING：一旦達標就永久保留最早的達標時間，重複呼叫不會覆寫。
      await db
        .prepare(
          `INSERT INTO user_chapter_achievements (user_id, chapter_id, achieved_at)
           VALUES (?, ?, CURRENT_TIMESTAMP)
           ON CONFLICT(user_id, chapter_id) DO NOTHING`
        )
        .bind(userId, chapterId)
        .run()

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }

```

- [ ] **Step 5: 實作 data.ts**

在 `functions/api/user/data.ts:40-43` 的查詢區塊加一行（放在 `historyRows` 之後）：

```ts
  const chapterAchievementRows = await db.prepare('SELECT chapter_id, achieved_at FROM user_chapter_achievements WHERE user_id = ?').bind(userId).all()
```

並在第 46-51 行的回應物件加上欄位：

```ts
  return new Response(
    JSON.stringify({
      vocabMastery: vocabRows.results || [],
      wrongQuestions: wrongRows.results || [],
      answerHistory: historyRows.results || [],
      chapterAchievements: chapterAchievementRows.results || [],
      stats: stats || { streak_days: 1, estimated_score: 450 },
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  )
```

- [ ] **Step 6: 執行測試確認通過**

Run: `pnpm vitest run tests/functions-api.test.ts`
Expected: PASS（全部既有 + 新增 test case）

- [ ] **Step 7: Commit**

```bash
git add migrations/0005_chapter_achievements.sql functions/api/user/action.ts functions/api/user/data.ts tests/functions-api.test.ts
git commit -m "feat(backend): 新增 user_chapter_achievements 表與 chapter_achievement action"
```

---

### Task 4: 練習頁在「練這章」回合結束時記錄達標

**Files:**
- Modify: `src/app/practice/grammar/page.tsx`

**Interfaces:**
- Consumes: Task 1 的 `recordChapterPracticeRound(chapterId: string, correctCount: number, totalCount: number): void`

- [ ] **Step 1: 修改 import**

在 `src/app/practice/grammar/page.tsx:16-21` 的 import 加入 `recordChapterPracticeRound`：

```ts
import {
  getWrongQuestionsMap,
  recordChapterPracticeRound,
  recordQuestionAnswer,
  recordTaskCompletion,
  type AnswerSource,
} from '../../../lib/storage'
```

- [ ] **Step 2: Session 型別與 buildSession 帶入 chapterId**

修改 `Session` 介面（第 30-36 行）：

```ts
interface Session {
  questions: Question[]
  source: AnswerSource
  /** 只有每日任務模式才記「今日文法已完成」 */
  countsAsDailyTask: boolean
  title: string
  /** 只有從章節頁「練這章」進入的專屬回合才有值，用來判定章節達標。 */
  chapterId?: string
}
```

修改 `buildSession` 的 `chapter` 分支（第 48-57 行）：

```ts
  if (chapter) {
    const pool = getGrammarQuestionsByChapter(chapter)
    return {
      questions: [...pool].sort(() => 0.5 - Math.random()).slice(0, DEFAULT_COUNT),
      source: 'grammar',
      countsAsDailyTask: false,
      // 副標已經是章名，標題再放一次會變成同一行講兩遍。
      title: '章節練習',
      chapterId: chapter,
    }
  }
```

- [ ] **Step 3: handleNext 在回合結束時呼叫 recordChapterPracticeRound**

修改 `handleNext`（第 114-124 行）：

```ts
  const handleNext = useCallback(() => {
    setJustFiled(false)
    if (currentIndex + 1 < questions.length) {
      setCurrentIndex((prev) => prev + 1)
      setSelectedAnswers({})
      setShowExplanation(false)
    } else {
      if (session?.countsAsDailyTask) recordTaskCompletion('grammar')
      if (session?.chapterId) {
        const correctInRound = results.filter(Boolean).length
        recordChapterPracticeRound(session.chapterId, correctInRound, questions.length)
      }
      setIsFinished(true)
    }
  }, [currentIndex, questions.length, session, results])
```

（`results` 用來算這輪正確題數，因為每次建立新 session 時 `results` 都會被 `setResults(new Array(...).fill(null))` 重設，不會有跨回合殘留值的風險；也因此把 `results` 加進依賴陣列。）

- [ ] **Step 4: Type check**

Run: `pnpm build`
Expected: 成功（`tsconfig.json` 是 `strict` + `noUncheckedIndexedAccess`，這一步順便確認沒有型別錯誤）

- [ ] **Step 5: Commit**

```bash
git add src/app/practice/grammar/page.tsx
git commit -m "feat(practice): 練這章回合結束時記錄章節達標"
```

---

### Task 5: 章節列表頁改讀達標記錄

**Files:**
- Modify: `src/app/chapters/page.tsx`

**Interfaces:**
- Consumes: Task 1 的 `getChapterAchievements(): Record<string, number>`、`isChapterAchieved(chapterId: string, achievements?: Record<string, number>): boolean`

- [ ] **Step 1: 修改 import**

第 13-17 行：

```ts
import {
  getChapterAchievements,
  getChapterMasteryMap,
  isChapterAchieved,
  type ChapterMastery,
} from '../../lib/storage'
```

- [ ] **Step 2: categoryCompletion 改用 achievements**

第 24-49 行整段改成：

```ts
/** 分類完成率＝該類中單輪正確率達標（≥80%）過的小章節數 / 該類總章節數。 */
function categoryCompletion(
  category: CategoryMeta,
  masteryMap: Record<string, ChapterMastery>,
  achievements: Record<string, number>
): { rate: number | null; completedCount: number; hasPracticed: boolean } {
  let completedCount = 0
  let hasPracticed = false

  for (const ch of category.chapters) {
    const m = masteryMap[ch.id]
    if (m && (m.uniqueAnsweredCount ?? 0) > 0) {
      hasPracticed = true
    }
    if (isChapterAchieved(ch.id, achievements)) {
      completedCount += 1
    }
  }

  const total = category.chapters.length
  return {
    rate: hasPracticed && total > 0 ? Math.round((completedCount / total) * 100) : null,
    completedCount,
    hasPracticed,
  }
}
```

- [ ] **Step 3: 元件內新增 achievements state 並套用**

修改元件開頭（第 51-62 行）：

```ts
export default function ChaptersPage() {
  const [categories, setCategories] = useState<CategoryMeta[] | null>(null)
  const [mastery, setMastery] = useState<Record<string, ChapterMastery>>({})
  const [achievements, setAchievements] = useState<Record<string, number>>({})
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  useEffect(() => {
    const cats = getCategories()
    setCategories(cats)
    setMastery(getChapterMasteryMap())
    setAchievements(getChapterAchievements())
    // 預設展開第一類，讓兩層結構一眼看得出來。
    if (cats[0]) setExpanded(new Set([cats[0].id]))
  }, [])
```

修改整體完成率迴圈（第 70-81 行）：

```ts
  for (const cat of categories) {
    for (const ch of cat.chapters) {
      const m = mastery[ch.id]
      if (m && (m.uniqueAnsweredCount ?? 0) > 0) {
        hasAnyPracticed = true
      }
      if (isChapterAchieved(ch.id, achievements)) {
        totalCompletedChapters += 1
      }
    }
  }
```

修改 `categoryCompletion` 呼叫（第 109 行）：

```ts
          const { rate } = categoryCompletion(cat, mastery, achievements)
```

- [ ] **Step 4: 章節列表項目改用 isChapterAchieved**

第 151-155 行：

```ts
                  {cat.chapters.map((chap) => {
                    const m = mastery[chap.id]
                    const chapQCount = getGrammarQuestionsByChapter(chap.id).length
                    const uniqueDone = m?.uniqueAnsweredCount ?? 0
                    const isAchieved = isChapterAchieved(chap.id, achievements)
```

第 175-181 行的徽章（變數名跟著改）：

```ts
                              {isAchieved && (
                                // 完成是進度，用主色；綠色專屬於「這一題答對了」。
                                <CheckCircle2
                                  className="h-3.5 w-3.5 shrink-0 text-[var(--pr)]"
                                  aria-label="已完成 (練這章單輪正確率 80% 以上)"
                                />
                              )}
```

第 193-207 行右側正確率欄位（變數名跟著改）：

```ts
                          <span className="shrink-0 text-right">
                            <span
                              className={cn(
                                'block text-xs font-bold',
                                isAchieved ? 'text-[var(--pr)]' : 'text-[var(--mu)]'
                              )}
                            >
                              {m ? `${m.accuracyRate}%` : '—'}
                            </span>
                            {m && uniqueDone < chapQCount && (
                              <span className="block text-[10px] font-normal text-[var(--mu)]">
                                ({uniqueDone}/{chapQCount}題)
                              </span>
                            )}
                          </span>
```

- [ ] **Step 5: Type check**

Run: `pnpm build`
Expected: 成功

- [ ] **Step 6: Commit**

```bash
git add src/app/chapters/page.tsx
git commit -m "feat(chapters): 章節列表改用單輪達標記錄顯示完成徽章"
```

---

### Task 6: 章節詳情頁改讀達標記錄，並移除舊的 isChapterCompleted

**Files:**
- Modify: `src/app/chapters/[...id]/ChapterDetailClient.tsx`
- Modify: `src/lib/storage.ts:769-777`（移除 `isChapterCompleted`）

**Interfaces:**
- Consumes: Task 1 的 `getChapterAchievements()`、`isChapterAchieved()`

- [ ] **Step 1: 修改 import**

`src/app/chapters/[...id]/ChapterDetailClient.tsx:15-20`：

```ts
import {
  getChapterAchievements,
  getWrongQuestionList,
  isChapterAchieved,
  type ChapterMastery,
} from '../../../lib/storage'
```

- [ ] **Step 2: ChapterView 加入 achieved 欄位**

第 29-37 行：

```ts
interface ChapterView {
  chapter: Chapter
  formulas: Formula[]
  questionCount: number
  mastery: ChapterMastery | null
  achieved: boolean
  wrong: { question: Question; failCount: number; consecutiveCorrect: number }[]
  siblings: Chapter[]
  categoryTitle: string
}
```

第 66-74 行的 `setView`：

```ts
    setView({
      chapter,
      formulas: getFormulasByChapter(chapter.id),
      questionCount: chapterQuestions.length,
      mastery: getChapterMasteryMap()[chapter.id] ?? null,
      achieved: isChapterAchieved(chapter.id, getChapterAchievements()),
      wrong,
      siblings: category?.chapters ?? [],
      categoryTitle: category?.title ?? stripOrderPrefix(chapter.categoryId),
    })
```

- [ ] **Step 3: 解構與渲染區塊改用 achieved**

第 90 行：

```ts
  const { chapter, formulas, mastery, achieved, wrong, siblings, categoryTitle, questionCount } = view
```

把「本章正確率」卡片（第 163-204 行）整段改成：

```tsx
          <section className="rounded-2xl border border-[var(--ln)] bg-[var(--sf)] p-5">
            <h2 className="text-xs font-bold tracking-wider text-[var(--fa)]">本章正確率</h2>
            {mastery ? (
              <>
                <div className="flex items-baseline justify-between gap-2">
                  <p className="mt-1 text-2xl font-bold text-[var(--pr)]">
                    {mastery.accuracyRate}%
                  </p>
                  {achieved ? (
                    // 「已完成」是進度，不是答題判定——綠色在這裡會稀釋掉「答對」的反射。
                    <span className="flex items-center gap-1 rounded-full border border-[var(--pr-ln)] bg-[var(--pr-sf)] px-2 py-0.5 text-[11px] font-bold text-[var(--pr)]">
                      <CheckCircle2 className="h-3 w-3" /> 已完成 (單輪≥80%)
                    </span>
                  ) : (
                    <span className="rounded-full bg-[var(--sf2)] px-2 py-0.5 text-[11px] text-[var(--mu)]">
                      練這章單輪答對 ≥80% 即完成
                    </span>
                  )}
                </div>
                <p className="text-xs text-[var(--mu)]">
                  已答 {mastery.uniqueAnsweredCount} / {questionCount} 題 · 作答 {mastery.totalAnswered} 題對 {mastery.correctCount} 題
                </p>
                <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-[var(--sf2)]">
                  <div
                    className="h-full rounded-full bg-[var(--pr)] transition-all duration-300"
                    style={{ width: `${mastery.accuracyRate}%` }}
                  />
                </div>
              </>
            ) : (
              <p className="mt-1 text-xs text-[var(--mu)]">還沒練過這一章</p>
            )}
```

- [ ] **Step 4: 移除 storage.ts 裡的 isChapterCompleted**

確認 `src/app/chapters/page.tsx`（Task 5）與 `ChapterDetailClient.tsx`（本任務 Step 1-3）都已經不再 import `isChapterCompleted` 後，從 `src/lib/storage.ts` 刪掉：

```ts
/** 判定小章節是否完成：必須答過該章節所有的題目，且正確率 >= 80% */
export function isChapterCompleted(
  mastery: ChapterMastery | null | undefined,
  totalQuestionsInChapter: number
): boolean {
  if (!mastery || totalQuestionsInChapter <= 0) return false
  const uniqueDone = mastery.uniqueAnsweredCount ?? 0
  return uniqueDone >= totalQuestionsInChapter && mastery.accuracyRate >= 80
}
```

- [ ] **Step 5: 全文搜尋確認沒有殘留引用**

Run: `pnpm exec grep -rn "isChapterCompleted" src tests`
Expected: 沒有任何結果

- [ ] **Step 6: Type check + 全部單元測試**

Run: `pnpm build`
Expected: 成功，無型別錯誤

Run: `pnpm test`
Expected: 全部 PASS（含 Task 1-3 新增的 test case）

- [ ] **Step 7: Commit**

```bash
git add src/app/chapters/[...id]/ChapterDetailClient.tsx src/lib/storage.ts
git commit -m "feat(chapters): 章節詳情頁改用單輪達標記錄，移除舊的 isChapterCompleted"
```

---

### Task 7: 瀏覽器手動驗證（含本機 D1）

**Files:**
- 無程式碼異動；驗證 Task 1-6 在真實瀏覽器流程中的行為

**Interfaces:**
- Consumes: 完整的 `functions/api/**` + D1 + 前端整合（`next dev` 沒有 Functions，必須用 `wrangler pages dev`，見 [CLAUDE.md](../../../CLAUDE.md) 的 local 開發指令）

- [ ] **Step 1: 準備本機 D1 並套用新 migration**

```bash
pnpm run build:content
pnpm run build
npx wrangler d1 migrations apply toeic-db --local
```

Expected: migration 清單顯示 `0005_chapter_achievements.sql` 套用成功（其餘 migration 已套用過會顯示已套用）

- [ ] **Step 2: 啟動本機伺服器**

```bash
npx wrangler pages dev out --port 8788
```

Expected: 終端機顯示伺服器已在 `http://localhost:8788` 啟動

- [ ] **Step 3: 在瀏覽器走一次「未達標」流程**

用瀏覽器工具開啟 `http://localhost:8788`，註冊一個測試帳號，進入「文法章節」，點進一個題目數 ≥5 的章節（例如任一有秒殺公式的章節），點「練這章」，前 3 題故意選錯、後 2 題選對（正確率 40%），交卷後回到章節詳情頁。

Expected: 徽章顯示「練這章單輪答對 ≥80% 即完成」（未達標樣式），沒有已完成勾號

- [ ] **Step 4: 走一次「達標」流程**

回到同一章節再按「練這章」，這次全部選對（正確率 100%），交卷後回到章節詳情頁。

Expected: 徽章變成「已完成 (單輪≥80%)」（主色勾號樣式）；回到「文法章節」列表頁，該章節前面出現勾號圖示，所屬分類的完成率百分比也跟著更新

- [ ] **Step 5: 驗證達標後的永久保留**

再對同一章節按「練這章」一次，這次全部故意選錯（正確率 0%），交卷。

Expected: 章節詳情頁與列表頁仍然顯示「已完成 (單輪≥80%)」，不會因為這輪低分被收回

- [ ] **Step 6: 驗證跨裝置同步（可選但建議）**

登出後重新登入同一帳號（或用無痕視窗重新登入）。

Expected: 該章節的已完成狀態仍在（代表 D1 同步 + `syncUserDataFromD1` 合併邏輯正常運作）

- [ ] **Step 7: 關閉本機伺服器**

確認驗證完成後停止 `wrangler pages dev` 進程。

---

## Self-Review Notes

- **Spec 覆蓋**：資料層（Task 1-2）、後端/D1（Task 3）、練習頁寫入（Task 4）、章節列表/詳情頁讀取（Task 5-6）、手動端到端驗證（Task 7）都對應到設計文件的對應章節；「不做舊資料遷移」「不新增讀教材追蹤」兩項範圍外決策沒有對應任務，符合設計文件的「範圍外」段落。
- **型別一致性**：`recordChapterPracticeRound(chapterId, correctCount, totalCount)`、`isChapterAchieved(chapterId, achievements?)`、`getChapterAchievements()` 的簽名在 Task 1 定義後，Task 2/4/5/6 全部照原樣呼叫，沒有改名或參數順序不一致的狀況。
- **建置不中斷**：`isChapterCompleted` 的移除延後到 Task 6（兩個呼叫端都改完之後），中間任務執行完 `pnpm build` 都應該維持綠燈。
