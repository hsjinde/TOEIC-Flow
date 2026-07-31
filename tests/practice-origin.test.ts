import { describe, it, expect } from 'vitest'
import { buildSession as buildVocabSession } from '../src/app/practice/vocab/page'
import { buildSession as buildCardSession } from '../src/app/practice/formulas/page'

describe('單字練習的出口', () => {
  it('預設回合沒帶 from 時回今日任務', () => {
    const s = buildVocabSession(new URLSearchParams())
    expect(s.backHref).toBe('/')
  })

  it('from=practice 讓預設回合回練習中心', () => {
    const s = buildVocabSession(new URLSearchParams({ from: 'practice' }))
    expect(s.backHref).toBe('/practice')
    expect(s.backLabel).toBe('練習中心')
  })

  // /stats 有一條 /practice/vocab?mode=weak，練完不該掉回首頁。
  it('from=stats 讓弱點複習回統計', () => {
    const s = buildVocabSession(new URLSearchParams({ mode: 'weak', from: 'stats' }))
    expect(s.backHref).toBe('/stats')
  })

  it('from 不改變題目數量', () => {
    const a = buildVocabSession(new URLSearchParams())
    const b = buildVocabSession(new URLSearchParams({ from: 'practice' }))
    expect(b.items.length).toBe(a.items.length)
  })
})

describe('速查卡的出口', () => {
  it('預設回合沒帶 from 時回今日任務', () => {
    const s = buildCardSession(new URLSearchParams())
    expect(s.backHref).toBe('/')
  })

  it('from=practice 讓預設回合回練習中心', () => {
    const s = buildCardSession(new URLSearchParams({ from: 'practice' }))
    expect(s.backHref).toBe('/practice')
  })
})
