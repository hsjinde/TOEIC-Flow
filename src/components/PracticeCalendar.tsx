import React, { useState, useRef } from 'react'
import { ANSWER_SOURCE_LABELS, type AnswerSource, type CalendarDay } from '../lib/storage'

interface PracticeCalendarProps {
  days: CalendarDay[]
}

const WEEKDAY_LABELS = ['一', '', '三', '', '五', '', '日']

/** 顏色深淺＝當日答題量（設計 12）。只用主色的透明度分四階。 */
function levelOf(count: number): number {
  if (count === 0) return 0
  if (count < 5) return 1
  if (count < 15) return 2
  return 3
}

const LEVEL_STYLE = [
  { background: 'var(--sf2)', borderColor: 'var(--ln)' },
  { background: 'color-mix(in srgb, var(--pr) 24%, transparent)', borderColor: 'transparent' },
  { background: 'color-mix(in srgb, var(--pr) 55%, transparent)', borderColor: 'transparent' },
  { background: 'var(--pr)', borderColor: 'transparent' },
]

function formatDateZh(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  if (!y || !m || !d) return dateStr
  const dateObj = new Date(y, m - 1, d)
  const weekdays = ['日', '一', '二', '三', '四', '五', '六']
  const weekdayStr = weekdays[dateObj.getDay()] ?? ''
  return `${m}月${d}日 (${weekdayStr})`
}

interface HoverInfo {
  day: CalendarDay
  x: number
  y: number
  isBelow: boolean
}

/**
 * 近 N 週的練習熱區。以週一為每欄起點；傳入天數不是 7 的倍數時前面補空白格，
 * 否則星期會對不齊。
 */
