export function getCorsHeaders(request?: any): Record<string, string> {
  const origin = request?.headers?.get?.('origin') || request?.headers?.get?.('Origin') || '*'
  return {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  }
}

export function buildSessionCookie(token: string, request?: any, maxAge: number = 2592000): string {
  const url = request?.url || ''
  const origin = request?.headers?.get?.('origin') || ''
  const isHttps = url.startsWith('https:') || origin.startsWith('https:')
  
  if (isHttps) {
    return `toeic_session=${token}; HttpOnly; Secure; Path=/; SameSite=None; Max-Age=${maxAge}`
  } else {
    // 本地 HTTP 開發環境：瀏覽器會拒絕帶有 Secure 的 Set-Cookie，故本地需省略 Secure
    return `toeic_session=${token}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${maxAge}`
  }
}
