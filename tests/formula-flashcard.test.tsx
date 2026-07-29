// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest'
import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import type { Formula } from '../scripts/build-content/types'
import { FormulaFlashcard } from '../src/components/FormulaFlashcard'
import { getChapterLabel } from '../src/lib/content'

// title 與 body 刻意不共用字串——用來判斷「翻面前找不到」的關鍵字如果剛好也
// 出現在標題裡，斷言會因為找到標題而誤判通過，測不出真正的翻面行為。
const WITH_TITLE: Formula = {
  id: 'grammar/01_八大詞性與句型結構/01_名詞與代名詞#f1',
  chapterId: 'grammar/01_八大詞性與句型結構/01_名詞與代名詞',
  number: 1,
  title: '可數 vs. 不可數名詞陷阱',
  body: '看到選項有 `informations` 直接刪掉，這是最快的判斷方式。',
}

// 少數筆記的「補充秒殺公式」寫成一整句夾雜粗體，沒有獨立的「**標題**：」行——
// parse-formulas.ts 會如實給出空字串標題（622 條裡有 45 條）。
const WITHOUT_TITLE: Formula = {
  id: 'grammar/01_八大詞性與句型結構/04_連接詞#f4',
  chapterId: 'grammar/01_八大詞性與句型結構/04_連接詞',
  number: 4,
  title: '',
  body: '**連接詞 + 完整句 vs. 介系詞 + 名詞** 是所有連接詞題的核心判斷依據。',
}

describe('FormulaFlashcard', () => {
  it('shows the chapter tag and hides the technique behind a flip when a title exists', () => {
    render(<FormulaFlashcard formula={WITH_TITLE} />)

    expect(screen.getByText(getChapterLabel(WITH_TITLE.chapterId))).toBeTruthy()
    expect(screen.getByText(WITH_TITLE.title)).toBeTruthy()
    expect(screen.getByText('點卡片看解法')).toBeTruthy()
    expect(screen.queryByText(/直接刪掉/)).toBeNull()

    fireEvent.click(screen.getByLabelText('翻面看解法'))
    expect(screen.getByText(/直接刪掉/)).toBeTruthy()
    expect(screen.queryByText('點卡片看解法')).toBeNull()
  })

  it('skips the flip prompt and shows the technique immediately when the note has no distinct title', () => {
    render(<FormulaFlashcard formula={WITHOUT_TITLE} />)

    expect(screen.queryByText('點卡片看解法')).toBeNull()
    expect(screen.queryByRole('button', { name: /翻面看解法/ })).toBeNull()
    expect(screen.getByText(/連接詞 \+ 完整句/)).toBeTruthy()
  })
})
