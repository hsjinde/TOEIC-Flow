import type { Chapter } from './types'
import { splitSections } from './markdown'

/** Sections consumed by other parsers; they must not appear in teaching content. */
const EXCLUDED = ['補充秒殺公式', '相關單字和片語', '練習題']
const QUICK_TIPS = '秒殺解題技巧'
const QUICK_TIPS_FALLBACK = '秒殺技巧'
const TITLE_RE = /^#\s+(.+?)\s*$/m

function isQuickTips(heading: string): boolean {
  return heading.includes(QUICK_TIPS) || heading.includes(QUICK_TIPS_FALLBACK)
}

export function parseChapter(md: string, chapterId: string, categoryId: string, order: number): Chapter {
  // Level 2 keeps `###` sub-headings inside each body, so the teaching content
  // survives intact rather than being flattened into separate sections.
  const sections = splitSections(md, 2)
  const titleMatch = TITLE_RE.exec(md)
  const title = titleMatch ? (titleMatch[1] ?? '').trim() : (chapterId.split('/').pop() ?? chapterId)

  const quickTipsSection = sections.find((s) => isQuickTips(s.heading))
  const teaching = sections
    .filter((s) => !EXCLUDED.some((name) => s.heading.includes(name)) && !isQuickTips(s.heading))
    .map((s) => `## ${s.heading}\n${s.body.trim()}`)
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
