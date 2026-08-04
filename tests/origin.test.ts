import { describe, it, expect } from 'vitest'
import { resolveOrigin, chapterHref, type Origin } from '../src/lib/origin'
import chaptersData from '../content/chapters.json'

const FALLBACK: Origin = { backHref: '/', backLabel: '今日任務' }

const sampleChapterId = (chaptersData as { id: string }[])[0]?.id
if (!sampleChapterId) throw new Error('chapters.json 沒有可用的章節樣本')

describe('resolveOrigin', () => {
  it('沒帶 from 時原封不動回傳 fallback', () => {
    expect(resolveOrigin(new URLSearchParams(), FALLBACK)).toEqual(FALLBACK)
  })

  it('白名單命中時回傳該來源', () => {
    expect(resolveOrigin(new URLSearchParams({ from: 'practice' }), FALLBACK)).toEqual({
      backHref: '/practice',
      backLabel: '練習中心',
    })
    expect(resolveOrigin(new URLSearchParams({ from: 'stats' }), FALLBACK)).toEqual({
      backHref: '/stats',
      backLabel: '統計',
    })
  })

  // 直接把 from 當 href 用會變成開放重導向，所以查不到一律退回 fallback。
  it('未知的 from 退回 fallback', () => {
    expect(resolveOrigin(new URLSearchParams({ from: 'evil' }), FALLBACK)).toEqual(FALLBACK)
  })

  it('外部網址形式的 from 退回 fallback，不得原樣採用', () => {
    const out = resolveOrigin(new URLSearchParams({ from: 'https://example.com' }), FALLBACK)
    expect(out).toEqual(FALLBACK)
    expect(out.backHref.startsWith('/')).toBe(true)
  })

  it('from=chapter 時用同一組 params 裡的 chapter 解析出該章', () => {
    const params = new URLSearchParams({ from: 'chapter', chapter: sampleChapterId })
    const out = resolveOrigin(params, FALLBACK)
    expect(out.backHref).toBe(chapterHref(sampleChapterId))
    expect(out.backLabel.length).toBeGreaterThan(0)
  })

  it('from=chapter 但缺 chapter 參數時退回 fallback', () => {
    expect(resolveOrigin(new URLSearchParams({ from: 'chapter' }), FALLBACK)).toEqual(FALLBACK)
  })

  it('from=chapter 但章節不存在時退回 fallback', () => {
    const params = new URLSearchParams({ from: 'chapter', chapter: 'grammar/不存在/不存在' })
    expect(resolveOrigin(params, FALLBACK)).toEqual(FALLBACK)
  })

  it('原型鏈上的屬性（如 __proto__、constructor 等）應該退回 fallback，不能被誤認為是合法來源', () => {
    const prototypeKeys = ['__proto__', 'constructor', 'toString', 'hasOwnProperty', 'valueOf', 'isPrototypeOf', 'propertyIsEnumerable', 'toLocaleString']

    for (const key of prototypeKeys) {
      const result = resolveOrigin(new URLSearchParams({ from: key }), FALLBACK)
      expect(result).toEqual(FALLBACK)
    }
  })
})

describe('chapterHref', () => {
  it('逐段編碼，不把斜線編掉', () => {
    expect(chapterHref('grammar/01_甲/02_乙')).toBe(
      `/chapters/grammar/${encodeURIComponent('01_甲')}/${encodeURIComponent('02_乙')}`
    )
  })
})
