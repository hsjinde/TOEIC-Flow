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
  /**
   * 例句中文翻譯。筆記本身沒有這欄，由 `data/vocab-example-zh.json` 在 build 時併入；
   * 對不上的字留空字串，UI 才能條件渲染而不是印出 undefined。
   */
  exampleZh: z.string().default(''),
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

/**
 * One block of a mock exam. Part 5 yields a single section with no prose; Part
 * 6 and Part 7 yield one section per passage. The passage has to be kept or
 * those parts are unanswerable — the blanks live in the prose, not the stem.
 */
export const MockExamSectionSchema = z.object({
  /** the Part heading this block sits under, e.g. Part 6：短文填空（2 篇，每篇 4 題） */
  part: z.string().min(1),
  /** the passage heading, empty for Part 5 */
  title: z.string(),
  /** the passage prose, empty for Part 5 */
  passage: z.string(),
  questions: z.array(QuestionSchema).min(1),
})
export type MockExamSection = z.infer<typeof MockExamSectionSchema>

export const MockExamSchema = z.object({
  id: z.string().min(1),
  title: z.string(),
  sections: z.array(MockExamSectionSchema).min(1),
})
export type MockExam = z.infer<typeof MockExamSchema>

/**
 * 章節開頭那張「決策樹 + 用法總表」速查卡。
 *
 * 這是唯一不從 vault 來的結構化內容：筆記裡的秒殺公式是逐條散裝的技巧
 * （04_使役動詞 那五條都沒有 make/have/get/let/help × 主動/被動 的總表），
 * 所以整張卡是手寫的，放在 `data/formula-cards.json`，比照
 * `data/vocab-example-zh.json` 的側車檔作法，key 是 chapter id。
 *
 * 兩條分支刻意用「位置」而不是欄位決定強調：branches[0] 吃主色、branches[1]
 * 走灰階外框。DESIGN-PROMPT.md 把綠/紅保留給作答回饋，總表不能拿紅色當
 * 「被動」的識別色——那會跟同一頁的答錯回饋撞在一起。
 */
const CardBranchSchema = z.object({
  label: z.string().min(1),
  labelEn: z.string().default(''),
})

const CardCellSchema = z.object({
  /** 句型的敘述部分，如 `make O` */
  pattern: z.string().min(1),
  /** 要被標成 badge 的關鍵形式，如 `RV`、`p.p.`、`to-RV` */
  token: z.string().min(1),
  /** 例句，不含中文 */
  example: z.string().default(''),
})

const CardRowSchema = z.object({
  /** 列首的動詞，如 `make` */
  head: z.string().min(1),
  /** 列首動詞的中文語意，如「強迫」 */
  gloss: z.string().default(''),
  /**
   * 對應 decision.branches 的兩欄，順序一致。一欄是陣列而不是單一句型，因為同一
   * 邊常常有兩種合法形式——`have O RV` 與 `have O V-ing` 都是主動，後者是這章
   * 秒殺公式第 2 條在教的東西，總表只印一種就會跟下面的公式互相矛盾。
   */
  cells: z.tuple([z.array(CardCellSchema).min(1), z.array(CardCellSchema).min(1)]),
  /** 該列兩欄共用一個例句時填這裡，cells 的 example 就留空 */
  sharedExample: z.string().default(''),
})

const CardNoteSchema = z.object({
  title: z.string().min(1),
  lines: z.array(z.string().min(1)).min(1),
})

export const FormulaCardSchema = z.object({
  chapterId: z.string().min(1),
  title: z.string().min(1),
  titleEn: z.string().default(''),
  decision: z.object({
    question: z.string().min(1),
    questionEn: z.string().default(''),
    branches: z.tuple([CardBranchSchema, CardBranchSchema]),
  }),
  table: z.object({
    title: z.string().min(1),
    titleEn: z.string().default(''),
    /**
     * 列首那一欄的名稱。視覺上不印（欄位識別靠內容本身），但 sr-only 的 <th> 要用
     * 它——列首放的東西每章不同（動詞、時間、連接詞），寫死「動詞」對讀屏軟體是錯的。
     */
    rowHeader: z.string().min(1).default('項目'),
    rows: z.array(CardRowSchema).min(1),
  }),
  notes: z.array(CardNoteSchema).default([]),
})
export type FormulaCard = z.infer<typeof FormulaCardSchema>

/**
 * 學習路徑的一站。跟速查卡一樣是手寫側車檔（data/learning-path.json），不是從
 * vault 解析出來的——它的價值就在於「刻意不照筆記章節順序」。
 */
export const PathStageSchema = z.object({
  id: z.string().min(1),
  order: z.number().int().positive(),
  title: z.string().min(1),
  /** 一行講完這一站在解什麼題 */
  subtitle: z.string().min(1),
  /** 學完這一站你會做到什麼 */
  goal: z.string().min(1),
  /** 為什麼排在這個位置——路徑圖的重點就是順序的理由 */
  why: z.string().min(1),
  /** 建議學習順序，不是章節編號順序 */
  chapterIds: z.array(z.string().min(1)).min(1),
  /** 這一站之後值得順手做的非文法練習 */
  extraPractice: z
    .object({
      label: z.string().min(1),
      href: z.string().min(1),
    })
    .optional(),
})
export type PathStage = z.infer<typeof PathStageSchema>

export const ContentBundleSchema = z.object({
  buildAt: z.string(),
  chapters: z.array(ChapterSchema),
  grammar: z.array(QuestionSchema),
  vocab: z.array(VocabItemSchema),
  formulas: z.array(FormulaSchema),
  reading: z.array(ReadingPassageSchema),
  mockExams: z.array(MockExamSchema),
})
export type ContentBundle = z.infer<typeof ContentBundleSchema>
