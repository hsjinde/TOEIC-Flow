import React from 'react'
import type { Explanation } from '../../scripts/build-content/types'

interface ExplanationCardProps {
  explanation: Explanation
}

export const ExplanationCard: React.FC<ExplanationCardProps> = ({ explanation }) => {
  return (
    <div className="mt-4 p-4 rounded-2xl bg-muted/60 border border-muted text-sm space-y-3 animate-fade-in">
      <div className="font-semibold text-primary">💡 {explanation.title}</div>
      <div className="leading-relaxed text-muted-foreground whitespace-pre-line">
        {explanation.analysis}
      </div>
      {explanation.grammarPoint && (
        <div className="text-xs bg-primary/10 text-primary px-2.5 py-1.5 rounded-lg font-medium inline-block">
          重點：{explanation.grammarPoint}
        </div>
      )}
    </div>
  )
}
