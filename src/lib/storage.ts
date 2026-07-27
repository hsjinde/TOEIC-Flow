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

/** 設計 16 的作答歷程要能寫出「7/23 14:02 選 (B) · 答錯 · 文法練習」。 */
export type AnswerSource = 'grammar' | 'reading' | 'mock' | 'wrong' | 'vocab'

export interface AnswerHistoryEntry {
  questionId: string
  categoryId: string
  isCorrect: boolean
  timestamp: number
  /** 使用者選的選項；舊紀錄沒有這欄。 */
  selectedKey?: string
  /** 在哪個流程作答；舊紀錄沒有這欄。 */
  source?: AnswerSource
}

export const ANSWER_SOURCE_LABELS: Record<AnswerSource, string> = {
  grammar: '文法練習',
  reading: '閱讀理解',
  mock: '模擬考',
  wrong: '錯題複習',
  vocab: '單字測驗',
}

const STORAGE_KEY_PROGRESS = 'toeic_daily_progress'
const STORAGE_KEY_WRONG = 'toeic_wrong_questions'
const STORAGE_KEY_VOCAB = 'toeic_vocab_mastery'
const STORAGE_KEY_HISTORY = 'toeic_answer_history'
const STORAGE_KEY_PROFILE = 'toeic_user_profile'
const STORAGE_KEY_MOCK = 'toeic_mock_results'

function getTodayString(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function notifyStorageUpdate(): void {
  if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
    window.dispatchEvent(new Event('toeic_storage_update'))
  }
}

function checkTodayCompletedTasks(history?: AnswerHistoryEntry[]): { grammar: boolean; vocab: boolean; reading: boolean } {
  if (typeof window === 'undefined') return { grammar: false, vocab: false, reading: false }
  try {
    const entries: AnswerHistoryEntry[] = history ?? (
      localStorage.getItem(STORAGE_KEY_HISTORY)
        ? JSON.parse(localStorage.getItem(STORAGE_KEY_HISTORY)!)
        : []
    )

    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)
    const todayMs = todayStart.getTime()

    let grammar = false
    let vocab = false
    let reading = false

    for (const entry of entries) {
      if (entry.timestamp >= todayMs) {
        if (entry.source === 'grammar' || entry.categoryId?.startsWith('grammar/')) grammar = true
        if (entry.source === 'vocab') vocab = true
        if (entry.source === 'reading' || entry.categoryId?.startsWith('reading/')) reading = true
      }
    }

    if (!vocab) {
      const vocabMap = getVocabMasteryMap()
      for (const item of Object.values(vocabMap)) {
        if (item.lastReviewed && item.lastReviewed >= todayMs) {
          vocab = true
          break
        }
      }
    }

    return { grammar, vocab, reading }
  } catch {
    return { grammar: false, vocab: false, reading: false }
  }
}

export function getDailyProgress(): DailyProgress {
  if (typeof window === 'undefined') {
    return { date: getTodayString(), streak: 1, grammarCompleted: false, vocabCompleted: false, readingCompleted: false }
  }
  const raw = localStorage.getItem(STORAGE_KEY_PROGRESS)
  const today = getTodayString()
  const historyFlags = checkTodayCompletedTasks()

  if (!raw) {
    const initial: DailyProgress = {
      date: today,
      streak: 1,
      grammarCompleted: historyFlags.grammar,
      vocabCompleted: historyFlags.vocab,
      readingCompleted: historyFlags.reading,
    }
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

      const updated: DailyProgress = {
        date: today,
        streak: nextStreak,
        grammarCompleted: historyFlags.grammar,
        vocabCompleted: historyFlags.vocab,
        readingCompleted: historyFlags.reading,
      }
      localStorage.setItem(STORAGE_KEY_PROGRESS, JSON.stringify(updated))
      return updated
    }
    parsed.grammarCompleted = parsed.grammarCompleted || historyFlags.grammar
    parsed.vocabCompleted = parsed.vocabCompleted || historyFlags.vocab
    parsed.readingCompleted = parsed.readingCompleted || historyFlags.reading
    return parsed
  } catch {
    return {
      date: today,
      streak: 1,
      grammarCompleted: historyFlags.grammar,
      vocabCompleted: historyFlags.vocab,
      readingCompleted: historyFlags.reading,
    }
  }
}

