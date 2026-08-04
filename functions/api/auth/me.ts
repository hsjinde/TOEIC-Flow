import { verifyJwt } from '../../../src/lib/crypto'
import { getJwtSecret, JWT_SECRET_ERROR_MESSAGE } from '../../_lib/jwtSecret'
import { getCorsHeaders } from '../../_lib/corsAndCookie'

export async function onRequestOptions(context: any) {
  return new Response(null, {
    status: 204,
    headers: getCorsHeaders(context.request),
  })
}

export async function onRequestGet(context: any) {
  const corsHeaders = getCorsHeaders(context.request)
  const cookieHeader = context.request.headers.get('Cookie') || ''
  const match = cookieHeader.match(/toeic_session=([^;]+)/)
  if (!match) {
    return new Response(JSON.stringify({ user: null }), {
      status: 200,
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
  const payload = await verifyJwt<{ userId: string; email: string; nickname: string }>(match[1], secret)

  if (!payload) {
    return new Response(JSON.stringify({ user: null }), {
      status: 200,
      headers: corsHeaders,
    })
  }

  return new Response(
    JSON.stringify({ user: { id: payload.userId, email: payload.email, nickname: payload.nickname } }),
    { status: 200, headers: corsHeaders }
  )
}
