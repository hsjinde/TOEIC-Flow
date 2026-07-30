// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest'
import React from 'react'
import { render, screen } from '@testing-library/react'
import type { Formula } from '../scripts/build-content/types'
import { FormulaFlashcard } from '../src/components/FormulaFlashcard'
import { getChapterLabel } from '../src/lib/content'

// title 與 body 刻意不共用字串——查 body 的關鍵字如果剛好也出現在標題裡，
// 斷言會因為找到標題而誤判通過，測不出 body 真的被印出來。
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
  it('shows the chapter tag, the title and the technique together — no flip to reveal', () => {
    render(<FormulaFlashcard formula={WITH_TITLE} />)

    expect(screen.getByText(getChapterLabel(WITH_TITLE.chapterId))).toBeTruthy()
    expect(screen.getByText(WITH_TITLE.title)).toBeTruthy()
    expect(screen.getByText(/直接刪掉/)).toBeTruthy()
    // 卡片本身不再是按鈕，翻面提示也一併消失。
    expect(screen.queryByRole('button')).toBeNull()
    expect(screen.queryByText('點卡片看解法')).toBeNull()
  })

  it('renders only the technique when the note has no distinct title', () => {
    render(<FormulaFlashcard formula={WITHOUT_TITLE} />)

    expect(screen.getByText(/連接詞 \+ 完整句/)).toBeTruthy()
    expect(screen.queryByRole('heading')).toBeNull()
  })
})
