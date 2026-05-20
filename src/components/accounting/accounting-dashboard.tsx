'use client'

import { useState, useEffect, useCallback, type ElementType } from 'react'
import { toast } from 'sonner'
import { useAppStore } from '@/lib/store'
import { formatCurrency, formatDate, getStatusColor, getStatusLabel, getAccountTypeLabel } from '@/lib/erp-utils'
import { cn } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Calculator, GitBranch, BookOpen, TrendingUp, TrendingDown,
  AlertTriangle, CheckCircle2, Clock, FileText, ArrowRight,
  Scale, PieChart, ArrowRightLeft, Plus,
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

interface AnalyticsData {
  totalAccounts: number
  leafAccounts: number
  activeAccounts: number
  accountDistribution: Array<{
    type: string
    label: string
    color: string
    count: number
  }>
  totalJournalEntries: number
  draftEntries: number
  postedEntries: number
  reversedEntries: number
  totalDebit: number
  totalCredit: number
  totalsByType: Record<string, { debit: number; credit: number }>
  recentEntries: Array<{
    id: string
    number: string
    date: string
    description: string | null
    status: string
    sourceType: string | null
    totalDebit: number
    totalCredit: number
  }>
  monthlyEntries: Array<{
    month: string
    totalDebit: number
    totalCredit: number
    entryCount: number
  }>
  topAccounts: Array<{
    accountId: string
    code: string
    nameAr: string
    type: string
    totalDebit: number
    totalCredit: number
    movementCount: number
  }>
}

// ─── Quick Action Definition ──────────────────────────────────────────────────

interface QuickAction {
  id: string
  label: string
  description: string
  icon: ElementType
  color: string
  bg: string
  border: string
  viewId: string
}

// ─── Account type color mapping ──────────────────────────────────────────────

const accountTypeColors: Record<string, string> = {
  ASSET: 'text-cyan-700',
  LIABILITY: 'text-red-700',
  EQUITY: 'text-purple-700',
  REVENUE: 'text-emerald-700',
  EXPENSE: 'text-orange-700',
}

