import { verifyJwt } from '../../../src/lib/crypto'
import { getJwtSecret, JWT_SECRET_ERROR_MESSAGE } from '../../_lib/jwtSecret'

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

    const secret = getJwtSecret(context.env)
    if (!secret) {
      return new Response(JSON.stringify({ error: JWT_SECRET_ERROR_MESSAGE }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      })
    }
    const payload = await verifyJwt<{ userId: string }>(match[1], secret)
    if (!payload) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const userId = payload.userId
    const db = context.env.toeic_db || context.env.DB
    if (!db) {
      return new Response(JSON.stringify({ error: 'Cloudflare D1 資料庫未綁定' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      })
    }
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

      const selectedKey = data.selected_key || data.selectedKey || null
      const source = data.source || null

      const historyId = 'h_' + crypto.randomUUID()
      await db
        .prepare(
          `INSERT INTO user_answer_history (id, user_id, question_id, category_id, is_correct, selected_key, source)
           VALUES (?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(historyId, userId, questionId, categoryId, isCorrect, selectedKey, source)
        .run()

      // 模擬考交卷時只記歷程，錯題入本留給使用者按「把 N 題加入錯題本」。
      const fileWrong = data.fileWrong ?? data.file_wrong ?? true
      if (!fileWrong) {
        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      }

      if (isCorrect) {
        if (consecutiveCorrect >= 2) {
          await db
            .prepare(`DELETE FROM user_wrong_questions WHERE user_id = ? AND question_id = ?`)
            .bind(userId, questionId)
            .run()
        } else {
          // 只更新既有紀錄——第一次就答對的題目在表裡沒有列，UPDATE 不會新增，
          // 避免把從未答錯的題目誤植入錯題本（見 storage.ts 的 tracked 判斷）。
          await db
            .prepare(
              `UPDATE user_wrong_questions
               SET consecutive_correct = ?, updated_at = CURRENT_TIMESTAMP
               WHERE user_id = ? AND question_id = ?`
            )
            .bind(consecutiveCorrect, userId, questionId)
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

    if (act === 'file_wrong') {
      const items: { questionId: string; categoryId: string }[] = Array.isArray(data.items)
        ? data.items
        : []
      if (items.length === 0) {
        return new Response(JSON.stringify({ error: 'Missing items' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        })
      }

      const stmt = db.prepare(
        `INSERT INTO user_wrong_questions (user_id, question_id, category_id, consecutive_correct, updated_at)
         VALUES (?, ?, ?, 0, CURRENT_TIMESTAMP)
         ON CONFLICT(user_id, question_id) DO UPDATE SET
           consecutive_correct = 0,
           updated_at = CURRENT_TIMESTAMP`
      )
      await db.batch(
        items.map((i) => stmt.bind(userId, i.questionId, i.categoryId || 'general'))
      )

      return new Response(JSON.stringify({ success: true, filed: items.length }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    if (act === 'remove_wrong') {
      // 使用者在錯題本手動移出。少了這個分支，本機刪掉的題目會在下次
      // syncUserDataFromD1 時從 D1 復活。
      const ids: string[] = Array.isArray(data.questionIds)
        ? data.questionIds
        : Array.isArray(data.question_ids)
          ? data.question_ids
          : []

      if (ids.length === 0) {
        return new Response(JSON.stringify({ error: 'Missing questionIds' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        })
      }

      const stmt = db.prepare(
        'DELETE FROM user_wrong_questions WHERE user_id = ? AND question_id = ?'
      )
      await db.batch(ids.map((id) => stmt.bind(userId, id)))

      return new Response(JSON.stringify({ success: true, removed: ids.length }), {
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

    if (act === 'chapter_achievement') {
      const chapterId = data.chapter_id || data.chapterId

      if (!chapterId) {
        return new Response(JSON.stringify({ error: 'Missing chapter_id' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        })
      }

      // ON CONFLICT DO NOTHING：一旦達標就永久保留最早的達標時間，重複呼叫不會覆寫。
      await db
        .prepare(
          `INSERT INTO user_chapter_achievements (user_id, chapter_id, achieved_at)
           VALUES (?, ?, CURRENT_TIMESTAMP)
           ON CONFLICT(user_id, chapter_id) DO NOTHING`
        )
        .bind(userId, chapterId)
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
