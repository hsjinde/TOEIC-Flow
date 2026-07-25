import { verifyJwt } from '../../../src/lib/crypto'

export async function onRequestGet(context: any) {
  const cookieHeader = context.request.headers.get('Cookie') || ''
  const match = cookieHeader.match(/toeic_session=([^;]+)/)
  if (!match) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const secret = context.env.JWT_SECRET || 'toeic-flow-jwt-secret-2026'
  const payload = await verifyJwt<{ userId: string }>(match[1], secret)
  if (!payload) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const userId = payload.userId
  const db = context.env.toeic_db

  const vocabRows = await db.prepare('SELECT vocab_id, mastery_level FROM user_vocab_mastery WHERE user_id = ?').bind(userId).all()
  const wrongRows = await db.prepare('SELECT question_id, category_id, consecutive_correct FROM user_wrong_questions WHERE user_id = ?').bind(userId).all()
  const historyRows = await db.prepare('SELECT question_id, category_id, is_correct, created_at FROM user_answer_history WHERE user_id = ? ORDER BY created_at DESC LIMIT 500').bind(userId).all()
  const stats = await db.prepare('SELECT streak_days, last_practice_date, estimated_score FROM user_stats WHERE user_id = ?').bind(userId).first()

  return new Response(
    JSON.stringify({
      vocabMastery: vocabRows.results || [],
      wrongQuestions: wrongRows.results || [],
      answerHistory: historyRows.results || [],
      stats: stats || { streak_days: 1, estimated_score: 450 },
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  )
}
