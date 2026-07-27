# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
pnpm dev                    # Next dev server
pnpm build                  # static export → out/
pnpm test                   # vitest run (all tests)
pnpm test:watch
pnpm build:content          # parse Obsidian notes → content/*.json
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
- `id.ts` derives ids from note paths (`grammar/01_八大詞性與句型結構/01_名詞與代名詞#q5`). **These ids are persisted in user SRS/wrong-answer records in D1** — renaming a note file or category silently orphans user data.
- `types.ts` holds zod schemas that are the single source of truth for content shape; `src/lib/content.ts` casts the JSON to those types.
- `data/vocab-example-zh.json` is the one build **input** that does not come from the vault: the notes carry no Chinese for vocab example sentences, so the translations are hand-maintained here, keyed by vocab id, and merged onto `VocabItem.exampleZh` by `attachExampleZh()` in `index.ts`. Same "loud, never silent" rule — the build report prints how many items got a translation, and warns both for vocab with no entry and for entries matching no vocab (the symptom of a renamed note). Adding a word to the notes means adding its translation here too.
- `content/*.json` is committed and forced to LF by `.gitattributes` — without it every rebuild shows six files changed by line endings alone.

### 2. Frontend (`src/`, Next.js App Router, `output: 'export'`)

Static export only — **there are no Next API routes and none can be added**; all server work lives in Cloudflare Pages Functions (below).

- `src/lib/storage.ts` is the single write path for all user state. localStorage is the read source of truth for the UI; every mutation (`recordTaskCompletion`, `recordQuestionAnswer`, `updateVocabMastery`, `saveProfile`) writes localStorage first, then fires a `POST /api/user/*` that is deliberately `.catch(() => {})` — sync failures must never block practice.
- `syncUserDataFromD1()` is the reverse direction (D1 → localStorage), called from `AuthContext` on session restore and on login. It **overwrites** local state, so it must only run at those two moments. It also runs *after* pages have rendered from localStorage, so anything it changes is not reflected until the next navigation.
- Domain rules that live in `storage.ts`: wrong questions graduate off the list at `consecutiveCorrect >= 2`; a question answered correctly the first time is **never** filed in 錯題本; streak increments only if the previous entry was literally yesterday *and* a task was completed.
- `recordQuestionAnswer(..., { fileWrong: false })` records history/stats without filing the question — the mock exam uses this so 結算頁's「把 N 題加入錯題本」stays an explicit user action (`fileWrongQuestions()`), instead of double-counting fail counts.
- Derived queries also live in `storage.ts`: `getPracticeCalendar`, `getChapterMasteryMap` (reads the chapter out of `questionId.split('#')[0]`), `getWrongQuestionList`, `getQuestionHistory`, `getProfile`/`saveProfile`, `getMockResults`.
- `src/lib/content.ts` is the read-side index over `content/*.json`: `getQuestionById` spans grammar + reading + mock, `getCategories()` yields the six grammar categories, and `getChapterNumber()` renumbers chapters globally (`Chapter.order` restarts at 1 inside each category, so it cannot be displayed directly).
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
