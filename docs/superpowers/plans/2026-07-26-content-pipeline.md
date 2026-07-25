# 題庫資料管線 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 Obsidian 多益筆記解析成結構化 JSON 題庫，供前端直接載入，並在格式異常或詳解缺漏時讓 build 失敗。

**Architecture:** 一支 Node CLI (`pnpm build:content`)，讀取筆記目錄 → 分類型 parser 產生中間資料 → 與詳解合併並驗證 → 輸出 `content/*.json` 與一份 build report。純函式設計，每個 parser 吃字串吐物件，不碰檔案系統，因此可用 fixture 完整測試。runtime 永不讀 markdown。

**Tech Stack:** TypeScript (strict) · Node 20+ · pnpm · Vitest · zod（schema 驗證）

## Global Constraints

- Node ≥ 20，套件管理器一律用 `pnpm`
- TypeScript `strict: true`，不得使用 `any`（測試 fixture 除外）
- 筆記路徑由環境變數 `NOTES_DIR` 提供，預設 `D:\my-note\個人學習\多益`；程式中不得硬編碼絕對路徑
- **題目 ID 必須穩定**：ID 由「來源檔相對路徑 + 題號」組成，不得使用陣列索引。ID 一旦變動，使用者的 SRS 排程與錯題本會全部錯位
- 產出檔輸出到 `content/`，並納入版本控制
- **驗證失敗一律 `process.exit(1)`**，不得只印警告
- 所有 parser 為純函式：輸入字串，輸出物件，不做 I/O
- 註解與 commit message 用英文，report 輸出用繁體中文

## 已實測的資料現況（parser 必須符合這些事實）

| 項目 | 實測值 |
|---|---|
| 文法章節 | 29 章（6 大類），每章 5 題 = **145 題** |
| 單字行 | **314** 行，格式 `*   **word** 詞性 中文 \| 例句` |
| 區塊標題 | `## 💪 練習題（5 題）`、`## 🔤 相關單字和片語`、`## 📚 補充秒殺公式` — 29 章全部一致 |
| 閱讀理解 | 6 檔（單句/段落/篇章各 2），題目標題 `### 題目 N` 或 `### 題目 N（細節題）` |
| 模擬考 | 2 份，每份約 31 題 |
| 詳解題目標題 | `## 題目 N：類型敘述` |
| 答案格式 | **5 種變異**，見 Task 8 |

---

## 檔案結構

```
D:\toeic-web\
├── package.json                          Task 1
├── tsconfig.json                         Task 1
├── vitest.config.ts                      Task 1
├── content/                              Task 12/13 產出（進版控）
│   ├── grammar.json
│   ├── vocab.json
│   ├── formulas.json
│   ├── reading.json
│   ├── mock-exams.json
│   └── chapters.json
├── scripts/build-content/
│   ├── types.ts          題庫 schema 與型別          Task 2, 13
│   ├── id.ts             穩定 ID 生成                Task 3
│   ├── markdown.ts       ## 區塊切分                 Task 4
│   ├── parse-vocab.ts    單字區塊                    Task 5
│   ├── parse-formulas.ts 秒殺公式區塊                Task 6
│   ├── parse-questions.ts 練習題（含雙空格題）       Task 7
│   ├── parse-answers.ts  詳解檔（5 種答案格式）      Task 8
│   ├── merge.ts          題目+詳解合併與驗證         Task 9
│   ├── parse-reading.ts  閱讀理解                    Task 10
│   ├── parse-mock.ts     模擬考                      Task 11
│   ├── parse-chapter.ts  章節教學內容與元資料        Task 13
│   ├── report.ts         build report                Task 12
│   └── index.ts          CLI 進入點                  Task 12, 13
└── tests/
    ├── fixtures/         真實筆記節錄
    └── *.test.ts
```

每個 parser 一個檔、一個責任。`merge.ts` 是唯一知道「題目與詳解如何配對」的地方。

---

### Task 1: 專案初始化與測試環境

**Files:**
- Create: `package.json`, `tsconfig.json`, `vitest.config.ts`, `.gitignore`
- Test: `tests/setup.test.ts`

**Interfaces:**
- Produces: `pnpm test` 可執行；`scripts/build-content/` 下的 TS 檔可被 Vitest import

- [ ] **Step 1: 建立 package.json**

```json
{
  "name": "toeic-web",
  "private": true,
  "type": "module",
  "engines": { "node": ">=20" },
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "build:content": "tsx scripts/build-content/index.ts"
  },
  "devDependencies": {
    "@types/node": "^22.10.0",
    "tsx": "^4.19.0",
    "typescript": "^5.7.0",
    "vitest": "^2.1.0",
    "zod": "^3.24.0"
  }
}
```

- [ ] **Step 2: 建立 tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "types": ["node", "vitest/globals"]
  },
  "include": ["scripts/**/*.ts", "tests/**/*.ts"]
}
```

- [ ] **Step 3: 建立 vitest.config.ts**

```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    include: ['tests/**/*.test.ts'],
  },
})
```

- [ ] **Step 4: 建立 .gitignore**

```
node_modules/
.next/
.DS_Store
*.log
.env
.env.local
```

注意：`content/` **不要**加入 .gitignore，產出的 JSON 要進版控。

- [ ] **Step 5: 寫一個確認環境可用的測試**

`tests/setup.test.ts`：

```ts
import { describe, it, expect } from 'vitest'

describe('test environment', () => {
  it('runs typescript with strict mode', () => {
    const value: string = 'ok'
    expect(value).toBe('ok')
  })
})
```

- [ ] **Step 6: 安裝並執行測試**

```bash
pnpm install && pnpm test
```

預期：1 passed。

- [ ] **Step 7: Commit**

```bash
git add package.json tsconfig.json vitest.config.ts .gitignore tests/setup.test.ts
git commit -m "chore: init typescript project with vitest"
```

---

### Task 2: 題庫型別定義

**Files:**
- Create: `scripts/build-content/types.ts`
- Test: `tests/types.test.ts`

**Interfaces:**
- Produces: 型別 `Question`, `Blank`, `VocabItem`, `Formula`, `Explanation`, `ReadingPassage`, `MockExam`, `ContentBundle`；zod schema `QuestionSchema`, `ContentBundleSchema`

- [ ] **Step 1: 寫失敗的測試**

`tests/types.test.ts`：

```ts
import { describe, it, expect } from 'vitest'
import { QuestionSchema } from '../scripts/build-content/types'

describe('QuestionSchema', () => {
  it('accepts a single-blank question', () => {
    const q = {
      id: 'grammar/01_八大詞性與句型結構/01_名詞與代名詞#q1',
      source: 'note' as const,
      chapterId: 'grammar/01_八大詞性與句型結構/01_名詞與代名詞',
      categoryId: '01_八大詞性與句型結構',
      number: 1,
      stem: 'Please make sure your ___ is accurate.',
      blanks: [
        {
          label: null,
          options: [
            { key: 'A', text: 'inform' },
            { key: 'B', text: 'informative' },
            { key: 'C', text: 'information' },
            { key: 'D', text: 'informational' },
          ],
          answer: 'C',
        },
      ],
    }
    expect(QuestionSchema.parse(q).blanks).toHaveLength(1)
  })

  it('accepts a multi-blank question', () => {
    const q = {
      id: 'grammar/01_八大詞性與句型結構/01_名詞與代名詞#q5',
      source: 'note' as const,
      chapterId: 'grammar/01_八大詞性與句型結構/01_名詞與代名詞',
      categoryId: '01_八大詞性與句型結構',
      number: 5,
      stem: 'The company published a survey ___ ... improve their ___ with staff.',
      blanks: [
        {
          label: '第一空',
          options: [
            { key: 'A', text: 'satisfy' },
            { key: 'B', text: 'satisfied' },
            { key: 'C', text: 'satisfaction' },
            { key: 'D', text: 'satisfactorily' },
          ],
          answer: 'C',
        },
        {
          label: '第二空',
          options: [
            { key: 'A', text: 'communicate' },
            { key: 'B', text: 'communication' },
            { key: 'C', text: 'communicative' },
            { key: 'D', text: 'communicator' },
          ],
          answer: 'B',
        },
      ],
    }
    expect(QuestionSchema.parse(q).blanks).toHaveLength(2)
  })

  it('rejects a question with no blanks', () => {
    expect(() =>
      QuestionSchema.parse({
        id: 'x#q1',
        source: 'note',
        chapterId: 'x',
        categoryId: 'y',
        number: 1,
        stem: 's',
        blanks: [],
      }),
    ).toThrow()
  })
})
```

- [ ] **Step 2: 執行測試確認失敗**

```bash
pnpm vitest run tests/types.test.ts
```

預期：FAIL，`Cannot find module '../scripts/build-content/types'`。

- [ ] **Step 3: 實作 types.ts**

```ts
import { z } from 'zod'

export const OptionKeySchema = z.enum(['A', 'B', 'C', 'D'])
export type OptionKey = z.infer<typeof OptionKeySchema>

export const OptionSchema = z.object({
  key: OptionKeySchema,
  text: z.string().min(1),
})
export type Option = z.infer<typeof OptionSchema>

/** One blank in a question. Single-blank questions have exactly one. */
export const BlankSchema = z.object({
  /** e.g. 第一空 for multi-blank questions, null for single-blank */
  label: z.string().nullable(),
  options: z.array(OptionSchema).min(2),
  answer: OptionKeySchema,
})
export type Blank = z.infer<typeof BlankSchema>

export const ExplanationSchema = z.object({
  /** e.g. 詞性題 - 名詞字尾判斷 */
  title: z.string(),
  /** 逐選項分析全文（markdown） */
  analysis: z.string(),
  /** 相關文法點，可能沒有 */
  grammarPoint: z.string().nullable(),
  /** 相似題型提醒，可能沒有 */
  similarNote: z.string().nullable(),
})
export type Explanation = z.infer<typeof ExplanationSchema>

// ExplanationSchema must be declared before QuestionSchema: zod schemas are
// const bindings evaluated at module load, so referencing it earlier would hit
// the temporal dead zone and throw at import time.
export const QuestionSchema = z.object({
  id: z.string().min(1),
  source: z.enum(['note', 'ai']),
  chapterId: z.string().min(1),
  categoryId: z.string().min(1),
  number: z.number().int().positive(),
  stem: z.string().min(1),
  blanks: z.array(BlankSchema).min(1),
  /** null until merge.ts attaches the explanation; non-null in written output */
  explanation: ExplanationSchema.nullable().default(null),
})
export type Question = z.infer<typeof QuestionSchema>

