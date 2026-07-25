export interface DailyProgress {
  date: string
  streak: number
  grammarCompleted: boolean
  vocabCompleted: boolean
  readingCompleted: boolean
}

const STORAGE_KEY_PROGRESS = 'toeic_daily_progress'

function getTodayString(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function getDailyProgress(): DailyProgress {
  if (typeof window === 'undefined') {
    return { date: getTodayString(), streak: 1, grammarCompleted: false, vocabCompleted: false, readingCompleted: false }
  }
  const raw = localStorage.getItem(STORAGE_KEY_PROGRESS)
  const today = getTodayString()
  if (!raw) {
    const initial: DailyProgress = { date: today, streak: 1, grammarCompleted: false, vocabCompleted: false, readingCompleted: false }
    localStorage.setItem(STORAGE_KEY_PROGRESS, JSON.stringify(initial))
    return initial
  }

  try {
    const parsed: DailyProgress = JSON.parse(raw)
    if (parsed.date !== today) {
      // New day: check streak continuation
      const yesterday = new Date()
      yesterday.setDate(yesterday.getDate() - 1)
      const yStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`
      
      const isConsecutive = parsed.date === yStr && (parsed.grammarCompleted || parsed.vocabCompleted || parsed.readingCompleted)
      const nextStreak = isConsecutive ? parsed.streak + 1 : 1

      const updated: DailyProgress = { date: today, streak: nextStreak, grammarCompleted: false, vocabCompleted: false, readingCompleted: false }
      localStorage.setItem(STORAGE_KEY_PROGRESS, JSON.stringify(updated))
      return updated
    }
    return parsed
  } catch {
    return { date: today, streak: 1, grammarCompleted: false, vocabCompleted: false, readingCompleted: false }
  }
}

export function recordTaskCompletion(task: 'grammar' | 'vocab' | 'reading'): void {
  if (typeof window === 'undefined') return
  const progress = getDailyProgress()
  if (task === 'grammar') progress.grammarCompleted = true
  if (task === 'vocab') progress.vocabCompleted = true
  if (task === 'reading') progress.readingCompleted = true
  localStorage.setItem(STORAGE_KEY_PROGRESS, JSON.stringify(progress))
}
