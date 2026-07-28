import { describe, it, expect, beforeAll } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { buildContent, type ContentBundle } from '../scripts/build-content/index'
import { NOTES_DIR, VAULT_AVAILABLE, VAULT_SKIP_REASON } from './support/vault'

if (!VAULT_AVAILABLE) console.warn(`[content-consistency.real.test.ts] ${VAULT_SKIP_REASON}`)

const CONTENT_DIR = join(process.cwd(), 'content')

function loadJson<T>(name: string): T {
  return JSON.parse(readFileSync(join(CONTENT_DIR, name), 'utf8')) as T
}

interface IdRecord {
  id: string
}

function diffIds(freshIds: string[], committedIds: string[]) {
  const freshSet = new Set(freshIds)
  const committedSet = new Set(committedIds)
  return {
    // Present in committed content/*.json but the vault no longer produces it
    // — this is the shape of the incident this test exists to catch.
    missingFromFresh: committedIds.filter((id) => !freshSet.has(id)),
    // Present in a fresh parse but not yet in committed content — the notes
    // grew and nobody has run `pnpm build:content` yet.
    extraInFresh: freshIds.filter((id) => !committedSet.has(id)),
  }
}

function expectSameIds(label: string, freshIds: string[], committedIds: string[]): void {
  const { missingFromFresh, extraInFresh } = diffIds(freshIds, committedIds)
  if (missingFromFresh.length === 0 && extraInFresh.length === 0) return

  const lines = [
    'content/*.json 與筆記已脫鉤，請執行 pnpm build:content',
    `${label}：筆記重新解析出 ${freshIds.length} 筆，committed content/*.json 有 ${committedIds.length} 筆` +
      `（差 ${freshIds.length - committedIds.length}）`,
  ]
  if (missingFromFresh.length > 0) {
    lines.push(
      `committed content 裡存在、筆記重新解析後卻消失的 id（前 10 筆）：` +
        `${missingFromFresh.slice(0, 10).join(', ')}${missingFromFresh.length > 10 ? ' …' : ''}`,
    )
  }
  if (extraInFresh.length > 0) {
    lines.push(
      `筆記重新解析出、但 committed content 裡還沒有的 id（前 10 筆）：` +
        `${extraInFresh.slice(0, 10).join(', ')}${extraInFresh.length > 10 ? ' …' : ''}`,
    )
  }
  expect.fail(lines.join('\n'))
}

/** Compares one field (e.g. chapterId, categoryId) for every id present in both sides. */
function expectSameField<T extends IdRecord>(
  label: string,
  fieldName: string,
  fresh: T[],
  committed: T[],
  fieldFn: (r: T) => string,
): void {
  const committedByField = new Map(committed.map((r) => [r.id, fieldFn(r)]))
  const mismatches: string[] = []
  for (const r of fresh) {
    const committedValue = committedByField.get(r.id)
    const freshValue = fieldFn(r)
    if (committedValue !== undefined && committedValue !== freshValue) {
      mismatches.push(`${r.id}: 筆記解析為 ${freshValue}，content 裡是 ${committedValue}`)
    }
  }
  if (mismatches.length === 0) return

  expect.fail(
    [
      'content/*.json 與筆記已脫鉤，請執行 pnpm build:content',
      `${label} 的 ${fieldName} 有 ${mismatches.length} 筆不一致（前 10 筆）：`,
      ...mismatches.slice(0, 10),
    ].join('\n'),
  )
}

interface QuestionLike extends IdRecord {
  chapterId: string
}

function flattenReadingQuestions(
  passages: { id: string; questions: QuestionLike[] }[],
): QuestionLike[] {
  return passages.flatMap((p) => p.questions)
}

function flattenMockQuestions(
  exams: { id: string; sections: { questions: QuestionLike[] }[] }[],
): QuestionLike[] {
  return exams.flatMap((e) => e.sections.flatMap((s) => s.questions))
}

describe.skipIf(!VAULT_AVAILABLE)('content/*.json matches a fresh parse of the vault', () => {
  let fresh: ContentBundle

  beforeAll(() => {
    // Belt and suspenders: describe.skipIf already skips this suite's hooks
    // when the vault is missing, but guard the call directly too, so this
    // can never throw ENOENT instead of skipping cleanly.
    if (!VAULT_AVAILABLE) return
    fresh = buildContent(NOTES_DIR)
  })

  it('produces no blocking (error-level) issues while parsing the vault', () => {
    const errors = fresh.issues.filter((i) => i.level === 'error')
    expect(
      errors,
      `解析筆記時出現錯誤，下面的內容比對就沒有意義了，請先修正：\n${errors.map((e) => e.message).join('\n')}`,
    ).toEqual([])
  })

  it('chapters.json: ids and category membership match exactly', () => {
    const committed = loadJson<{ id: string; categoryId: string }[]>('chapters.json')
    expectSameIds('chapters', fresh.chapters.map((c) => c.id), committed.map((c) => c.id))
    expectSameField('chapters', 'categoryId', fresh.chapters, committed, (c) => c.categoryId)
  })

  it('grammar.json: question ids and chapter membership match exactly', () => {
    const committed = loadJson<{ id: string; chapterId: string }[]>('grammar.json')
    expectSameIds('grammar 題目', fresh.grammar.map((q) => q.id), committed.map((q) => q.id))
    expectSameField('grammar 題目', 'chapterId', fresh.grammar, committed, (q) => q.chapterId)
  })

  it('vocab.json: vocab ids and chapter membership match exactly', () => {
    const committed = loadJson<{ id: string; chapterId: string }[]>('vocab.json')
    expectSameIds('vocab 單字', fresh.vocab.map((v) => v.id), committed.map((v) => v.id))
    expectSameField('vocab 單字', 'chapterId', fresh.vocab, committed, (v) => v.chapterId)
  })

  it('formulas.json: formula ids and chapter membership match exactly', () => {
    const committed = loadJson<{ id: string; chapterId: string }[]>('formulas.json')
    expectSameIds('formulas 秒殺公式', fresh.formulas.map((f) => f.id), committed.map((f) => f.id))
    expectSameField('formulas 秒殺公式', 'chapterId', fresh.formulas, committed, (f) => f.chapterId)
  })

  it('reading.json: passage ids, question ids and chapter membership match exactly', () => {
    const committedPassages = loadJson<{ id: string; questions: QuestionLike[] }[]>('reading.json')
    expectSameIds('reading 篇章', fresh.reading.map((p) => p.id), committedPassages.map((p) => p.id))

    const freshQuestions = flattenReadingQuestions(fresh.reading)
    const committedQuestions = flattenReadingQuestions(committedPassages)
    expectSameIds('reading 題目', freshQuestions.map((q) => q.id), committedQuestions.map((q) => q.id))
    expectSameField('reading 題目', 'chapterId', freshQuestions, committedQuestions, (q) => q.chapterId)
  })

  it('mock-exams.json: exam ids, question ids and chapter membership match exactly', () => {
    const committedExams = loadJson<{ id: string; sections: { questions: QuestionLike[] }[] }[]>(
      'mock-exams.json',
    )
    expectSameIds('mock 考卷', fresh.mockExams.map((e) => e.id), committedExams.map((e) => e.id))

    const freshQuestions = flattenMockQuestions(fresh.mockExams)
    const committedQuestions = flattenMockQuestions(committedExams)
    expectSameIds('mock 題目', freshQuestions.map((q) => q.id), committedQuestions.map((q) => q.id))
    expectSameField('mock 題目', 'chapterId', freshQuestions, committedQuestions, (q) => q.chapterId)
  })
})
