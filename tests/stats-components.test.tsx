// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { RadarChart } from '../src/components/RadarChart'
import { PracticeCalendar } from '../src/components/PracticeCalendar'
import { GraduationDots } from '../src/components/GraduationDots'
import { MasteryDots } from '../src/components/MasteryDots'
import { VocabQuiz, quizKindFor } from '../src/components/VocabQuiz'
import { VocabFlashcard } from '../src/components/VocabFlashcard'
import type { VocabItem } from '../scripts/build-content/types'

const AXES = [
  { label: '八大詞性', value: 82 },
  { label: '動詞時態', value: 74 },
  { label: '動狀詞', value: 52 },
  { label: '特殊動詞', value: 66 },
  { label: '子句假設', value: 58 },
  { label: '進階題型', value: 45 },
]

describe('RadarChart', () => {
  it('draws one labelled vertex per category', () => {
    const { container } = render(<RadarChart axes={AXES} size={280} />)
    // 4 圈網格 + 1 個資料多邊形
    expect(container.querySelectorAll('polygon')).toHaveLength(5)
    expect(container.querySelectorAll('text')).toHaveLength(AXES.length)
    expect(screen.getByText('八大詞性')).toBeTruthy()
    expect(screen.getByText('45%')).toBeTruthy()
  })

  it('exposes the numbers to screen readers instead of leaving an unlabelled svg', () => {
    render(<RadarChart axes={AXES} />)
    expect(screen.getByRole('img').getAttribute('aria-label')).toContain('動狀詞 52%')
  })

  it('renders nothing when there are too few axes to form a shape', () => {
    const { container } = render(<RadarChart axes={AXES.slice(0, 2)} />)
    expect(container.querySelector('svg')).toBeNull()
  })

  it('clamps out-of-range values so a bad stat cannot blow past the outer ring', () => {
    const { container } = render(
      <RadarChart axes={[...AXES.slice(1), { label: '爆表', value: 180 }]} size={200} />
    )
    const shape = container.querySelectorAll('polygon')[4]!
    for (const pair of shape.getAttribute('points')!.split(' ')) {
      const [x, y] = pair.split(',').map(Number)
      expect(x! >= 0 && x! <= 200 && y! >= 0 && y! <= 200).toBe(true)
    }
  })
})

describe('PracticeCalendar', () => {
  const days = Array.from({ length: 28 }, (_, i) => ({
    date: `2026-07-${String(i + 1).padStart(2, '0')}`,
    count: i % 4 === 0 ? 12 : 0,
  }))

  it('summarises how many days were actually practised', () => {
    render(<PracticeCalendar days={days} />)
    expect(screen.getByText('練了 7 天')).toBeTruthy()
  })

  it('pads the first week so weekday rows stay aligned', () => {
    const { container } = render(<PracticeCalendar days={days} />)
    // 2026-07-01 是星期三 → 前面要補 2 格
    const columns = container.querySelectorAll('.flex.flex-none.flex-col')
    // 第一欄是星期標籤，其後每欄 7 格
    expect(columns.length).toBeGreaterThan(1)
    expect(columns[1]!.children).toHaveLength(7)
  })

  it('renders nothing for an empty range', () => {
    const { container } = render(<PracticeCalendar days={[]} />)
    expect(container.firstChild).toBeNull()
  })

  const popupDay = {
    date: '2026-07-27',
    count: 10,
    correctCount: 8,
    sources: { grammar: 6, vocab: 4 },
  }

  it('shows detailed popup on cell hover with accuracy and source breakdown', () => {
    render(<PracticeCalendar days={[popupDay]} />)
    const cell = screen.getByLabelText('7月27日 (一) 10 題')

    fireEvent.mouseEnter(cell)

    expect(screen.getByText('7月27日 (一)')).toBeTruthy()
    expect(screen.getByText('當日正確率')).toBeTruthy()
    expect(screen.getByText('80%')).toBeTruthy()
    // 答對／答錯合併成一組數字：綠與紅只屬於答題判定，統計裡不該出現。
    expect(screen.getByText('8 / 2 題')).toBeTruthy()
    expect(screen.getByText('文法練習')).toBeTruthy()
    expect(screen.getByText('單字測驗')).toBeTruthy()
  })

  it('opens the popup on tap and keeps it open until tapped again', () => {
    // 手機沒有 hover。先前這份細節在觸控裝置上完全打不開。
    render(<PracticeCalendar days={[popupDay]} />)
    const cell = screen.getByLabelText('7月27日 (一) 10 題')

    fireEvent.click(cell)
    expect(cell.getAttribute('aria-expanded')).toBe('true')
    expect(screen.getByText('當日正確率')).toBeTruthy()

    // 滑出格子不該把點開的那張收掉
    fireEvent.mouseLeave(cell.closest('.relative')!)
    expect(screen.getByText('當日正確率')).toBeTruthy()

    fireEvent.click(cell)
    expect(screen.queryByText('當日正確率')).toBeNull()
  })
})

