'use client'

import { useEffect, useState } from 'react'
import { ArrowLeft, BookOpenCheck, CheckCircle2, RotateCcw } from 'lucide-react'
import Link from 'next/link'
import { getWrongQuestionsMap, type WrongQuestionRecord } from '../../lib/storage'
import { Button } from '../../components/ui/Button'

export default function WrongQuestionsPage() {
  const [wrongMap, setWrongMap] = useState<Record<string, WrongQuestionRecord>>({})

  useEffect(() => {
    setWrongMap(getWrongQuestionsMap())
  }, [])

  const wrongList = Object.values(wrongMap)

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Link href="/" className="p-2 -ml-2 rounded-xl text-muted-foreground hover:bg-muted">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <h1 className="text-xl font-bold">錯題本</h1>
        </div>
        <span className="text-xs px-3 py-1 rounded-full bg-wrong/10 text-wrong font-semibold">
          {wrongList.length} 題待複習
        </span>
      </div>

      {/* Intro Note */}
      <div className="p-4 rounded-2xl bg-card border border-muted/80 text-xs text-muted-foreground leading-relaxed">
        💡 錯題專攻原則：每道錯題需在複習中**連續答對 2 次**（表示為 <span className="text-foreground font-bold">●●</span>）才能從錯題本畢業移除。
      </div>

      {/* List / Empty State */}
      {wrongList.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 bg-card border border-muted/60 rounded-3xl text-center space-y-3">
          <CheckCircle2 className="w-12 h-12 text-correct opacity-80" />
          <h3 className="font-bold text-base">無待複習錯題</h3>
          <p className="text-xs text-muted-foreground">太棒了！所有錯題已全部畢業或尚未積累錯題。</p>
          <Link href="/" className="pt-2">
            <Button variant="secondary" className="text-xs">返回首頁</Button>
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {wrongList.map((item) => (
            <div
              key={item.questionId}
              className="p-4 rounded-2xl bg-card border border-muted/80 flex items-center justify-between shadow-sm"
            >
              <div>
                <div className="text-xs font-semibold text-primary">{item.categoryId}</div>
                <div className="text-sm font-medium mt-1">{item.questionId}</div>
                <div className="text-xs text-muted-foreground mt-1">錯過 {item.failCount} 次</div>
              </div>
              <div className="flex flex-col items-end gap-1">
                <span className="text-xs font-semibold">畢業進度</span>
                <span className="text-base tracking-widest text-primary">
                  {item.consecutiveCorrect === 0 && '○○'}
                  {item.consecutiveCorrect === 1 && '●○'}
                  {item.consecutiveCorrect >= 2 && '●●'}
                </span>
              </div>
            </div>
          ))}

          <Link href="/practice/grammar" className="block pt-2">
            <Button variant="primary">
              <RotateCcw className="w-4 h-4" /> 開始錯題專攻練習
            </Button>
          </Link>
        </div>
      )}
    </div>
  )
}
