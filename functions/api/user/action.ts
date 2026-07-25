import { verifyJwt } from '../../../src/lib/crypto'

export async function onRequestPost(context: any) {
  try {
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
    const body = await context.request.json()
    const { action, payload: actionPayload } = body

    const act = action || body.type
    const data = actionPayload || body

    if (act === 'vocab_update') {
      const vocabId = data.vocab_id || data.vocabId
      const masteryLevel = data.mastery_level ?? data.masteryLevel ?? 0

      if (!vocabId) {
        return new Response(JSON.stringify({ error: 'Missing vocab_id' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        })
      }

      await db
        .prepare(
          `INSERT INTO user_vocab_mastery (user_id, vocab_id, mastery_level, updated_at)
           VALUES (?, ?, ?, CURRENT_TIMESTAMP)
           ON CONFLICT(user_id, vocab_id) DO UPDATE SET
             mastery_level = excluded.mastery_level,
             updated_at = CURRENT_TIMESTAMP`
        )
        .bind(userId, vocabId, masteryLevel)
        .run()

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    if (act === 'record_answer') {
      const questionId = data.question_id || data.questionId
      const categoryId = data.category_id || data.categoryId || 'general'
      const isCorrect = data.is_correct ?? data.isCorrect ? 1 : 0
      const consecutiveCorrect = data.consecutive_correct ?? data.consecutiveCorrect ?? (isCorrect ? 1 : 0)

      if (!questionId) {
        return new Response(JSON.stringify({ error: 'Missing question_id' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        })
      }

      const historyId = 'h_' + crypto.randomUUID()
      await db
        .prepare(
          `INSERT INTO user_answer_history (id, user_id, question_id, category_id, is_correct)
           VALUES (?, ?, ?, ?, ?)`
        )
        .bind(historyId, userId, questionId, categoryId, isCorrect)
        .run()

      if (isCorrect) {
        if (consecutiveCorrect >= 2) {
          await db
            .prepare(`DELETE FROM user_wrong_questions WHERE user_id = ? AND question_id = ?`)
            .bind(userId, questionId)
            .run()
        } else {
          await db
            .prepare(
              `INSERT INTO user_wrong_questions (user_id, question_id, category_id, consecutive_correct, updated_at)
               VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
               ON CONFLICT(user_id, question_id) DO UPDATE SET
                 consecutive_correct = excluded.consecutive_correct,
                 updated_at = CURRENT_TIMESTAMP`
            )
            .bind(userId, questionId, categoryId, consecutiveCorrect)
            .run()
        }
      } else {
        await db
          .prepare(
            `INSERT INTO user_wrong_questions (user_id, question_id, category_id, consecutive_correct, updated_at)
             VALUES (?, ?, ?, 0, CURRENT_TIMESTAMP)
             ON CONFLICT(user_id, question_id) DO UPDATE SET
               consecutive_correct = 0,
               updated_at = CURRENT_TIMESTAMP`
          )
          .bind(userId, questionId, categoryId)
          .run()
      }

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    if (act === 'update_stats') {
      const streakDays = data.streak_days ?? data.streakDays ?? 1
      const lastPracticeDate = data.last_practice_date || data.lastPracticeDate || new Date().toISOString().split('T')[0]
      const estimatedScore = data.estimated_score ?? data.estimatedScore ?? 450

      await db
        .prepare(
          `INSERT INTO user_stats (user_id, streak_days, last_practice_date, estimated_score, updated_at)
           VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
           ON CONFLICT(user_id) DO UPDATE SET
             streak_days = excluded.streak_days,
             last_practice_date = excluded.last_practice_date,
             estimated_score = excluded.estimated_score,
             updated_at = CURRENT_TIMESTAMP`
        )
        .bind(userId, streakDays, lastPracticeDate, estimatedScore)
        .run()

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ error: `Unknown action: ${act}` }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message || 'Action failed' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
