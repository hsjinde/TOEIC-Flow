import React from 'react'
import { cn } from '../../lib/utils'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'correct' | 'wrong'
}

export const Button: React.FC<ButtonProps> = ({
  children,
  className,
  variant = 'primary',
  disabled,
  ...props
}) => {
  const base = 'w-full min-h-[52px] py-3.5 px-4 rounded-[10px] font-medium transition-all duration-200 flex items-center justify-center gap-2'
  const variants = {
    primary: 'bg-[var(--pr)] text-[var(--pr-tx)] hover:opacity-90 active:scale-[0.98] font-bold',
    secondary: 'bg-[var(--sf2)] text-[var(--tx)] border border-[var(--ln2)] hover:bg-muted/80 active:scale-[0.98]',
    outline: 'border border-[var(--ln)] bg-[var(--sf)] text-[var(--tx)] hover:border-[var(--pr-ln)] hover:bg-[var(--pr-sf)] active:scale-[0.98]',
    correct: 'bg-[var(--ok-sf)] text-[var(--ok)] border-2 border-[var(--ok)] font-semibold',
    wrong: 'bg-[var(--bad-sf)] text-[var(--bad)] border-2 border-[var(--bad)] font-semibold',
  }

  return (
    <button
      className={cn(
        base,
        variants[variant],
        disabled && variant === 'outline' && 'opacity-50 cursor-default',
        disabled && (variant === 'correct' || variant === 'wrong') && 'cursor-default',
        className
      )}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  )
}
