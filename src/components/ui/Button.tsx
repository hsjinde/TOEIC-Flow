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
  const base = 'w-full py-3 px-4 rounded-xl font-medium transition-all duration-200 flex items-center justify-center gap-2'
  const variants = {
    primary: 'bg-primary text-primary-foreground hover:opacity-90 shadow-sm active:scale-[0.98]',
    secondary: 'bg-muted text-foreground hover:bg-muted/80 active:scale-[0.98]',
    outline: 'border border-muted text-foreground hover:bg-muted/50 active:scale-[0.98]',
    correct: 'bg-correct/15 text-correct border-2 border-correct font-semibold shadow-sm',
    wrong: 'bg-wrong/15 text-wrong border-2 border-wrong font-semibold shadow-sm',
  }

  return (
    <button
      className={cn(
        base,
        variants[variant],
        disabled && variant === 'outline' && 'opacity-60 cursor-default',
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
