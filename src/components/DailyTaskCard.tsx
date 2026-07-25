import React from 'react'
import Link from 'next/link'
import { CheckCircle2, ChevronRight } from 'lucide-react'
import { cn } from '../lib/utils'

interface DailyTaskCardProps {
  title: string
  subtitle: string
  timeEstimate: string
  icon: React.ReactNode
  completed: boolean
  href: string
}

export const DailyTaskCard: React.FC<DailyTaskCardProps> = ({
  title,
  subtitle,
  timeEstimate,
  icon,
  completed,
  href,
}) => {
  const content = (
    <div className={cn(
      "flex items-center justify-between p-4 rounded-2xl border transition-all duration-200",
      completed 
        ? "bg-muted/40 border-muted/60 opacity-80" 
        : "bg-card border-muted/80 hover:border-primary/50 shadow-sm"
    )}>
      <div className="flex items-center gap-3.5">
        <div className={cn(
          "p-2.5 rounded-xl",
          completed ? "bg-muted text-muted-foreground" : "bg-primary/10 text-primary"
        )}>
          {icon}
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-base">{title}</h3>
            {completed && <CheckCircle2 className="w-4 h-4 text-correct" />}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">{subtitle} · 約 {timeEstimate}</p>
        </div>
      </div>
      <ChevronRight className="w-5 h-5 text-muted-foreground" />
    </div>
  )

  return completed ? content : <Link href={href} className="block">{content}</Link>
}