export const VocabItemSchema = z.object({
  id: z.string().min(1),
  chapterId: z.string().min(1),
  word: z.string().min(1),
  pos: z.string(),
  meaning: z.string().min(1),
  example: z.string(),
})
export type VocabItem = z.infer<typeof VocabItemSchema>

export const FormulaSchema = z.object({
  id: z.string().min(1),
  chapterId: z.string().min(1),
  number: z.number().int().positive(),
  /** 粗體標題，如「可數 vs. 不可數名詞陷阱」 */
  title: z.string(),
  body: z.string().min(1),
})
export type Formula = z.infer<typeof FormulaSchema>

export const ReadingPassageSchema = z.object({
  id: z.string().min(1),
  /** single-sentence | paragraph | article */
  kind: z.enum(['single', 'paragraph', 'article']),
  title: z.string(),
  /** 篇章本文；單句填空題為空字串 */
  passage: z.string(),
  questions: z.array(QuestionSchema).min(1),
})
export type ReadingPassage = z.infer<typeof ReadingPassageSchema>

export const MockExamSchema = z.object({
  id: z.string().min(1),
  title: z.string(),
  questions: z.array(QuestionSchema).min(1),
})
export type MockExam = z.infer<typeof MockExamSchema>

export const ContentBundleSchema = z.object({
  buildAt: z.string(),
  grammar: z.array(QuestionSchema),
  vocab: z.array(VocabItemSchema),
  formulas: z.array(FormulaSchema),
  reading: z.array(ReadingPassageSchema),
  mockExams: z.array(MockExamSchema),
})
export type ContentBundle = z.infer<typeof ContentBundleSchema>
```

註：`ExplanationSchemaLazy()` 只是為了讓 `explanation` 在 parse 階段可為 `null`（詳解尚未合併），合併後由 `merge.ts` 保證非 null。

- [ ] **Step 4: 執行測試確認通過**

```bash
pnpm vitest run tests/types.test.ts
```

預期：3 passed。

- [ ] **Step 5: Commit**

```bash
git add scripts/build-content/types.ts tests/types.test.ts
git commit -m "feat: add content schema types"
```

---

### Task 3: 穩定 ID 生成

**Files:**
- Create: `scripts/build-content/id.ts`
- Test: `tests/id.test.ts`

**Interfaces:**
- Consumes: 無
- Produces: `chapterIdFromPath(relPath: string): string`、`questionId(chapterId: string, number: number): string`、`vocabId(chapterId: string, word: string): string`、`formulaId(chapterId: string, number: number): string`

- [ ] **Step 1: 寫失敗的測試**

`tests/id.test.ts`：

```ts
import { describe, it, expect } from 'vitest'
import { chapterIdFromPath, questionId, vocabId, formulaId } from '../scripts/build-content/id'

describe('chapterIdFromPath', () => {
  it('converts a windows relative path to a stable id', () => {
    expect(chapterIdFromPath('文法\\01_八大詞性與句型結構\\01_名詞與代名詞.md')).toBe(
      'grammar/01_八大詞性與句型結構/01_名詞與代名詞',
    )
  })

  it('converts a posix relative path identically', () => {
    expect(chapterIdFromPath('文法/01_八大詞性與句型結構/01_名詞與代名詞.md')).toBe(
      'grammar/01_八大詞性與句型結構/01_名詞與代名詞',
    )
  })

  it('maps reading and mock roots to english prefixes', () => {
    expect(chapterIdFromPath('閱讀理解/02_段落填空題/01_綜合練習一.md')).toBe(
      'reading/02_段落填空題/01_綜合練習一',
    )
    expect(chapterIdFromPath('模擬考試/模擬測驗一.md')).toBe('mock/模擬測驗一')
  })
})

describe('questionId', () => {
  it('is stable and readable', () => {
    expect(questionId('grammar/01_八大詞性與句型結構/01_名詞與代名詞', 3)).toBe(
      'grammar/01_八大詞性與句型結構/01_名詞與代名詞#q3',
    )
  })
})

describe('vocabId', () => {
  it('slugifies the word', () => {
    expect(vocabId('grammar/01_x/01_y', 'each other')).toBe('grammar/01_x/01_y#v-each-other')
  })

  it('lowercases for stability', () => {
    expect(vocabId('grammar/01_x/01_y', 'Information')).toBe('grammar/01_x/01_y#v-information')
  })
})

describe('formulaId', () => {
  it('uses an f prefix', () => {
    expect(formulaId('grammar/01_x/01_y', 2)).toBe('grammar/01_x/01_y#f2')
  })
})
```

- [ ] **Step 2: 執行測試確認失敗**

```bash
pnpm vitest run tests/id.test.ts
```

預期：FAIL，找不到模組。

- [ ] **Step 3: 實作 id.ts**

```ts
const ROOT_PREFIX: Record<string, string> = {
  文法: 'grammar',
  閱讀理解: 'reading',
  模擬考試: 'mock',
  詳解: 'explanation',
}

/**
 * Build a stable, human-readable chapter id from a note path relative to NOTES_DIR.
 * Stability matters: ids are persisted in user SRS/wrong-answer records.
 */
export function chapterIdFromPath(relPath: string): string {
  const segments = relPath.replace(/\\/g, '/').replace(/\.md$/i, '').split('/').filter(Boolean)
  const [root, ...rest] = segments
  if (root === undefined) throw new Error(`empty path: ${relPath}`)
  const prefix = ROOT_PREFIX[root]
  if (prefix === undefined) throw new Error(`unknown note root: ${root} (from ${relPath})`)
  return [prefix, ...rest].join('/')
}

export function questionId(chapterId: string, number: number): string {
  return `${chapterId}#q${number}`
}

export function formulaId(chapterId: string, number: number): string {
  return `${chapterId}#f${number}`
}

export function vocabId(chapterId: string, word: string): string {
  const slug = word.trim().toLowerCase().replace(/\s+/g, '-')
  return `${chapterId}#v-${slug}`
}
```

- [ ] **Step 4: 執行測試確認通過**

```bash
pnpm vitest run tests/id.test.ts
```

預期：7 passed。

- [ ] **Step 5: Commit**

```bash
git add scripts/build-content/id.ts tests/id.test.ts
git commit -m "feat: add stable content id generation"
```

---

### Task 4: Markdown 區塊切分

**Files:**
- Create: `scripts/build-content/markdown.ts`
- Test: `tests/markdown.test.ts`

**Interfaces:**
- Produces: `splitSections(md: string): Section[]`，`Section = { heading: string; level: number; body: string }`；`findSection(sections: Section[], headingIncludes: string): Section | null`

- [ ] **Step 1: 寫失敗的測試**

`tests/markdown.test.ts`：

```ts
import { describe, it, expect } from 'vitest'
import { splitSections, findSection } from '../scripts/build-content/markdown'

const SAMPLE = `# 01_名詞與代名詞

## 核心概念
名詞是句子骨幹。

## 📚 補充秒殺公式
1.  **可數陷阱**：information 不可數。

## 💪 練習題（5 題）

**1.** Please make sure your ___ is accurate.
(A) inform (B) informative (C) information (D) informational
`

describe('splitSections', () => {
  it('splits on level-2 headings and keeps bodies', () => {
    const sections = splitSections(SAMPLE)
    expect(sections.map((s) => s.heading)).toEqual([
      '核心概念',
      '📚 補充秒殺公式',
      '💪 練習題（5 題）',
    ])
  })

  it('excludes the heading line from the body', () => {
    const sections = splitSections(SAMPLE)
    expect(sections[0]?.body.trim()).toBe('名詞是句子骨幹。')
  })

  it('ignores the level-1 title', () => {
    expect(splitSections(SAMPLE).some((s) => s.heading.includes('01_名詞'))).toBe(false)
  })
})

describe('findSection', () => {
  it('matches by substring so emoji variants still resolve', () => {
    const sections = splitSections(SAMPLE)
    expect(findSection(sections, '練習題')?.heading).toBe('💪 練習題（5 題）')
  })

  it('returns null when absent', () => {
    expect(findSection(splitSections(SAMPLE), '不存在的區塊')).toBeNull()
  })
})
```

- [ ] **Step 2: 執行測試確認失敗**

```bash
pnpm vitest run tests/markdown.test.ts
```

預期：FAIL。

- [ ] **Step 3: 實作 markdown.ts**

```ts
export interface Section {
  heading: string
  level: number
  body: string
}

