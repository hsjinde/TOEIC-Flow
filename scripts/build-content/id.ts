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
