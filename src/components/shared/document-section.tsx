'use client'

import { cn } from '@/lib/utils'
import { type ElementType } from 'react'

// ─── Document Section Card ─────────────────────────────────────────────────────
// A styled card for document page sections with consistent header styling

interface DocumentSectionProps {
  title: string
  icon?: ElementType
  iconColor?: string
  children: React.ReactNode
  action?: React.ReactNode
  className?: string
  noPadding?: boolean
}

export function DocumentSection({
  title,
  icon: Icon,
  iconColor = 'text-emerald-600',
  children,
  action,
  className,
  noPadding = false,
}: DocumentSectionProps) {
  return (
    <div className={cn('border rounded-xl bg-white shadow-sm overflow-hidden', className)}>
      <div className="flex items-center justify-between px-5 py-3 border-b bg-slate-50/50">
        <div className="flex items-center gap-2">
          {Icon && <Icon className={cn('h-4 w-4', iconColor)} />}
          <h3 className="text-sm font-semibold text-slate-700">{title}</h3>
        </div>
        {action}
      </div>
      <div className={cn(noPadding ? '' : 'p-5')}>{children}</div>
    </div>
  )
}

// ─── Linked Document Badge ─────────────────────────────────────────────────────

interface LinkedDocumentBadgeProps {
  label: string
  value: string
  onClick?: () => void
}

export function LinkedDocumentBadge({ label, value, onClick }: LinkedDocumentBadgeProps) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-200 text-xs hover:bg-emerald-50 hover:border-emerald-200 transition-colors"
    >
      <span className="text-slate-400">{label}:</span>
      <span className="font-medium text-slate-700 font-mono">{value}</span>
    </button>
  )
}