export const PracticeCalendar: React.FC<PracticeCalendarProps> = ({ days }) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const [hoverInfo, setHoverInfo] = useState<HoverInfo | null>(null)

  if (days.length === 0) return null

  const first = days[0]!
  // getDay(): 0=日 → 我們要以週一為列首，所以週日視為第 6 列。
  const firstWeekday = (new Date(first.date).getDay() + 6) % 7
  const cells: (CalendarDay | null)[] = [...Array(firstWeekday).fill(null), ...days]
  while (cells.length % 7 !== 0) cells.push(null)

  const weeks: (CalendarDay | null)[][] = []
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7))

  const activeDays = days.filter((d) => d.count > 0).length

  const handleCellMouseEnter = (e: React.MouseEvent<HTMLElement> | React.FocusEvent<HTMLElement>, day: CalendarDay) => {
    if (!containerRef.current) return
    const containerRect = containerRef.current.getBoundingClientRect()
    const cellRect = e.currentTarget.getBoundingClientRect()

    const tooltipWidth = 190
    const halfWidth = tooltipWidth / 2
    const containerWidth = containerRect.width

    const rawX = cellRect.left - containerRect.left + cellRect.width / 2
    const clampedX = Math.max(halfWidth + 4, Math.min(containerWidth - halfWidth - 4, rawX))

    const relativeY = cellRect.top - containerRect.top
    const isBelow = relativeY < 110

    setHoverInfo({
      day,
      x: clampedX,
      y: relativeY,
      isBelow,
    })
  }

  const handleCellMouseLeave = () => {
    setHoverInfo(null)
  }

  return (
    <div ref={containerRef} className="relative space-y-2.5" onMouseLeave={handleCellMouseLeave}>
      <div className="flex items-center justify-between text-[11px] text-[var(--mu)]">
        <span>顏色深淺＝當日答題量 · 滑鼠移至格子看細節</span>
        <span className="font-semibold text-[var(--tx)]">練了 {activeDays} 天</span>
      </div>

      <div className="flex gap-1.5 overflow-x-auto pb-1">
        <div className="flex flex-none flex-col gap-[3px] pr-0.5">
          {WEEKDAY_LABELS.map((label, i) => (
            <span
              key={i}
              // 9px 是 type ramp 的唯一例外：軸標籤要對齊 13px 的熱力圖格子行高，
              // 物理上放不下 11px。字級破例，但顏色不破例——用 --mu 保住 4.5:1。
              className="flex h-[13px] items-center text-[9px] leading-none text-[var(--mu)]"
            >
              {label}
            </span>
          ))}
        </div>

        {weeks.map((week, wi) => (
          <div key={wi} className="flex flex-none flex-col gap-[3px]">
            {week.map((day, di) => {
              if (!day) return <span key={di} className="h-[13px] w-[13px]" />
              const style = LEVEL_STYLE[levelOf(day.count)]!
              return (
                <span
                  key={di}
                  title={`${day.date} · ${day.count} 題`}
                  tabIndex={0}
                  className="h-[13px] w-[13px] cursor-pointer rounded-[3px] border transition-transform duration-100 hover:scale-125 hover:z-10 focus:outline-none focus:ring-1 focus:ring-[var(--pr)]"
                  style={style}
                  onMouseEnter={(e) => handleCellMouseEnter(e, day)}
                  onFocus={(e) => handleCellMouseEnter(e, day)}
                />
              )
            })}
          </div>
        ))}
      </div>

      {/* 詳細浮動卡片 Tooltip */}
      {hoverInfo && (
        <div
          className="pointer-events-none absolute z-50 w-[190px] rounded-xl border border-[var(--ln)] bg-[var(--sf)] p-3 shadow-xl backdrop-blur-md transition-all duration-150 text-xs animate-fade-in"
          style={{
            left: `${hoverInfo.x}px`,
            top: hoverInfo.isBelow ? `${hoverInfo.y + 18}px` : `${hoverInfo.y - 6}px`,
            transform: hoverInfo.isBelow ? 'translate(-50%, 0)' : 'translate(-50%, -100%)',
          }}
        >
          {(() => {
            const day = hoverInfo.day
            const count = day.count
            const correct = day.correctCount ?? 0
            const wrong = count - correct
            const accuracy = count > 0 ? Math.round((correct / count) * 100) : 0
            const sources = day.sources
              ? (Object.entries(day.sources) as [AnswerSource, number][]).filter(([, cnt]) => cnt > 0)
              : []

            return (
              <>
                <div className="flex items-center justify-between border-b border-[var(--ln)] pb-1.5 mb-2 font-semibold text-[var(--tx)]">
                  <span>{formatDateZh(day.date)}</span>
                  <span className="text-[11px] font-bold text-[var(--pr)]">
                    {count > 0 ? `${count} 題` : '無紀錄'}
                  </span>
                </div>

                {count > 0 ? (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-[var(--mu)]">當日正確率</span>
                      <span className="font-bold text-[var(--tx)]">{accuracy}%</span>
                    </div>
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-[var(--mu)]">答對 / 答錯</span>
                      <span className="text-[var(--tx)]">
                        <span className="font-semibold text-emerald-500">{correct} 題</span>
                        {' · '}
                        <span className="font-semibold text-rose-400">{wrong} 題</span>
                      </span>
                    </div>
                    {sources.length > 0 && (
                      <div className="border-t border-[var(--ln)] pt-1.5 space-y-1">
                        <span className="text-[10px] font-medium text-[var(--mu)]">答題類別</span>
                        <div className="flex flex-col gap-1">
                          {sources.map(([src, cnt]) => (
                            <div key={src} className="flex items-center justify-between text-[11px]">
                              <span className="text-[var(--mu)]">
                                {ANSWER_SOURCE_LABELS[src] || src}
                              </span>
                              <span className="font-semibold text-[var(--tx)]">{cnt} 題</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="py-0.5 text-[11px] text-[var(--mu)]">當天無答題紀錄</p>
                )}
              </>
            )
          })()}
        </div>
      )}

      <div className="flex items-center justify-end gap-1.5 text-[11px] text-[var(--mu)]">
        <span>少</span>
        {LEVEL_STYLE.map((style, i) => (
          <span key={i} className="h-[11px] w-[11px] rounded-[3px] border" style={style} />
        ))}
        <span>多</span>
      </div>
    </div>
  )
}

