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
  Users, ClipboardCheck, FileText, ShoppingCart, Receipt,
  TrendingUp, AlertTriangle, ArrowRight, Loader2, Undo2,
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

interface TopCustomer {
  customerId: string
  customerName: string
  totalAmount: number
  invoiceCount: number
}

interface RecentOrder {
  id: string
  number: string
  customerName: string
  date: string
  totalAmount: number
  status: string
}

interface RecentInvoice {
  id: string
  number: string
  customerName: string
  date: string
  totalAmount: number
  status: string
  balanceDue: number
}

interface MonthlySale {
  month: string
  totalAmount: number
  invoiceCount: number
}

interface AnalyticsData {
  customerCount: number
  activeCustomerCount: number
  totalSalesOrders: number
  pendingSalesOrders: number
  confirmedSalesOrders: number
  totalSalesInvoices: number
  pendingSalesInvoices: number
  totalSalesAmount: number
  totalPaidAmount: number
  totalBalanceDue: number
  recentOrders: RecentOrder[]
  recentInvoices: RecentInvoice[]
  topCustomers: TopCustomer[]
  monthlySales: MonthlySale[]
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

export default function SalesDashboard() {
  const companyId = useAppStore((s) => s.currentCompanyId)
  const setView = useAppStore((s) => s.setView)
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    if (!companyId) return
    try {
      const res = await fetch(`/api/sales/analytics?companyId=${companyId}`)
      if (res.ok) setData(await res.json())
    } catch {
      toast.error('فشل في تحميل تحليلات المبيعات')
    } finally {
      setLoading(false)
    }
  }, [companyId])

  useEffect(() => { fetchData() }, [fetchData])

  // ── Quick Actions ──
  const quickActions: QuickAction[] = [
    { id: 'customers', label: 'العملاء', description: 'إدارة العملاء', icon: Users, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200', viewId: 'customers' },
    { id: 'new-order', label: 'أمر بيع جديد', description: 'إنشاء أمر بيع', icon: ClipboardCheck, color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200', viewId: 'sales-order-form' },
    { id: 'new-invoice', label: 'فاتورة بيع جديدة', description: 'إنشاء فاتورة بيع', icon: FileText, color: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-200', viewId: 'sales-invoice-form' },
    { id: 'orders', label: 'أوامر البيع', description: 'عرض أوامر البيع', icon: ShoppingCart, color: 'text-teal-600', bg: 'bg-teal-50', border: 'border-teal-200', viewId: 'sales-orders' },
    { id: 'invoices', label: 'فواتير البيع', description: 'عرض فواتير البيع', icon: Receipt, color: 'text-purple-600', bg: 'bg-purple-50', border: 'border-purple-200', viewId: 'sales-invoices' },
    { id: 'sales-returns', label: 'مرتجعات المبيعات', description: 'عرض المرتجعات', icon: Undo2, color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-200', viewId: 'sales-returns' },
  ]

  // ── Stat Cards Definition ──
  const statCards = [
    { key: 'totalSalesAmount', label: 'إجمالي المبيعات', icon: TrendingUp, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200', isCurrency: true },
    { key: 'customerCount', label: 'العملاء', icon: Users, color: 'text-teal-600', bg: 'bg-teal-50', border: 'border-teal-200', isCurrency: false },
    { key: 'pendingSalesOrders', label: 'أوامر بيع معلقة', icon: ClipboardCheck, color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200', isCurrency: false, isAlert: true },
    { key: 'pendingSalesInvoices', label: 'فواتير معلقة', icon: FileText, color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-200', isCurrency: false, isAlert: true },
  ] as const

  const statValues: Record<string, number> = data ? {
    totalSalesAmount: data.totalSalesAmount,
    customerCount: data.customerCount,
    pendingSalesOrders: data.pendingSalesOrders,
    pendingSalesInvoices: data.pendingSalesInvoices,
  } : {}

  // ── Monthly sales bar colors ──
  const barColors = ['bg-emerald-400', 'bg-teal-400', 'bg-amber-400', 'bg-purple-400', 'bg-orange-400', 'bg-rose-400', 'bg-cyan-400']

  // ── Invoice status color ──
  const invoiceStatusStyles: Record<string, { color: string; bg: string; label: string }> = {
    DRAFT: { color: 'text-yellow-700', bg: 'bg-yellow-50 border-yellow-200', label: 'مسودة' },
    CONFIRMED: { color: 'text-blue-700', bg: 'bg-blue-50 border-blue-200', label: 'مؤكدة' },
    PAID: { color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200', label: 'مدفوعة' },
    PARTIAL_PAID: { color: 'text-orange-700', bg: 'bg-orange-50 border-orange-200', label: 'مدفوعة جزئياً' },
    CANCELLED: { color: 'text-red-700', bg: 'bg-red-50 border-red-200', label: 'ملغية' },
  }

  // ── Order status color ──
  const orderStatusStyles: Record<string, { color: string; bg: string; label: string }> = {
    DRAFT: { color: 'text-yellow-700', bg: 'bg-yellow-50 border-yellow-200', label: 'مسودة' },
    CONFIRMED: { color: 'text-blue-700', bg: 'bg-blue-50 border-blue-200', label: 'مؤكدة' },
    CANCELLED: { color: 'text-red-700', bg: 'bg-red-50 border-red-200', label: 'ملغية' },
    CLOSED: { color: 'text-teal-700', bg: 'bg-teal-50 border-teal-200', label: 'مغلق' },
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
        <Skeleton className="h-36 rounded-xl" />
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
                  {stat.isAlert && val > 0 && (
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
            <div className="h-9 w-9 rounded-xl bg-emerald-50 flex items-center justify-center">
              <ShoppingCart className="h-4.5 w-4.5 text-emerald-600" />
            </div>
            <CardTitle className="text-base font-semibold">اختصارات المبيعات</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {quickActions.map((action) => (
              <button
                key={action.id}
                onClick={() => setView(action.viewId)}
                className={cn(
                  'flex flex-col items-center gap-2 p-4 rounded-xl border transition-all duration-150 group',
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

      {/* ── Analytics Row: Top Customers + Recent Sales Orders ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Top Customers */}
        <Card className="border shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-emerald-50 flex items-center justify-center">
                  <Users className="h-4 w-4 text-emerald-600" />
                </div>
                <CardTitle className="text-sm font-semibold">أعلى العملاء</CardTitle>
              </div>
              <button onClick={() => setView('customers')} className="text-xs text-emerald-600 hover:text-emerald-700 font-medium">
                عرض الكل ←
              </button>
            </div>
          </CardHeader>
          <CardContent>
            {data.topCustomers.length > 0 ? (
              <div className="space-y-2 max-h-72 overflow-y-auto">
                {data.topCustomers.map((customer, i) => {
                  const maxVal = data.topCustomers[0]?.totalAmount || 1
                  const pct = Math.round((customer.totalAmount / maxVal) * 100)
                  return (
                    <div key={customer.customerId} className="flex items-center gap-3">
                      <span className="text-xs font-mono text-slate-400 w-4">{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium text-slate-700 truncate">{customer.customerName}</p>
                          <span className="text-sm font-bold text-slate-900 ltr:ml-2 rtl:mr-2 whitespace-nowrap">
                            {formatCurrency(customer.totalAmount)}
                          </span>
                        </div>
                        <div className="mt-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-emerald-400 rounded-full transition-all duration-500"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <p className="text-[10px] text-slate-400 mt-0.5">
                          {customer.invoiceCount} فاتورة
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-32 text-slate-400">
                <Users className="h-8 w-8 mb-2 text-slate-200" />
                <p className="text-xs">لا توجد بيانات</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Sales Orders */}
        <Card className="border shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-amber-50 flex items-center justify-center">
                  <ClipboardCheck className="h-4 w-4 text-amber-600" />
                </div>
                <CardTitle className="text-sm font-semibold">آخر أوامر البيع</CardTitle>
              </div>
              <button onClick={() => setView('sales-orders')} className="text-xs text-emerald-600 hover:text-emerald-700 font-medium">
                عرض الكل ←
              </button>
            </div>
          </CardHeader>
          <CardContent>
            {data.recentOrders.length > 0 ? (
              <div className="space-y-2 max-h-72 overflow-y-auto">
                {data.recentOrders.map((order) => {
                  const style = orderStatusStyles[order.status] || { color: 'text-slate-600', bg: 'bg-slate-50 border-slate-200', label: order.status }
                  return (
                    <div key={order.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50 transition-colors">
                      <div className={cn('h-8 w-8 rounded-lg flex items-center justify-center shrink-0', style.bg.split(' ')[0])}>
                        <ClipboardCheck className={cn('h-4 w-4', style.color)} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-slate-700 truncate">{order.customerName}</p>
                          <Badge variant="outline" className={cn('text-[9px] px-1.5 py-0', style.bg, style.color, 'border-0')}>
                            {style.label}
                          </Badge>
                        </div>
                        <p className="text-[10px] text-slate-400">{order.number} • {formatDate(order.date)}</p>
                      </div>
                      <div className="text-left">
                        <p className="text-sm font-mono font-semibold text-slate-700" dir="ltr">
                          {formatCurrency(order.totalAmount)}
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-32 text-slate-400">
                <ClipboardCheck className="h-8 w-8 mb-2 text-slate-200" />
                <p className="text-xs">لا توجد أوامر بيع</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Financial Summary ── */}
      <Card className="border shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-emerald-50 flex items-center justify-center">
              <TrendingUp className="h-4 w-4 text-emerald-600" />
            </div>
            <CardTitle className="text-sm font-semibold">ملخص مالي</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Total Sales */}
            <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200">
              <p className="text-sm text-emerald-600 font-medium">إجمالي المبيعات</p>
              <p className="text-2xl font-bold text-emerald-700 mt-1">{formatCurrency(data.totalSalesAmount)}</p>
            </div>
            {/* Total Paid */}
            <div className="p-4 rounded-xl bg-teal-50 border border-teal-200">
              <p className="text-sm text-teal-600 font-medium">إجمالي المحصل</p>
              <p className="text-2xl font-bold text-teal-700 mt-1">{formatCurrency(data.totalPaidAmount)}</p>
            </div>
            {/* Balance Due */}
            <div className={cn(
              'p-4 rounded-xl border',
              data.totalBalanceDue > 0
                ? 'bg-red-50 border-red-200'
                : 'bg-slate-50 border-slate-200'
            )}>
              <p className={cn(
                'text-sm font-medium',
                data.totalBalanceDue > 0 ? 'text-red-600' : 'text-slate-500'
              )}>المتبقي</p>
              <p className={cn(
                'text-2xl font-bold mt-1',
                data.totalBalanceDue > 0 ? 'text-red-700' : 'text-slate-600'
              )}>{formatCurrency(data.totalBalanceDue)}</p>
              {data.totalBalanceDue > 0 && (
                <div className="flex items-center gap-1 mt-1.5">
                  <AlertTriangle className="h-3 w-3 text-red-500" />
                  <span className="text-[10px] text-red-500 font-medium">مبالغ مستحقة</span>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Recent Invoices + Monthly Sales ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Recent Invoices */}
        <Card className="border shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-orange-50 flex items-center justify-center">
                  <FileText className="h-4 w-4 text-orange-600" />
                </div>
                <CardTitle className="text-sm font-semibold">آخر الفواتير</CardTitle>
              </div>
              <button onClick={() => setView('sales-invoices')} className="text-xs text-emerald-600 hover:text-emerald-700 font-medium">
                عرض الكل ←
              </button>
            </div>
          </CardHeader>
          <CardContent>
            {data.recentInvoices.length > 0 ? (
              <div className="space-y-2 max-h-72 overflow-y-auto">
                {data.recentInvoices.map((inv) => {
                  const style = invoiceStatusStyles[inv.status] || { color: 'text-slate-600', bg: 'bg-slate-50 border-slate-200', label: inv.status }
                  return (
                    <div key={inv.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50 transition-colors">
                      <div className={cn('h-8 w-8 rounded-lg flex items-center justify-center shrink-0', style.bg.split(' ')[0])}>
                        <FileText className={cn('h-4 w-4', style.color)} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-slate-700 truncate">{inv.customerName}</p>
                          <Badge variant="outline" className={cn('text-[9px] px-1.5 py-0', style.bg, style.color, 'border-0')}>
                            {style.label}
                          </Badge>
                        </div>
                        <p className="text-[10px] text-slate-400">{inv.number} • {formatDate(inv.date)}</p>
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
                  )
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-32 text-slate-400">
                <FileText className="h-8 w-8 mb-2 text-slate-200" />
                <p className="text-xs">لا توجد فواتير</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Monthly Sales */}
        <Card className="border shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-purple-50 flex items-center justify-center">
                <TrendingUp className="h-4 w-4 text-purple-600" />
              </div>
              <CardTitle className="text-sm font-semibold">المبيعات الشهرية</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {data.monthlySales.length > 0 ? (
              <div className="space-y-3 max-h-72 overflow-y-auto">
                {data.monthlySales.map((ms, i) => {
                  const maxVal = Math.max(...data.monthlySales.map(m => m.totalAmount), 1)
                  const pct = Math.round((ms.totalAmount / maxVal) * 100)
                  const colorIdx = i % barColors.length
                  // Format month label
                  const [year, month] = ms.month.split('-')
                  const monthNames = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر']
                  const monthLabel = `${monthNames[parseInt(month) - 1]} ${year}`
                  return (
                    <div key={ms.month}>
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-sm font-medium text-slate-700">{monthLabel}</p>
                        <div className="flex items-center gap-3">
                          <span className="text-[10px] text-slate-400">{ms.invoiceCount} فاتورة</span>
                          <span className="text-xs font-semibold text-slate-600">
                            {formatCurrency(ms.totalAmount)}
                          </span>
                        </div>
                      </div>
                      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className={cn('h-full rounded-full transition-all duration-500', barColors[colorIdx])}
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
                <p className="text-xs">لا توجد بيانات مبيعات شهرية</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
