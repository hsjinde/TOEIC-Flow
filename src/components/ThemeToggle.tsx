'use client'

import React, { useEffect, useState } from 'react'
import { Sun, Moon } from 'lucide-react'
import { getStoredTheme, applyTheme, type Theme } from '../lib/theme'

export const ThemeToggle: React.FC = () => {
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
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-[var(--ln2)] bg-[var(--sf)] hover:bg-[var(--sf2)] text-xs font-semibold text-[var(--tx)] transition-all"
      title="切換深色/淺色模式"
    >
      {theme === 'dark' ? (
        <>
          <Sun className="w-3.5 h-3.5 text-[var(--pr)]" />
          <span>淺色</span>
        </>
      ) : (
        <>
          <Moon className="w-3.5 h-3.5 text-[var(--pr)]" />
          <span>深色</span>
        </>
      )}
    </button>
  )
}
