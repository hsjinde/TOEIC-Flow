import React from 'react'
import { MAX_VOCAB_LEVEL } from '../lib/storage'

interface MasteryDotsProps {
  level: number
  className?: string
}

/** 設計 03：熟悉度 ●●○○，四格對應 SRS 的四個間隔。 */
export const MasteryDots: React.FC<MasteryDotsProps> = ({ level, className }) => {
  const filled = Math.max(0, Math.min(MAX_VOCAB_LEVEL, level))
  return (
    <span
      className={className}
      aria-label={`熟悉度 ${filled} / ${MAX_VOCAB_LEVEL}`}
      style={{ letterSpacing: '0.1em', color: filled > 0 ? 'var(--pr)' : 'var(--fa)' }}
    >
      {'●'.repeat(filled)}
      {'○'.repeat(MAX_VOCAB_LEVEL - filled)}
    </span>
  )
}
