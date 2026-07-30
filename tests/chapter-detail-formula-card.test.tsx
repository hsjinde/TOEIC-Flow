// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest'
import React from 'react'
import { render, screen } from '@testing-library/react'
import ChapterDetailClient from '../src/app/chapters/[...id]/ChapterDetailClient'
import { getFormulaCard } from '../src/lib/content'
import cards from '../data/formula-cards.json'

// next/link 在測試環境沒有 router，換成原生 a。
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: any) =>
    React.createElement('a', { href, ...rest }, children),
}))

const WITH_CARD = 'grammar/04_特殊動詞用法/01_使役動詞'
// 69 章裡只有 11 章有速查卡，所以「沒有卡的章節不能憑空長出一張」也要驗。
const WITHOUT_CARD = 'grammar/01_八大詞性與句型結構/01_名詞與代名詞'

/** 頁面用 useEffect 組 view，route 是 [...id]，所以要拆成路徑片段餵給它。 */
function renderChapter(id: string) {
  return render(<ChapterDetailClient id={id.split('/')} />)
}

/**
 * 速查卡的錨點是它自己的 aria-labelledby，不是「頁面上有沒有 table」——教學本文的
 * markdown 也會渲染出表格（名詞與代名詞那章就有），拿 role=table 當判準會誤判。
 */
function cardSection(container: HTMLElement, chapterId: string): HTMLElement | null {
  return container.querySelector(`[aria-labelledby="formula-card-${chapterId}"]`)
}

describe('文法章節頁的速查卡', () => {
  it('renders the card above the 秒殺公式 section for a chapter that has one', () => {
    const { container } = renderChapter(WITH_CARD)

    const card = getFormulaCard(WITH_CARD)!
    expect(card).toBeTruthy()

    const section = cardSection(container, WITH_CARD)
    expect(section).toBeTruthy()

    const heading = screen.getByRole('heading', { name: card.title })
    expect(section!.contains(heading)).toBe(true)
    expect(section!.querySelector('table')).toBeTruthy()

    // 「骨架在前、細節在後」：速查卡要排在秒殺公式小標之前。
    const formulaLabel = screen.getByText('秒殺公式')
    expect(
      section!.compareDocumentPosition(formulaLabel) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
  })

  it('still renders the 秒殺公式 list alongside the card, not instead of it', () => {
    renderChapter(WITH_CARD)

    expect(screen.getByText('秒殺公式')).toBeTruthy()
    // 這章筆記自己的第一條公式標題，證明卡片沒有取代掉逐條技巧。
    expect(screen.getByRole('heading', { name: '被動句陷阱' })).toBeTruthy()
  })

  it('renders no card for a chapter that has none', () => {
    expect(getFormulaCard(WITHOUT_CARD)).toBeNull()
    const { container } = renderChapter(WITHOUT_CARD)

    expect(cardSection(container, WITHOUT_CARD)).toBeNull()
    expect(container.querySelector('[aria-labelledby^="formula-card-"]')).toBeNull()
    // 該章原本的秒殺公式區塊照舊。
    expect(screen.getByText('秒殺公式')).toBeTruthy()
  })

  // /practice/formulas 現在發的是速查卡，所以沒有卡的章節不能留那個入口——留著就是
  // 一個點進去看到「這一章還沒有速查卡」的連結。
  it('only links to /practice/formulas from chapters that actually have a card', () => {
    const hrefsOf = (container: HTMLElement) =>
      Array.from(container.querySelectorAll('a[href^="/practice/formulas"]')).map((a) =>
        a.getAttribute('href'),
      )

    const withCard = renderChapter(WITH_CARD)
    expect(hrefsOf(withCard.container)).toEqual([
      `/practice/formulas?chapter=${encodeURIComponent(WITH_CARD)}`,
    ])
    withCard.unmount()

    const withoutCard = renderChapter(WITHOUT_CARD)
    expect(hrefsOf(withoutCard.container)).toEqual([])
  })

  it('reaches every card in data/formula-cards.json through its chapter page', () => {
    for (const key of Object.keys(cards as Record<string, unknown>)) {
      const card = getFormulaCard(key)
      expect(card, `${key} 在章節頁上取不到速查卡`).toBeTruthy()

      const { container, unmount } = renderChapter(key)
      const section = cardSection(container, key)
      expect(section, `${key} 的章節頁沒有渲染速查卡`).toBeTruthy()
      expect(section!.textContent, `${key} 的卡片標題沒印出來`).toContain(card!.title)
      unmount()
    }
  })
})
