'use client'

import { useEffect, useState } from 'react'

/** 與 Tailwind 的 `lg:` 同一個斷點；兩邊不一致會出現「CSS 已經換版、JS 還沒」的破口。 */
const DESKTOP_QUERY = '(min-width: 1024px)'

/**
 * 版面在手機與桌機是兩種**結構**而不是兩種樣式時使用（例如錯題本：手機把詳解
 * 就地展開在該題下面，桌機用右欄常駐預覽）。純樣式差異一律用 Tailwind 的 `lg:`，
 * 不要為了改個顏色跑來用這個 hook。
 *
 * 一律以手機為初始值：使用它的頁面都先渲染骨架、資料備妥後才畫清單，因此桌機不會
 * 看到手機版本閃一下。
 */
export function useIsDesktop(): boolean {
  const [isDesktop, setIsDesktop] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia(DESKTOP_QUERY)
    const sync = () => setIsDesktop(mq.matches)
    sync()
    mq.addEventListener('change', sync)
    return () => mq.removeEventListener('change', sync)
  }, [])

  return isDesktop
}
