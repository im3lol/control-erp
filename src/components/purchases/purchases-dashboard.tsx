'use client'

import { useState, useEffect, useCallback, type ElementType } from 'react'
import { toast } from 'sonner'
import { useAppStore } from '@/lib/store'
import { formatCurrency, formatDate, getStatusColor, getStatusLabel } from '@/lib/erp-utils'
import { cn } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Building2, ClipboardList, FileText, PackageCheck, Receipt,
  TrendingUp, AlertTriangle, ArrowRight, Loader2,
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

interface AnalyticsData {
  supplierCount: number
  activeSupplierCount: number
  totalPurchaseOrders: number
  pendingPurchaseOrders: number
  confirmedPurchaseOrders: number
  totalPurchaseInvoices: number
  pendingPurchaseInvoices: number
  totalPurchaseAmount: number
  totalPaidAmount: number
  totalBalanceDue: number
  recentOrders: Array<{
    id: string; number: string; supplierName: string
    date: string; totalAmount: number; status: string
  }>
  recentInvoices: Array<{
    id: string; number: string; supplierName: string
    date: string; totalAmount: number; status: string; balanceDue: number
  }>
  topSuppliers: Array<{
    supplierId: string; supplierName: string
    totalAmount: number; invoiceCount: number
  }>
  monthlyPurchases: Array<{
    month: string; totalAmount: number; invoiceCount: number
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

// ─── Component ────────────────────────────────────────────────────────────────

export default function PurchasesDashboard() {
  const companyId = useAppStore((s) => s.currentCompanyId)
  const setView = useAppStore((s) => s.setView)
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    if (!companyId) return
    try {
      const res = await fetch(`/api/purchases/analytics?companyId=${companyId}`)
      if (res.ok) setData(await res.json())
    } catch {
      toast.error('فشل في تحميل تحليلات المشتريات')
    } finally {
      setLoading(false)
    }
  }, [companyId])

  useEffect(() => { fetchData() }, [fetchData])