export function recordTaskCompletion(task: 'grammar' | 'vocab' | 'reading'): void {
  if (typeof window === 'undefined') return
  const progress = getDailyProgress()
  if (task === 'grammar') progress.grammarCompleted = true
  if (task === 'vocab') progress.vocabCompleted = true
  if (task === 'reading') progress.readingCompleted = true
  localStorage.setItem(STORAGE_KEY_PROGRESS, JSON.stringify(progress))
  notifyStorageUpdate()

  // Sync to Cloudflare D1
  fetch('/api/user/action', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'update_stats',
      payload: {
        streakDays: progress.streak,
        lastPracticeDate: progress.date,
      },
    }),
  }).catch(() => {})
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

export function recordQuestionAnswer(
  questionId: string,
  categoryId: string,
  isCorrect: boolean,
  meta?: { selectedKey?: string; source?: AnswerSource; fileWrong?: boolean }
): void {
  if (typeof window === 'undefined') return

  // 模擬考交卷時要記歷程與統計，但錯題入本是使用者按「把 N 題加入錯題本」
  // 才發生的（設計 17）。少了這個開關，交卷會先自動入本、按鈕再入一次，
  // 同一題的錯次會被算兩遍。
  const fileWrong = meta?.fileWrong !== false

  // 1. Update Wrong Questions
  const wrongMap = getWrongQuestionsMap()
  const tracked = wrongMap[questionId]
  const existing = tracked || {
    questionId,
    categoryId,
    failCount: 0,
    consecutiveCorrect: 0,
    lastFailedAt: Date.now(),
  }

  if (fileWrong) {
    if (isCorrect) {
      // Only questions already in the list can make graduation progress —
      // getting a fresh question right must never file it under 錯題本.
      if (tracked) {
        existing.consecutiveCorrect += 1
        // If consecutive correct >= 2, item is graduated and removed from wrong list
        if (existing.consecutiveCorrect >= 2) {
          delete wrongMap[questionId]
        } else {
          wrongMap[questionId] = existing
        }
      }
    } else {
      existing.failCount += 1
      existing.consecutiveCorrect = 0
      existing.lastFailedAt = Date.now()
      wrongMap[questionId] = existing
    }
    localStorage.setItem(STORAGE_KEY_WRONG, JSON.stringify(wrongMap))
  }

  // 2. Append Answer History
  const rawHist = localStorage.getItem(STORAGE_KEY_HISTORY)
  const history: AnswerHistoryEntry[] = rawHist ? JSON.parse(rawHist) : []
  history.push({
    questionId,
    categoryId,
    isCorrect,
    timestamp: Date.now(),
    ...(meta?.selectedKey ? { selectedKey: meta.selectedKey } : {}),
    ...(meta?.source ? { source: meta.source } : {}),
  })
  localStorage.setItem(STORAGE_KEY_HISTORY, JSON.stringify(history))

  // 3. Sync to Cloudflare D1
  fetch('/api/user/action', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'record_answer',
      payload: {
        questionId,
        categoryId,
        isCorrect,
        consecutiveCorrect: existing.consecutiveCorrect,
        selectedKey: meta?.selectedKey ?? null,
        source: meta?.source ?? null,
        fileWrong,
      },
    }),
  }).catch(() => {})
}

/**
 * 把指定題目補記進錯題本，不再寫一筆作答歷程。
 * 設計 17 的「把 N 題加入錯題本」是交卷後的獨立動作，若重跑
 * recordQuestionAnswer 會讓同一次作答在歷程裡出現兩遍、錯次也多加一次。
 */