describe('progress dots', () => {
  it('shows graduation progress out of two', () => {
    const { rerender } = render(<GraduationDots consecutiveCorrect={0} />)
    expect(screen.getByLabelText('畢業進度 0/2').textContent).toBe('○○')

    rerender(<GraduationDots consecutiveCorrect={1} />)
    expect(screen.getByLabelText('畢業進度 1/2').textContent).toBe('●○')

    rerender(<GraduationDots consecutiveCorrect={5} />)
    expect(screen.getByLabelText('已畢業').textContent).toBe('●●')
  })

  it('shows vocab familiarity out of four', () => {
    render(<MasteryDots level={2} />)
    expect(screen.getByLabelText('熟悉度 2 / 4').textContent).toBe('●●○○')
  })
})

const ITEM: VocabItem = {
  id: 'ch#v-itinerary',
  chapterId: 'ch',
  word: 'itinerary',
  pos: '名詞',
  meaning: '行程表',
  example: 'Please review the *itinerary* before the trip.',
  exampleZh: '出發前請先看過這份行程表。',
}

const POOL: VocabItem[] = [
  { ...ITEM, id: 'a', word: 'inventory', meaning: '庫存清單' },
  { ...ITEM, id: 'b', word: 'warranty', meaning: '保固期限' },
  { ...ITEM, id: 'c', word: 'agenda', meaning: '會議記錄' },
  { ...ITEM, id: 'd', word: 'invoice', meaning: '發票' },
]

/**
 * 作答後解析卡也會寫出釋義，getByText 會一次撈到選項和解析兩個節點。
 * 要點的一定是選項按鈕，所以這裡指名按鈕，不靠 DOM 順序。
 */
function pickOption(text: string): HTMLElement {
  return screen
    .getAllByRole('button')
    .find((b) => b.textContent?.startsWith('(') && b.textContent.includes(text))!
}

describe('VocabFlashcard', () => {
  it('shows the example sentence with its chinese once flipped', () => {
    render(<VocabFlashcard item={ITEM} onGrade={vi.fn()} currentLevel={0} />)
    expect(screen.queryByText('出發前請先看過這份行程表。')).toBeNull()

    fireEvent.click(screen.getByLabelText('翻到中文釋義'))

    expect(screen.getByText(/Please review the/)).toBeTruthy()
    expect(screen.getByText('出發前請先看過這份行程表。')).toBeTruthy()
  })

  it('leaves the sentence in english when there is no translation', () => {
    render(<VocabFlashcard item={{ ...ITEM, exampleZh: '' }} onGrade={vi.fn()} currentLevel={0} />)
    fireEvent.click(screen.getByLabelText('翻到中文釋義'))
    expect(screen.getByText(/Please review the/)).toBeTruthy()
    expect(screen.queryByText('出發前請先看過這份行程表。')).toBeNull()
  })
})

