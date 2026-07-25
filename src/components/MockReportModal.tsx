import React from 'react'
import Link from 'next/link'
import { Award, ArrowLeft } from 'lucide-react'
import { Button } from './ui/Button'

interface MockReportModalProps {
  score: number
  correctCount: number
  totalCount: number
  timeSpentSeconds: number
}

export const MockReportModal: React.FC<MockReportModalProps> = ({
  score,
  correctCount,
  totalCount,
  timeSpentSeconds,
}) => {
  const minutes = Math.floor(timeSpentSeconds / 60)
  const seconds = timeSpentSeconds % 60

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-card border border-muted p-6 rounded-3xl text-center space-y-5 shadow-xl">
        <div className="w-16 h-16 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto">
          <Award className="w-8 h-8" />
        </div>
        <div>
          <h2 className="text-xl font-bold">模擬考測驗完成！</h2>
          <div className="text-3xl font-extrabold text-primary my-2">{score} <span className="text-xs text-muted-foreground font-normal">分 (預估多益)</span></div>
          <p className="text-xs text-muted-foreground">
            答對 {correctCount} / {totalCount} 題 · 耗時 {minutes} 分 {seconds} 秒
          </p>
        </div>
        <Link href="/" className="block">
          <Button variant="primary">
            <ArrowLeft className="w-4 h-4" /> 返回今日任務
          </Button>
        </Link>
      </div>
    </div>
  )
}
