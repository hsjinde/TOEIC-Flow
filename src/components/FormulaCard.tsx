'use client'

import React from 'react'
import type { FormulaCard as FormulaCardData } from '../../scripts/build-content/types'

interface FormulaCardProps {
  card: FormulaCardData
}

/**
 * 等寬字體只給純 ASCII 的字串。列首與 badge 有些章節放的是英文 token（`make`、
 * `to V`、`IO + DO`），有些放的是中文（`現在式`、`had + p.p.`、`過去式`）——
 * JetBrains Mono 沒有中文字符，落到 fallback 之後行高與字重都跟旁邊對不齊，
 * 所以有中文就走一般字體。
 */
function monoIfAscii(text: string): string {
  return /^[\x20-\x7E]+$/.test(text) ? 'font-mono' : ''
}

/**
 * 章節開頭的「決策樹 + 用法總表」速查卡。
 *
 * 兩個刻意的取捨：
 *
 * 1. 主動／被動不用藍／紅分色。參考來源的總表是藍紅對照，但 DESIGN-PROMPT.md 把
 *    綠/紅保留給作答回饋，而這張卡就印在有作答回饋的章節頁上——一旦借用紅色，
 *    「被動」與「答錯」就會共用同一個語意訊號。改成主動＝主色實心、被動＝灰階
 *    外框，對照關係一樣讀得出來，而且不必破例。
 *
 * 2. 沒有「⚡章節速查卡」那種小標。它下面緊接著的就是「⚡秒殺公式」區塊，兩者
 *    同色同圖示同框線，並排時讀起來像同一種東西的兩份；拿掉小標之後，這張卡是
 *    「有大標題的整塊面板」、下面是「小標題底下的一串小卡」，層級才分得開。
 *
 * 3. 用真的 <table>，不是 flex 排版。內容本來就是二維的（動詞 × 語態），
 *    <thead> 放完整的分支標籤但 sr-only——視覺上的欄位識別靠 badge 的實心/外框
 *    與上方兩個分支框呼應（和參考來源靠顏色呼應是同一個手法），讀屏軟體則拿得到
 *    真正的欄位名。手機寬度下字級降到 11px，外面再包一層 overflow-x-auto 保底。
 */