const HEADING_RE = /^(#{2,3})\s+(.+?)\s*$/

/** Split a note into level-2/3 sections. The level-1 title is dropped. */
export function splitSections(md: string): Section[] {
  const lines = md.split(/\r?\n/)
  const sections: Section[] = []
  let current: { heading: string; level: number; lines: string[] } | null = null

  for (const line of lines) {
    const match = HEADING_RE.exec(line)
    if (match) {
      if (current) sections.push({ heading: current.heading, level: current.level, body: current.lines.join('\n') })
      current = { heading: match[2] ?? '', level: (match[1] ?? '##').length, lines: [] }
      continue
    }
    if (current) current.lines.push(line)
  }
  if (current) sections.push({ heading: current.heading, level: current.level, body: current.lines.join('\n') })
  return sections
}

/** Match by substring: headings carry emoji and counts that vary between chapters. */
export function findSection(sections: Section[], headingIncludes: string): Section | null {
  return sections.find((s) => s.heading.includes(headingIncludes)) ?? null
}
```

- [ ] **Step 4: 執行測試確認通過**

```bash
pnpm vitest run tests/markdown.test.ts
```

預期：5 passed。

- [ ] **Step 5: Commit**

```bash
git add scripts/build-content/markdown.ts tests/markdown.test.ts
git commit -m "feat: add markdown section splitter"
```

---

### Task 5: 解析單字區塊

**Files:**
- Create: `scripts/build-content/parse-vocab.ts`
- Test: `tests/parse-vocab.test.ts`

**Interfaces:**
- Consumes: `VocabItem` (Task 2)、`vocabId` (Task 3)、`splitSections`/`findSection` (Task 4)
- Produces: `parseVocab(md: string, chapterId: string): VocabItem[]`

實際格式：`*   **information** 名詞 資訊（不可數） | Please review the *information* carefully.`
子標題（`### 名詞字尾相關`）要略過，不能當成單字。

- [ ] **Step 1: 寫失敗的測試**

`tests/parse-vocab.test.ts`：

```ts
import { describe, it, expect } from 'vitest'
import { parseVocab } from '../scripts/build-content/parse-vocab'

const MD = `## 🔤 相關單字和片語
### 名詞字尾相關
*   **information** 名詞 資訊（不可數） | Please review the *information* carefully.
*   **decision** 名詞 決定 | The manager made a final *decision* yesterday.

### 代名詞與片語
*   **each other** 片語 彼此（兩者間） | The two teams cooperated with *each other*.
*   **another** 代名詞/形容詞 另一個（單數） | Could you show me *another* option?

## 💪 練習題（5 題）
**1.** Not a vocab line.
`

describe('parseVocab', () => {
  it('parses every vocab line across sub-headings', () => {
    expect(parseVocab(MD, 'grammar/01_x/01_y')).toHaveLength(4)
  })

  it('splits word, pos, meaning and example', () => {
    const first = parseVocab(MD, 'grammar/01_x/01_y')[0]
    expect(first).toMatchObject({
      id: 'grammar/01_x/01_y#v-information',
      word: 'information',
      pos: '名詞',
      meaning: '資訊（不可數）',
      example: 'Please review the *information* carefully.',
    })
  })

  it('handles multi-word entries', () => {
    const item = parseVocab(MD, 'grammar/01_x/01_y').find((v) => v.word === 'each other')
    expect(item?.pos).toBe('片語')
    expect(item?.meaning).toBe('彼此（兩者間）')
  })

  it('handles a slashed part of speech', () => {
    const item = parseVocab(MD, 'grammar/01_x/01_y').find((v) => v.word === 'another')
    expect(item?.pos).toBe('代名詞/形容詞')
  })

  it('does not leak lines from other sections', () => {
    expect(parseVocab(MD, 'grammar/01_x/01_y').some((v) => v.word.includes('Not a vocab'))).toBe(false)
  })

  it('returns an empty array when the section is missing', () => {
    expect(parseVocab('## 其他\n內容', 'grammar/01_x/01_y')).toEqual([])
  })
})
```

- [ ] **Step 2: 執行測試確認失敗**

```bash
pnpm vitest run tests/parse-vocab.test.ts
```

預期：FAIL。

- [ ] **Step 3: 實作 parse-vocab.ts**

```ts
import type { VocabItem } from './types'
import { vocabId } from './id'
import { splitSections, findSection } from './markdown'

/** `*   **word** pos meaning | example` */
const LINE_RE = /^\*\s+\*\*(.+?)\*\*\s*(.*)$/

export function parseVocab(md: string, chapterId: string): VocabItem[] {
  const section = findSection(splitSections(md), '相關單字和片語')
  if (!section) return []

  const items: VocabItem[] = []
  for (const rawLine of section.body.split(/\r?\n/)) {
    const line = rawLine.trim()
    const match = LINE_RE.exec(line)
    if (!match) continue

    const word = (match[1] ?? '').trim()
    const rest = (match[2] ?? '').trim()
    const [beforeExample, ...exampleParts] = rest.split('|')
    const example = exampleParts.join('|').trim()

    // pos is the first whitespace-delimited token; the remainder is the meaning.
    const descriptor = (beforeExample ?? '').trim()
    const spaceIndex = descriptor.search(/\s/)
    const pos = spaceIndex === -1 ? descriptor : descriptor.slice(0, spaceIndex)
    const meaning = spaceIndex === -1 ? '' : descriptor.slice(spaceIndex).trim()

    if (!word || !meaning) continue
    items.push({ id: vocabId(chapterId, word), chapterId, word, pos, meaning, example })
  }
  return items
}
```

- [ ] **Step 4: 執行測試確認通過**

```bash
pnpm vitest run tests/parse-vocab.test.ts
```

預期：6 passed。

- [ ] **Step 5: 對真實筆記做一次抽樣驗證**

建立 `tests/parse-vocab.real.test.ts`：

```ts
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseVocab } from '../scripts/build-content/parse-vocab'

const NOTES_DIR = process.env.NOTES_DIR ?? 'D:\\my-note\\個人學習\\多益'

describe('parseVocab against a real note', () => {
  it('extracts 13 items from 01_名詞與代名詞', () => {
    const path = join(NOTES_DIR, '文法', '01_八大詞性與句型結構', '01_名詞與代名詞.md')
    const items = parseVocab(readFileSync(path, 'utf8'), 'grammar/01_八大詞性與句型結構/01_名詞與代名詞')
    expect(items.length).toBe(13)
    expect(items.every((i) => i.word.length > 0 && i.meaning.length > 0)).toBe(true)
  })
})
```

執行 `pnpm vitest run tests/parse-vocab.real.test.ts`。若實際數量不是 13，改成實際值並確認每一筆都合理——**不要為了讓測試通過而放寬 parser**。

- [ ] **Step 6: Commit**

```bash
git add scripts/build-content/parse-vocab.ts tests/parse-vocab.test.ts tests/parse-vocab.real.test.ts
git commit -m "feat: parse vocabulary entries from grammar notes"
```

---

### Task 6: 解析秒殺公式區塊

**Files:**
- Create: `scripts/build-content/parse-formulas.ts`
- Test: `tests/parse-formulas.test.ts`

**Interfaces:**
- Consumes: `Formula` (Task 2)、`formulaId` (Task 3)、`splitSections`/`findSection` (Task 4)
- Produces: `parseFormulas(md: string, chapterId: string): Formula[]`

實際格式：`1.  **可數 vs. 不可數名詞陷阱**：\`information\` 不可數…`（編號清單，標題粗體後接全形冒號）

- [ ] **Step 1: 寫失敗的測試**

`tests/parse-formulas.test.ts`：

```ts
import { describe, it, expect } from 'vitest'
import { parseFormulas } from '../scripts/build-content/parse-formulas'

const MD = `## 📚 補充秒殺公式
1.  **可數 vs. 不可數名詞陷阱**：\`information\`, \`advice\` 都是不可數名詞，看到 informations 直接刪掉。
2.  **複合名詞判斷**：兩個名詞相連時，前面的名詞常轉為形容詞用法。
3.  沒有粗體標題的公式也要收進來。

## 🔤 相關單字和片語
*   **information** 名詞 資訊 | Example.
`

describe('parseFormulas', () => {
  it('parses each numbered entry', () => {
    expect(parseFormulas(MD, 'grammar/01_x/01_y')).toHaveLength(3)
  })

  it('extracts the bold title and body separately', () => {
    const first = parseFormulas(MD, 'grammar/01_x/01_y')[0]
    expect(first?.id).toBe('grammar/01_x/01_y#f1')
    expect(first?.number).toBe(1)
    expect(first?.title).toBe('可數 vs. 不可數名詞陷阱')
    expect(first?.body).toContain('不可數名詞')
  })

  it('falls back to an empty title when there is no bold prefix', () => {
    const third = parseFormulas(MD, 'grammar/01_x/01_y')[2]
    expect(third?.title).toBe('')
    expect(third?.body).toBe('沒有粗體標題的公式也要收進來。')
  })

  it('does not leak the vocabulary section', () => {
    expect(parseFormulas(MD, 'grammar/01_x/01_y').some((f) => f.body.includes('名詞 資訊'))).toBe(false)
  })

  it('returns an empty array when the section is missing', () => {
    expect(parseFormulas('## 核心概念\n內容', 'grammar/01_x/01_y')).toEqual([])
  })
})
```

- [ ] **Step 2: 執行測試確認失敗**

```bash
pnpm vitest run tests/parse-formulas.test.ts
```

預期：FAIL。

- [ ] **Step 3: 實作 parse-formulas.ts**

```ts
import type { Formula } from './types'
import { formulaId } from './id'
import { splitSections, findSection } from './markdown'

/** `1.  **Title**：body` — the numbered-list marker starts a new entry. */
const ENTRY_RE = /^(\d+)\.\s+(.*)$/
const TITLE_RE = /^\*\*(.+?)\*\*[：:]\s*(.*)$/

export function parseFormulas(md: string, chapterId: string): Formula[] {
  const section = findSection(splitSections(md), '補充秒殺公式')
  if (!section) return []

  const formulas: Formula[] = []
  let current: { number: number; lines: string[] } | null = null

  const flush = () => {
    if (!current) return
    const raw = current.lines.join('\n').trim()
    const titleMatch = TITLE_RE.exec(raw)
    const title = titleMatch ? (titleMatch[1] ?? '').trim() : ''
    const body = titleMatch ? (titleMatch[2] ?? '').trim() : raw
    if (body) {
      formulas.push({ id: formulaId(chapterId, current.number), chapterId, number: current.number, title, body })
    }
    current = null
  }

  for (const rawLine of section.body.split(/\r?\n/)) {
    const line = rawLine.trim()
    const match = ENTRY_RE.exec(line)
    if (match) {
      flush()
      current = { number: Number(match[1]), lines: [match[2] ?? ''] }
      continue
    }
    if (current && line) current.lines.push(line)
  }
  flush()
  return formulas
}
```

- [ ] **Step 4: 執行測試確認通過**

```bash
pnpm vitest run tests/parse-formulas.test.ts
```

預期：5 passed。

- [ ] **Step 5: Commit**

```bash
git add scripts/build-content/parse-formulas.ts tests/parse-formulas.test.ts
git commit -m "feat: parse shortcut formula entries"
```

---

### Task 7: 解析文法練習題（含雙空格題）

**Files:**
- Create: `scripts/build-content/parse-questions.ts`
- Test: `tests/parse-questions.test.ts`

**Interfaces:**
- Consumes: `Question`, `Blank`, `Option`, `OptionKey` (Task 2)、`questionId` (Task 3)、`splitSections`/`findSection` (Task 4)
- Produces: `parseQuestions(md: string, chapterId: string, categoryId: string): ParsedQuestion[]`，其中 `ParsedQuestion = Omit<Question, 'explanation' | 'blanks'> & { blanks: Omit<Blank, 'answer'>[] }`（答案在 Task 9 才合併進來），以及 `extractOptions(line: string): Option[]`

實際格式有兩種：

```
**1.** Please make sure your ___ is accurate.
(A) inform (B) informative (C) information (D) informational
```

```
**5.** ...（第一空）... improve their ___ with staff.（第二空）
第一空：(A) satisfy (B) satisfied (C) satisfaction (D) satisfactorily
第二空：(A) communicate (B) communication (C) communicative (D) communicator
```

- [ ] **Step 1: 寫失敗的測試**

`tests/parse-questions.test.ts`：

```ts
import { describe, it, expect } from 'vitest'
import { parseQuestions, extractOptions } from '../scripts/build-content/parse-questions'

const MD = `## 💪 練習題（5 題）

**1.** Please make sure your ___ is accurate before submitting the form.
(A) inform (B) informative (C) information (D) informational

**2.** The board members will introduce ___ before the meeting begins.
(A) they (B) them (C) themselves (D) their

**5.** The company published a survey to measure employee ___ regarding the policy.（第一空）In addition, managers should improve their ___ with staff.（第二空）
第一空：(A) satisfy (B) satisfied (C) satisfaction (D) satisfactorily
第二空：(A) communicate (B) communication (C) communicative (D) communicator

📖 詳解請見：[[詳解/01_八大詞性與句型結構/01_名詞與代名詞]]
`

describe('extractOptions', () => {
  it('splits four inline options', () => {
    expect(extractOptions('(A) inform (B) informative (C) information (D) informational')).toEqual([
      { key: 'A', text: 'inform' },
      { key: 'B', text: 'informative' },
      { key: 'C', text: 'information' },
      { key: 'D', text: 'informational' },
    ])
  })

  it('keeps multi-word option text intact', () => {
    const options = extractOptions('(A) another (B) other (C) others (D) the other')
    expect(options[3]).toEqual({ key: 'D', text: 'the other' })
  })

  it('strips a 第一空： prefix', () => {
    const options = extractOptions('第一空：(A) satisfy (B) satisfied (C) satisfaction (D) satisfactorily')
    expect(options).toHaveLength(4)
    expect(options[0]?.text).toBe('satisfy')
  })

  it('returns an empty array for a non-option line', () => {
    expect(extractOptions('**1.** Please make sure your ___ is accurate.')).toEqual([])
  })
})

describe('parseQuestions', () => {
  const questions = parseQuestions(MD, 'grammar/01_八大詞性與句型結構/01_名詞與代名詞', '01_八大詞性與句型結構')

  it('parses every numbered question', () => {
    expect(questions.map((q) => q.number)).toEqual([1, 2, 5])
  })

  it('builds stable ids from the chapter and question number', () => {
    expect(questions[0]?.id).toBe('grammar/01_八大詞性與句型結構/01_名詞與代名詞#q1')
  })

  it('keeps the stem free of option text', () => {
    expect(questions[0]?.stem).toBe('Please make sure your ___ is accurate before submitting the form.')
  })

  it('gives single-blank questions exactly one blank with a null label', () => {
    expect(questions[0]?.blanks).toHaveLength(1)
    expect(questions[0]?.blanks[0]?.label).toBeNull()
  })

  it('gives multi-blank questions one blank per labelled option line', () => {
    const q5 = questions.find((q) => q.number === 5)
    expect(q5?.blanks).toHaveLength(2)
    expect(q5?.blanks.map((b) => b.label)).toEqual(['第一空', '第二空'])
    expect(q5?.blanks[1]?.options[1]?.text).toBe('communication')
  })

  it('excludes the wikilink footer from the last stem', () => {
    const q5 = questions.find((q) => q.number === 5)
    expect(q5?.stem).not.toContain('詳解請見')
  })

  it('returns an empty array when the section is missing', () => {
    expect(parseQuestions('## 核心概念\n內容', 'grammar/01_x/01_y', '01_x')).toEqual([])
  })
})
```

- [ ] **Step 2: 執行測試確認失敗**

```bash
pnpm vitest run tests/parse-questions.test.ts
```

預期：FAIL。

- [ ] **Step 3: 實作 parse-questions.ts**

```ts
import type { Option, OptionKey, Question, Blank } from './types'
import { questionId } from './id'
import { splitSections, findSection } from './markdown'

export type ParsedBlank = Omit<Blank, 'answer'>
export type ParsedQuestion = Omit<Question, 'explanation' | 'blanks'> & { blanks: ParsedBlank[] }

const QUESTION_RE = /^\*\*(\d+)\.\*\*\s*(.*)$/
const OPTION_LINE_RE = /\([A-D]\)/
const LABEL_RE = /^(第[一二三四]空)[：:]\s*/
const FOOTER_RE = /^(📖|詳解請見|\[\[)/

/** Extract `(A) x (B) y (C) z (D) w` from one line, tolerating a 第N空： prefix. */
export function extractOptions(line: string): Option[] {
  const withoutLabel = line.replace(LABEL_RE, '').trim()
  if (!OPTION_LINE_RE.test(withoutLabel)) return []

  const options: Option[] = []
  const re = /\(([A-D])\)\s*([\s\S]*?)(?=\s*\([A-D]\)|$)/g
  let match: RegExpExecArray | null
  while ((match = re.exec(withoutLabel)) !== null) {
    const key = match[1] as OptionKey
    const text = (match[2] ?? '').trim()
    if (text) options.push({ key, text })
  }
  return options
}

function labelOf(line: string): string | null {
  const match = LABEL_RE.exec(line.trim())
  return match ? (match[1] ?? null) : null
}

export function parseQuestions(md: string, chapterId: string, categoryId: string): ParsedQuestion[] {
  const section = findSection(splitSections(md), '練習題')
  if (!section) return []

  const questions: ParsedQuestion[] = []
  let current: { number: number; stemLines: string[]; blanks: ParsedBlank[] } | null = null

  const flush = () => {
    if (!current) return
    const stem = current.stemLines.join(' ').replace(/\s+/g, ' ').trim()
    if (stem && current.blanks.length > 0) {
      questions.push({
        id: questionId(chapterId, current.number),
        source: 'note',
        chapterId,
        categoryId,
        number: current.number,
        stem,
        blanks: current.blanks,
      })
    }
    current = null
  }

  for (const rawLine of section.body.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line) continue

    const questionMatch = QUESTION_RE.exec(line)
    if (questionMatch) {
      flush()
      current = { number: Number(questionMatch[1]), stemLines: [questionMatch[2] ?? ''], blanks: [] }
      continue
    }
    if (!current) continue
    if (FOOTER_RE.test(line)) continue

    const options = extractOptions(line)
    if (options.length > 0) {
      current.blanks.push({ label: labelOf(line), options })
      continue
    }
    current.stemLines.push(line)
  }
  flush()
  return questions
}
```

- [ ] **Step 4: 執行測試確認通過**

```bash
pnpm vitest run tests/parse-questions.test.ts
```

預期：11 passed。

- [ ] **Step 5: 對全部 29 章做真實驗證**

`tests/parse-questions.real.test.ts`：

```ts
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { parseQuestions } from '../scripts/build-content/parse-questions'

const NOTES_DIR = process.env.NOTES_DIR ?? 'D:\\my-note\\個人學習\\多益'
const GRAMMAR_DIR = join(NOTES_DIR, '文法')

describe('parseQuestions against every real chapter', () => {
  it('finds exactly 5 questions in each of the 29 chapters', () => {
    const categories = readdirSync(GRAMMAR_DIR, { withFileTypes: true }).filter((d) => d.isDirectory())
    const results: { chapter: string; count: number }[] = []

    for (const category of categories) {
      const dir = join(GRAMMAR_DIR, category.name)
      for (const file of readdirSync(dir).filter((f) => f.endsWith('.md'))) {
        const chapterId = `grammar/${category.name}/${file.replace(/\.md$/, '')}`
        const questions = parseQuestions(readFileSync(join(dir, file), 'utf8'), chapterId, category.name)
        results.push({ chapter: chapterId, count: questions.length })
      }
    }

    expect(results).toHaveLength(29)
    const bad = results.filter((r) => r.count !== 5)
    expect(bad, `chapters without exactly 5 questions: ${JSON.stringify(bad, null, 2)}`).toEqual([])
  })

  it('gives every blank at least two options', () => {
    const dir = join(GRAMMAR_DIR, '01_八大詞性與句型結構')
    for (const file of readdirSync(dir).filter((f) => f.endsWith('.md'))) {
      const questions = parseQuestions(readFileSync(join(dir, file), 'utf8'), `grammar/x/${file}`, 'x')
      for (const q of questions) {
        for (const blank of q.blanks) {
          expect(blank.options.length, `${q.id} has a blank with ${blank.options.length} options`).toBeGreaterThanOrEqual(2)
        }
      }
    }
  })
})
```

執行後如有章節不是 5 題，**先看該章原始 markdown 找出格式差異，修正 parser 或修正筆記**，不要調降期望值。這一步的目的就是把格式異常全部逼出來。

- [ ] **Step 6: Commit**

```bash
git add scripts/build-content/parse-questions.ts tests/parse-questions.test.ts tests/parse-questions.real.test.ts
git commit -m "feat: parse grammar practice questions with multi-blank support"
```

---

### Task 8: 解析詳解檔（5 種答案格式）

**Files:**
- Create: `scripts/build-content/parse-answers.ts`
- Test: `tests/parse-answers.test.ts`

**Interfaces:**
- Consumes: `Explanation`, `OptionKey` (Task 2)、`splitSections` (Task 4)
- Produces: `parseAnswers(md: string): AnswerEntry[]`，`AnswerEntry = { number: number; title: string; answers: OptionKey[]; explanation: Explanation }`；`extractAnswerKeys(text: string): OptionKey[]`

**實測到的 5 種答案格式，全部都要支援：**

| 格式 | 樣本 | 出現次數 |
|---|---|---|
| 單答案 | `**答案**: B` | 219 |
| 全形空格多答案 | `**答案**: (1) B　(2) A` | 12 |
| 逗號多答案 | `**答案**: (1) A, (2) B` | 5 |
| 中文標籤 | `**答案**: 第一空 C 第二空 B` | 7 |
| **答案在下一行** | `**答案**:`⏎`(1) B`⏎`(2) A` | 4 |

- [ ] **Step 1: 寫失敗的測試**

`tests/parse-answers.test.ts`：

```ts
import { describe, it, expect } from 'vitest'
import { parseAnswers, extractAnswerKeys } from '../scripts/build-content/parse-answers'

describe('extractAnswerKeys', () => {
  it('reads a bare single answer', () => {
    expect(extractAnswerKeys('C')).toEqual(['C'])
  })

  it('reads numbered answers separated by an ideographic space', () => {
    expect(extractAnswerKeys('(1) B\u3000(2) A')).toEqual(['B', 'A'])
  })

  it('reads numbered answers separated by a comma', () => {
    expect(extractAnswerKeys('(1) A, (2) B')).toEqual(['A', 'B'])
  })

  it('reads chinese blank labels', () => {
    expect(extractAnswerKeys('第一空 C　第二空 B')).toEqual(['C', 'B'])
  })

  it('reads answers spread over multiple lines', () => {
    expect(extractAnswerKeys('\n(1) B\n(2) A\n')).toEqual(['B', 'A'])
  })

  it('ignores stray letters inside prose', () => {
    expect(extractAnswerKeys('B（注意 A 選項是陷阱）')).toEqual(['B'])
  })

  it('returns an empty array when nothing parses', () => {
    expect(extractAnswerKeys('（待補）')).toEqual([])
  })
})

const MD = `# 01_名詞與代名詞 - 詳細解答

## 題目 1：詞性題 - 名詞字尾判斷
**答案**: C

**詳細解析**:
空格在所有格 \`your\` 之後，需要填入名詞。

**相關文法點**:
對應「1. 必背名詞字尾」。

**相似題型提醒**:
information 不可數，不可加 -s。

---

## 題目 5：段落填空（Part 6 風格）
**答案**:
(1) C
(2) B

**詳細解析**:
第一空需要名詞；第二空同理。
`

describe('parseAnswers', () => {
  const entries = parseAnswers(MD)

  it('parses one entry per question heading', () => {
    expect(entries.map((e) => e.number)).toEqual([1, 5])
  })

  it('keeps the question type as the explanation title', () => {
    expect(entries[0]?.title).toBe('詞性題 - 名詞字尾判斷')
  })

  it('parses a single answer', () => {
    expect(entries[0]?.answers).toEqual(['C'])
  })

  it('parses multi-line answers', () => {
    expect(entries[1]?.answers).toEqual(['C', 'B'])
  })

  it('captures the analysis body', () => {
    expect(entries[0]?.explanation.analysis).toContain('空格在所有格')
  })

  it('captures optional grammar point and similar-question note', () => {
    expect(entries[0]?.explanation.grammarPoint).toContain('必背名詞字尾')
    expect(entries[0]?.explanation.similarNote).toContain('不可數')
  })

  it('sets optional fields to null when absent', () => {
    expect(entries[1]?.explanation.grammarPoint).toBeNull()
    expect(entries[1]?.explanation.similarNote).toBeNull()
  })
})
```

- [ ] **Step 2: 執行測試確認失敗**

```bash
pnpm vitest run tests/parse-answers.test.ts
```

預期：FAIL。

- [ ] **Step 3: 實作 parse-answers.ts**

```ts
import type { Explanation, OptionKey } from './types'
import { splitSections } from './markdown'

export interface AnswerEntry {
  number: number
  title: string
  answers: OptionKey[]
  explanation: Explanation
}

const HEADING_RE = /^題目\s*(\d+)\s*[：:]?\s*(.*)$/
const FIELD_RE = /\*\*(答案|詳細解析|相關文法點|相似題型提醒)\*\*\s*[：:]?/g

/**
 * Answers appear in five shapes across the notes:
 *   C | (1) B　(2) A | (1) A, (2) B | 第一空 C　第二空 B | newline-separated
 * Strategy: prefer explicitly indexed/labelled answers; fall back to the first
 * standalone letter so prose like "（注意 A 選項是陷阱）" never leaks in.
 */
export function extractAnswerKeys(text: string): OptionKey[] {
  const indexed = [...text.matchAll(/\((\d)\)\s*\(?([A-D])\)?/g)]
  if (indexed.length > 0) return indexed.map((m) => m[2] as OptionKey)

  const labelled = [...text.matchAll(/第[一二三四]空\s*[：:]?\s*\(?([A-D])\)?/g)]
  if (labelled.length > 0) return labelled.map((m) => m[1] as OptionKey)

  const first = /(?:^|[\s：:])\(?([A-D])\)?(?=$|[\s。，,（(])/m.exec(text.trim())
  return first ? [first[1] as OptionKey] : []
}

function fieldValues(body: string): Record<string, string> {
  const values: Record<string, string> = {}
  const matches = [...body.matchAll(FIELD_RE)]
  for (let i = 0; i < matches.length; i += 1) {
    const match = matches[i]
    if (!match) continue
    const name = match[1] ?? ''
    const start = match.index + match[0].length
    const next = matches[i + 1]
    const end = next ? next.index : body.length
    values[name] = body.slice(start, end).replace(/^\s*[\r\n]+/, '').replace(/\n?-{3,}\s*$/, '').trim()
  }
  return values
}

export function parseAnswers(md: string): AnswerEntry[] {
  const entries: AnswerEntry[] = []
  for (const section of splitSections(md)) {
    const heading = HEADING_RE.exec(section.heading.trim())
    if (!heading) continue

    const values = fieldValues(section.body)
    const analysis = values['詳細解析'] ?? ''
    entries.push({
      number: Number(heading[1]),
      title: (heading[2] ?? '').trim(),
      answers: extractAnswerKeys(values['答案'] ?? ''),
      explanation: {
        title: (heading[2] ?? '').trim(),
        analysis,
        grammarPoint: values['相關文法點'] ?? null,
        similarNote: values['相似題型提醒'] ?? null,
      },
    })
  }
  return entries
}
```

- [ ] **Step 4: 執行測試確認通過**

```bash
pnpm vitest run tests/parse-answers.test.ts
```

預期：14 passed。

- [ ] **Step 5: 對全部詳解檔做真實驗證**

`tests/parse-answers.real.test.ts`：

```ts
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { parseAnswers } from '../scripts/build-content/parse-answers'

const NOTES_DIR = process.env.NOTES_DIR ?? 'D:\\my-note\\個人學習\\多益'
const EXPLAIN_DIR = join(NOTES_DIR, '詳解')

describe('parseAnswers against every real explanation file', () => {
  it('leaves no entry without an answer key', () => {
    const empty: string[] = []
    const categories = readdirSync(EXPLAIN_DIR, { withFileTypes: true })
      .filter((d) => d.isDirectory() && /^\d/.test(d.name))

    for (const category of categories) {
      const dir = join(EXPLAIN_DIR, category.name)
      for (const file of readdirSync(dir).filter((f) => f.endsWith('.md'))) {
        for (const entry of parseAnswers(readFileSync(join(dir, file), 'utf8'))) {
          if (entry.answers.length === 0) empty.push(`${category.name}/${file} 題目 ${entry.number}`)
        }
      }
    }

    expect(empty, `entries with no parsable answer:\n${empty.join('\n')}`).toEqual([])
  })
})
```

執行 `pnpm vitest run tests/parse-answers.real.test.ts`。任何解不出答案的項目都要逐一檢查原始 markdown 並修正 parser。

- [ ] **Step 6: Commit**

```bash
git add scripts/build-content/parse-answers.ts tests/parse-answers.test.ts tests/parse-answers.real.test.ts
git commit -m "feat: parse explanation files with five answer formats"
```

---

### Task 9: 合併題目與詳解並驗證

**Files:**
- Create: `scripts/build-content/merge.ts`
- Test: `tests/merge.test.ts`

**Interfaces:**
- Consumes: `ParsedQuestion` (Task 7)、`AnswerEntry` (Task 8)、`Question` (Task 2)
- Produces: `mergeQuestions(questions: ParsedQuestion[], answers: AnswerEntry[], sourceLabel: string): MergeResult`，`MergeResult = { questions: Question[]; issues: Issue[] }`，`Issue = { level: 'error' | 'warn'; questionId: string; message: string }`

驗證規則：
1. 題目沒有對應詳解 → error
2. 答案數與 blank 數不符 → error
3. 答案字母不在該 blank 的選項中 → error
4. 詳解存在但沒有對應題目 → warn
5. `analysis` 為空 → warn

- [ ] **Step 1: 寫失敗的測試**

`tests/merge.test.ts`：

```ts
import { describe, it, expect } from 'vitest'
import { mergeQuestions } from '../scripts/build-content/merge'
import type { ParsedQuestion } from '../scripts/build-content/parse-questions'
import type { AnswerEntry } from '../scripts/build-content/parse-answers'

const question = (number: number, blankCount: number): ParsedQuestion => ({
  id: `grammar/x/y#q${number}`,
  source: 'note',
  chapterId: 'grammar/x/y',
  categoryId: 'x',
  number,
  stem: `stem ${number}`,
  blanks: Array.from({ length: blankCount }, (_, i) => ({
    label: blankCount > 1 ? `第${'一二'[i]}空` : null,
    options: [
      { key: 'A' as const, text: 'a' },
      { key: 'B' as const, text: 'b' },
      { key: 'C' as const, text: 'c' },
      { key: 'D' as const, text: 'd' },
    ],
  })),
})

const answer = (number: number, answers: ('A' | 'B' | 'C' | 'D')[]): AnswerEntry => ({
  number,
  title: 't',
  answers,
  explanation: { title: 't', analysis: 'why', grammarPoint: null, similarNote: null },
})

describe('mergeQuestions', () => {
  it('attaches the answer key to each blank', () => {
    const result = mergeQuestions([question(1, 1)], [answer(1, ['C'])], 'chapter')
    expect(result.issues).toEqual([])
    expect(result.questions[0]?.blanks[0]?.answer).toBe('C')
    expect(result.questions[0]?.explanation?.analysis).toBe('why')
  })

  it('maps multi-blank answers in order', () => {
    const result = mergeQuestions([question(5, 2)], [answer(5, ['C', 'B'])], 'chapter')
    expect(result.questions[0]?.blanks.map((b) => b.answer)).toEqual(['C', 'B'])
  })

  it('errors when a question has no explanation', () => {
    const result = mergeQuestions([question(1, 1)], [], 'chapter')
    expect(result.questions).toEqual([])
    expect(result.issues).toContainEqual({
      level: 'error',
      questionId: 'grammar/x/y#q1',
      message: 'chapter：題目 1 找不到對應詳解',
    })
  })

  it('errors when the answer count does not match the blank count', () => {
    const result = mergeQuestions([question(5, 2)], [answer(5, ['C'])], 'chapter')
    expect(result.questions).toEqual([])
    expect(result.issues[0]?.level).toBe('error')
    expect(result.issues[0]?.message).toContain('答案數 1 與空格數 2 不符')
  })

  it('errors when an answer letter is not among the options', () => {
    const q = question(1, 1)
    q.blanks[0]!.options = [
      { key: 'A', text: 'a' },
      { key: 'B', text: 'b' },
    ]
    const result = mergeQuestions([q], [answer(1, ['D'])], 'chapter')
    expect(result.issues[0]?.message).toContain('答案 D 不在選項中')
  })

  it('warns about an explanation with no matching question', () => {
    const result = mergeQuestions([question(1, 1)], [answer(1, ['A']), answer(9, ['B'])], 'chapter')
    expect(result.questions).toHaveLength(1)
    expect(result.issues).toContainEqual({
      level: 'warn',
      questionId: 'grammar/x/y#q9',
      message: 'chapter：詳解 題目 9 沒有對應的題目',
    })
  })

  it('warns about an empty analysis but still keeps the question', () => {
    const a = answer(1, ['A'])
    a.explanation.analysis = ''
    const result = mergeQuestions([question(1, 1)], [a], 'chapter')
    expect(result.questions).toHaveLength(1)
    expect(result.issues[0]?.level).toBe('warn')
  })
})
```

- [ ] **Step 2: 執行測試確認失敗**

```bash
pnpm vitest run tests/merge.test.ts
```

預期：FAIL。

- [ ] **Step 3: 實作 merge.ts**

```ts
import type { Question } from './types'
import type { ParsedQuestion } from './parse-questions'
import type { AnswerEntry } from './parse-answers'

export interface Issue {
  level: 'error' | 'warn'
  questionId: string
  message: string
}

export interface MergeResult {
  questions: Question[]
  issues: Issue[]
}

/**
 * Pair parsed questions with their explanation entries by question number.
 * A question that fails any error-level check is dropped from the output so
 * broken data can never reach the app; the build then fails on issue count.
 */
export function mergeQuestions(
  questions: ParsedQuestion[],
  answers: AnswerEntry[],
  sourceLabel: string,
): MergeResult {
  const byNumber = new Map(answers.map((a) => [a.number, a]))
  const usedNumbers = new Set<number>()
  const merged: Question[] = []
  const issues: Issue[] = []

  for (const question of questions) {
    const entry = byNumber.get(question.number)
    if (!entry) {
      issues.push({
        level: 'error',
        questionId: question.id,
        message: `${sourceLabel}：題目 ${question.number} 找不到對應詳解`,
      })
      continue
    }
    usedNumbers.add(question.number)

    if (entry.answers.length !== question.blanks.length) {
      issues.push({
        level: 'error',
        questionId: question.id,
        message: `${sourceLabel}：題目 ${question.number} 答案數 ${entry.answers.length} 與空格數 ${question.blanks.length} 不符`,
      })
      continue
    }

    const blanks = question.blanks.map((blank, index) => ({
      ...blank,
      answer: entry.answers[index]!,
    }))

    const invalid = blanks.find((blank) => !blank.options.some((o) => o.key === blank.answer))
    if (invalid) {
      issues.push({
        level: 'error',
        questionId: question.id,
        message: `${sourceLabel}：題目 ${question.number} 答案 ${invalid.answer} 不在選項中`,
      })
      continue
    }

    if (!entry.explanation.analysis) {
      issues.push({
        level: 'warn',
        questionId: question.id,
        message: `${sourceLabel}：題目 ${question.number} 的詳解沒有解析內容`,
      })
    }

    merged.push({ ...question, blanks, explanation: entry.explanation })
  }

  for (const entry of answers) {
    if (usedNumbers.has(entry.number)) continue
    issues.push({
      level: 'warn',
      questionId: `${questions[0]?.chapterId ?? sourceLabel}#q${entry.number}`,
      message: `${sourceLabel}：詳解 題目 ${entry.number} 沒有對應的題目`,
    })
  }

  return { questions: merged, issues }
}
```

- [ ] **Step 4: 執行測試確認通過**

```bash
pnpm vitest run tests/merge.test.ts
```

預期：7 passed。

- [ ] **Step 5: Commit**

```bash
git add scripts/build-content/merge.ts tests/merge.test.ts
git commit -m "feat: merge questions with explanations and validate"
```

---

### Task 10: 解析閱讀理解

**Files:**
- Create: `scripts/build-content/parse-reading.ts`
- Test: `tests/parse-reading.test.ts`

**Interfaces:**
- Consumes: `ReadingPassage` (Task 2)、`ParsedQuestion` (Task 7)、`splitSections` (Task 4)
- Produces: `parseReading(md, chapterId, kind): ParsedReadingPassage[]`，其中
  `ParsedReadingPassage = Omit<ReadingPassage, 'questions'> & { questions: ParsedQuestion[] }`
  ——答案由 Task 9 的 `mergeQuestions` 補上，此處不得使用型別 cast 假裝已有答案

閱讀檔結構與文法章節不同：`## 短文一：公司內部公告` 底下接本文，再接 `### 題目 N`（選項各自獨立成行）。`## 📝 答題策略` 區塊要略過。

- [ ] **Step 1: 寫失敗的測試**

`tests/parse-reading.test.ts`：

```ts
import { describe, it, expect } from 'vitest'
import { parseReading } from '../scripts/build-content/parse-reading'

const MD = `# 01_綜合練習一

## 📝 答題策略 🌟
1.  時態一致原則。

---

## 短文一：公司內部公告

Notice to All Staff

Starting next Monday, the office will ______(1) to a new floor plan.

### 題目 1
(A) move
(B) moving
(C) moved
(D) has moved

### 題目 2（細節題）
(A) The cafeteria will remain open.
(B) All desks must be packed by Friday.
(C) The company was founded years ago.
(D) Please bring your own lunch.
`

describe('parseReading', () => {
  const passages = parseReading(MD, 'reading/02_段落填空題/01_綜合練習一', 'paragraph')

  it('skips the strategy section and keeps only passages', () => {
    expect(passages).toHaveLength(1)
    expect(passages[0]?.title).toBe('短文一：公司內部公告')
  })

  it('keeps the passage body', () => {
    expect(passages[0]?.passage).toContain('Notice to All Staff')
    expect(passages[0]?.passage).not.toContain('題目 1')
  })

  it('parses questions with one option per line', () => {
    expect(passages[0]?.questions).toHaveLength(2)
    expect(passages[0]?.questions[0]?.blanks[0]?.options).toHaveLength(4)
    expect(passages[0]?.questions[0]?.blanks[0]?.options[1]?.text).toBe('moving')
  })

  it('keeps full-sentence options intact', () => {
    const q2 = passages[0]?.questions[1]
    expect(q2?.blanks[0]?.options[1]?.text).toBe('All desks must be packed by Friday.')
  })

  it('builds ids that include the passage index', () => {
    expect(passages[0]?.id).toBe('reading/02_段落填空題/01_綜合練習一#p1')
    expect(passages[0]?.questions[0]?.id).toBe('reading/02_段落填空題/01_綜合練習一#p1q1')
  })

  it('records the reading kind', () => {
    expect(passages[0]?.kind).toBe('paragraph')
  })
})
```

- [ ] **Step 2: 執行測試確認失敗**

```bash
pnpm vitest run tests/parse-reading.test.ts
```

預期：FAIL。

- [ ] **Step 3: 實作 parse-reading.ts**

```ts
import type { Option, OptionKey, ReadingPassage } from './types'
import type { ParsedQuestion } from './parse-questions'
import { splitSections } from './markdown'

const QUESTION_HEADING_RE = /^題目\s*(\d+)/
const SKIP_HEADING_RE = /(答題策略|解題技巧)/
const OPTION_RE = /^\(([A-D])\)\s*(.+)$/

/** Reading notes put each option on its own line, unlike grammar chapters. */
function optionsFromLines(body: string): Option[] {
  const options: Option[] = []
  for (const rawLine of body.split(/\r?\n/)) {
    const match = OPTION_RE.exec(rawLine.trim())
    if (!match) continue
    options.push({ key: match[1] as OptionKey, text: (match[2] ?? '').trim() })
  }
  return options
}

export type ParsedReadingPassage = Omit<ReadingPassage, 'questions'> & { questions: ParsedQuestion[] }

export function parseReading(
  md: string,
  chapterId: string,
  kind: 'single' | 'paragraph' | 'article',
): ParsedReadingPassage[] {
  const sections = splitSections(md)
  const passages: ParsedReadingPassage[] = []
  let passageIndex = 0

  for (const section of sections) {
    if (section.level === 2) {
      if (SKIP_HEADING_RE.test(section.heading)) continue
      passageIndex += 1
      passages.push({
        id: `${chapterId}#p${passageIndex}`,
        kind,
        title: section.heading.trim(),
        passage: section.body.replace(/^-{3,}$/gm, '').trim(),
        questions: [],
      })
      continue
    }

    const heading = QUESTION_HEADING_RE.exec(section.heading.trim())
    const passage = passages[passages.length - 1]
    if (!heading || !passage) continue

    const number = Number(heading[1])
    const options = optionsFromLines(section.body)
    if (options.length === 0) continue

    passage.questions.push({
      id: `${passage.id}q${number}`,
      source: 'note',
      chapterId,
      categoryId: kind,
      number,
      stem: section.heading.trim(),
      blanks: [{ label: null, options }],
    })
  }

  return passages.filter((p) => p.questions.length > 0)
}
```

- [ ] **Step 4: 執行測試確認通過**

```bash
pnpm vitest run tests/parse-reading.test.ts
```

預期：6 passed。

- [ ] **Step 5: Commit**

```bash
git add scripts/build-content/parse-reading.ts tests/parse-reading.test.ts
git commit -m "feat: parse reading comprehension passages"
```

---

### Task 11: 解析模擬考

**Files:**
- Create: `scripts/build-content/parse-mock.ts`
- Test: `tests/parse-mock.test.ts`

**Interfaces:**
- Consumes: `MockExam` (Task 2)、`splitSections` (Task 4)、`extractOptions` (Task 7)、`ParsedQuestion` (Task 7)
- Produces: `parseMockExam(md, chapterId, title): ParsedMockExam`，其中
  `ParsedMockExam = Omit<MockExam, 'questions'> & { questions: ParsedQuestion[] }`

模擬考題目標題同為 `### 題目 N`，但題號連續到 31 以上，且題幹在標題下方、選項可能同行或分行——兩種都要支援。

