import { getCorsHeaders, buildSessionCookie } from '../../_lib/corsAndCookie'

export async function onRequestOptions(context?: any) {
  return new Response(null, {
    status: 204,
    headers: getCorsHeaders(context?.request),
  })
}

export async function onRequestPost(context?: any) {
  const corsHeaders = getCorsHeaders(context?.request)
  const headers = new Headers(corsHeaders)
  headers.append('Set-Cookie', buildSessionCookie('', context?.request, 0))
  return new Response(JSON.stringify({ success: true }), { status: 200, headers })
}
