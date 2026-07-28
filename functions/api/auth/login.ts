import { verifyPassword, signJwt } from '../../../src/lib/crypto'
import { getJwtSecret, JWT_SECRET_ERROR_MESSAGE } from '../../_lib/jwtSecret'

function getCorsHeaders(request: any) {
  const origin = request?.headers?.get('origin') || request?.headers?.get('Origin') || 'http://localhost:3000'
  return {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  }
}

export async function onRequestOptions(context: any) {
  return new Response(null, {
    status: 204,
    headers: getCorsHeaders(context.request),
  })
}

export async function onRequestPost(context: any) {
  const origin = context.request?.headers?.get('origin') || '*'
  const corsHeaders = getCorsHeaders(context.request)

  try {
    const { email, password } = await context.request.json()
    if (!email || !password) {
      return new Response(JSON.stringify({ error: '請提供帳號與密碼' }), {
        status: 400,
        headers: corsHeaders,
      })
    }

    const db = context.env.toeic_db || context.env.DB
    if (!db) {
      return new Response(JSON.stringify({ error: 'Cloudflare D1 資料庫未綁定' }), {
        status: 500,
        headers: corsHeaders,
      })
    }
    const user = await db
      .prepare('SELECT id, email, password_hash, salt, nickname FROM users WHERE email = ?')
      .bind(email)
      .first()

    if (!user) {
      return new Response(JSON.stringify({ error: '帳號或密碼錯誤' }), {
        status: 401,
        headers: corsHeaders,
      })
    }

    const isValid = await verifyPassword(password, user.password_hash, user.salt)
    if (!isValid) {
      return new Response(JSON.stringify({ error: '帳號或密碼錯誤' }), {
        status: 401,
        headers: corsHeaders,
      })
    }

    const secret = getJwtSecret(context.env)
    if (!secret) {
      return new Response(JSON.stringify({ error: JWT_SECRET_ERROR_MESSAGE }), {
        status: 500,
        headers: corsHeaders,
      })
    }
    const token = await signJwt({ userId: user.id, email: user.email, nickname: user.nickname }, secret)

    const headers = new Headers()
    headers.append('Content-Type', 'application/json')
    headers.append('Access-Control-Allow-Origin', origin)
    headers.append('Access-Control-Allow-Credentials', 'true')
    headers.append(
      'Set-Cookie',
      `toeic_session=${token}; HttpOnly; Secure; Path=/; SameSite=None; Max-Age=2592000`
    )

    return new Response(
      JSON.stringify({ success: true, user: { id: user.id, email: user.email, nickname: user.nickname } }),
      { status: 200, headers }
    )
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message || '登入失敗' }), {
      status: 500,
      headers: corsHeaders,
    })
  }
}