  // ── Quick Actions ──
  const quickActions: QuickAction[] = [
    { id: 'suppliers', label: 'الموردين', description: 'إدارة الموردين', icon: Building2, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200', viewId: 'suppliers' },
    { id: 'purchase-order-form', label: 'أمر شراء جديد', description: 'إنشاء أمر شراء', icon: ClipboardList, color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200', viewId: 'purchase-order-form' },
    { id: 'purchase-invoice-form', label: 'فاتورة شراء جديدة', description: 'إنشاء فاتورة شراء', icon: FileText, color: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-200', viewId: 'purchase-invoice-form' },
    { id: 'purchase-orders', label: 'أوامر الشراء', description: 'عرض أوامر الشراء', icon: PackageCheck, color: 'text-teal-600', bg: 'bg-teal-50', border: 'border-teal-200', viewId: 'purchase-orders' },
    { id: 'purchase-invoices', label: 'فواتير الشراء', description: 'عرض فواتير الشراء', icon: Receipt, color: 'text-purple-600', bg: 'bg-purple-50', border: 'border-purple-200', viewId: 'purchase-invoices' },
  ]

  // ── Stat Cards Definition ──
  const statCards = [
    { key: 'totalPurchaseAmount', label: 'إجمالي المشتريات', icon: TrendingUp, color: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-200', isCurrency: true },
    { key: 'supplierCount', label: 'الموردين', icon: Building2, color: 'text-purple-600', bg: 'bg-purple-50', border: 'border-purple-200', isCurrency: false },
    { key: 'pendingPurchaseOrders', label: 'أوامر شراء معلقة', icon: ClipboardList, color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200', isCurrency: false },
    { key: 'pendingPurchaseInvoices', label: 'فواتير معلقة', icon: FileText, color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-200', isCurrency: false },
  ] as const

  const statValues: Record<string, number> = data ? {
    totalPurchaseAmount: data.totalPurchaseAmount,
    supplierCount: data.supplierCount,
    pendingPurchaseOrders: data.pendingPurchaseOrders,
    pendingPurchaseInvoices: data.pendingPurchaseInvoices,
  } : {}

  // ── Month label helper ──
  const getMonthLabel = (monthKey: string): string => {
    const [year, month] = monthKey.split('-')
    const d = new Date(Number(year), Number(month) - 1, 1)
    return new Intl.DateTimeFormat('ar-EG', { month: 'short', year: '2-digit' }).format(d)
  }

  // ── Status badge colors for purchase orders ──
  const getOrderStatusColor = (status: string): string => {
    const colors: Record<string, string> = {
      DRAFT: 'bg-yellow-100 text-yellow-800',
      CONFIRMED: 'bg-blue-100 text-blue-800',
      CANCELLED: 'bg-red-100 text-red-800',
      CLOSED: 'bg-teal-100 text-teal-800',
    }
    return colors[status] || 'bg-gray-100 text-gray-800'
  }

  const getOrderStatusLabel = (status: string): string => {
    const labels: Record<string, string> = {
      DRAFT: 'مسودة',
      CONFIRMED: 'مؤكدة',
      CANCELLED: 'ملغية',
      CLOSED: 'مغلق',
    }
    return labels[status] || status
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
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Skeleton className="h-72 rounded-xl" />
          <Skeleton className="h-72 rounded-xl" />
        </div>
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
                  {(stat.key === 'pendingPurchaseOrders' && val > 0) && (
                    <Badge className="bg-amber-100 text-amber-700 border-amber-200 animate-pulse">
                      تنبيه
                    </Badge>
                  )}
                  {(stat.key === 'pendingPurchaseInvoices' && val > 0) && (
                    <Badge className="bg-red-100 text-red-700 border-red-200 animate-pulse">
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
            <div className="h-9 w-9 rounded-xl bg-orange-50 flex items-center justify-center">
              <ClipboardList className="h-4.5 w-4.5 text-orange-600" />
            </div>
            <CardTitle className="text-base font-semibold">اختصارات المشتريات</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {quickActions.map((action) => (
              <button
                key={action.id}
                onClick={() => setView(action.viewId)}
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

      {/* ── Analytics Row: Top Suppliers + Recent Purchase Orders ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Top Suppliers */}
        <Card className="border shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-orange-50 flex items-center justify-center">
                  <Building2 className="h-4 w-4 text-orange-600" />
                </div>
                <CardTitle className="text-sm font-semibold">أعلى الموردين</CardTitle>
              </div>
              <button onClick={() => setView('suppliers')} className="text-xs text-orange-600 hover:text-orange-700 font-medium">
                عرض الكل ←
              </button>
            </div>
          </CardHeader>
          <CardContent>
            {data.topSuppliers.length > 0 ? (
              <div className="space-y-2 max-h-72 overflow-y-auto">
                {data.topSuppliers.map((supplier, i) => {
                  const maxVal = data.topSuppliers[0]?.totalAmount || 1
                  const pct = Math.round((supplier.totalAmount / maxVal) * 100)
                  const colors = ['bg-orange-400', 'bg-purple-400', 'bg-teal-400', 'bg-amber-400', 'bg-emerald-400', 'bg-rose-400', 'bg-cyan-400', 'bg-indigo-400']
                  const colorIdx = i % colors.length
                  return (
                    <div key={supplier.supplierId} className="flex items-center gap-3">
                      <span className="text-xs font-mono text-slate-400 w-4">{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium text-slate-700 truncate">{supplier.supplierName}</p>
                          <span className="text-sm font-bold text-slate-900 ltr:ml-2 rtl:mr-2 whitespace-nowrap">
                            {formatCurrency(supplier.totalAmount)}
                          </span>
                        </div>
                        <div className="mt-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className={cn('h-full rounded-full transition-all duration-500', colors[colorIdx])}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <p className="text-[10px] text-slate-400 mt-0.5">
                          {supplier.invoiceCount} فاتورة
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-32 text-slate-400">
                <Building2 className="h-8 w-8 mb-2 text-slate-200" />
                <p className="text-xs">لا توجد بيانات</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Purchase Orders */}
        <Card className="border shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-amber-50 flex items-center justify-center">
                  <ClipboardList className="h-4 w-4 text-amber-600" />
                </div>
                <CardTitle className="text-sm font-semibold">آخر أوامر الشراء</CardTitle>
              </div>
              <button onClick={() => setView('purchase-orders')} className="text-xs text-amber-600 hover:text-amber-700 font-medium">
                عرض الكل ←
              </button>
            </div>
          </CardHeader>
          <CardContent>
            {data.recentOrders.length > 0 ? (
              <div className="space-y-2 max-h-72 overflow-y-auto">
                {data.recentOrders.map((order) => (
                  <div key={order.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50 transition-colors">
                    <div className="h-8 w-8 rounded-lg bg-amber-50 flex items-center justify-center shrink-0">
                      <ClipboardList className="h-4 w-4 text-amber-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-slate-700 truncate">{order.number}</p>
                        <Badge variant="outline" className={cn('text-[9px] px-1.5 py-0 border-0', getOrderStatusColor(order.status))}>
                          {getOrderStatusLabel(order.status)}
                        </Badge>
                      </div>
                      <p className="text-[10px] text-slate-400">{order.supplierName} • {formatDate(order.date)}</p>
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-mono font-semibold text-slate-700" dir="ltr">
                        {formatCurrency(order.totalAmount)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-32 text-slate-400">
                <ClipboardList className="h-8 w-8 mb-2 text-slate-200" />
                <p className="text-xs">لا توجد أوامر شراء</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Financial Summary Card ── */}
      <Card className="border shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-orange-50 flex items-center justify-center">
              <TrendingUp className="h-4 w-4 text-orange-600" />
            </div>
            <CardTitle className="text-sm font-semibold">الملخص المالي</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Total Purchase Amount */}
            <div className="p-4 rounded-xl bg-orange-50 border border-orange-100">
              <p className="text-sm text-orange-600 font-medium">إجمالي المشتريات</p>
              <p className="text-2xl font-bold text-slate-900 mt-1">{formatCurrency(data.totalPurchaseAmount)}</p>
              <p className="text-[10px] text-slate-400 mt-1">إجمالي الفواتير المؤكدة</p>
            </div>
            {/* Total Paid */}
            <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-100">
              <p className="text-sm text-emerald-600 font-medium">إجمالي المدفوع</p>
              <p className="text-2xl font-bold text-slate-900 mt-1">{formatCurrency(data.totalPaidAmount)}</p>
              <div className="mt-1 h-1.5 bg-emerald-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-400 rounded-full transition-all duration-500"
                  style={{ width: `${data.totalPurchaseAmount > 0 ? Math.round((data.totalPaidAmount / data.totalPurchaseAmount) * 100) : 100}%` }}
                />
              </div>
              <p className="text-[10px] text-slate-400 mt-1">
                {data.totalPurchaseAmount > 0
                  ? `${Math.round((data.totalPaidAmount / data.totalPurchaseAmount) * 100)}% من الإجمالي`
                  : 'لا توجد مشتريات'
                }
              </p>
            </div>
            {/* Balance Due */}
            <div className={cn(
              'p-4 rounded-xl border',
              data.totalBalanceDue > 0 ? 'bg-red-50 border-red-100' : 'bg-slate-50 border-slate-100'
            )}>
              <p className={cn(
                'text-sm font-medium',
                data.totalBalanceDue > 0 ? 'text-red-600' : 'text-slate-500'
              )}>المتبقي</p>
              <p className={cn(
                'text-2xl font-bold mt-1',
                data.totalBalanceDue > 0 ? 'text-red-700' : 'text-slate-900'
              )}>{formatCurrency(data.totalBalanceDue)}</p>
              {data.totalBalanceDue > 0 ? (
                <div className="flex items-center gap-1 mt-1">
                  <AlertTriangle className="h-3 w-3 text-red-500" />
                  <p className="text-[10px] text-red-500">مبالغ مستحقة الدفع</p>
                </div>
              ) : (
                <p className="text-[10px] text-slate-400 mt-1">جميع المبالغ مدفوعة ✓</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Recent Invoices + Monthly Purchases ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Recent Invoices */}
        <Card className="border shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-purple-50 flex items-center justify-center">
                  <Receipt className="h-4 w-4 text-purple-600" />
                </div>
                <CardTitle className="text-sm font-semibold">آخر الفواتير</CardTitle>
              </div>
              <button onClick={() => setView('purchase-invoices')} className="text-xs text-purple-600 hover:text-purple-700 font-medium">
                عرض الكل ←
              </button>
            </div>
          </CardHeader>
          <CardContent>
            {data.recentInvoices.length > 0 ? (
              <div className="space-y-2 max-h-72 overflow-y-auto">
                {data.recentInvoices.map((inv) => (
                  <div key={inv.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50 transition-colors">
                    <div className="h-8 w-8 rounded-lg bg-purple-50 flex items-center justify-center shrink-0">
                      <Receipt className="h-4 w-4 text-purple-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-slate-700 truncate">{inv.number}</p>
                        <Badge variant="outline" className={cn('text-[9px] px-1.5 py-0 border-0', getStatusColor(inv.status))}>
                          {getStatusLabel(inv.status)}
                        </Badge>
                      </div>
                      <p className="text-[10px] text-slate-400">{inv.supplierName} • {formatDate(inv.date)}</p>
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-mono font-semibold text-slate-700" dir="ltr">
                        {formatCurrency(inv.totalAmount)}
                      </p>
                      {inv.balanceDue > 0 && (
                        <p className="text-[10px] text-red-500 font-medium" dir="ltr">
                          متبقي: {formatCurrency(inv.balanceDue)}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-32 text-slate-400">
                <Receipt className="h-8 w-8 mb-2 text-slate-200" />
                <p className="text-xs">لا توجد فواتير</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Monthly Purchases */}
        <Card className="border shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-teal-50 flex items-center justify-center">
                <TrendingUp className="h-4 w-4 text-teal-600" />
              </div>
              <CardTitle className="text-sm font-semibold">المشتريات الشهرية</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {data.monthlyPurchases.length > 0 ? (
              <div className="space-y-2 max-h-72 overflow-y-auto">
                {data.monthlyPurchases.map((mp) => {
                  const maxAmount = Math.max(...data.monthlyPurchases.map(m => m.totalAmount), 1)
                  const pct = Math.round((mp.totalAmount / maxAmount) * 100)
                  return (
                    <div key={mp.month}>
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-sm font-medium text-slate-700">{getMonthLabel(mp.month)}</p>
                        <div className="flex items-center gap-3">
                          <span className="text-[10px] text-slate-400">{mp.invoiceCount} فاتورة</span>
                          <span className="text-xs font-semibold text-slate-600">
                            {formatCurrency(mp.totalAmount)}
                          </span>
                        </div>
                      </div>
                      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-teal-400 rounded-full transition-all duration-500"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  )
                })}
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
    </div>
  )
}