- [ ] **Step 1: 寫失敗的測試**

`tests/parse-mock.test.ts`：

```ts
import { describe, it, expect } from 'vitest'
import { parseMockExam } from '../scripts/build-content/parse-mock'

const MD = `# 模擬測驗一

## Part 5：單句填空

### 題目 1
The manager ___ the report before the deadline.
(A) submit (B) submits (C) submitted (D) submitting

### 題目 2
All employees ___ attend the safety training.
(A) must
(B) should
(C) can
(D) may
`

describe('parseMockExam', () => {
  const exam = parseMockExam(MD, 'mock/模擬測驗一', '模擬測驗一')

  it('collects every question across parts', () => {
    expect(exam.questions.map((q) => q.number)).toEqual([1, 2])
  })

  it('supports inline options', () => {
    expect(exam.questions[0]?.blanks[0]?.options).toHaveLength(4)
    expect(exam.questions[0]?.blanks[0]?.options[2]?.text).toBe('submitted')
  })

  it('supports one-option-per-line', () => {
    expect(exam.questions[1]?.blanks[0]?.options).toHaveLength(4)
    expect(exam.questions[1]?.blanks[0]?.options[0]?.text).toBe('must')
  })

  it('keeps the stem separate from the options', () => {
    expect(exam.questions[0]?.stem).toBe('The manager ___ the report before the deadline.')
  })

  it('builds ids from the exam chapter', () => {
    expect(exam.id).toBe('mock/模擬測驗一')
    expect(exam.questions[0]?.id).toBe('mock/模擬測驗一#q1')
  })
})
```

