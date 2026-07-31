import React from 'react'
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { cn } from '../lib/utils'

interface EntryCardProps {
  href: string
  title: string
  /** 標題左邊的小圖示，選用 */
  icon?: React.ReactNode
  /** 標題右邊的即時數字，例如「12 題待複習」。沒有數字就不要硬湊。 */
  badge?: string
  description: React.ReactNode
  /** 右側動作標籤，例如「開始複習」。省略時只留箭頭。 */
  action?: string
  /** 主色外框：用在「這一區現在最該點的那一張」，一區至多一張。 */
  emphasis?: boolean
}

/**
 * 首頁與練習中心共用的功能入口卡。
 *
 * 這兩頁原本各自手寫同一塊 JSX（錯題本、單字複習本、速查卡、學習路徑），版型會慢慢
 * 漂開——而使用者是靠「長得一樣＝同一種東西」在認路的，所以統一成一個元件。
 */
export const EntryCard: React.FC<EntryCardProps> = ({
  href,
  title,
  icon,
  badge,
  description,
  action,
  emphasis,
}) => {
  return (
    <Link
      href={href}
      className={cn(
        'flex items-center justify-between gap-3 overflow-hidden rounded-2xl border p-3.5 transition-colors sm:p-4',
        emphasis
          ? 'border-[var(--pr-ln)] bg-[var(--pr-sf)] hover:border-[var(--pr)]'
          : 'border-[var(--ln)] bg-[var(--sf)] hover:border-[var(--pr-ln)]'
      )}
    >
      <div className="min-w-0 flex-1 overflow-hidden">
        <div className="flex min-w-0 items-center gap-2">
          <h3 className="flex shrink-0 items-center gap-1.5 text-[15px] font-semibold text-[var(--tx)]">
            {icon}
            {title}
          </h3>
          {badge && (
            <span className="truncate text-xs font-bold text-[var(--pr)]">{badge}</span>
          )}
        </div>
        <p className="mt-1 line-clamp-2 overflow-hidden break-words text-xs leading-relaxed text-[var(--mu)]">
          {description}
        </p>
      </div>

      {action ? (
        <span
          className={cn(
            'shrink-0 rounded-lg border border-[var(--pr-ln)] px-2.5 py-1.5 text-xs font-bold text-[var(--pr)] sm:px-3',
            emphasis ? 'bg-[var(--sf)]' : 'bg-[var(--pr-sf)]'
          )}
        >
          {action}
        </span>
      ) : (
        <ChevronRight className="h-5 w-5 shrink-0 text-[var(--mu)]" />
      )}
    </Link>
  )
}
