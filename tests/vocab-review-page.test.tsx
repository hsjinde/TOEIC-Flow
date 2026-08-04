// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import vocabData from '../content/vocab.json'
import type { VocabItem } from '../scripts/build-content/types'
import VocabReviewPage from '../src/app/vocab-review/page'
import type { AnswerHistoryEntry } from '../src/lib/storage'

// next/link 在測試環境沒有 router，換成原生 a 才驗得到 href。
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: any) =>
    React.createElement('a', { href, ...rest }, children),
}))

const vocab = vocabData as unknown as VocabItem[]
const [LEECH, DUE, LEARNING, MASTERED] = vocab as [
  VocabItem,
  VocabItem,
  VocabItem,
  VocabItem,
]

const DAY = 86_400_000

function seed() {
  const history: AnswerHistoryEntry[] = [
    { questionId: LEECH.id, categoryId: 'vocab', isCorrect: false, timestamp: Date.now() - 6 * DAY, source: 'vocab' },
    { questionId: LEECH.id, categoryId: 'vocab', isCorrect: false, timestamp: Date.now() - 4 * DAY, source: 'vocab' },
    { questionId: DUE.id, categoryId: 'vocab', isCorrect: true, timestamp: Date.now() - 9 * DAY, source: 'vocab' },
    { questionId: LEARNING.id, categoryId: 'vocab', isCorrect: false, timestamp: Date.now() - 2 * DAY, source: 'vocab' },
    { questionId: MASTERED.id, categoryId: 'vocab', isCorrect: true, timestamp: Date.now(), source: 'vocab' },
  ]
  localStorage.setItem('toeic_answer_history', JSON.stringify(history))
  localStorage.setItem(
    'toeic_vocab_mastery',
    JSON.stringify({
      [LEECH.id]: { level: 1, lastReviewed: Date.now() },
      [DUE.id]: { level: 3, lastReviewed: Date.now() },
      [LEARNING.id]: { level: 0, lastReviewed: Date.now() },
      [MASTERED.id]: { level: 4, lastReviewed: Date.now() },
    })
  )
}

describe('單字複習本', () => {
  beforeEach(() => localStorage.clear())

  it('tells the user nothing is filed yet instead of showing an empty list', () => {
    render(<VocabReviewPage />)
    expect(screen.getByText('還沒有單字紀錄')).toBeTruthy()
  })

  it('groups practised words into 常錯／待複習／不熟／已熟', () => {
    seed()
    render(<VocabReviewPage />)

    // 分組晶片：每一組各一個字
    expect(screen.getByRole('button', { name: /常錯 1/ })).toBeTruthy()
    expect(screen.getByRole('button', { name: /待複習 1/ })).toBeTruthy()
    expect(screen.getByRole('button', { name: /不熟 1/ })).toBeTruthy()
    expect(screen.getByRole('button', { name: /全部 4/ })).toBeTruthy()
    expect(screen.getByText(/3 個字要加強/)).toBeTruthy()
  })

  it('shows how many times each word was missed', () => {
    seed()
    render(<VocabReviewPage />)
    fireEvent.click(screen.getByRole('button', { name: /全部 4/ }))
    expect(screen.getAllByText('錯 2 次').length).toBeGreaterThan(0)
  })

  it('filters the list down to one group', () => {
    seed()
    render(<VocabReviewPage />)

    fireEvent.click(screen.getByRole('button', { name: /常錯 1/ }))
    expect(screen.getByText('共 1 個字')).toBeTruthy()
    expect(screen.queryByLabelText(`選取 ${MASTERED.word}`)).toBeNull()
  })

  it('sends only the checked words to the practice session', () => {
    seed()
    render(<VocabReviewPage />)
    fireEvent.click(screen.getByRole('button', { name: /全部 4/ }))

    fireEvent.click(screen.getByLabelText(`選取 ${LEECH.word}`))
    const link = screen.getByRole('link', { name: /複習選取的字/ })
    expect(link.getAttribute('href')).toBe(
      `/practice/vocab?ids=${encodeURIComponent(LEECH.id)}`
    )
  })

  it('defaults to reviewing the whole visible list, weakest first', () => {
    seed()
    render(<VocabReviewPage />)
    fireEvent.click(screen.getByRole('button', { name: /全部 4/ }))

    const link = screen.getByRole('link', { name: /開始複習 4 個/ })
    const ids = decodeURIComponent(link.getAttribute('href')!.split('ids=')[1]!).split(',')
    expect(ids[0]).toBe(LEECH.id)
    expect(ids).toHaveLength(4)
  })
})
