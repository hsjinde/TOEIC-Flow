// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import chaptersData from '../content/chapters.json'
import formulasData from '../content/formulas.json'
import type { Chapter, Formula } from '../scripts/build-content/types'
import Page from '../src/app/practice/formulas/page'
import { getChapterLabel } from '../src/lib/content'

const chapters = chaptersData as unknown as Chapter[]
const formulas = formulasData as unknown as Formula[]

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

function chapterFormulasOf(chapterId: string): Formula[] {
  return formulas.filter((f) => f.chapterId === chapterId).sort((a, b) => a.number - b.number)
}

describe('秒殺公式閃卡', () => {
  beforeEach(() => {
    mocks.search = ''
  })

  it('defaults to a shuffled 20-card batch across the whole bank', () => {
    render(<Page />)
    expect(screen.getByText('秒殺公式閃卡 1 / 20')).toBeTruthy()
  })

  it('scopes to one chapter, in formula order, when linked from a chapter page', () => {
    const chapter = chapters.find((c) => chapterFormulasOf(c.id).length > 0)!
    const items = chapterFormulasOf(chapter.id)
    mocks.search = `chapter=${encodeURIComponent(chapter.id)}`

    render(<Page />)

    expect(
      screen.getByText(`${getChapterLabel(chapter.id)} 秒殺公式 1 / ${items.length}`)
    ).toBeTruthy()
    expect(screen.getByText(items[0]!.title)).toBeTruthy()
  })

  it('flips the card to reveal the technique, then advances on 下一條', () => {
    const chapter = chapters.find((c) => chapterFormulasOf(c.id).length > 1)!
    const items = chapterFormulasOf(chapter.id)
    mocks.search = `chapter=${encodeURIComponent(chapter.id)}`

    render(<Page />)

    expect(screen.getByText('點卡片看解法')).toBeTruthy()
    fireEvent.click(screen.getByLabelText('翻面看解法'))
    expect(screen.queryByText('點卡片看解法')).toBeNull()
    expect(screen.getByLabelText('翻回標題')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: /下一條/ }))
    expect(
      screen.getByText(`${getChapterLabel(chapter.id)} 秒殺公式 2 / ${items.length}`)
    ).toBeTruthy()
    // 換卡要回到標題面，不能直接洩題。
    expect(screen.getByText('點卡片看解法')).toBeTruthy()
    expect(screen.getByText(items[1]!.title)).toBeTruthy()
  })

  it('上一條 steps back without going past the first card', () => {
    const chapter = chapters.find((c) => chapterFormulasOf(c.id).length > 1)!
    mocks.search = `chapter=${encodeURIComponent(chapter.id)}`

    render(<Page />)
    const prevButton = screen.getByRole('button', { name: /上一條/ })
    expect(prevButton).toHaveProperty('disabled', true)

    fireEvent.click(screen.getByRole('button', { name: /下一條/ }))
    expect(prevButton).toHaveProperty('disabled', false)
    fireEvent.click(prevButton)
    expect(screen.getByText(`${getChapterLabel(chapter.id)} 秒殺公式 1 / ${chapterFormulasOf(chapter.id).length}`)).toBeTruthy()
  })

  it('reaches the completion screen after the last card and can return to the chapter', () => {
    const chapter = chapters.find((c) => chapterFormulasOf(c.id).length <= 6)!
    const total = chapterFormulasOf(chapter.id).length
    mocks.search = `chapter=${encodeURIComponent(chapter.id)}`

    render(<Page />)
    for (let i = 0; i < total; i++) {
      fireEvent.click(screen.getByRole('button', { name: /下一條/ }))
    }

    expect(screen.getByText(/刷完了/)).toBeTruthy()
    expect(screen.getByText(`共 ${total} 條`)).toBeTruthy()
    const link = screen.getByRole('link', { name: /^返回/ })
    expect(link.getAttribute('href')).toBe(
      `/chapters/${chapter.id.split('/').map(encodeURIComponent).join('/')}`
    )
  })

  it('shows an empty state instead of crashing on an unknown chapter id', () => {
    mocks.search = `chapter=${encodeURIComponent('grammar/gone/gone')}`
    render(<Page />)
    expect(screen.getByText('這裡還沒有秒殺公式')).toBeTruthy()
  })
})
