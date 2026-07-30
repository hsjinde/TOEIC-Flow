// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import Page from '../src/app/practice/formulas/page'
import { getChapterLabel, getFormulaCard, getFormulaCards } from '../src/lib/content'

// useSearchParams() 在真正的 Next.js 裡是穩定參照，同一組查詢字串重render不會換物件。
// 這裡如果每次呼叫都 new 一個 URLSearchParams，頁面裡 useCallback([searchParams]) →
// useEffect([reload]) 這條鏈就會每次 render 都判定依賴變了，變成無限迴圈。
const mocks = vi.hoisted(() => ({
  search: '',
  cached: null as URLSearchParams | null,
  cachedFor: undefined as string | undefined,
}))

vi.mock('next/navigation', () => ({
  useSearchParams: () => {
    if (mocks.cachedFor !== mocks.search) {
      mocks.cached = new URLSearchParams(mocks.search)
      mocks.cachedFor = mocks.search
    }
    return mocks.cached
  },
}))

// next/link 在測試環境沒有 router，換成原生 a 才驗得到 href。
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: any) =>
    React.createElement('a', { href, ...rest }, children),
}))

const cards = getFormulaCards()
const WITH_CARD = 'grammar/04_特殊動詞用法/01_使役動詞'
// 69 章裡只有少數幾章寫了速查卡，所以「這一章沒有卡」是常態路徑，必須測。
const WITHOUT_CARD = 'grammar/01_八大詞性與句型結構/01_名詞與代名詞'

function chapterPath(id: string): string {
  return `/chapters/${id.split('/').map(encodeURIComponent).join('/')}`
}

describe('章節速查卡', () => {
  beforeEach(() => {
    mocks.search = ''
  })

  it('draws the whole card set with no query string', () => {
    render(<Page />)
    expect(screen.getByText(`章節速查卡 1 / ${cards.length}`)).toBeTruthy()
    expect(screen.getByRole('table')).toBeTruthy()
  })

  it('scopes to a single card when linked from a chapter page', () => {
    mocks.search = `chapter=${encodeURIComponent(WITH_CARD)}`
    render(<Page />)

    const card = getFormulaCard(WITH_CARD)!
    expect(screen.getByText(`${getChapterLabel(WITH_CARD)} 速查卡 1 / 1`)).toBeTruthy()
    expect(screen.getByRole('heading', { name: card.title })).toBeTruthy()
  })

  it('advances and steps back through the set', () => {
    render(<Page />)

    const prev = screen.getByRole('button', { name: /上一張/ })
    expect(prev).toHaveProperty('disabled', true)

    fireEvent.click(screen.getByRole('button', { name: /下一張/ }))
    expect(screen.getByText(`章節速查卡 2 / ${cards.length}`)).toBeTruthy()
    expect(prev).toHaveProperty('disabled', false)

    fireEvent.click(prev)
    expect(screen.getByText(`章節速查卡 1 / ${cards.length}`)).toBeTruthy()
  })

  it('reaches the completion screen after the last card and can return', () => {
    mocks.search = `chapter=${encodeURIComponent(WITH_CARD)}`
    render(<Page />)

    fireEvent.click(screen.getByRole('button', { name: /下一張/ }))

    expect(screen.getByText(/刷完了/)).toBeTruthy()
    expect(screen.getByText('共 1 張')).toBeTruthy()
    const link = screen.getByRole('link', { name: /^返回/ })
    expect(link.getAttribute('href')).toBe(chapterPath(WITH_CARD))
  })

  it('offers the full set as the way out when a chapter has no card', () => {
    mocks.search = `chapter=${encodeURIComponent(WITHOUT_CARD)}`
    expect(getFormulaCard(WITHOUT_CARD)).toBeNull()
    render(<Page />)

    expect(screen.getByText('這一章還沒有速查卡')).toBeTruthy()
    // 出口要指回整套，不是把使用者留在死路上。
    const escape = screen.getByRole('link', { name: /刷整套速查卡/ })
    expect(escape.getAttribute('href')).toBe('/practice/formulas')
    expect(screen.getByText(new RegExp(`目前有 ${cards.length} 章`))).toBeTruthy()
  })

  it('shows the empty state instead of crashing on an unknown chapter id', () => {
    mocks.search = `chapter=${encodeURIComponent('grammar/gone/gone')}`
    render(<Page />)
    expect(screen.getByText('這一章還沒有速查卡')).toBeTruthy()
  })

  it('links each card back to its own chapter', () => {
    mocks.search = `chapter=${encodeURIComponent(WITH_CARD)}`
    render(<Page />)

    const link = screen.getByRole('link', { name: /完整章節/ })
    expect(link.getAttribute('href')).toBe(chapterPath(WITH_CARD))
  })
})
