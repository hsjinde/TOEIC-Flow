import React from 'react'
import type { CalendarDay } from '../lib/storage'

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

/**
 * 近 N 週的練習熱區。以週一為每欄起點；傳入天數不是 7 的倍數時前面補空白格，
 * 否則星期會對不齊。
 */
export const PracticeCalendar: React.FC<PracticeCalendarProps> = ({ days }) => {
  if (days.length === 0) return null

  const first = days[0]!
  // getDay(): 0=日 → 我們要以週一為列首，所以週日視為第 6 列。
  const firstWeekday = (new Date(first.date).getDay() + 6) % 7
  const cells: (CalendarDay | null)[] = [...Array(firstWeekday).fill(null), ...days]
  while (cells.length % 7 !== 0) cells.push(null)

  const weeks: (CalendarDay | null)[][] = []
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7))

  const activeDays = days.filter((d) => d.count > 0).length

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between text-[11px] text-[var(--mu)]">
        <span>顏色深淺＝當日答題量</span>
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
                  className="h-[13px] w-[13px] rounded-[3px] border"
                  style={style}
                />
              )
            })}
          </div>
        ))}
      </div>

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