- [ ] **Step 2: 執行測試確認失敗**

```bash
pnpm vitest run tests/parse-mock.test.ts
```

預期：FAIL。

- [ ] **Step 3: 實作 parse-mock.ts**

```ts
import type { MockExam, Option, OptionKey } from './types'
import type { ParsedQuestion } from './parse-questions'
import { extractOptions } from './parse-questions'
import { splitSections } from './markdown'
import { questionId } from './id'

const QUESTION_HEADING_RE = /^題目\s*(\d+)/
const SINGLE_OPTION_RE = /^\(([A-D])\)\s*(.+)$/

/** Mock exams mix inline `(A) x (B) y` and one-per-line option layouts. */
function parseBody(body: string): { stem: string; options: Option[] } {
  const stemLines: string[] = []
  const options: Option[] = []

  for (const rawLine of body.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line) continue

    const inline = extractOptions(line)
    if (inline.length >= 2) {
      options.push(...inline)
      continue
    }
    const single = SINGLE_OPTION_RE.exec(line)
    if (single) {
      options.push({ key: single[1] as OptionKey, text: (single[2] ?? '').trim() })
      continue
    }
    stemLines.push(line)
  }

  return { stem: stemLines.join(' ').replace(/\s+/g, ' ').trim(), options }
}

export type ParsedMockExam = Omit<MockExam, 'questions'> & { questions: ParsedQuestion[] }

export function parseMockExam(md: string, chapterId: string, title: string): ParsedMockExam {
  const questions: ParsedQuestion[] = []

  for (const section of splitSections(md)) {
    const heading = QUESTION_HEADING_RE.exec(section.heading.trim())
    if (!heading) continue

    const number = Number(heading[1])
    const { stem, options } = parseBody(section.body)
    if (options.length < 2 || !stem) continue

    questions.push({
      id: questionId(chapterId, number),
      source: 'note',
      chapterId,
      categoryId: 'mock',
      number,
      stem,
      blanks: [{ label: null, options }],
    })
  }

  return { id: chapterId, title, questions }
}
```

