'use client'

import { ArrowRight, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { type ElementType } from 'react'

// ─── Status Badge ──────────────────────────────────────────────────────────────

export function getDocumentStatusBadge(status: string) {
  switch (status) {
    case 'DRAFT':
      return <Badge variant="outline" className="bg-slate-50 text-slate-600 border-slate-200 font-medium">مسودة</Badge>
    case 'PENDING':
      return <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 font-medium">قيد المراجعة</Badge>
    case 'CONFIRMED':
      return <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 font-medium">مؤكد</Badge>
    case 'APPROVED':
      return <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 font-medium">معتمد</Badge>
    case 'FULFILLED':
      return <Badge variant="outline" className="bg-teal-50 text-teal-700 border-teal-200 font-medium">مكتمل</Badge>
    case 'IN_PROGRESS':
      return <Badge variant="outline" className="bg-sky-50 text-sky-700 border-sky-200 font-medium">قيد التنفيذ</Badge>
    case 'COMPLETED':
      return <Badge variant="outline" className="bg-teal-50 text-teal-700 border-teal-200 font-medium">مكتمل</Badge>
    case 'CANCELLED':
      return <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 font-medium">ملغي</Badge>
    case 'CLOSED':
      return <Badge variant="outline" className="bg-slate-100 text-slate-500 border-slate-200 font-medium">مغلق</Badge>
    case 'POSTED':
      return <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 font-medium">مرحّل</Badge>
    default:
      return <Badge variant="outline">{status}</Badge>
  }
}

// ─── Action Button ─────────────────────────────────────────────────────────────

interface ActionButton {
  label: string
  icon?: ElementType
  onClick: () => void
  variant?: 'default' | 'outline' | 'ghost' | 'destructive'
  className?: string
  disabled?: boolean
  loading?: boolean
}

// ─── Document Page Header ──────────────────────────────────────────────────────

interface DocumentPageHeaderProps {
  /** Icon component for the document type */
  icon: ElementType
  /** Icon background color class (e.g. 'bg-emerald-50') */
  iconBg?: string
  /** Icon color class (e.g. 'text-emerald-600') */
  iconColor?: string
  /** Document title when new (e.g. 'أمر شراء جديد') */
  newTitle: string
  /** Document title prefix when editing (e.g. 'أمر شراء') */
  editTitlePrefix: string
  /** Document number (shown when editing) */
  documentNumber?: string
  /** Current document status */
  status?: string
  /** Subtitle for the document */
  subtitle?: string
  /** Go back handler */
  onGoBack: () => void
  /** Primary actions (save, confirm) */
  primaryActions?: ActionButton[]
  /** Secondary actions (shortcuts like 'تحويل لإذن استلام') */
  shortcutActions?: ActionButton[]
}

export default function DocumentPageHeader({
  icon: Icon,
  iconBg = 'bg-emerald-50',
  iconColor = 'text-emerald-600',
  newTitle,
  editTitlePrefix,
  documentNumber,
  status,
  subtitle,
  onGoBack,
  primaryActions,
  shortcutActions,
}: DocumentPageHeaderProps) {
  const isExisting = !!documentNumber
  const title = isExisting ? `${editTitlePrefix} ${documentNumber}` : newTitle
  const statusBadge = status && status !== 'NEW' ? getDocumentStatusBadge(status) : null

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      {/* Right side: Back button + Title */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onGoBack} className="hover:bg-slate-100 shrink-0">
          <ArrowRight className="h-5 w-5" />
        </Button>
        <div className="flex items-center gap-3">
          <div className={`h-10 w-10 rounded-xl ${iconBg} flex items-center justify-center shrink-0`}>
            <Icon className={`h-5 w-5 ${iconColor}`} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-slate-900 truncate">{title}</h2>
              {statusBadge}
            </div>
            {subtitle && (
              <p className="text-xs text-slate-400 truncate">{subtitle}</p>
            )}
          </div>
        </div>
      </div>

      {/* Left side: Actions */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <Button variant="outline" onClick={onGoBack} className="text-sm">
          إلغاء
        </Button>
        {/* Shortcut actions */}
        {shortcutActions?.map((action, idx) => (
          <Button
            key={idx}
            variant={action.variant || 'outline'}
            onClick={action.onClick}
            disabled={action.disabled}
            className={`gap-2 text-sm ${action.className || ''}`}
          >
            {action.loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : action.icon ? (
              <action.icon className="h-4 w-4" />
            ) : null}
            {action.label}
          </Button>
        ))}
        {/* Primary actions */}
        {primaryActions?.map((action, idx) => (
          <Button
            key={idx}
            variant={action.variant || (idx === (primaryActions.length - 1) ? 'default' : 'outline')}
            onClick={action.onClick}
            disabled={action.disabled}
            className={`gap-2 text-sm ${
              action.className ||
              (idx === primaryActions.length - 1
                ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                : 'border-emerald-200 text-emerald-700 hover:bg-emerald-50')
            }`}
          >
            {action.loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : action.icon ? (
              <action.icon className="h-4 w-4" />
            ) : null}
            {action.label}
          </Button>
        ))}
      </div>
    </div>
  )
}
