import { describe, it, expect, beforeEach } from 'vitest'
import { onRequestPost as registerHandler } from '../functions/api/auth/register'
import { onRequestPost as loginHandler } from '../functions/api/auth/login'
import { onRequestGet as meHandler } from '../functions/api/auth/me'
import { onRequestPost as logoutHandler } from '../functions/api/auth/logout'
import { onRequestGet as userDataHandler } from '../functions/api/user/data'
import { onRequestPost as userActionHandler } from '../functions/api/user/action'

// Mock D1 Database
function createMockD1() {
  const usersTable = new Map<string, any>()
  const statsTable = new Map<string, any>()
  const vocabTable = new Map<string, any>()
  const wrongTable = new Map<string, any>()
  const historyTable: any[] = []

  return {
    prepare(query: string) {
      let bindings: any[] = []
      const stmt = {
        bind(...args: any[]) {
          bindings = args
          return stmt
        },
        async first() {
          if (query.includes('SELECT id FROM users WHERE email')) {
            const email = bindings[0]
            for (const u of usersTable.values()) {
              if (u.email === email) return { id: u.id }
            }
            return null
          }
          if (query.includes('SELECT id, email, password_hash, salt, nickname FROM users WHERE email')) {
            const email = bindings[0]
            for (const u of usersTable.values()) {
              if (u.email === email) return u
            }
            return null
          }
          if (query.includes('SELECT streak_days, last_practice_date, estimated_score FROM user_stats')) {
            const userId = bindings[0]
            return statsTable.get(userId) || null
          }
          return null
        },
        async run() {
          if (query.includes('INSERT INTO users')) {
            const [id, email, password_hash, salt, nickname] = bindings
            usersTable.set(id, { id, email, password_hash, salt, nickname })
          } else if (query.includes('INSERT INTO user_stats') || query.includes('ON CONFLICT(user_id) DO UPDATE')) {
            const [user_id, streak_days, last_practice_date, estimated_score] = bindings
            statsTable.set(user_id, { streak_days, last_practice_date, estimated_score })
          } else if (query.includes('INSERT INTO user_vocab_mastery')) {
            const [user_id, vocab_id, mastery_level] = bindings
            vocabTable.set(`${user_id}:${vocab_id}`, { user_id, vocab_id, mastery_level })
          } else if (query.includes('INSERT INTO user_wrong_questions')) {
            const [user_id, question_id, category_id, consecutive_correct] = bindings
            wrongTable.set(`${user_id}:${question_id}`, { user_id, question_id, category_id, consecutive_correct })
          } else if (query.includes('DELETE FROM user_wrong_questions')) {
            const [user_id, question_id] = bindings
            wrongTable.delete(`${user_id}:${question_id}`)
          } else if (query.includes('INSERT INTO user_answer_history')) {
            const [id, user_id, question_id, category_id, is_correct] = bindings
            historyTable.push({ id, user_id, question_id, category_id, is_correct, created_at: new Date().toISOString() })
          }
          return { success: true }
        },
        async all() {
          const userId = bindings[0]
          if (query.includes('user_vocab_mastery')) {
            const results = Array.from(vocabTable.values()).filter(r => r.user_id === userId)
            return { results }
          }
          if (query.includes('user_wrong_questions')) {
            const results = Array.from(wrongTable.values()).filter(r => r.user_id === userId)
            return { results }
          }
          if (query.includes('user_answer_history')) {
            const results = historyTable.filter(r => r.user_id === userId)
            return { results }
          }
          return { results: [] }
        }
      }
      return stmt
    }
  }
}

describe('Cloudflare Pages Functions Auth & User API', () => {
  let mockDb: any
  let env: any

  beforeEach(() => {
    mockDb = createMockD1()
    env = { toeic_db: mockDb, JWT_SECRET: 'test-secret-key-12345' }
  })

  it('handles registration, login, me, and logout cycle', async () => {
    // 1. Register
    const regReq = new Request('http://localhost/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'user@example.com', password: 'password123', nickname: 'TestUser' }),
    })
    const regRes = await registerHandler({ request: regReq, env })
    expect(regRes.status).toBe(200)
    const regData = await regRes.json()
    expect(regData.success).toBe(true)
    expect(regData.user.email).toBe('user@example.com')

    const cookieHeader = regRes.headers.get('Set-Cookie')
    expect(cookieHeader).toContain('toeic_session=')

    const cookieValue = cookieHeader?.match(/toeic_session=([^;]+)/)?.[1] || ''

    // 2. Me endpoint with Cookie
    const meReq = new Request('http://localhost/api/auth/me', {
      headers: { Cookie: `toeic_session=${cookieValue}` },
    })
    const meRes = await meHandler({ request: meReq, env })
    expect(meRes.status).toBe(200)
    const meData = await meRes.json()
    expect(meData.user.email).toBe('user@example.com')

    // 3. Login
    const loginReq = new Request('http://localhost/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'user@example.com', password: 'password123' }),
    })
    const loginRes = await loginHandler({ request: loginReq, env })
    expect(loginRes.status).toBe(200)
    const loginData = await loginRes.json()
    expect(loginData.user.email).toBe('user@example.com')

    // 4. Logout
    const logoutRes = await logoutHandler()
    expect(logoutRes.status).toBe(200)
    expect(logoutRes.headers.get('Set-Cookie')).toContain('Max-Age=0')
  })

  it('handles user data query and user actions', async () => {
    // Register to get cookie
    const regReq = new Request('http://localhost/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'action@example.com', password: 'password123', nickname: 'ActionUser' }),
    })
    const regRes = await registerHandler({ request: regReq, env })
    const cookieValue = regRes.headers.get('Set-Cookie')?.match(/toeic_session=([^;]+)/)?.[1] || ''

    // Perform vocab_update action
    const actionReq1 = new Request('http://localhost/api/user/action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: `toeic_session=${cookieValue}` },
      body: JSON.stringify({ action: 'vocab_update', payload: { vocab_id: 'v_001', mastery_level: 3 } }),
    })
    const actionRes1 = await userActionHandler({ request: actionReq1, env })
    expect(actionRes1.status).toBe(200)

    // Perform record_answer action
    const actionReq2 = new Request('http://localhost/api/user/action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: `toeic_session=${cookieValue}` },
      body: JSON.stringify({ action: 'record_answer', payload: { question_id: 'q_101', category_id: 'part1', is_correct: false } }),
    })
    const actionRes2 = await userActionHandler({ request: actionReq2, env })
    expect(actionRes2.status).toBe(200)

    // Fetch user data
    const dataReq = new Request('http://localhost/api/user/data', {
      headers: { Cookie: `toeic_session=${cookieValue}` },
    })
    const dataRes = await userDataHandler({ request: dataReq, env })
    expect(dataRes.status).toBe(200)
    const data = await dataRes.json()
    expect(data.vocabMastery.length).toBe(1)
    expect(data.wrongQuestions.length).toBe(1)
    expect(data.answerHistory.length).toBe(1)
  })
})
