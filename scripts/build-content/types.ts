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
