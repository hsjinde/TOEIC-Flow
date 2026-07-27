'use client'

import React, { useEffect, useState } from 'react'
import { Sun, Moon } from 'lucide-react'
import { getStoredTheme, applyTheme, type Theme } from '../lib/theme'
import { cn } from '../lib/utils'

interface ThemeToggleProps {
  compact?: boolean
}

export const ThemeToggle: React.FC<ThemeToggleProps> = ({ compact }) => {
  const [theme, setTheme] = useState<Theme>('dark')

  useEffect(() => {
    const current = getStoredTheme()
    setTheme(current)
    applyTheme(current)
  }, [])

  const toggle = () => {
    const next = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    applyTheme(next)
  }

  return (
    <button
      onClick={toggle}
      className={cn(
        // 手機 44px 觸控高，桌機（有指標裝置）回到原本較緊的尺寸。
        'flex min-h-[44px] items-center justify-center gap-1.5 rounded-full border border-[var(--ln2)] bg-[var(--sf)] text-xs font-semibold text-[var(--tx)] transition-all hover:bg-[var(--sf2)] lg:min-h-0',
        compact ? 'px-3 py-1.5' : 'px-3.5 py-1.5 lg:px-3'
      )}
      title="切換深色/淺色模式"
      aria-label="切換深色/淺色模式"
    >
      {theme === 'dark' ? (
        <>
          <Sun className="h-3.5 w-3.5 text-[var(--pr)] shrink-0" />
          <span className={cn(compact && 'hidden sm:inline')}>淺色</span>
        </>
      ) : (
        <>
          <Moon className="h-3.5 w-3.5 text-[var(--pr)] shrink-0" />
          <span className={cn(compact && 'hidden sm:inline')}>深色</span>
        </>
      )}
    </button>
  )
}

