import React from 'react'

interface ProgressRingProps {
  completed: number
  total: number
  size?: number
  strokeWidth?: number
}

export const ProgressRing: React.FC<ProgressRingProps> = ({
  completed,
  total,
  size = 120,
  strokeWidth = 10,
}) => {
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const progress = Math.min(completed / total, 1)
  const offset = circumference - progress * circumference

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width={size} height={size} className="transform -rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          className="stroke-muted"
          strokeWidth={strokeWidth}
          fill="transparent"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          className="stroke-primary transition-all duration-500 ease-out"
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          fill="transparent"
        />
      </svg>
      <div className="absolute text-center">
        <span className="text-2xl font-bold">{completed}/{total}</span>
        <span className="block text-xs text-muted-foreground">任務解鎖</span>
      </div>
    </div>
  )
}