export function fileWrongQuestions(
  items: { questionId: string; categoryId: string }[]
): void {
  if (typeof window === 'undefined') return
  const wrongMap = getWrongQuestionsMap()

  for (const item of items) {
    const existing = wrongMap[item.questionId]
    if (existing) {
      existing.failCount += 1
      existing.consecutiveCorrect = 0
      existing.lastFailedAt = Date.now()
    } else {
      wrongMap[item.questionId] = {
        questionId: item.questionId,
        categoryId: item.categoryId,
        failCount: 1,
        consecutiveCorrect: 0,
        lastFailedAt: Date.now(),
      }
    }
  }
  localStorage.setItem(STORAGE_KEY_WRONG, JSON.stringify(wrongMap))

  fetch('/api/user/action', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'file_wrong', payload: { items } }),
  }).catch(() => {})
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
  const now = Date.now()
  map[vocabId] = { level, lastReviewed: now }
  localStorage.setItem(STORAGE_KEY_VOCAB, JSON.stringify(map))
  recordTaskCompletion('vocab')

  const rawHist = localStorage.getItem(STORAGE_KEY_HISTORY)
  const history: AnswerHistoryEntry[] = rawHist ? JSON.parse(rawHist) : []
  history.push({
    questionId: vocabId,
    categoryId: 'vocab',
    isCorrect: level >= 2,
    timestamp: now,
    source: 'vocab',
  })
  localStorage.setItem(STORAGE_KEY_HISTORY, JSON.stringify(history))

  // Sync to Cloudflare D1
  fetch('/api/user/action', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'vocab_update',
      payload: {
        vocabId,
        masteryLevel: level,
      },
    }),
  }).catch(() => {})

  fetch('/api/user/action', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'record_answer',
      payload: {
        questionId: vocabId,
        categoryId: 'vocab',
        isCorrect: level >= 2,
        source: 'vocab',
      },
    }),
  }).catch(() => {})
}

/** 四選一測驗答對加一檔、答錯退一檔，範圍 0–4；翻卡自評仍走 updateVocabMastery。 */
export function bumpVocabMastery(vocabId: string, isCorrect: boolean): number {
  const current = getVocabMasteryMap()[vocabId]?.level ?? 0
  const next = isCorrect ? Math.min(MAX_VOCAB_LEVEL, current + 1) : Math.max(0, current - 1)
  updateVocabMastery(vocabId, next)
  return next
}

export const MAX_VOCAB_LEVEL = 4

/** 設計 03：自評三檔各自對應下次出現時間，翻卡與測驗共用同一組文案。 */
const SRS_INTERVALS: Record<number, string> = {
  0: '10 分鐘後',
  1: '10 分鐘後',
  2: '明天',
  3: '4 天後',
  4: '10 天後',
}

