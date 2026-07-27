import grammarData from '../../content/grammar.json'
import vocabData from '../../content/vocab.json'
import readingData from '../../content/reading.json'
import mockData from '../../content/mock-exams.json'
import chaptersData from '../../content/chapters.json'
import formulasData from '../../content/formulas.json'
import type {
  Question,
  VocabItem,
  ReadingPassage,
  MockExam,
  Chapter,
  Formula,
} from '../../scripts/build-content/types'
import { resolveStem } from './stem'

const grammar = (grammarData as unknown) as Question[]
const vocab = (vocabData as unknown) as VocabItem[]
const reading = (readingData as unknown) as ReadingPassage[]
const mocks = (mockData as unknown) as MockExam[]
const chapters = (chaptersData as unknown) as Chapter[]
const formulas = (formulasData as unknown) as Formula[]

export function getRandomGrammarQuestions(count: number = 5): Question[] {
  const shuffled = [...grammar].sort(() => 0.5 - Math.random())
  return shuffled.slice(0, count)
}

export function getRandomVocabItems(count: number = 10): VocabItem[] {
  const shuffled = [...vocab].sort(() => 0.5 - Math.random())
  return shuffled.slice(0, count)
}

export function getRandomReadingPassages(count: number = 1): ReadingPassage[] {
  const shuffled = [...reading].sort(() => 0.5 - Math.random())
  return shuffled.slice(0, count)
}

export function getMockExams(): MockExam[] {
  return mocks
}

export function getChapters(): Chapter[] {
  return chapters
}

export function getVocabItems(): VocabItem[] {
  return vocab
}

export function getFormulas(): Formula[] {
  return formulas
}

// --- Lookups ---

/**
 * Every question in the bundle, keyed by id. Wrong-answer records only persist
 * the id, so the whole bank (grammar + reading + mock) has to be searchable or
 * 錯題本 can never show a stem.
 */
const questionIndex: Map<string, Question> = (() => {
  const map = new Map<string, Question>()
  for (const q of grammar) map.set(q.id, q)
  for (const p of reading) for (const q of p.questions) map.set(q.id, q)
  for (const m of mocks) for (const s of m.sections) for (const q of s.questions) map.set(q.id, q)
  return map
})()

export function getQuestionById(id: string): Question | null {
  return questionIndex.get(id) ?? null
}

/**
 * Question id → the prose it belongs to. Part 6/7 and paragraph reading keep the
 * blank in the passage, not the stem, so any screen that shows one of those
 * questions needs the passage to make it answerable — and to turn the 「題目 16」
 * placeholder stem into the sentence the blank actually sits in.
 */
const passageIndex: Map<string, { title: string; passage: string }> = (() => {
  const map = new Map<string, { title: string; passage: string }>()
  for (const p of reading) {
    if (!p.passage) continue
    for (const q of p.questions) map.set(q.id, { title: p.title, passage: p.passage })
  }
  for (const m of mocks) {
    for (const s of m.sections) {
      if (!s.passage) continue
      for (const q of s.questions) map.set(q.id, { title: s.title, passage: s.passage })
    }
  }
  return map
})()

export function getQuestionPassage(id: string): { title: string; passage: string } | null {
  return passageIndex.get(id) ?? null
}

/** 給人看的題幹。佔位題幹會換成空格所在的那一句，其餘題型原樣返回。 */
export function getQuestionStem(question: Question): string {
  return resolveStem(question.stem, question.number, passageIndex.get(question.id)?.passage)
}

/** Skips ids with no matching question — orphaned records must not crash a page. */
export function getQuestionsByIds(ids: string[]): Question[] {
  const out: Question[] = []
  for (const id of ids) {
    const q = questionIndex.get(id)
    if (q) out.push(q)
  }
  return out
}

const vocabIndex: Map<string, VocabItem> = new Map(vocab.map((v) => [v.id, v]))

export function getVocabById(id: string): VocabItem | null {
  return vocabIndex.get(id) ?? null
}

/** 保持傳入順序；查無此字就跳過——改過筆記檔名的舊紀錄不該讓頁面掛掉。 */
export function getVocabByIds(ids: string[]): VocabItem[] {
  const out: VocabItem[] = []
  for (const id of ids) {
    const v = vocabIndex.get(id)
    if (v) out.push(v)
  }
  return out
}

const chapterIndex: Map<string, Chapter> = new Map(chapters.map((c) => [c.id, c]))

export function getChapterById(id: string): Chapter | null {
  return chapterIndex.get(id) ?? null
}