const accountTypeBgColors: Record<string, string> = {
  ASSET: 'bg-cyan-50 border-cyan-200',
  LIABILITY: 'bg-red-50 border-red-200',
  EQUITY: 'bg-purple-50 border-purple-200',
  REVENUE: 'bg-emerald-50 border-emerald-200',
  EXPENSE: 'bg-orange-50 border-orange-200',
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function AccountingDashboard() {
  const companyId = useAppStore((s) => s.currentCompanyId)
  const setView = useAppStore((s) => s.setView)
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    if (!companyId) return
    try {
      const res = await fetch(`/api/accounting/analytics?companyId=${companyId}`)
      if (res.ok) setData(await res.json())
    } catch {
      toast.error('فشل في تحميل تحليلات الحسابات')
    } finally {
      setLoading(false)
    }
  }, [companyId])

  useEffect(() => { fetchData() }, [fetchData])

  // ── Quick Actions ──
  const quickActions: QuickAction[] = [
    { id: 'chart-of-accounts', label: 'شجرة الحسابات', description: 'إدارة الحسابات', icon: GitBranch, color: 'text-cyan-600', bg: 'bg-cyan-50', border: 'border-cyan-200', viewId: 'chart-of-accounts' },
    { id: 'journal-entries', label: 'القيود اليومية', description: 'عرض القيود', icon: BookOpen, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200', viewId: 'journal-entries' },
    { id: 'trial-balance', label: 'ميزان المراجعة', description: 'تقرير الأرصدة', icon: Scale, color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200', viewId: 'trial-balance' },
    { id: 'balance-sheet', label: 'الميزانية العمومية', description: 'تقرير المركز المالي', icon: PieChart, color: 'text-purple-600', bg: 'bg-purple-50', border: 'border-purple-200', viewId: 'balance-sheet' },
    { id: 'income-statement', label: 'قائمة الدخل', description: 'تقرير الأرباح والخسائر', icon: TrendingUp, color: 'text-teal-600', bg: 'bg-teal-50', border: 'border-teal-200', viewId: 'income-statement' },
  ]

  // ── Stat Cards Definition ──
  const statCards = [
    { key: 'totalAccounts', label: 'إجمالي الحسابات', icon: GitBranch, color: 'text-cyan-600', bg: 'bg-cyan-50', border: 'border-cyan-200', isCurrency: false },
    { key: 'totalJournalEntries', label: 'إجمالي القيود', icon: BookOpen, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200', isCurrency: false },
    { key: 'draftEntries', label: 'قيود مسودة', icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200', isCurrency: false },
    { key: 'totalDebit', label: 'إجمالي المدين', icon: TrendingUp, color: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-200', isCurrency: true },
  ] as const

  const statValues: Record<string, number> = data ? {
    totalAccounts: data.totalAccounts,
    totalJournalEntries: data.totalJournalEntries,
    draftEntries: data.draftEntries,
    totalDebit: data.totalDebit,
  } : {}

  // ── Month label helper ──
  const getMonthLabel = (monthKey: string): string => {
    const [year, month] = monthKey.split('-')
    const d = new Date(Number(year), Number(month) - 1, 1)
    return new Intl.DateTimeFormat('ar-EG', { month: 'short', year: '2-digit' }).format(d)
  }

  // ── Source type label ──
  const getSourceLabel = (sourceType: string | null): string => {
    const labels: Record<string, string> = {
      sales_invoice: 'فاتورة بيع',
      purchase_invoice: 'فاتورة شراء',
      payment_voucher: 'سند صرف',
      receipt_voucher: 'سند قبض',
      stock_transfer: 'تحويل مخزون',
    }
    return sourceType ? (labels[sourceType] || sourceType) : 'يدوي'
  }

  // ── Loading State ──
  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Skeleton className="h-72 rounded-xl" />
          <Skeleton className="h-72 rounded-xl" />
        </div>
        <Skeleton className="h-40 rounded-xl" />
      </div>
    )
  }

  if (!data) return null

  return (
    <div className="space-y-6">
      {/* ── Stat Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat) => {
          const val = statValues[stat.key] ?? 0
          return (
            <Card key={stat.key} className={cn('border shadow-sm hover:shadow-md transition-shadow', stat.border)}>
              <CardContent className="p-5">
                <div className="flex items-center gap-4">
                  <div className={cn('p-3 rounded-xl', stat.bg)}>
                    <stat.icon className={cn('h-6 w-6', stat.color)} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-500 truncate">{stat.label}</p>
                    <p className="text-2xl font-bold text-slate-900 mt-0.5">
                      {stat.isCurrency ? formatCurrency(val) : String(val)}
                    </p>
                  </div>
                  {(stat.key === 'draftEntries' && val > 0) && (
                    <Badge className="bg-amber-100 text-amber-700 border-amber-200 animate-pulse">
                      تنبيه
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* ── Quick Actions / Shortcuts ── */}
      <Card className="border shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-emerald-50 flex items-center justify-center">
              <Calculator className="h-4.5 w-4.5 text-emerald-600" />
            </div>
            <CardTitle className="text-base font-semibold">اختصارات الحسابات</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {quickActions.map((action) => (
              <button
                key={action.id}
                onClick={() => {
                  // Navigate to reports module for report views
                  const reportViews = ['trial-balance', 'balance-sheet', 'income-statement']
                  if (reportViews.includes(action.viewId)) {
                    useAppStore.getState().setModule('reports')
                    setView(action.viewId)
                  } else {
                    setView(action.viewId)
                  }
                }}
                className={cn(
                  'relative flex flex-col items-center gap-2 p-4 rounded-xl border transition-all duration-150 group',
                  'hover:shadow-md hover:-translate-y-0.5',
                  action.bg, action.border
                )}
              >
                <div className={cn('h-10 w-10 rounded-lg flex items-center justify-center transition-colors', action.bg, 'group-hover:scale-110')}>
                  <action.icon className={cn('h-5 w-5', action.color)} />
                </div>
                <div className="text-center">
                  <p className={cn('text-sm font-semibold', action.color)}>{action.label}</p>
                  <p className="text-[10px] text-slate-400 mt-0.5 leading-tight">{action.description}</p>
                </div>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* ── Account Distribution + Financial Summary ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Account Distribution by Type */}
        <Card className="border shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-cyan-50 flex items-center justify-center">
                  <GitBranch className="h-4 w-4 text-cyan-600" />
                </div>
                <CardTitle className="text-sm font-semibold">توزيع الحسابات حسب النوع</CardTitle>
              </div>
              <button onClick={() => setView('chart-of-accounts')} className="text-xs text-cyan-600 hover:text-cyan-700 font-medium">
                عرض الكل ←
              </button>
            </div>
          </CardHeader>
          <CardContent>
            {data.accountDistribution.some((ad) => ad.count > 0) ? (
              <div className="space-y-3">
                {data.accountDistribution.map((ad) => {
                  const maxCount = Math.max(...data.accountDistribution.map(a => a.count), 1)
                  const pct = Math.round((ad.count / maxCount) * 100)
                  const typeTotals = data.totalsByType?.[ad.type]
                  return (
                    <div key={ad.type} className="space-y-1">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className={cn('h-3 w-3 rounded-full', ad.color)} />
                          <span className={cn('text-sm font-medium', accountTypeColors[ad.type])}>{ad.label}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-slate-400">{ad.count} حساب</span>
                          {typeTotals && (
                            <span className="text-xs font-mono text-slate-500" dir="ltr">
                              {formatCurrency(typeTotals.debit)}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className={cn('h-full rounded-full transition-all duration-500', ad.color)}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  )
                })}
                <div className="mt-3 pt-3 border-t flex items-center justify-between text-xs text-slate-500">
                  <span>إجمالي الحسابات: {data.totalAccounts}</span>
                  <span>فرعية: {data.leafAccounts} • نشطة: {data.activeAccounts}</span>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-32 text-slate-400">
                <GitBranch className="h-8 w-8 mb-2 text-slate-200" />
                <p className="text-xs">لا توجد حسابات</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Financial Summary */}
        <Card className="border shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-emerald-50 flex items-center justify-center">
                <Scale className="h-4 w-4 text-emerald-600" />
              </div>
              <CardTitle className="text-sm font-semibold">الملخص المالي</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Total Debit */}
              <div className="p-4 rounded-xl bg-orange-50 border border-orange-100">
                <p className="text-sm text-orange-600 font-medium">إجمالي المدين</p>
                <p className="text-2xl font-bold text-slate-900 mt-1" dir="ltr">{formatCurrency(data.totalDebit)}</p>
                <p className="text-[10px] text-slate-400 mt-1">من القيود المرحلة</p>
              </div>
              {/* Total Credit */}
              <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-100">
                <p className="text-sm text-emerald-600 font-medium">إجمالي الدائن</p>
                <p className="text-2xl font-bold text-slate-900 mt-1" dir="ltr">{formatCurrency(data.totalCredit)}</p>
                <p className="text-[10px] text-slate-400 mt-1">من القيود المرحلة</p>
              </div>
            </div>
            {/* Balance indicator */}
            <div className={cn(
              'mt-4 p-3 rounded-lg border flex items-center gap-3',
              Math.abs(data.totalDebit - data.totalCredit) < 0.01
                ? 'bg-emerald-50 border-emerald-200'
                : 'bg-red-50 border-red-200'
            )}>
              {Math.abs(data.totalDebit - data.totalCredit) < 0.01 ? (
                <>
                  <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-emerald-700">الدفاتر متوازنة</p>
                    <p className="text-[10px] text-emerald-500">المدين = الدائن</p>
                  </div>
                </>
              ) : (
                <>
                  <AlertTriangle className="h-5 w-5 text-red-600 shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-red-700">خلل في التوازن</p>
                    <p className="text-[10px] text-red-500" dir="ltr">
                      الفرق: {formatCurrency(Math.abs(data.totalDebit - data.totalCredit))}
                    </p>
                  </div>
                </>
              )}
            </div>

            {/* Entries status summary */}
            <div className="mt-4 grid grid-cols-3 gap-2">
              <div className="text-center p-2 rounded-lg bg-yellow-50 border border-yellow-100">
                <p className="text-lg font-bold text-yellow-700">{data.draftEntries}</p>
                <p className="text-[10px] text-yellow-500">مسودة</p>
              </div>
              <div className="text-center p-2 rounded-lg bg-green-50 border border-green-100">
                <p className="text-lg font-bold text-green-700">{data.postedEntries}</p>
                <p className="text-[10px] text-green-500">مرحل</p>
              </div>
              <div className="text-center p-2 rounded-lg bg-gray-50 border border-gray-100">
                <p className="text-lg font-bold text-gray-500">{data.reversedEntries}</p>
                <p className="text-[10px] text-gray-400">معكوس</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Recent Journal Entries + Top Accounts ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Recent Journal Entries */}
        <Card className="border shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-emerald-50 flex items-center justify-center">
                  <BookOpen className="h-4 w-4 text-emerald-600" />
                </div>
                <CardTitle className="text-sm font-semibold">آخر القيود اليومية</CardTitle>
              </div>
              <button onClick={() => setView('journal-entries')} className="text-xs text-emerald-600 hover:text-emerald-700 font-medium">
                عرض الكل ←
              </button>
            </div>
          </CardHeader>
          <CardContent>
            {data.recentEntries.length > 0 ? (
              <div className="space-y-2 max-h-72 overflow-y-auto">
                {data.recentEntries.map((entry) => (
                  <div key={entry.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50 transition-colors">
                    <div className="h-8 w-8 rounded-lg bg-emerald-50 flex items-center justify-center shrink-0">
                      <BookOpen className="h-4 w-4 text-emerald-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-slate-700 truncate">{entry.number}</p>
                        <Badge variant="outline" className={cn('text-[9px] px-1.5 py-0 border-0', getStatusColor(entry.status))}>
                          {getStatusLabel(entry.status)}
                        </Badge>
                      </div>
                      <p className="text-[10px] text-slate-400 truncate">
                        {entry.description || getSourceLabel(entry.sourceType)} • {formatDate(entry.date)}
                      </p>
                    </div>
                    <div className="text-left">
                      <p className="text-xs font-mono text-slate-600" dir="ltr">
                        {formatCurrency(entry.totalDebit)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-32 text-slate-400">
                <BookOpen className="h-8 w-8 mb-2 text-slate-200" />
                <p className="text-xs">لا توجد قيود</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Top Accounts by Movement */}
        <Card className="border shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-orange-50 flex items-center justify-center">
                  <ArrowRightLeft className="h-4 w-4 text-orange-600" />
                </div>
                <CardTitle className="text-sm font-semibold">أكثر الحسابات حركة</CardTitle>
              </div>
              <button onClick={() => setView('chart-of-accounts')} className="text-xs text-orange-600 hover:text-orange-700 font-medium">
                عرض الكل ←
              </button>
            </div>
          </CardHeader>
          <CardContent>
            {data.topAccounts.length > 0 ? (
              <div className="space-y-2 max-h-72 overflow-y-auto">
                {data.topAccounts.map((account, i) => {
                  const maxVal = data.topAccounts[0]?.totalDebit || 1
                  const pct = Math.round((account.totalDebit / maxVal) * 100)
                  const colors = ['bg-cyan-400', 'bg-emerald-400', 'bg-orange-400', 'bg-purple-400', 'bg-teal-400', 'bg-amber-400', 'bg-rose-400', 'bg-lime-400']
                  return (
                    <div key={account.accountId} className="flex items-center gap-3">
                      <span className="text-xs font-mono text-slate-400 w-4">{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="font-mono text-xs text-slate-500 shrink-0" dir="ltr">{account.code}</span>
                            <p className="text-sm font-medium text-slate-700 truncate">{account.nameAr}</p>
                          </div>
                          <span className="text-xs font-semibold text-slate-600 whitespace-nowrap ltr:ml-2 rtl:mr-2" dir="ltr">
                            {formatCurrency(account.totalDebit)}
                          </span>
                        </div>
                        <div className="mt-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className={cn('h-full rounded-full transition-all duration-500', colors[i % colors.length])}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <Badge variant="outline" className={cn('text-[9px] px-1.5 py-0 border-0', accountTypeBgColors[account.type] || 'bg-slate-50', accountTypeColors[account.type] || 'text-slate-600')}>
                            {getAccountTypeLabel(account.type)}
                          </Badge>
                          <span className="text-[10px] text-slate-400">{account.movementCount} حركة</span>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-32 text-slate-400">
                <ArrowRightLeft className="h-8 w-8 mb-2 text-slate-200" />
                <p className="text-xs">لا توجد حركات</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Monthly Activity ── */}
      <Card className="border shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-teal-50 flex items-center justify-center">
              <TrendingUp className="h-4 w-4 text-teal-600" />
            </div>
            <CardTitle className="text-sm font-semibold">النشاط الشهري للقيود</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          {data.monthlyEntries.length > 0 ? (
            <div className="space-y-3">
              {data.monthlyEntries.map((me) => {
                const maxAmount = Math.max(...data.monthlyEntries.map(m => Math.max(m.totalDebit, m.totalCredit)), 1)
                const debitPct = Math.round((me.totalDebit / maxAmount) * 100)
                const creditPct = Math.round((me.totalCredit / maxAmount) * 100)
                return (
                  <div key={me.month}>
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-sm font-medium text-slate-700">{getMonthLabel(me.month)}</p>
                      <div className="flex items-center gap-3">
                        <span className="text-[10px] text-slate-400">{me.entryCount} قيد</span>
                        <div className="flex items-center gap-2 text-xs">
                          <span className="text-orange-500 font-medium" dir="ltr">
                            م: {formatCurrency(me.totalDebit)}
                          </span>
                          <span className="text-emerald-500 font-medium" dir="ltr">
                            د: {formatCurrency(me.totalCredit)}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-orange-400 rounded-full transition-all duration-500"
                          style={{ width: `${debitPct}%` }}
                        />
                      </div>
                      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-emerald-400 rounded-full transition-all duration-500"
                          style={{ width: `${creditPct}%` }}
                        />
                      </div>
                    </div>
                  </div>
                )
              })}
              <div className="flex items-center gap-4 mt-3 pt-3 border-t text-[10px]">
                <div className="flex items-center gap-1">
                  <div className="h-2 w-2 rounded-full bg-orange-400" />
                  <span className="text-slate-500">مدين</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="h-2 w-2 rounded-full bg-emerald-400" />
                  <span className="text-slate-500">دائن</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-32 text-slate-400">
              <TrendingUp className="h-8 w-8 mb-2 text-slate-200" />
              <p className="text-xs">لا توجد بيانات شهرية</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
