/**
 * 錯題本與單字複習本的漸進顯示。
 *
 * 用累積顯示而不是虛擬捲動：虛擬捲動會破壞瀏覽器 Ctrl-F 與錨點定位，
 * 而且回收時的閃爍很難壓在 DESIGN-PROMPT 的 300ms 動效上限內。
 */
export const PAGE_SIZE = 20

export function takePage<T>(items: T[], page: number): T[] {
  return items.slice(0, page * PAGE_SIZE)
}