- [ ] **Step 4: 執行測試確認通過**

```bash
pnpm vitest run tests/parse-mock.test.ts
```

預期：5 passed。

- [ ] **Step 5: Commit**

```bash
git add scripts/build-content/parse-mock.ts tests/parse-mock.test.ts
git commit -m "feat: parse mock exam papers"
```

---

### Task 12: CLI 進入點與 build report

**Files:**
- Create: `scripts/build-content/report.ts`, `scripts/build-content/index.ts`
- Test: `tests/report.test.ts`

**Interfaces:**
- Consumes: 全部前述 parser 與 `mergeQuestions`
- Produces: `pnpm build:content` 指令；`content/*.json`；`formatReport(stats: BuildStats, issues: Issue[]): string`

- [ ] **Step 1: 寫失敗的測試**

`tests/report.test.ts`：

```ts
import { describe, it, expect } from 'vitest'
import { formatReport, hasBlockingIssues } from '../scripts/build-content/report'

const stats = { chapters: 29, grammar: 145, vocab: 314, formulas: 145, reading: 6, mockExams: 2 }

describe('formatReport', () => {
  it('lists every count', () => {
    const output = formatReport(stats, [])
    expect(output).toContain('文法題：145')
    expect(output).toContain('單字：314')
    expect(output).toContain('沒有發現問題')
  })

  it('lists errors before warnings', () => {
    const output = formatReport(stats, [
      { level: 'warn', questionId: 'a#q1', message: 'warn message' },
      { level: 'error', questionId: 'b#q2', message: 'error message' },
    ])
    expect(output.indexOf('error message')).toBeLessThan(output.indexOf('warn message'))
  })
})

describe('hasBlockingIssues', () => {
  it('is true when any error exists', () => {
    expect(hasBlockingIssues([{ level: 'error', questionId: 'x', message: 'm' }])).toBe(true)
  })

  it('is false when only warnings exist', () => {
    expect(hasBlockingIssues([{ level: 'warn', questionId: 'x', message: 'm' }])).toBe(false)
  })
})
```

