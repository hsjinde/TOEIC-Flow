'use client'

import React, { useEffect, useState } from 'react'
import { CloudOff } from 'lucide-react'

/**
 * 設計 01：離線提示條不佔主要空間、不使用語意色（不是錯誤，只是狀態）。
 */
export function OfflineBanner() {
  const [offline, setOffline] = useState(false)

  useEffect(() => {
    const sync = () => setOffline(!navigator.onLine)
    sync()
    window.addEventListener('online', sync)
    window.addEventListener('offline', sync)
    return () => {
      window.removeEventListener('online', sync)
      window.removeEventListener('offline', sync)
    }
  }, [])

  if (!offline) return null

  return (
    <div
      role="status"
      className="flex items-center justify-center gap-2 border-b border-[var(--ln)] bg-[var(--sf2)] px-4 py-1.5 text-[11px] font-medium text-[var(--mu)]"
    >
      <CloudOff className="h-3.5 w-3.5" />
      離線中 · 今日題目已下載，進度稍後同步
    </div>
  )
}
