export interface DailyProgress {
  date: string
  streak: number
  grammarCompleted: boolean
  vocabCompleted: boolean
  readingCompleted: boolean
}

export interface WrongQuestionRecord {
  questionId: string
  categoryId: string
  failCount: number
  consecutiveCorrect: number
  lastFailedAt: number
}

export interface AnswerHistoryEntry {
  questionId: string
  categoryId: string
  isCorrect: boolean
  timestamp: number
}

const STORAGE_KEY_PROGRESS = 'toeic_daily_progress'
const STORAGE_KEY_WRONG = 'toeic_wrong_questions'
const STORAGE_KEY_VOCAB = 'toeic_vocab_mastery'
const STORAGE_KEY_HISTORY = 'toeic_answer_history'

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

// --- Wrong Questions Controller ---

export function getWrongQuestionsMap(): Record<string, WrongQuestionRecord> {
  if (typeof window === 'undefined') return {}
  const raw = localStorage.getItem(STORAGE_KEY_WRONG)
  if (!raw) return {}
  try {
    return JSON.parse(raw)
  } catch {
    return {}
  }
}

export function recordQuestionAnswer(questionId: string, categoryId: string, isCorrect: boolean): void {
  if (typeof window === 'undefined') return

  // 1. Update Wrong Questions
  const wrongMap = getWrongQuestionsMap()
  const existing = wrongMap[questionId] || {
    questionId,
    categoryId,
    failCount: 0,
    consecutiveCorrect: 0,
    lastFailedAt: Date.now(),
  }

  if (isCorrect) {
    existing.consecutiveCorrect += 1
    // If consecutive correct >= 2, item is graduated and removed from wrong list
    if (existing.consecutiveCorrect >= 2) {
      delete wrongMap[questionId]
    } else {
      wrongMap[questionId] = existing
    }
  } else {
    existing.failCount += 1
    existing.consecutiveCorrect = 0
    existing.lastFailedAt = Date.now()
    wrongMap[questionId] = existing
  }
  localStorage.setItem(STORAGE_KEY_WRONG, JSON.stringify(wrongMap))

  // 2. Append Answer History
  const rawHist = localStorage.getItem(STORAGE_KEY_HISTORY)
  const history: AnswerHistoryEntry[] = rawHist ? JSON.parse(rawHist) : []
  history.push({ questionId, categoryId, isCorrect, timestamp: Date.now() })
  localStorage.setItem(STORAGE_KEY_HISTORY, JSON.stringify(history))
}

// --- Vocab Mastery Controller ---

export function getVocabMasteryMap(): Record<string, { level: number; lastReviewed: number }> {
  if (typeof window === 'undefined') return {}
  const raw = localStorage.getItem(STORAGE_KEY_VOCAB)
  if (!raw) return {}
  try {
    return JSON.parse(raw)
  } catch {
    return {}
  }
}

export function updateVocabMastery(vocabId: string, level: number): void {
  if (typeof window === 'undefined') return
  const map = getVocabMasteryMap()
  map[vocabId] = { level, lastReviewed: Date.now() }
  localStorage.setItem(STORAGE_KEY_VOCAB, JSON.stringify(map))
}

// --- Category Stats Controller ---

export interface CategoryStat {
  categoryId: string
  totalAnswered: number
  correctCount: number
  accuracyRate: number
}

export function getCategoryStats(): CategoryStat[] {
  if (typeof window === 'undefined') return []
  const rawHist = localStorage.getItem(STORAGE_KEY_HISTORY)
  const history: AnswerHistoryEntry[] = rawHist ? JSON.parse(rawHist) : []

  const statsMap: Record<string, { total: number; correct: number }> = {}
  for (const entry of history) {
    if (!statsMap[entry.categoryId]) {
      statsMap[entry.categoryId] = { total: 0, correct: 0 }
    }
    statsMap[entry.categoryId]!.total += 1
    if (entry.isCorrect) statsMap[entry.categoryId]!.correct += 1
  }

  return Object.entries(statsMap).map(([catId, stat]) => ({
    categoryId: catId,
    totalAnswered: stat.total,
    correctCount: stat.correct,
    accuracyRate: stat.total > 0 ? Math.round((stat.correct / stat.total) * 100) : 0,
  }))
}
