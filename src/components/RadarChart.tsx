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
export const RadarChart: React.FC<RadarChartProps> = ({ axes, size = 480, className }) => {
  if (axes.length < 3) return null

  const cx = size / 2
  const cy = size / 2
  // 網格半徑設為 42%，讓雷達圖視覺最大化，滿版大方醒目。
  const radius = Math.round(size * 0.42)
  const labelRadiusRatio = 1.12

  const padX = Math.max(36, Math.round(size * 0.08))
  const padY = Math.max(26, Math.round(size * 0.06))
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
          strokeWidth={1.5}
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
            strokeWidth={1.5}
          />
        )
      })}

      <polygon points={shape} fill="var(--pr)" fillOpacity={0.22} stroke="var(--pr)" strokeWidth={2.5} />

      {axes.map((axis, i) => {
        const p = pointAt(i, Math.max(0, Math.min(100, axis.value)) / 100)
        return <circle key={i} cx={p.x} cy={p.y} r={5} fill="var(--pr)" />
      })}

      {axes.map((axis, i) => {
        const p = pointAt(i, labelRadiusRatio)
        const dx = p.x - cx
        const anchor = Math.abs(dx) < 4 ? 'middle' : dx > 0 ? 'start' : 'end'
        return (
          <text
            key={i}
            x={p.x}
            y={p.y}
            textAnchor={anchor}
            fill="var(--mu)"
          >
            <tspan x={p.x} dy="-0.4em" fontSize={14} fontWeight={600}>
              {axis.label}
            </tspan>
            <tspan x={p.x} dy="1.3em" fill="var(--tx)" fontSize={15} fontWeight={700}>
              {axis.value}%
            </tspan>
          </text>
        )
      })}
    </svg>
  )
}
