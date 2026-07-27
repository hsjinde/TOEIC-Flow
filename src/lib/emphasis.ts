/**
 * 單字例句把目標字用星號標起來，但筆記兩種寫法都有：
 * `*information*` 與 `**information**`（vocab.json 裡 267 筆雙星、83 筆單星）。
 * 只認單星號會讓外圈的 `*` 漏在畫面上，所以統一在這裡處理。
 */
const EMPHASIS_SPLIT = /(\*{1,2}[^*]+\*{1,2})/g
const EMPHASIS_TRIM = /^\*+|\*+$/g

export interface EmphasisPart {
  text: string
  emphasised: boolean
}

function isEmphasised(part: string): boolean {
  return part.length > 2 && part.startsWith('*') && part.endsWith('*')
}

export function splitEmphasis(text: string): EmphasisPart[] {
  return text
    .split(EMPHASIS_SPLIT)
    .filter((part) => part !== '')
    .map((part) =>
      isEmphasised(part)
        ? { text: part.replace(EMPHASIS_TRIM, ''), emphasised: true }
        : { text: part, emphasised: false }
    )
}

/** 去掉標記但保留文字，用於不需要強調樣式的地方（例如四選一的題幹）。 */
export function stripEmphasis(text: string): string {
  return text.replace(EMPHASIS_SPLIT, (match) => match.replace(EMPHASIS_TRIM, ''))
}

/** 把被標記的目標字換成填空底線；沒有標記時退回用字面比對。 */
export function toClozeSentence(example: string, word: string, blank = '______'): string {
  const parts = splitEmphasis(example)
  const hasEmphasised = parts.some((p) => p.emphasised)

  if (hasEmphasised) {
    const cleanWord = word.toLowerCase().replace(/\(.*?\)/g, '').trim()
    const wordTokens = cleanWord.split(/[\s\/\+\-]+/).filter((t) => t.length >= 2)

    const matchIndex = parts.findIndex((p) => {
      if (!p.emphasised) return false
      const lowerP = p.text.toLowerCase()
      return wordTokens.some((t) => lowerP.includes(t) || t.includes(lowerP))
    })

    const targetIdx = matchIndex !== -1 ? matchIndex : parts.findIndex((p) => p.emphasised)

    return parts
      .map((p, idx) => (idx === targetIdx ? blank : p.text))
      .join('')
  }

  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return example.replace(new RegExp(escaped, 'i'), blank)
}
