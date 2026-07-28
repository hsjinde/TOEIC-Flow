import { hashPassword, signJwt } from '../../../src/lib/crypto'
import { getJwtSecret, JWT_SECRET_ERROR_MESSAGE } from '../../_lib/jwtSecret'

export async function onRequestPost(context: any) {
  try {
    const { email, password, nickname } = await context.request.json()
    if (!email || !password || !nickname) {
      return new Response(JSON.stringify({ error: '請填寫所有必要欄位' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const db = context.env.toeic_db || context.env.DB
    if (!db) {
      return new Response(JSON.stringify({ error: 'Cloudflare D1 資料庫未綁定' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      })
    }
    const existing = await db.prepare('SELECT id FROM users WHERE email = ?').bind(email).first()
    if (existing) {
      return new Response(JSON.stringify({ error: '此 Email 已被註冊' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const userId = 'u_' + crypto.randomUUID()
    const { hash, salt } = await hashPassword(password)

    await db
      .prepare('INSERT INTO users (id, email, password_hash, salt, nickname) VALUES (?, ?, ?, ?, ?)')
      .bind(userId, email, hash, salt, nickname)
      .run()

    await db
      .prepare('INSERT INTO user_stats (user_id, streak_days, estimated_score) VALUES (?, 1, 450)')
      .bind(userId)
      .run()

    const secret = getJwtSecret(context.env)
    if (!secret) {
      return new Response(JSON.stringify({ error: JWT_SECRET_ERROR_MESSAGE }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      })
    }
    const token = await signJwt({ userId, email, nickname }, secret)

    const headers = new Headers()
    headers.append('Content-Type', 'application/json')
    headers.append(
      'Set-Cookie',
      `toeic_session=${token}; HttpOnly; Secure; Path=/; SameSite=Lax; Max-Age=2592000`
    )

    return new Response(JSON.stringify({ success: true, user: { id: userId, email, nickname } }), {
      status: 200,
      headers,
    })
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message || '註冊失敗' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