export const FormulaCard: React.FC<FormulaCardProps> = ({ card }) => {
  const [active, passive] = card.decision.branches
  const headingId = `formula-card-${card.chapterId}`

  return (
    <section
      aria-labelledby={headingId}
      className="space-y-4 rounded-2xl border border-[var(--pr-ln)] bg-[var(--sf)] p-4 sm:p-5"
    >
      <header className="space-y-1">
        <h2 id={headingId} className="text-base font-bold leading-snug text-[var(--tx)]">
          {card.title}
        </h2>
        {card.titleEn && (
          <p className="font-mono text-[10px] tracking-wide text-[var(--fa)]">{card.titleEn}</p>
        )}
      </header>

      {/* 決策樹：一個判斷點往下分兩條路 */}
      <div className="flex flex-col items-center">
        <div className="w-full max-w-[280px] rounded-lg border border-[var(--ln)] bg-[var(--sf2)] px-3 py-2 text-center">
          <p className="text-xs font-bold text-[var(--tx)]">{card.decision.question}</p>
          {card.decision.questionEn && (
            <p className="mt-0.5 font-mono text-[9px] leading-tight text-[var(--fa)]">
              {card.decision.questionEn}
            </p>
          )}
        </div>
        <div aria-hidden className="h-3 w-px bg-[var(--ln2)]" />
        <div className="grid w-full grid-cols-2 gap-2">
          <div className="rounded-lg bg-[var(--pr)] px-2.5 py-2 text-center">
            <p className="text-[11px] font-bold leading-tight text-[var(--pr-tx)]">{active.label}</p>
            {active.labelEn && (
              <p className="mt-0.5 font-mono text-[9px] leading-tight text-[var(--pr-tx)] opacity-80">
                {active.labelEn}
              </p>
            )}
          </div>
          <div className="rounded-lg border border-[var(--ln2)] bg-[var(--sf2)] px-2.5 py-2 text-center">
            <p className="text-[11px] font-bold leading-tight text-[var(--tx)]">{passive.label}</p>
            {passive.labelEn && (
              <p className="mt-0.5 font-mono text-[9px] leading-tight text-[var(--fa)]">
                {passive.labelEn}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* 用法總表 */}
      <div className="rounded-xl border border-[var(--ln)] bg-[var(--sf2)] p-3">
        <p className="text-xs font-bold text-[var(--tx)]">{card.table.title}</p>
        {card.table.titleEn && (
          <p className="mt-0.5 font-mono text-[9px] tracking-wide text-[var(--fa)]">
            {card.table.titleEn}
          </p>
        )}

        <div className="mt-2.5 overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead className="sr-only">
              <tr>
                <th scope="col">{card.table.rowHeader}</th>
                <th scope="col">{active.label}</th>
                <th scope="col">{passive.label}</th>
              </tr>
            </thead>
            <tbody>
              {card.table.rows.map((row) => {
                const [activeForms, passiveForms] = row.cells
                return (
                  <React.Fragment key={row.head}>
                    <tr className="border-t border-[var(--ln)] first:border-t-0">
                      <th
                        scope="row"
                        rowSpan={row.sharedExample ? 2 : 1}
                        className="w-[66px] py-2.5 pr-1.5 align-top sm:w-[92px] sm:pr-2"
                      >
                        <span
                          className={`block text-[13px] font-bold text-[var(--pr)] ${monoIfAscii(row.head)}`}
                        >
                          {row.head}
                        </span>
                        {row.gloss && (
                          <span className="block text-[10px] font-semibold text-[var(--mu)]">
                            {row.gloss}
                          </span>
                        )}
                      </th>
                      <td className="space-y-1.5 py-2.5 pr-1.5 align-top sm:pr-2">
                        {activeForms.map((cell) => (
                          <Pattern key={cell.token} cell={cell} tone="active" />
                        ))}
                      </td>
                      <td className="space-y-1.5 border-l border-[var(--ln)] py-2.5 pl-1.5 align-top sm:pl-2">
                        {passiveForms.map((cell) => (
                          <Pattern key={cell.token} cell={cell} tone="passive" />
                        ))}
                      </td>
                    </tr>
                    {row.sharedExample && (
                      <tr>
                        <td colSpan={2} className="pb-2.5">
                          <Example text={row.sharedExample} />
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {card.notes.length > 0 && (
        <div className="grid gap-2 sm:grid-cols-2">
          {card.notes.map((note) => (
            <div
              key={note.title}
              className="rounded-xl border border-[var(--ln)] bg-[var(--sf2)] p-3"
            >
              <p className="text-[11px] font-bold text-[var(--pr)]">{note.title}</p>
              <ul className="mt-1.5 space-y-1">
                {note.lines.map((line) => (
                  <li key={line} className="text-[11px] leading-snug text-[var(--mu)]">
                    {line}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

/** 句型格：敘述部分照常印，關鍵形式抽成 badge——主動實心、被動外框。 */
const Pattern: React.FC<{
  cell: FormulaCardData['table']['rows'][number]['cells'][number][number]
  tone: 'active' | 'passive'
}> = ({ cell, tone }) => (
  <div>
    <span className="flex flex-wrap items-center gap-1">
      <span className={`text-[11px] text-[var(--tx)] sm:text-xs ${monoIfAscii(cell.pattern)}`}>
        {cell.pattern}
      </span>
      <span
        className={`rounded px-1.5 py-px text-[10px] font-bold ${monoIfAscii(cell.token)} ${
          tone === 'active'
            ? 'bg-[var(--pr)] text-[var(--pr-tx)]'
            : 'border border-[var(--ln2)] bg-[var(--sf)] text-[var(--tx)]'
        }`}
      >
        {cell.token}
      </span>
    </span>
    {cell.example && <Example text={cell.example} />}
  </div>
)

const Example: React.FC<{ text: string }> = ({ text }) => (
  <span className={`mt-1 block text-[10px] leading-snug text-[var(--mu)] ${monoIfAscii(text)}`}>
    e.g., {text}
  </span>
)
