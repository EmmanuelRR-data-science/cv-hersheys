import { type ButtonHTMLAttributes } from 'react'

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary'
}

export function Button({ variant = 'primary', className, ...props }: Props) {
  const variantClass = variant === 'primary' ? 'ui-btn-primary' : 'ui-btn-secondary'
  const cls = ['ui-btn', variantClass, className].filter(Boolean).join(' ')
  return <button {...props} className={cls} />
}

