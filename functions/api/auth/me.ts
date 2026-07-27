import { verifyJwt } from '../../../src/lib/crypto'

function getCorsHeaders(request: any) {
  const origin = request?.headers?.get('origin') || '*'
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

  const secret = context.env.JWT_SECRET || 'toeic-flow-jwt-secret-2026'
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
