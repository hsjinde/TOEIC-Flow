import React from 'react'

interface GraduationDotsProps {
  /** 目前連續答對次數，2 次即畢業（見 storage.recordQuestionAnswer） */
  consecutiveCorrect: number
  className?: string
}

/** 設計 06/16：畢業進度用 ○● 小圓點，兩格代表「連續答對 2 次」。 */
export const GraduationDots: React.FC<GraduationDotsProps> = ({
  consecutiveCorrect,
  className,
}) => {
  const filled = Math.max(0, Math.min(2, consecutiveCorrect))
  const label = filled >= 2 ? '已畢業' : `畢業進度 ${filled}/2`

  return (
    <span
      className={className}
      aria-label={label}
      title={label}
      style={{ letterSpacing: '0.12em', color: filled > 0 ? 'var(--pr)' : 'var(--fa)' }}
    >
      {'●'.repeat(filled)}
      {'○'.repeat(2 - filled)}
    </span>
  )
}
