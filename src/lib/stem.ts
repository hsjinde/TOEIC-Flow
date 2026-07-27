/**
 * 題幹的顯示形式。短文填空與段落題在題庫裡的 stem 只是「題目 16」這種佔位字串——
 * 空格與線索都在文章本文裡。任何要把題目印給人看的畫面（閱讀練習、模擬考、錯題本、
 * 模擬考檢討）都得先把它換成空格所在的那一句，否則使用者看到的是一個沒有內容的題目。
 */

/** 短文／文章題的 stem 在題庫裡只是「題目 N」佔位字串，沒有內容。 */
export const PLACEHOLDER_STEM = /^題目\s*\d+$/

/** 找不到對應空格時的替代題幹。畫面上「題目 18」四個字對使用者沒有任何用處。 */
export const FALLBACK_STEM = '請對照文章作答'

/**
 * 設計 13：題目要顯示空格所在的那一句，而不是佔位標題。
 * 空格在文章裡標成 `______(N)`，往前後找到句界就是上下文。
 *
 * 底線長度與括號前的空白都不固定：閱讀題庫寫成 `______(1)`，模擬考題庫寫成
 * `______ (16)`。先前是字串比對，模擬考那一半永遠找不到，題幹只能落回「題目 16」。
 */
export function contextSentence(passageText: string, questionNumber: number): string | null {
  const match = passageText.match(new RegExp(`_{2,}\\s*\\(${questionNumber}\\)`))
  const at = match?.index
  if (match === null || at === undefined) return null

  const before = passageText.slice(0, at)
  const after = passageText.slice(at + match[0].length)
  const start = Math.max(
    before.lastIndexOf('. '),
    before.lastIndexOf('\n'),
    before.lastIndexOf('? '),
    before.lastIndexOf('! ')
  )
  const endCandidates = ['.', '\n', '?', '!']
    .map((ch) => after.indexOf(ch))
    .filter((i) => i >= 0)
  const end = endCandidates.length > 0 ? Math.min(...endCandidates) : after.length

  const sentence = `${before.slice(start + 1)}___${after.slice(0, end + 1)}`.trim()
  return sentence.length > 0 ? sentence : null
}

/** 佔位題幹 → 空格所在的句子；其餘題型原樣返回。 */
export function resolveStem(
  stem: string,
  questionNumber: number,
  passageText: string | undefined
): string {
  if (!PLACEHOLDER_STEM.test(stem)) return stem
  if (!passageText) return stem
  return contextSentence(passageText, questionNumber) ?? FALLBACK_STEM
}