export function getSrsIntervalLabel(level: number): string {
  return SRS_INTERVALS[Math.max(0, Math.min(MAX_VOCAB_LEVEL, level))] ?? '10 分鐘後'
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

// --- Answer History Queries ---

export function getAnswerHistory(): AnswerHistoryEntry[] {
  if (typeof window === 'undefined') return []
  const raw = localStorage.getItem(STORAGE_KEY_HISTORY)
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

/** 單題作答歷程，新到舊。設計 16 的右欄要列出每次選了什麼、在哪答的。 */
export function getQuestionHistory(questionId: string): AnswerHistoryEntry[] {
  return getAnswerHistory()
    .filter((e) => e.questionId === questionId)
    .sort((a, b) => b.timestamp - a.timestamp)
}

export interface CalendarDay {
  date: string
  count: number
}

/**
 * 由舊到新、連續不跳日的每日答題量，供設計 05/12 的練習日曆熱區使用。
 * 一律補滿空白日，否則格子會錯位對不上星期。
 */
export function getPracticeCalendar(days: number = 84): CalendarDay[] {
  const counts: Record<string, number> = {}
  for (const entry of getAnswerHistory()) {
    const d = new Date(entry.timestamp)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    counts[key] = (counts[key] ?? 0) + 1
  }

  const out: CalendarDay[] = []
  const cursor = new Date()
  cursor.setHours(0, 0, 0, 0)
  cursor.setDate(cursor.getDate() - (days - 1))
  for (let i = 0; i < days; i++) {
    const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}-${String(cursor.getDate()).padStart(2, '0')}`
    out.push({ date: key, count: counts[key] ?? 0 })
    cursor.setDate(cursor.getDate() + 1)
  }
  return out
}

export function getPracticedDayCount(): number {
  const seen = new Set<string>()
  for (const entry of getAnswerHistory()) {
    const d = new Date(entry.timestamp)
    seen.add(`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`)
  }
  return seen.size
}

export interface ChapterMastery {
  totalAnswered: number
  correctCount: number
  accuracyRate: number
  uniqueAnsweredCount: number
}

/**
 * 每章掌握度。歷程只存 categoryId，章節要從 questionId 反推——id 形如
 * `grammar/02_.../09_不定詞#q5`，`#` 前面就是 chapterId（見 build-content/id.ts）。
 */
export function getChapterMasteryMap(): Record<string, ChapterMastery> {
  const map: Record<string, { total: number; correct: number; questions: Set<string> }> = {}
  for (const entry of getAnswerHistory()) {
    const hashAt = entry.questionId.indexOf('#')
    if (hashAt <= 0) continue
    const chapterId = entry.questionId.slice(0, hashAt)
    const bucket = map[chapterId] ?? { total: 0, correct: 0, questions: new Set() }
    bucket.total += 1
    if (entry.isCorrect) bucket.correct += 1
    bucket.questions.add(entry.questionId)
    map[chapterId] = bucket
  }

  const out: Record<string, ChapterMastery> = {}
  for (const [id, v] of Object.entries(map)) {
    out[id] = {
      totalAnswered: v.total,
      correctCount: v.correct,
      accuracyRate: v.total > 0 ? Math.round((v.correct / v.total) * 100) : 0,
      uniqueAnsweredCount: v.questions.size,
    }
  }
  return out
}

/** 判定小章節是否完成：必須答過該章節所有的題目，且正確率 >= 80% */
export function isChapterCompleted(
  mastery: ChapterMastery | null | undefined,
  totalQuestionsInChapter: number
): boolean {
  if (!mastery || totalQuestionsInChapter <= 0) return false
  const uniqueDone = mastery.uniqueAnsweredCount ?? 0
  return uniqueDone >= totalQuestionsInChapter && mastery.accuracyRate >= 80
}

// --- Wrong Question Queries ---

/** 待複習優先：未畢業的排前面，同組再依錯次多、最近答錯的排前面。 */
export function getWrongQuestionList(): WrongQuestionRecord[] {
  return Object.values(getWrongQuestionsMap()).sort((a, b) => {
    if (a.consecutiveCorrect !== b.consecutiveCorrect) {
      return a.consecutiveCorrect - b.consecutiveCorrect
    }
    if (a.failCount !== b.failCount) return b.failCount - a.failCount
    return b.lastFailedAt - a.lastFailedAt
  })
}

export function removeWrongQuestions(questionIds: string[]): void {
  if (typeof window === 'undefined') return
  const map = getWrongQuestionsMap()
  for (const id of questionIds) delete map[id]
  localStorage.setItem(STORAGE_KEY_WRONG, JSON.stringify(map))

  fetch('/api/user/action', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'remove_wrong', payload: { questionIds } }),
  }).catch(() => {})
}

// --- Mock Exam Results ---

export interface MockResult {
  examId: string
  finishedAt: number
  correctCount: number
  totalCount: number
  /** 秒 */
  durationSeconds: number
  estimatedScore: number
}

export function getMockResults(): MockResult[] {
  if (typeof window === 'undefined') return []
  const raw = localStorage.getItem(STORAGE_KEY_MOCK)
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

/** 回傳「這次之前」的最近一次成績，供設計 17 的「比上次 +3 題」使用。 */
export function saveMockResult(result: MockResult): MockResult | null {
  if (typeof window === 'undefined') return null
  const all = getMockResults()
  const previous = all.length > 0 ? all[all.length - 1]! : null
  all.push(result)
  // 只留最近 20 次，避免 localStorage 無限成長。
  localStorage.setItem(STORAGE_KEY_MOCK, JSON.stringify(all.slice(-20)))
  return previous
}

// --- User Profile ---

export interface UserProfile {
  nickname: string
  targetScore: number
  dailyGoalMinutes: number
  examDate: string | null
  reminderEnabled: boolean
  reminderTime: string
  streakShield: boolean
  weeklyReport: boolean
}

export const DEFAULT_PROFILE: UserProfile = {
  nickname: '',
  targetScore: 800,
  dailyGoalMinutes: 15,
  examDate: null,
  reminderEnabled: true,
  reminderTime: '07:30',
  streakShield: true,
  weeklyReport: false,
}

export function getProfile(): UserProfile {
  if (typeof window === 'undefined') return { ...DEFAULT_PROFILE }
  const raw = localStorage.getItem(STORAGE_KEY_PROFILE)
  if (!raw) return { ...DEFAULT_PROFILE }
  try {
    return { ...DEFAULT_PROFILE, ...JSON.parse(raw) }
  } catch {
    return { ...DEFAULT_PROFILE }
  }
}

export function saveProfile(profile: UserProfile): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(STORAGE_KEY_PROFILE, JSON.stringify(profile))

  fetch('/api/user/profile', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(profile),
  }).catch(() => {})
}

