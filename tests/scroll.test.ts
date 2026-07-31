// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useScrollToTopOnChange } from '../src/lib/scroll'

/**
 * 練習流程全部是「同一個路由裡換內容」，所以沒有任何換頁捲動重置會發生：按下
 * 「下一張／下一題」時捲動位置留在上一張卡的底部。這個 hook 是全站唯一的補救，
 * 三件事都得成立——首次掛載不要亂捲、key 變了一定捲、key 沒變絕不捲（否則使用者
 * 展開詳解往下讀時會被彈回頂端）。
 */
describe('useScrollToTopOnChange', () => {
  beforeEach(() => {
    window.scrollTo = vi.fn() as unknown as typeof window.scrollTo
  })

  it('does not scroll on the first render', () => {
    renderHook(({ k }: { k: string }) => useScrollToTopOnChange(k), {
      initialProps: { k: '0' },
    })
    expect(window.scrollTo).not.toHaveBeenCalled()
  })

  it('scrolls back to the top when the key changes', () => {
    const { rerender } = renderHook(({ k }: { k: string }) => useScrollToTopOnChange(k), {
      initialProps: { k: '0' },
    })

    rerender({ k: '1' })

    expect(window.scrollTo).toHaveBeenCalledWith({ top: 0, left: 0, behavior: 'auto' })
  })

  it('leaves the scroll position alone while the key is unchanged', () => {
    const { rerender } = renderHook(({ k }: { k: string }) => useScrollToTopOnChange(k), {
      initialProps: { k: '0' },
    })

    rerender({ k: '0' })
    rerender({ k: '0' })

    expect(window.scrollTo).not.toHaveBeenCalled()
  })
})
