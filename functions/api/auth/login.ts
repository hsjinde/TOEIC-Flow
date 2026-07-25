import { verifyPassword, signJwt } from '../../../src/lib/crypto'

export async function onRequestPost(context: any) {
  try {
    const { email, password } = await context.request.json()
    if (!email || !password) {
      return new Response(JSON.stringify({ error: '請提供帳號與密碼' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const db = context.env.toeic_db
    const user = await db
      .prepare('SELECT id, email, password_hash, salt, nickname FROM users WHERE email = ?')
      .bind(email)
      .first()

    if (!user) {
      return new Response(JSON.stringify({ error: '帳號或密碼錯誤' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const isValid = await verifyPassword(password, user.password_hash, user.salt)
    if (!isValid) {
      return new Response(JSON.stringify({ error: '帳號或密碼錯誤' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const secret = context.env.JWT_SECRET || 'toeic-flow-jwt-secret-2026'
    const token = await signJwt({ userId: user.id, email: user.email, nickname: user.nickname }, secret)

    const headers = new Headers()
    headers.append('Content-Type', 'application/json')
    headers.append(
      'Set-Cookie',
      `toeic_session=${token}; HttpOnly; Secure; Path=/; SameSite=Lax; Max-Age=2592000`
    )

    return new Response(
      JSON.stringify({ success: true, user: { id: user.id, email: user.email, nickname: user.nickname } }),
      { status: 200, headers }
    )
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message || '登入失敗' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