- [ ] **Step 2: 執行測試確認失敗**

```bash
pnpm vitest run tests/report.test.ts
```

預期：FAIL。

- [ ] **Step 3: 實作 report.ts**

```ts
import type { Issue } from './merge'

export interface BuildStats {
  chapters: number
  grammar: number
  vocab: number
  formulas: number
  reading: number
  mockExams: number
}

export function hasBlockingIssues(issues: Issue[]): boolean {
  return issues.some((i) => i.level === 'error')
}

export function formatReport(stats: BuildStats, issues: Issue[]): string {
  const lines: string[] = []
  lines.push('=== 題庫 build report ===')
  lines.push(`章節：${stats.chapters}`)
  lines.push(`文法題：${stats.grammar}`)
  lines.push(`單字：${stats.vocab}`)
  lines.push(`秒殺公式：${stats.formulas}`)
  lines.push(`閱讀篇章：${stats.reading}`)
  lines.push(`模擬考：${stats.mockExams}`)
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
```

- [ ] **Step 4: 執行測試確認通過**

```bash
pnpm vitest run tests/report.test.ts
```

預期：4 passed。

- [ ] **Step 5: 實作 index.ts**

```ts
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs'
import { join, relative } from 'node:path'
import { parseQuestions } from './parse-questions'
import { parseVocab } from './parse-vocab'
import { parseFormulas } from './parse-formulas'
import { parseAnswers } from './parse-answers'
import { parseReading } from './parse-reading'
import { parseMockExam } from './parse-mock'
import { mergeQuestions, type Issue } from './merge'
import { chapterIdFromPath } from './id'
import { formatReport, hasBlockingIssues, type BuildStats } from './report'
import type { Question, VocabItem, Formula, ReadingPassage, MockExam } from './types'

const NOTES_DIR = process.env.NOTES_DIR ?? 'D:\\my-note\\個人學習\\多益'
const OUT_DIR = join(process.cwd(), 'content')

const READING_KINDS: Record<string, 'single' | 'paragraph' | 'article'> = {
  '01_單句填空題': 'single',
  '02_段落填空題': 'paragraph',
  '03_篇章閱讀題': 'article',
}

function mdFiles(dir: string): string[] {
  return readdirSync(dir).filter((f) => f.endsWith('.md')).sort()
}

function subDirs(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort()
}

function main(): void {
  const issues: Issue[] = []
  const grammar: Question[] = []
  const vocab: VocabItem[] = []
  const formulas: Formula[] = []
  const reading: ReadingPassage[] = []
  const mockExams: MockExam[] = []
  let chapters = 0

  // --- grammar chapters ---
  const grammarDir = join(NOTES_DIR, '文法')
  for (const category of subDirs(grammarDir)) {
    for (const file of mdFiles(join(grammarDir, category))) {
      chapters += 1
      const notePath = join(grammarDir, category, file)
      const chapterId = chapterIdFromPath(relative(NOTES_DIR, notePath))
      const md = readFileSync(notePath, 'utf8')

      vocab.push(...parseVocab(md, chapterId))
      formulas.push(...parseFormulas(md, chapterId))

      const parsed = parseQuestions(md, chapterId, category)
      const explainPath = join(NOTES_DIR, '詳解', category, file)
      let answers: ReturnType<typeof parseAnswers> = []
      try {
        answers = parseAnswers(readFileSync(explainPath, 'utf8'))
      } catch {
        issues.push({ level: 'error', questionId: chapterId, message: `${chapterId}：找不到詳解檔 ${explainPath}` })
      }

      const merged = mergeQuestions(parsed, answers, chapterId)
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

      const explainPath = join(NOTES_DIR, '詳解', '閱讀理解', kindDir, file)
      const answers = parseAnswers(readFileSync(explainPath, 'utf8'))
      for (const passage of passages) {
        const merged = mergeQuestions(passage.questions, answers, chapterId)
        issues.push(...merged.issues)
        reading.push({ ...passage, questions: merged.questions })
      }
    }
  }

  // --- mock exams ---
  const mockDir = join(NOTES_DIR, '模擬考試')
  for (const file of mdFiles(mockDir)) {
    const notePath = join(mockDir, file)
    const chapterId = chapterIdFromPath(relative(NOTES_DIR, notePath))
    const title = file.replace(/\.md$/, '')
    const exam = parseMockExam(readFileSync(notePath, 'utf8'), chapterId, title)

    const answers = parseAnswers(readFileSync(join(NOTES_DIR, '詳解', '模擬考試', file), 'utf8'))
    const merged = mergeQuestions(exam.questions, answers, chapterId)
    issues.push(...merged.issues)
    mockExams.push({ ...exam, questions: merged.questions })
  }

  const stats: BuildStats = {
    chapters,
    grammar: grammar.length,
    vocab: vocab.length,
    formulas: formulas.length,
    reading: reading.length,
    mockExams: mockExams.length,
  }

  console.log(formatReport(stats, issues))

  if (hasBlockingIssues(issues)) {
    console.error('\nbuild 失敗：請先修正上列錯誤。')
    process.exit(1)
  }

  mkdirSync(OUT_DIR, { recursive: true })
  const write = (name: string, data: unknown) =>
    writeFileSync(join(OUT_DIR, name), `${JSON.stringify(data, null, 2)}\n`, 'utf8')

  write('grammar.json', grammar)
  write('vocab.json', vocab)
  write('formulas.json', formulas)
  write('reading.json', reading)
  write('mock-exams.json', mockExams)

  console.log(`\n已輸出至 ${OUT_DIR}`)
}

main()
```