describe('VocabQuiz', () => {
  beforeEach(() => {
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: {
        getItem: () => null,
        setItem: () => {},
        removeItem: () => {},
        clear: () => {},
      },
    })
  })

  it('rotates through the three question types', () => {
    expect(quizKindFor(0, ITEM)).toBe('en2zh')
    expect(quizKindFor(1, ITEM)).toBe('zh2en')
    expect(quizKindFor(2, ITEM)).toBe('cloze')
    expect(quizKindFor(3, ITEM)).toBe('en2zh')
  })

  it('drops the cloze type when the word has no example sentence', () => {
    const noExample = { ...ITEM, example: '' }
    expect(quizKindFor(2, noExample)).toBe('en2zh')
  })

  it('offers four options containing the correct meaning', () => {
    render(
      <VocabQuiz
        item={ITEM}
        pool={POOL}
        index={0}
        currentLevel={0}
        onAnswer={vi.fn()}
        onNext={vi.fn()}
      />
    )
    const options = screen.getAllByRole('button')
    expect(options).toHaveLength(4)
    expect(screen.getByText('行程表')).toBeTruthy()
  })

  it('locks the options with aria-disabled so the verdict stays readable', () => {
    // 原生 disabled 會讓按鈕不可聚焦、被螢幕閱讀器跳過，而「正解」「你的選擇」就寫在
    // 按鈕內部——鎖住選項不能以犧牲結果的可讀性為代價。
    const onAnswer = vi.fn()
    render(
      <VocabQuiz
        item={ITEM}
        pool={POOL}
        index={0}
        currentLevel={1}
        onAnswer={onAnswer}
        onNext={vi.fn()}
      />
    )

    fireEvent.click(screen.getByText('行程表'))
    expect(onAnswer).toHaveBeenCalledWith(true)

    const options = screen.getAllByRole('button').filter((b) => b.textContent?.startsWith('('))
    expect(options).toHaveLength(4)
    for (const button of options) {
      expect(button.getAttribute('aria-disabled')).toBe('true')
      expect((button as HTMLButtonElement).disabled).toBe(false)
    }
    expect(screen.getByText(/下次/)).toBeTruthy()
  })

  it('does not fire onAnswer a second time once locked', () => {
    const onAnswer = vi.fn()
    render(
      <VocabQuiz
        item={ITEM}
        pool={POOL}
        index={0}
        currentLevel={1}
        onAnswer={onAnswer}
        onNext={vi.fn()}
      />
    )

    fireEvent.click(pickOption('行程表'))
    fireEvent.click(pickOption('行程表'))
    expect(onAnswer).toHaveBeenCalledTimes(1)
  })

  it('advances the familiarity by exactly one step even after the parent re-renders', () => {
    // 父層會在 onAnswer 之後把新的 currentLevel 傳回來；顯示的結果檔位必須
    // 停在作答當下算好的那一格，不能再跟著 prop 往上跳。
    const { rerender } = render(
      <VocabQuiz item={ITEM} pool={POOL} index={0} currentLevel={0} onAnswer={vi.fn()} onNext={vi.fn()} />
    )

    fireEvent.click(screen.getByText('行程表'))
    rerender(<VocabQuiz item={ITEM} pool={POOL} index={0} currentLevel={1} onAnswer={vi.fn()} onNext={vi.fn()} />)

    expect(screen.getByLabelText('熟悉度 1 / 4')).toBeTruthy()
    expect(screen.getByText(/下次 10 分鐘後/)).toBeTruthy()
  })

  it('steps the familiarity down on a wrong pick without going below zero', () => {
    render(<VocabQuiz item={ITEM} pool={POOL} index={0} currentLevel={0} onAnswer={vi.fn()} onNext={vi.fn()} />)
    fireEvent.click(screen.getByText('庫存清單'))
    expect(screen.getByLabelText('熟悉度 0 / 4')).toBeTruthy()
  })

  it('shows an explanation with the full example and its chinese once answered', () => {
    render(<VocabQuiz item={ITEM} pool={POOL} index={0} currentLevel={0} onAnswer={vi.fn()} onNext={vi.fn()} />)
    expect(screen.queryByText('解析')).toBeNull()

    fireEvent.click(pickOption('行程表'))

    expect(screen.getByText('解析')).toBeTruthy()
    expect(screen.getByText(/Please review the/)).toBeTruthy()
    expect(screen.getByText('出發前請先看過這份行程表。')).toBeTruthy()
  })

  it('spells out what the wrong pick actually meant', () => {
    render(<VocabQuiz item={ITEM} pool={POOL} index={0} currentLevel={0} onAnswer={vi.fn()} onNext={vi.fn()} />)
    fireEvent.click(pickOption('庫存清單'))

    // 錯選的那個字是誰、是什麼意思，才是這題真正要學的東西。
    const note = screen.getByText(/你選的/)
    expect(note.textContent).toContain('inventory')
    expect(note.textContent).toContain('庫存清單')
  })

  it('keeps the explanation out of the way when the answer was right', () => {
    render(<VocabQuiz item={ITEM} pool={POOL} index={0} currentLevel={0} onAnswer={vi.fn()} onNext={vi.fn()} />)
    fireEvent.click(pickOption('行程表'))
    expect(screen.queryByText(/你選的/)).toBeNull()
  })

  it('shows the filled-in sentence in the cloze explanation, not the blanked one', () => {
    // 填空題的教學點就是「字填回去長什麼樣」，解析再給一次挖空的句子等於沒解析。
    render(<VocabQuiz item={ITEM} pool={POOL} index={2} currentLevel={0} onAnswer={vi.fn()} onNext={vi.fn()} />)
    fireEvent.click(pickOption('itinerary'))
    // 題面那句仍是挖空的，所以這裡本來就會撈到兩句；解析那句要看得到答案。
    const sentences = screen.getAllByText(/Please review the/).map((el) => el.textContent)
    expect(sentences).toContain('Please review the ______ before the trip.')
    expect(sentences).toContain('Please review the itinerary before the trip.')
  })

  it('blanks out the target word in the cloze prompt', () => {
    render(<VocabQuiz item={ITEM} pool={POOL} index={2} currentLevel={0} onAnswer={vi.fn()} onNext={vi.fn()} />)
    expect(screen.getByText(/Please review the ______ before the trip\./)).toBeTruthy()
  })
})
