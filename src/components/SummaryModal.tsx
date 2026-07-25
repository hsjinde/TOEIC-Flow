import React from 'react'
import Link from 'next/link'
import { Trophy, ArrowLeft } from 'lucide-react'
import { Button } from './ui/Button'

interface SummaryModalProps {
  correctCount: number
  totalCount: number
}

export const SummaryModal: React.FC<SummaryModalProps> = ({ correctCount, totalCount }) => {
  const percentage = Math.round((correctCount / totalCount) * 100)

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-card border border-muted p-6 rounded-3xl text-center space-y-5 shadow-xl">
        <div className="w-16 h-16 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto">
          <Trophy className="w-8 h-8" />
        </div>
        <div>
          <h2 className="text-xl font-bold">文法練習完成！</h2>
          <p className="text-sm text-muted-foreground mt-1">答對 {correctCount} / {totalCount} 題 ({percentage}%)</p>
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
