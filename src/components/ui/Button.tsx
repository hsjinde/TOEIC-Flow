import React from 'react'
import { cn } from '../../lib/utils'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'correct' | 'wrong'
  /**
   * 已定案、不可再點，但必須保持可聚焦且能被螢幕閱讀器讀到。
   *
   * 答題選項一定要用這個而不是原生 `disabled`：正解與「你的答案」這兩段文字就寫在
   * 按鈕內部，而 disabled 的按鈕不可聚焦、多數 AT 會整個跳過，等於答題結果對非視覺
   * 使用者永遠不存在。原生 disabled 只留給「真的不該被送出」的場合（例如送出中的表單）。
   */
  softDisabled?: boolean
}

export const Button: React.FC<ButtonProps> = ({
  children,
  className,
  variant = 'primary',
  disabled,
  softDisabled,
  onClick,
  ...props
}) => {
  const base =
    'w-full min-h-[52px] py-3.5 px-4 rounded-[10px] font-medium transition-all duration-200 flex items-center justify-center gap-2'
  const variants = {
    primary: 'bg-[var(--pr)] text-[var(--pr-tx)] hover:opacity-90 active:scale-[0.98] font-bold',
    secondary: 'bg-[var(--sf2)] text-[var(--tx)] border border-[var(--ln2)] hover:bg-muted/80 active:scale-[0.98]',
    outline: 'border border-[var(--ln)] bg-[var(--sf)] text-[var(--tx)] hover:border-[var(--pr-ln)] hover:bg-[var(--pr-sf)] active:scale-[0.98]',
    correct: 'bg-[var(--ok-sf)] text-[var(--ok)] border-2 border-[var(--ok)] font-semibold',
    wrong: 'bg-[var(--bad-sf)] text-[var(--bad)] border-2 border-[var(--bad)] font-semibold',
  }

  const inactive = disabled || softDisabled

  return (
    <button
      className={cn(
        base,
        variants[variant],
        inactive && variant === 'outline' && 'opacity-50 cursor-default',
        inactive && (variant === 'correct' || variant === 'wrong') && 'cursor-default',
        className
      )}
      disabled={disabled}
      aria-disabled={softDisabled || undefined}
      onClick={(e) => {
        if (softDisabled) {
          e.preventDefault()
          return
        }
        onClick?.(e)
      }}
      {...props}
    >
      {children}
    </button>
  )
}