- [ ] **Step 6: 執行真實 build**

```bash
pnpm build:content
```

預期輸出包含 `章節：29`、`文法題：145`、`單字：314`。

**若 build 失敗（很可能第一次會失敗），這是預期行為** — 逐條看錯誤訊息，判斷是 parser 太嚴還是筆記格式真的有問題，修正後重跑，直到 0 error。警告可以留著，但要看過一遍確認可接受。

- [ ] **Step 7: 執行完整測試**

```bash
pnpm test
```

預期：全部 passed。

- [ ] **Step 8: Commit**

```bash
git add scripts/build-content/report.ts scripts/build-content/index.ts tests/report.test.ts content/
git commit -m "feat: add content build cli with validation report"
```

---

### Task 13: 章節元資料與教學內容

**Files:**
- Create: `scripts/build-content/parse-chapter.ts`
- Modify: `scripts/build-content/types.ts`（新增 `ChapterSchema`）、`scripts/build-content/index.ts`（輸出 `chapters.json`）
- Test: `tests/parse-chapter.test.ts`

**Interfaces:**
- Consumes: `splitSections` (Task 4)、`chapterIdFromPath` (Task 3)
- Produces: `parseChapter(md, chapterId, categoryId, order): Chapter`；型別 `Chapter = { id, categoryId, title, order, teaching, quickTips }`

設計稿畫面 07（章節列表／教學頁）與答題頁的「相關文法點 → 跳到章節」都需要教學本文。教學本文
＝整份筆記**扣掉**補充秒殺公式、相關單字和片語、練習題三個區塊後剩下的內容。另有一個獨立欄位
`quickTips` 存原有的「📝 多益秒殺解題技巧」（29 章中 27 章標題一致，2 章為變異寫法，需用子字串比對）。

- [ ] **Step 1: 在 types.ts 新增 ChapterSchema**

接在 `FormulaSchema` 之後加入：

```ts
export const ChapterSchema = z.object({
  id: z.string().min(1),
  categoryId: z.string().min(1),
  title: z.string().min(1),
  /** 章節在該分類中的排序，取自檔名前綴數字 */
  order: z.number().int().nonnegative(),
  /** 教學本文（markdown），已排除練習題／單字／補充公式區塊 */
  teaching: z.string().min(1),
  /** 原有的「多益秒殺解題技巧」區塊，沒有則為 null */
  quickTips: z.string().nullable(),
})
export type Chapter = z.infer<typeof ChapterSchema>
```

並在 `ContentBundleSchema` 中加入 `chapters: z.array(ChapterSchema),`。

- [ ] **Step 2: 寫失敗的測試**

`tests/parse-chapter.test.ts`：

```ts
import { describe, it, expect } from 'vitest'
import { parseChapter } from '../scripts/build-content/parse-chapter'

const MD = `# 01_名詞與代名詞

## 核心概念
名詞與代名詞是句子的核心骨幹。

## 1. 必背名詞字尾 (字尾判斷法) 🌟
*   **-tion / -sion**：information, decision

## 📝 多益秒殺解題技巧
1.  詞性題：介系詞後面常接名詞。

## 📚 補充秒殺公式
1.  **可數陷阱**：information 不可數。

## 🔤 相關單字和片語
*   **information** 名詞 資訊 | Example.

## 💪 練習題（5 題）
**1.** Question text.
(A) a (B) b (C) c (D) d
`

describe('parseChapter', () => {
  const chapter = parseChapter(MD, 'grammar/01_八大詞性與句型結構/01_名詞與代名詞', '01_八大詞性與句型結構', 1)

  it('takes the title from the level-1 heading', () => {
    expect(chapter.title).toBe('01_名詞與代名詞')
  })

  it('keeps teaching sections', () => {
    expect(chapter.teaching).toContain('核心概念')
    expect(chapter.teaching).toContain('必背名詞字尾')
  })

  it('excludes practice, vocab and supplementary formula sections', () => {
    expect(chapter.teaching).not.toContain('練習題')
    expect(chapter.teaching).not.toContain('相關單字和片語')
    expect(chapter.teaching).not.toContain('補充秒殺公式')
  })

  it('extracts quick tips into their own field', () => {
    expect(chapter.quickTips).toContain('介系詞後面常接名詞')
    expect(chapter.teaching).not.toContain('多益秒殺解題技巧')
  })

  it('records id, category and order', () => {
    expect(chapter.id).toBe('grammar/01_八大詞性與句型結構/01_名詞與代名詞')
    expect(chapter.categoryId).toBe('01_八大詞性與句型結構')
    expect(chapter.order).toBe(1)
  })

  it('sets quickTips to null when the section is absent', () => {
    const plain = parseChapter('# T\n\n## 核心概念\n內容', 'grammar/x/y', 'x', 2)
    expect(plain.quickTips).toBeNull()
    expect(plain.teaching).toContain('核心概念')
  })
})
```

- [ ] **Step 3: 執行測試確認失敗**

```bash
pnpm vitest run tests/parse-chapter.test.ts
```

預期：FAIL，找不到模組。

- [ ] **Step 4: 實作 parse-chapter.ts**

```ts
import type { Chapter } from './types'
import { splitSections } from './markdown'

/** Sections consumed by other parsers; they must not appear in teaching content. */
const EXCLUDED = ['補充秒殺公式', '相關單字和片語', '練習題']
const QUICK_TIPS = '秒殺解題技巧'
const QUICK_TIPS_FALLBACK = '秒殺技巧'
const TITLE_RE = /^#\s+(.+?)\s*$/m

export function parseChapter(md: string, chapterId: string, categoryId: string, order: number): Chapter {
  const sections = splitSections(md)
  const titleMatch = TITLE_RE.exec(md)
  const title = titleMatch ? (titleMatch[1] ?? '').trim() : chapterId.split('/').pop() ?? chapterId

  const isQuickTips = (heading: string) =>
    heading.includes(QUICK_TIPS) || heading.includes(QUICK_TIPS_FALLBACK)

  const quickTipsSection = sections.find((s) => isQuickTips(s.heading))
  const teaching = sections
    .filter((s) => !EXCLUDED.some((name) => s.heading.includes(name)) && !isQuickTips(s.heading))
    .map((s) => `${'#'.repeat(s.level)} ${s.heading}\n${s.body.trim()}`)
    .join('\n\n')
    .trim()

  return {
    id: chapterId,
    categoryId,
    title,
    order,
    teaching,
    quickTips: quickTipsSection ? quickTipsSection.body.trim() : null,
  }
}
```

- [ ] **Step 5: 執行測試確認通過**

```bash
pnpm vitest run tests/parse-chapter.test.ts
```

預期：6 passed。

- [ ] **Step 6: 接進 index.ts**

在 import 區加入：

```ts
import { parseChapter } from './parse-chapter'
import type { Chapter } from './types'
```

在變數宣告區加入：

```ts
const chapterList: Chapter[] = []
```

在文法章節迴圈內，`vocab.push(...)` 之前加入：

```ts
      const order = Number(/^(\d+)/.exec(file)?.[1] ?? 0)
      chapterList.push(parseChapter(md, chapterId, category, order))
```

在輸出區加入：

```ts
  write('chapters.json', chapterList)
```

並在 `BuildStats`（`report.ts`）沿用既有的 `chapters` 欄位——它已經是章節數，改為 `chapters: chapterList.length` 即可。

- [ ] **Step 7: 重跑 build 與完整測試**

```bash
pnpm build:content && pnpm test
```

預期：`章節：29`，產出 6 個 JSON（含 `chapters.json`），測試全過。

- [ ] **Step 8: Commit**

```bash
git add scripts/build-content/parse-chapter.ts scripts/build-content/types.ts scripts/build-content/index.ts tests/parse-chapter.test.ts content/
git commit -m "feat: parse chapter teaching content and metadata"
```

---

## 完成後的驗收標準

- [ ] `pnpm test` 全數通過
- [ ] `pnpm build:content` 以 0 error 結束，產出 6 個 JSON
- [ ] `content/grammar.json` 有 145 題，每題 `blanks[].answer` 都在該 blank 的 `options` 內
- [ ] `content/vocab.json` 有 314 筆
- [ ] `content/chapters.json` 有 29 筆，每筆 `teaching` 非空且不含練習題／單字區塊
- [ ] 隨機抽 3 題人工比對原始筆記，題幹、選項、答案、詳解四者都正確
- [ ] 把 `content/` 全數刪除後重跑 build，產出的 JSON 與刪除前逐字節相同（證明 ID 與排序穩定）

---

## 後續計畫（本計畫完成後再撰寫）

| 計畫 | 內容 | 依賴 |
|---|---|---|
| 2. 練習核心 App | Next.js 專案、設計 token 落地、今日任務頁、文法答題頁、本機儲存 | 本計畫的 JSON schema |
| 3. 進度雲端化 | D1 schema、Cloudflare Access 登入、進度同步、離線佇列 | 計畫 2 |
| 4. 學習系統 | SRS 排程、單字卡、閱讀頁、統計頁、錯題本 | 計畫 2、3 |
| 5. 模擬考與 AI 生成 | 計時模擬考、分數換算、Claude API 出題 CLI | 計畫 1、4 |

計畫 2 的細節（元件切分、路由結構）要等本計畫產出的 JSON 實際長相確定後才寫，避免對著假想的資料結構寫前端。