// --- D1 Synchronizer ---

export async function syncUserDataFromD1(): Promise<void> {
  if (typeof window === 'undefined') return
  try {
    const res = await fetch('/api/user/data')
    if (!res.ok) return
    const data = await res.json()
    if (!data) return

    // 1. Sync Vocab Mastery
    if (Array.isArray(data.vocabMastery) && data.vocabMastery.length > 0) {
      const vocabMap: Record<string, { level: number; lastReviewed: number }> = {}
      for (const item of data.vocabMastery) {
        vocabMap[item.vocab_id] = { level: item.mastery_level, lastReviewed: Date.now() }
      }
      localStorage.setItem(STORAGE_KEY_VOCAB, JSON.stringify(vocabMap))
    }

    // 2. Sync Wrong Questions
    if (Array.isArray(data.wrongQuestions)) {
      const wrongMap: Record<string, WrongQuestionRecord> = {}
      for (const item of data.wrongQuestions) {
        wrongMap[item.question_id] = {
          questionId: item.question_id,
          categoryId: item.category_id,
          failCount: 1,
          consecutiveCorrect: item.consecutive_correct,
          lastFailedAt: Date.now(),
        }
      }
      localStorage.setItem(STORAGE_KEY_WRONG, JSON.stringify(wrongMap))
    }

    // 3. Sync Answer History
    if (Array.isArray(data.answerHistory) && data.answerHistory.length > 0) {
      const history: AnswerHistoryEntry[] = data.answerHistory.map((item: any) => ({
        questionId: item.question_id,
        categoryId: item.category_id,
        isCorrect: item.is_correct === 1 || item.is_correct === true,
        timestamp: new Date(item.created_at || Date.now()).getTime(),
        ...(item.selected_key ? { selectedKey: item.selected_key } : {}),
        ...(item.source ? { source: item.source as AnswerSource } : {}),
      }))
      localStorage.setItem(STORAGE_KEY_HISTORY, JSON.stringify(history))
    }

    // 4. Sync User Profile（獨立 endpoint，失敗不影響其他同步）
    try {
      const profileRes = await fetch('/api/user/profile')
      if (profileRes.ok) {
        const profileData = await profileRes.json()
        if (profileData?.profile) {
          const merged: UserProfile = {
            ...DEFAULT_PROFILE,
            ...profileData.profile,
            nickname: profileData.nickname || getProfile().nickname,
          }
          localStorage.setItem(STORAGE_KEY_PROFILE, JSON.stringify(merged))
        }
      }
    } catch {
      // 個人資料同步失敗就沿用本機設定
    }

    // 5. Sync Daily Progress / Stats
    if (data.stats && data.stats.streak_days) {
      const today = getTodayString()
      const currentLocal = getDailyProgress()
      const isTodayLocal = currentLocal.date === today
      const syncedHistory: AnswerHistoryEntry[] = Array.isArray(data.answerHistory)
        ? data.answerHistory.map((item: any) => ({
            questionId: item.question_id,
            categoryId: item.category_id,
            isCorrect: item.is_correct === 1 || item.is_correct === true,
            timestamp: new Date(item.created_at || Date.now()).getTime(),
            source: item.source as AnswerSource,
          }))
        : []
      const historyFlags = checkTodayCompletedTasks(syncedHistory)

      const progress: DailyProgress = {
        date: today, // Must always be client local today date, NOT last_practice_date from DB
        streak: data.stats.streak_days || 1,
        grammarCompleted: (isTodayLocal && currentLocal.grammarCompleted) || historyFlags.grammar,
        vocabCompleted: (isTodayLocal && currentLocal.vocabCompleted) || historyFlags.vocab,
        readingCompleted: (isTodayLocal && currentLocal.readingCompleted) || historyFlags.reading,
      }
      localStorage.setItem(STORAGE_KEY_PROGRESS, JSON.stringify(progress))
      notifyStorageUpdate()
    }
  } catch (e) {
    console.error('Error syncing user data from D1:', e)
  }
}
