export async function onRequestPost() {
  const headers = new Headers()
  headers.append('Content-Type', 'application/json')
  headers.append('Set-Cookie', 'toeic_session=; HttpOnly; Secure; Path=/; Max-Age=0')
  return new Response(JSON.stringify({ success: true }), { status: 200, headers })
}
