# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
pnpm dev                    # Next dev server
pnpm build                  # static export → out/
pnpm test                   # vitest run (all tests)
pnpm test:watch
pnpm build:content          # parse Obsidian notes → content/*.json
pnpm check:content          # 只比對已 commit 的 content/*.json，不需要 vault（CI 用這個）
pnpm check:duplicates       # 查重：題幹相似度（決定退出碼）＋ 正解目標詞碰撞（僅供參考）
pnpm deploy                 # build:content + build + wrangler pages deploy out --project-name=toeic
```

Single test file / single case:

```bash
pnpm vitest run tests/toeicScore.test.ts -t "gold certificate"
```

There is no lint step configured; type checking happens via `pnpm build` (tsconfig is `strict` + `noUncheckedIndexedAccess`, `noEmit`).

`tests/*.real.test.ts` read the actual Obsidian vault at `D:\my-note\個人學習\多益` (override with `NOTES_DIR`) and assert exact counts (e.g. "352 vocab items across 29 chapters"). They fail on a machine without the vault, and they intentionally break when the notes change — that is the signal to re-run `pnpm build:content` and update the expected numbers.

## Architecture

Three separate layers with a deliberate boundary between **read-only content** and **mutable user progress**:

### 1. Content pipeline (`scripts/build-content/` → `content/*.json`)

Obsidian markdown notes are parsed at build time into committed JSON, which is imported directly by `src/lib/content.ts` and bundled into the static site. The question bank never touches D1.

- `index.ts` orchestrates; `parse-*.ts` are pure functions (markdown string → structured data), `merge.ts` pairs questions with their 詳解 by question number, `report.ts` prints the build report.
- **The parser must be loud, never silent.** `merge.ts` drops any question that fails an error-level check and records an `Issue`; `hasBlockingIssues()` then fails the build. Adding a lenient fallback that silently accepts malformed notes defeats the whole design.
- **內容縮水護欄**（`shrink-guard.ts` 純函式 + `baseline.ts` 負責 git/檔案 I/O）：任何一類（章節/文法題/單字/秒殺公式/閱讀篇章/閱讀題/模擬考/模擬考題）比已 commit 的 `content/*.json` 掉超過 10% 就以非零 exit code 中止，並印出掉了多少與前幾個消失的 id。`build:content` 在寫檔**之前**跑這道（基準是 `HEAD`，現況是這次 parse 出來的 bundle）；`check:content` 是同一道的獨立版，比的是「某個 ref 上的 JSON」對「磁碟上的 JSON」，不需要 vault，所以 CI 在 PR 上會拿 base branch 當基準跑它——真正擋得住「有人直接刪掉 committed JSON、根本沒跑 build:content」的只有後者（那正是題庫 745 → 145 那次的樣子）。確定要刪題時，本機用 `--allow-shrink` 或 `ALLOW_CONTENT_SHRINK=1`（覆寫時會在 build report 上大聲印出被放行的數字），CI 上則是在該 PR 掛 `allow-content-shrink` 標籤（這個標籤要先在 repo 建一次）。除了數量，護欄還看 **id 汰換率**：總數沒明顯少、但消失的 id 超過 10%，一樣擋——那是筆記被改名或搬走的樣子，也就是 `id.ts` 那條警告說的、會讓 D1 裡使用者錯題本與 SRS 記錄孤兒化的情形。門檻訂 10% 的依據是實測整段 git 歷史：正常變更（含題庫擴充 4-5 倍）汰換率一律 0.0%，只有 745 → 145 那次事故是 58–81%。
- `id.ts` derives ids from note paths (`grammar/01_八大詞性與句型結構/01_名詞與代名詞#q5`). **These ids are persisted in user SRS/wrong-answer records in D1** — renaming a note file or category silently orphans user data.
- `types.ts` holds zod schemas that are the single source of truth for content shape; `src/lib/content.ts` casts the JSON to those types.
- `data/vocab-example-zh.json` is the one build **input** that does not come from the vault: the notes carry no Chinese for vocab example sentences, so the translations are hand-maintained here, keyed by vocab id, and merged onto `VocabItem.exampleZh` by `attachExampleZh()` in `index.ts`. Same "loud, never silent" rule — the build report prints how many items got a translation, and warns both for vocab with no entry and for entries matching no vocab (the symptom of a renamed note). Adding a word to the notes means adding its translation here too.
- `data/learning-path.json` is the other hand-written sidecar (with `data/formula-cards.json`): the 學習路徑 — 章節**刻意不照** `content/chapters.json` 的編號排，而是重排成十站的建議學習順序，跨大類混編。它不進 bundle，前端直接 import。`checkLearningPath()` in `index.ts` 用同一套「吵」的規則擋：形狀不合 schema、章節在路徑上重複、id 對不到章節都是 error 級（擋 build），章節**漏排**是 warn（新增筆記後還沒排進去很正常，但路徑頁上印的「N 章」是使用者用來確認沒漏學的數字，不能無聲少掉）。改章節檔名一樣會孤兒化這裡的 id。
- `content/*.json` is committed and forced to LF by `.gitattributes` — without it every rebuild shows six files changed by line endings alone.

### 2. Frontend (`src/`, Next.js App Router, `output: 'export'`)

Static export only — **there are no Next API routes and none can be added**; all server work lives in Cloudflare Pages Functions (below).

- `src/lib/storage.ts` is the single write path for all user state. localStorage is the read source of truth for the UI; every mutation (`recordTaskCompletion`, `recordQuestionAnswer`, `updateVocabMastery`, `saveProfile`) writes localStorage first, then fires a `POST /api/user/*` that is deliberately `.catch(() => {})` — sync failures must never block practice.
- `syncUserDataFromD1()` is the reverse direction (D1 → localStorage), called from `AuthContext` on session restore and on login. It **overwrites** local state, so it must only run at those two moments. It also runs *after* pages have rendered from localStorage, so anything it changes is not reflected until the next navigation.
- Domain rules that live in `storage.ts`: wrong questions graduate off the list at `consecutiveCorrect >= 2`; a question answered correctly the first time is **never** filed in 錯題本; streak increments only if the previous entry was literally yesterday *and* a task was completed.
- `recordQuestionAnswer(..., { fileWrong: false })` records history/stats without filing the question — the mock exam uses this so 結算頁's「把 N 題加入錯題本」stays an explicit user action (`fileWrongQuestions()`), instead of double-counting fail counts.
- Derived queries also live in `storage.ts`: `getPracticeCalendar`, `getChapterMasteryMap` (reads the chapter out of `questionId.split('#')[0]`), `getWrongQuestionList`, `getQuestionHistory`, `getProfile`/`saveProfile`, `getMockResults`.
- `src/lib/content.ts` is the read-side index over `content/*.json`: `getQuestionById` spans grammar + reading + mock, `getCategories()` yields the six grammar categories, and `getChapterNumber()` renumbers chapters globally (`Chapter.order` restarts at 1 inside each category, so it cannot be displayed directly).
- `src/lib/learning-path.ts` is the read side of `data/learning-path.json`, rendered by `/path`（學習路徑）。它存在的理由就是「順序跟 `/chapters` 不一樣」：筆記按主題歸檔方便查，路徑按依賴關係重排方便學，每一站的 `why` 就是排序理由。`getPathProgress()` 是純函式（進度 map 由呼叫端傳入），完成判準沿用 `isChapterAchieved()`——路徑頁與章節頁對同一章說出不同的完成狀態會直接讓人不信任。`/practice/grammar?stage=<id>` 是整站混合驗收，**刻意不帶 `chapterId`**：章節達標只認「練這章」那種單章回合。
- `/practice`（練習中心，`src/app/practice/page.tsx`）是**全站功能的唯一目錄**：三項每日任務、學習路徑、文法章節、錯題本、單字複習本、速查卡、模擬考全在這一頁，而且**不論數字是不是 0 都要列出來**（0 的時候改文案，不要整張卡藏起來）。手機底部 tab 的「練習」與桌機頂部導航的「練習」都指這裡。這一條是硬規則：先前模擬考只在「三項任務都做完」之後才出現在首頁、錯題本與單字複習本只在有東西時才出現、學習路徑只掛在章節頁上，結果就是使用者根本不知道某些功能存在。新功能一律要在這一頁掛入口，不能只靠首頁的條件式卡片。
- 導覽出口的規則：頁面左上角的返回鍵指向**底部 tab 上正在亮著的那一格**（錯題本／單字複習本 → `/practice`），而練習回合的返回鍵與結算頁指向**這一回合是從哪裡開始的**——`buildSession()` 回傳的 `backHref`/`backLabel`（章節練習 → 該章、路徑驗收 → `/path`、錯題專攻 → `/wrong-questions`、其餘 → `/`），`SummaryModal` 吃同一組值。寫死 `/` 會讓從章節頁進來練五題的人一練完就被丟出閱讀脈絡。
- `src/lib/scroll.ts` 的 `useScrollToTopOnChange(key)`：練習流程全部是「同一個路由裡換內容」，Next.js 的換頁捲動重置完全幫不上忙，所以**每一個會就地換卡／換題的畫面都必須呼叫它**（速查卡、單字、文法、閱讀、模擬考各一處）。沒有它的話，按下「下一張」之後視窗還停在上一張卡的底部，新卡的標題在畫面上方看不見。刻意用 instant 而非 smooth——長卡片平滑捲回頂端會超過 DESIGN-PROMPT 的 300ms 動效上限。
- `src/components/EntryCard.tsx` 是首頁、練習中心、章節頁共用的功能入口卡（圖示＋標題＋即時數字＋一行說明＋右側動作）。這三頁原本各自手寫同一塊 JSX，版型會慢慢漂開，而使用者是靠「長得一樣＝同一種東西」在認路的。
- `src/lib/emphasis.ts` handles the two marker styles the vault uses for the target word in a vocab example (`*word*` and `**word**`). Matching only one leaves stray asterisks on screen.
- `src/lib/toeicScore.ts` maps accuracy → 10–990 via a piecewise ETS S-curve, rounded to the nearest 5, then to gold/blue/green/brown certificate levels.
- Auth is mandatory: `layout.tsx` wraps everything in `AuthProvider` → `AuthGuard`, which renders `AuthModal` instead of the app when there is no user.

### 3. Backend (`functions/api/**`, Cloudflare Pages Functions + D1)

- File-routed Pages Functions exporting `onRequestGet` / `onRequestPost`. They import from `src/lib/crypto.ts` (PBKDF2-SHA256 100k iterations + hand-rolled HMAC JWT, Web Crypto only — no Node APIs available at the edge).
- Session is an HttpOnly cookie `toeic_session`; each handler re-parses the cookie and calls `verifyJwt`.
- D1 binding is read as `context.env.toeic_db || context.env.DB`, declared in `wrangler.jsonc`. `JWT_SECRET` comes from `context.env` with a hardcoded dev fallback — set it as a real secret in production.
- Schema lives in `migrations/000*.sql`, applied in order with `wrangler d1 execute` (`0001_init`, `0002_user_profile`, `0003_answer_detail`). They are not idempotent — `0003` uses `ALTER TABLE ADD COLUMN`, which D1 has no `IF NOT EXISTS` for.
- `/api/user/action` is a single dispatching endpoint keyed on `action` (`vocab_update` / `record_answer` / `file_wrong` / `remove_wrong` / `update_stats`), tolerating both snake_case and camelCase payload keys. `/api/user/profile` is separate (GET + POST).
- Anything the client persists locally must have a matching action here, or `syncUserDataFromD1()` resurrects it on the next login — that is why `remove_wrong` exists.

Run the whole stack locally (static export + Functions + local D1) rather than `next dev`, which has no Functions:

```bash
npx wrangler pages dev out --port 8788
```

## Design source of truth

`TOEIC Daily Practice App/` holds the exported design files (`TOEIC App.dc.html`, `Wireframes.dc.html`, `Design Tokens.dc.html`, `_ds/`). Colors, spacing and interaction timings in the app are meant to match these exactly — check them before inventing a value.

Two token systems coexist in `src/app/globals.css` and must stay in sync:
- Raw hex CSS vars (`--bg --sf --tx --mu --pr --ok --bad …`) used directly via `text-[var(--mu)]`. Prefer these for new code — they are the design file's own names.
- HSL-triplet vars (`--background --primary --correct --wrong --muted …`) bridged to Tailwind utilities (`bg-card`, `text-muted-foreground`, `text-correct`) by the `@theme inline` block at the top of `globals.css`.

**Tailwind v4 does not read a `tailwind.config.ts`.** There is no config file; every custom colour, radius and animation is declared in `@theme inline` in `globals.css`, and `dark:` works only because of the `@custom-variant dark` line next to it. Adding a colour to a JS config would compile to nothing — a whole set of semantic utilities was silently dead this way. After touching tokens, check the utility actually exists:

```bash
grep -c '\.text-muted-foreground' out/_next/static/chunks/*.css
```

Dark mode is the primary mode (`<html className="dark">`); `src/lib/theme.ts` toggles both the `.dark` class and `data-theme`, and the CSS defines both selectors.

Design constraints carried from `DESIGN-PROMPT.md`: single accent color (blue/indigo) throughout, green/red reserved *exclusively* for answer feedback, no gamified/celebratory visuals, animation only on answer feedback / progress ring / explanation expand and always ≤300ms.

## Conventions

- All user-facing UI strings are 繁體中文, including API error messages returned from Functions.
- `PROMPT.md` / `DESIGN-PROMPT.md` are the original product briefs; `docs/superpowers/specs/` and `docs/superpowers/plans/` hold the per-feature design docs and task ledgers, with `.superpowers/sdd/progress.md` tracking task completion against commits.
