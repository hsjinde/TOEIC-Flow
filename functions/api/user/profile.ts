import { verifyJwt } from '../../../src/lib/crypto'
import { getJwtSecret, JWT_SECRET_ERROR_MESSAGE } from '../../_lib/jwtSecret'

const JSON_HEADERS = { 'Content-Type': 'application/json' }

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS })
}

async function authorize(
  context: any
): Promise<{ userId: string; db: any } | Response> {
  const cookieHeader = context.request.headers.get('Cookie') || ''
  const match = cookieHeader.match(/toeic_session=([^;]+)/)
  if (!match) return json({ error: '請先登入' }, 401)

  const secret = getJwtSecret(context.env)
  if (!secret) return json({ error: JWT_SECRET_ERROR_MESSAGE }, 500)
  const payload = await verifyJwt<{ userId: string }>(match[1], secret)
  if (!payload) return json({ error: '登入已過期，請重新登入' }, 401)

  const db = context.env.toeic_db || context.env.DB
  if (!db) return json({ error: 'Cloudflare D1 資料庫未綁定' }, 500)

  return { userId: payload.userId, db }
}

export async function onRequestGet(context: any) {
  const auth = await authorize(context)
  if (auth instanceof Response) return auth
  const { userId, db } = auth

  const row = await db
    .prepare(
      `SELECT target_score, daily_goal_minutes, exam_date, reminder_enabled,
              reminder_time, streak_shield, weekly_report
       FROM user_profile WHERE user_id = ?`
    )
    .bind(userId)
    .first()

  const nickname = await db
    .prepare('SELECT nickname FROM users WHERE id = ?')
    .bind(userId)
    .first()

  if (!row) return json({ profile: null, nickname: nickname?.nickname ?? '' })

  return json({
    profile: {
      targetScore: row.target_score,
      dailyGoalMinutes: row.daily_goal_minutes,
      examDate: row.exam_date,
      reminderEnabled: row.reminder_enabled === 1,
      reminderTime: row.reminder_time,
      streakShield: row.streak_shield === 1,
      weeklyReport: row.weekly_report === 1,
    },
    nickname: nickname?.nickname ?? '',
  })
}

export async function onRequestPost(context: any) {
  const auth = await authorize(context)
  if (auth instanceof Response) return auth
  const { userId, db } = auth

  try {
    const body = await context.request.json()

    const targetScore = Number(body.targetScore ?? body.target_score ?? 800)
    const dailyGoal = Number(body.dailyGoalMinutes ?? body.daily_goal_minutes ?? 15)
    if (!Number.isFinite(targetScore) || targetScore < 10 || targetScore > 990) {
      return json({ error: '目標分數需介於 10 到 990 之間' }, 400)
    }
    if (!Number.isFinite(dailyGoal) || dailyGoal <= 0) {
      return json({ error: '每日目標分鐘數不正確' }, 400)
    }

    const nickname = typeof body.nickname === 'string' ? body.nickname.trim() : ''
    if (nickname) {
      if (nickname.length > 20) return json({ error: '暱稱最多 20 個字' }, 400)
      await db.prepare('UPDATE users SET nickname = ? WHERE id = ?').bind(nickname, userId).run()
    }

    await db
      .prepare(
        `INSERT INTO user_profile (user_id, target_score, daily_goal_minutes, exam_date,
                                   reminder_enabled, reminder_time, streak_shield, weekly_report, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
         ON CONFLICT(user_id) DO UPDATE SET
           target_score = excluded.target_score,
           daily_goal_minutes = excluded.daily_goal_minutes,
           exam_date = excluded.exam_date,
           reminder_enabled = excluded.reminder_enabled,
           reminder_time = excluded.reminder_time,
           streak_shield = excluded.streak_shield,
           weekly_report = excluded.weekly_report,
           updated_at = CURRENT_TIMESTAMP`
      )
      .bind(
        userId,
        Math.round(targetScore),
        Math.round(dailyGoal),
        body.examDate ?? body.exam_date ?? null,
        body.reminderEnabled ?? body.reminder_enabled ? 1 : 0,
        body.reminderTime ?? body.reminder_time ?? '07:30',
        body.streakShield ?? body.streak_shield ? 1 : 0,
        body.weeklyReport ?? body.weekly_report ? 1 : 0
      )
      .run()

    return json({ success: true })
  } catch (err: any) {
    return json({ error: err?.message || '儲存個人資料失敗' }, 500)
  }
}
