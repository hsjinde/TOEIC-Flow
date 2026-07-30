// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest'
import React from 'react'
import { render, screen } from '@testing-library/react'
import { FormulaCardSchema, type FormulaCard as FormulaCardData } from '../scripts/build-content/types'
import { FormulaCard } from '../src/components/FormulaCard'
import { getChapters } from '../src/lib/content'
import cards from '../data/formula-cards.json'

const FIXTURE: FormulaCardData = FormulaCardSchema.parse({
  chapterId: 'grammar/04_特殊動詞用法/01_使役動詞',
  title: '使役動詞用法決策樹',
  titleEn: 'Decision Tree: Causative Verb Usage',
  decision: {
    question: 'O 與 V 的關係',
    questionEn: 'Relationship Between Object & Verb',
    branches: [
      { label: '主動：受詞執行動作', labelEn: 'Active: O Performs Action' },
      { label: '被動：受詞接受動作', labelEn: 'Passive: Action Acts Upon O' },
    ],
  },
  table: {
    title: '使役動詞用法總表',
    rows: [
      {
        head: 'make',
        gloss: '強迫',
        cells: [
          [
            { pattern: 'make O', token: 'RV', example: 'make him clean' },
            { pattern: 'make O', token: 'V-ing', example: 'made everyone wait' },
          ],
          [{ pattern: 'make O', token: 'p.p.', example: 'make himself known' }],
        ],
      },
      {
        head: 'help',
        gloss: '協助',
        cells: [
          [{ pattern: 'help O', token: '(to-)RV' }],
          [{ pattern: 'help O', token: '(to) be p.p.' }],
        ],
        sharedExample: 'help it (to) be understood',
      },
    ],
  },
  notes: [{ title: '補充：want', lines: ['want + to-RV（主動）'] }],
})

describe('FormulaCard', () => {
  it('does not repeat the 秒殺公式 eyebrow label — the card leads with its own title', () => {
    render(<FormulaCard card={FIXTURE} />)

    // 卡片下方緊接著就是「秒殺公式」區塊，同色同圖示的小標會讓兩者讀成同一種東西。
    expect(screen.queryByText('章節速查卡')).toBeNull()
    expect(screen.queryByText('秒殺公式')).toBeNull()
  })

  it('renders the decision node, both branches and every table row', () => {
    render(<FormulaCard card={FIXTURE} />)

    expect(screen.getByRole('heading', { name: '使役動詞用法決策樹' })).toBeTruthy()
    expect(screen.getByText('O 與 V 的關係')).toBeTruthy()
    // 每個分支標籤出現兩次是刻意的：一次是看得到的分支框，一次是 sr-only 的欄位表頭。
    expect(screen.getAllByText('主動：受詞執行動作')).toHaveLength(2)
    expect(screen.getAllByText('被動：受詞接受動作')).toHaveLength(2)

    // 兩欄 pattern 字串相同（make O），所以查 token 才測得出兩欄都印了。
    expect(screen.getByText('RV')).toBeTruthy()
    expect(screen.getByText('p.p.')).toBeTruthy()
    expect(screen.getByText(/make him clean/)).toBeTruthy()
    expect(screen.getByText(/make himself known/)).toBeTruthy()
    expect(screen.getByText('補充：want')).toBeTruthy()
  })

  it('is a real table whose column headers name the two branches', () => {
    render(<FormulaCard card={FIXTURE} />)

    // 視覺上沒有表頭列（欄位識別靠 badge 的實心/外框），但讀屏軟體要拿得到欄位名。
    expect(screen.getByRole('columnheader', { name: '主動：受詞執行動作' })).toBeTruthy()
    expect(screen.getByRole('columnheader', { name: '被動：受詞接受動作' })).toBeTruthy()
    expect(screen.getByRole('rowheader', { name: /make/ })).toBeTruthy()
    expect(screen.getAllByRole('row').length).toBe(4) // thead 1 + make 1 + help 2（共用例句自己一列）
  })

  // 一欄可以有兩種合法形式（have O RV 與 have O V-ing 都是主動），總表要印全，
  // 否則會跟章節裡的秒殺公式互相矛盾。
  it('prints every form in a column, not just the first', () => {
    render(<FormulaCard card={FIXTURE} />)

    expect(screen.getByText('V-ing')).toBeTruthy()
    expect(screen.getByText(/made everyone wait/)).toBeTruthy()
  })

  it('prints a shared example once instead of duplicating it per column', () => {
    render(<FormulaCard card={FIXTURE} />)

    expect(screen.getAllByText(/help it \(to\) be understood/)).toHaveLength(1)
  })

  it('uses no red or green anywhere — those are reserved for answer feedback', () => {
    const { container } = render(<FormulaCard card={FIXTURE} />)
    const classes = Array.from(container.querySelectorAll('*'))
      .map((el) => el.className)
      .join(' ')

    expect(classes).not.toMatch(/--bad|--ok|text-wrong|bg-wrong|text-correct|bg-correct/)
  })
})

describe('data/formula-cards.json', () => {
  const entries = Object.entries(cards as Record<string, unknown>)

  it('has at least one card', () => {
    expect(entries.length).toBeGreaterThan(0)
  })

  it('matches the schema and keys itself by its own chapterId', () => {
    for (const [key, raw] of entries) {
      const parsed = FormulaCardSchema.safeParse(raw)
      expect(parsed.success, `${key} 不合 schema`).toBe(true)
      if (parsed.success) expect(parsed.data.chapterId).toBe(key)
    }
  })

  // chapter id 是從筆記路徑推出來的（scripts/build-content/id.ts），改檔名就會讓
  // 卡片無聲脫鉤。build:content 會報警告，但那需要 vault；這條在 CI 上也擋得住。
  it('points every card at a chapter that actually exists', () => {
    const ids = new Set(getChapters().map((c) => c.id))
    for (const [key] of entries) {
      expect(ids.has(key), `${key} 對不到任何章節`).toBe(true)
    }
  })

  // FormulaCard 的 React key 用的是 row.head、cell.token、note.title、note 的每一行。
  // 同一層出現重複值不會讓畫面壞掉，但會噴 key 警告、而且通常代表資料抄錯了。
  it('keeps every React key unique within its own scope', () => {
    for (const [key, raw] of entries) {
      const card = FormulaCardSchema.parse(raw)
      const heads = card.table.rows.map((r) => r.head)
      expect(new Set(heads).size, `${key} 的列首有重複`).toBe(heads.length)

      for (const row of card.table.rows) {
        for (const column of row.cells) {
          const tokens = column.map((c) => c.token)
          expect(new Set(tokens).size, `${key} / ${row.head} 同一欄有重複 token`).toBe(tokens.length)
        }
      }

      const titles = card.notes.map((n) => n.title)
      expect(new Set(titles).size, `${key} 的補充卡標題有重複`).toBe(titles.length)
      for (const note of card.notes) {
        expect(new Set(note.lines).size, `${key} / ${note.title} 有重複的行`).toBe(note.lines.length)
      }
    }
  })

  it('renders every real card without throwing', () => {
    for (const [key, raw] of entries) {
      const { unmount } = render(<FormulaCard card={FormulaCardSchema.parse(raw)} />)
      expect(screen.getByRole('table'), `${key} 沒有渲染出表格`).toBeTruthy()
      unmount()
    }
  })
})
