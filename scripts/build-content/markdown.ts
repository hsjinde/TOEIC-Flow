export interface Section {
  heading: string
  level: number
  body: string
}

/**
 * Split a note into sections at exactly one heading level.
 *
 * The level is significant: vocabulary and formula blocks are level-2 sections
 * that contain level-3 sub-headings (e.g. `### 名詞字尾相關`). Splitting on both
 * levels at once would end the level-2 body at the first sub-heading and drop
 * every entry beneath it, so callers that want whole level-2 blocks must use
 * the default. Reading notes call this twice: level 2 for passages, then
 * level 3 within each passage body for its questions.
 *
 * `^#{n}\s` cannot match a deeper heading — `###` fails `#{2}\s` because the
 * third character is `#`, not whitespace — so no lookahead is needed.
 */
export function splitSections(md: string, level = 2): Section[] {
  const headingRe = new RegExp(`^#{${level}}\\s+(.+?)\\s*$`)
  const lines = md.split(/\r?\n/)
  const sections: Section[] = []
  let current: { heading: string; lines: string[] } | null = null

  const flush = () => {
    if (current) sections.push({ heading: current.heading, level, body: current.lines.join('\n') })
  }

  for (const line of lines) {
    const match = headingRe.exec(line)
    if (match) {
      flush()
      current = { heading: match[1] ?? '', lines: [] }
      continue
    }
    if (current) current.lines.push(line)
  }
  flush()
  return sections
}

/** Match by substring: headings carry emoji and counts that vary between chapters. */
export function findSection(sections: Section[], headingIncludes: string): Section | null {
  return sections.find((s) => s.heading.includes(headingIncludes)) ?? null
}
