import React from 'react'

export interface RadarAxis {
  label: string
  /** 0–100 */
  value: number
}

interface RadarChartProps {
  axes: RadarAxis[]
  size?: number
  /** 每軸至少要這麼多題才算有意義；不足者以虛線描邊表示樣本不足。 */
  className?: string
}

/**
 * 設計 05/12 的六大類正確率雷達圖。刻意只用主色一種顏色（設計約束：單一
 * 強調色，綠／紅保留給答題回饋），層級靠透明度與線寬區分。
 */
export const RadarChart: React.FC<RadarChartProps> = ({ axes, size = 300, className }) => {
  if (axes.length < 3) return null

  const cx = size / 2
  const cy = size / 2
  // 計算網格半徑：標籤改為雙行堆疊顯示（名稱在上、百分比在下），大幅節省水平寬度，讓網格放至最大。
  const radius = Math.round(size * 0.35)
  const labelRadiusRatio = 1.16

  const padX = Math.max(38, Math.round(size * 0.12))
  const padY = Math.max(26, Math.round(size * 0.08))
  const viewW = size + padX * 2
  const viewH = size + padY * 2

  const pointAt = (index: number, ratio: number) => {
    const angle = (Math.PI * 2 * index) / axes.length - Math.PI / 2
    return {
      x: cx + Math.cos(angle) * radius * ratio,
      y: cy + Math.sin(angle) * radius * ratio,
    }
  }

  const gridRings = [0.25, 0.5, 0.75, 1]

  const shape = axes
    .map((axis, i) => {
      const p = pointAt(i, Math.max(0, Math.min(100, axis.value)) / 100)
      return `${p.x.toFixed(2)},${p.y.toFixed(2)}`
    })
    .join(' ')

  return (
    <svg
      width={size}
      height={Math.round((size * viewH) / viewW)}
      viewBox={`-${padX} -${padY} ${viewW} ${viewH}`}
      className={className}
      role="img"
      aria-label={`六大文法類別正確率：${axes.map((a) => `${a.label} ${a.value}%`).join('、')}`}
    >
      {gridRings.map((ring) => (
        <polygon
          key={ring}
          points={axes
            .map((_, i) => {
              const p = pointAt(i, ring)
              return `${p.x.toFixed(2)},${p.y.toFixed(2)}`
            })
            .join(' ')}
          fill="none"
          stroke="var(--ln)"
          strokeWidth={1}
        />
      ))}

      {axes.map((_, i) => {
        const p = pointAt(i, 1)
        return (
          <line
            key={i}
            x1={cx}
            y1={cy}
            x2={p.x}
            y2={p.y}
            stroke="var(--ln)"
            strokeWidth={1}
          />
        )
      })}

      <polygon points={shape} fill="var(--pr)" fillOpacity={0.18} stroke="var(--pr)" strokeWidth={2} />

      {axes.map((axis, i) => {
        const p = pointAt(i, Math.max(0, Math.min(100, axis.value)) / 100)
        return <circle key={i} cx={p.x} cy={p.y} r={3.5} fill="var(--pr)" />
      })}

      {axes.map((axis, i) => {
        const p = pointAt(i, labelRadiusRatio)
        // 正上與正下的標籤置中，左右兩側靠外側對齊
        const dx = p.x - cx
        const anchor = Math.abs(dx) < 4 ? 'middle' : dx > 0 ? 'start' : 'end'
        return (
          <text
            key={i}
            x={p.x}
            y={p.y}
            textAnchor={anchor}
            fontSize={11.5}
            fill="var(--mu)"
          >
            <tspan x={p.x} dy="-0.5em" fontWeight={500}>
              {axis.label}
            </tspan>
            <tspan x={p.x} dy="1.25em" fill="var(--tx)" fontWeight={700}>
              {axis.value}%
            </tspan>
          </text>
        )
      })}
    </svg>
  )
}
