'use client'

import { useEffect, useRef } from 'react'

/**
 * 把視窗捲回頁首。
 *
 * 刻意用 instant 而不是 smooth：這是「換一張卡／換一題」的重置，不是導覽動作。
 * 從一張讀到底的長卡片平滑捲回頂端要花將近一秒，使用者會在動畫途中就開始讀新卡，
 * 而 DESIGN-PROMPT 的動效上限是 300ms——與其做一個一定超時的動畫，不如不做。
 */
export function scrollToTop(): void {
  // 測試環境（happy-dom／jsdom）與 SSR 都可能沒有真的 scrollTo，缺了不該讓整頁壞掉。
  if (typeof window === 'undefined' || typeof window.scrollTo !== 'function') return
  window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
}

/**
 * key 變了就捲回頁首，首次掛載不動作。
 *
 * 練習流程全部是「同一個路由裡換內容」，Next.js 的換頁捲動重置完全幫不上忙：按下
 * 「下一張／下一題」時捲動位置留在上一張卡的底部，新卡的題幹在視窗上方看不見。
 * 每一頁自己寫一次 scrollTo 的話一定會漏（速查卡、單字、文法、閱讀、模擬考各一處），
 * 所以集中成這一個 hook。
 */
export function useScrollToTopOnChange(key: unknown): void {
  const previous = useRef(key)

  useEffect(() => {
    if (previous.current === key) return
    previous.current = key
    scrollToTop()
  }, [key])
}
