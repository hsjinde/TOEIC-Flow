export type Theme = 'dark' | 'light'

const STORAGE_KEY_THEME = 'toeic_theme'

export function getStoredTheme(): Theme {
  if (typeof window === 'undefined') return 'dark'
  const stored = localStorage.getItem(STORAGE_KEY_THEME) as Theme | null
  return stored || 'dark'
}

export function applyTheme(theme: Theme): void {
  if (typeof window === 'undefined') return
  const root = document.documentElement
  if (theme === 'dark') {
    root.classList.add('dark')
    root.setAttribute('data-theme', 'dark')
  } else {
    root.classList.remove('dark')
    root.setAttribute('data-theme', 'light')
  }
  localStorage.setItem(STORAGE_KEY_THEME, theme)
}
