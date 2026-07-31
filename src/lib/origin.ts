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
 *
 * Map 的查找不會碰到原型鏈，可以安全地應對來自 URL query string
 * 的不可信輸入（如 __proto__、constructor 等）。
 */
const STATIC_ORIGINS = new Map<string, Origin>([
  ['home', { backHref: '/', backLabel: '今日任務' }],
  ['practice', { backHref: '/practice', backLabel: '練習中心' }],
  ['stats', { backHref: '/stats', backLabel: '統計' }],
  ['vocab-review', { backHref: '/vocab-review', backLabel: '單字複習本' }],
  ['wrong-questions', { backHref: '/wrong-questions', backLabel: '錯題本' }],
  ['path', { backHref: '/path', backLabel: '學習路徑' }],
])

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

  return STATIC_ORIGINS.get(from) ?? fallback
}