export function getVocabByChapter(chapterId: string): VocabItem[] {
  return vocab.filter((v) => v.chapterId === chapterId)
}

export function getFormulasByChapter(chapterId: string): Formula[] {
  return formulas.filter((f) => f.chapterId === chapterId)
}

export function getGrammarQuestionsByChapter(chapterId: string): Question[] {
  return grammar.filter((q) => q.chapterId === chapterId)
}

export function getGrammarQuestionsByCategory(categoryId: string, count?: number): Question[] {
  const pool = grammar.filter((q) => q.categoryId === categoryId)
  if (count === undefined) return pool
  return [...pool].sort(() => 0.5 - Math.random()).slice(0, count)
}

// --- Categories ---

export interface CategoryMeta {
  id: string
  /** 去掉數字前綴的完整名稱，如 八大詞性與句型結構 */
  title: string
  /** 雷達圖與晶片用的短名，如 八大詞性 */
  shortTitle: string
  /** 檔名前綴數字，如 01 */
  prefix: string
  chapters: Chapter[]
  questionCount: number
}

/** 雷達圖軸標籤要在 375px 寬度下不換行，所以短名寫死而非截字。 */
const SHORT_TITLES: Record<string, string> = {
  '01_八大詞性與句型結構': '八大詞性',
  '02_動詞時態與語態': '動詞時態',
  '03_動狀詞_非謂語動詞': '動狀詞',
  '04_特殊動詞用法': '特殊動詞',
  '05_子句與假設語氣': '子句假設',
  '06_其他多益必考進階題型': '進階題型',
}

export function stripOrderPrefix(raw: string): string {
  return raw.replace(/^\d+[_.\s-]*/, '').replace(/_/g, ' ')
}

const categoryList: CategoryMeta[] = (() => {
  const seen = new Map<string, Chapter[]>()
  for (const c of chapters) {
    // 只收文法六大類；reading/mock 的 categoryId 不帶數字前綴。
    if (!/^\d/.test(c.categoryId)) continue
    const list = seen.get(c.categoryId)
    if (list) list.push(c)
    else seen.set(c.categoryId, [c])
  }
  return [...seen.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([id, chs]) => ({
      id,
      title: stripOrderPrefix(id),
      shortTitle: SHORT_TITLES[id] ?? stripOrderPrefix(id).slice(0, 4),
      prefix: id.slice(0, 2),
      chapters: [...chs].sort((a, b) => a.order - b.order),
      questionCount: grammar.filter((q) => q.categoryId === id).length,
    }))
})()

export function getCategories(): CategoryMeta[] {
  return categoryList
}

export function getCategoryMeta(categoryId: string): CategoryMeta | null {
  return categoryList.find((c) => c.id === categoryId) ?? null
}

/** 顯示用名稱；未知分類（reading/mock/single…）回傳去前綴後的原字串。 */
export function getCategoryLabel(categoryId: string): string {
  const meta = getCategoryMeta(categoryId)
  if (meta) return meta.title
  const fallback: Record<string, string> = {
    single: '單句填空',
    paragraph: '段落填空',
    article: '文章閱讀',
    mock: '模擬考',
  }
  return fallback[categoryId] ?? stripOrderPrefix(categoryId)
}

export function getCategoryShortLabel(categoryId: string): string {
  return getCategoryMeta(categoryId)?.shortTitle ?? getCategoryLabel(categoryId)
}

/**
 * 全域章號。Chapter.order 取自檔名前綴，而檔名在每個分類底下都從 01 重新起算，
 * 直接拿來顯示會出現兩個「第 1 章」。設計 07/15 用的是跨分類連號（第 9 章 · 不定詞），
 * 所以這裡照分類順序把所有章節攤平後重新編號。
 */
const chapterNumbers: Map<string, number> = (() => {
  const map = new Map<string, number>()
  let n = 0
  for (const cat of categoryList) {
    for (const ch of cat.chapters) map.set(ch.id, ++n)
  }
  return map
})()

export function getChapterNumber(chapterId: string): number | null {
  return chapterNumbers.get(chapterId) ?? null
}

/** 章節顯示名稱，如 第 9 章 · 不定詞 */
export function getChapterLabel(chapterId: string): string {
  const ch = getChapterById(chapterId)
  if (!ch) return stripOrderPrefix(chapterId.split('/').pop() ?? chapterId)
  const number = chapterNumbers.get(chapterId)
  const title = stripOrderPrefix(ch.title)
  return number ? `第 ${number} 章 · ${title}` : title
}
