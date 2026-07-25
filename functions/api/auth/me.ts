import { verifyJwt } from '../../../src/lib/crypto'

export async function onRequestGet(context: any) {
  const cookieHeader = context.request.headers.get('Cookie') || ''
  const match = cookieHeader.match(/toeic_session=([^;]+)/)
  if (!match) {
    return new Response(JSON.stringify({ user: null }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const secret = context.env.JWT_SECRET || 'toeic-flow-jwt-secret-2026'
  const payload = await verifyJwt<{ userId: string; email: string; nickname: string }>(match[1], secret)

  if (!payload) {
    return new Response(JSON.stringify({ user: null }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  return new Response(
    JSON.stringify({ user: { id: payload.userId, email: payload.email, nickname: payload.nickname } }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  )
}
