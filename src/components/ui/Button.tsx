import React from 'react'
import { cn } from '../../lib/utils'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'correct' | 'wrong'
}

export const Button: React.FC<ButtonProps> = ({
  children,
  className,
  variant = 'primary',
  ...props
}) => {
  const base = 'w-full py-3 px-4 rounded-xl font-medium transition-all duration-200 active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2'
  const variants = {
    primary: 'bg-primary text-primary-foreground hover:opacity-90 shadow-sm',
    secondary: 'bg-muted text-foreground hover:bg-muted/80',
    outline: 'border border-muted text-foreground hover:bg-muted/50',
    correct: 'bg-correct text-correct-foreground font-semibold',
    wrong: 'bg-wrong text-wrong-foreground font-semibold',
  }

  return (
    <button className={cn(base, variants[variant], className)} {...props}>
      {children}
    </button>
  )
}
