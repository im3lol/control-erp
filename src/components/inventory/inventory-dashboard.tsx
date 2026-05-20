'use client'

import { useState, useEffect, useCallback, type ElementType } from 'react'
import { toast } from 'sonner'
import { useAppStore } from '@/lib/store'
import { formatCurrency, formatDate } from '@/lib/erp-utils'
import { cn } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Warehouse, Package, Tags, TrendingUp, AlertTriangle,
  ArrowLeftRight, ClipboardList, Truck, PackageCheck, ClipboardCheck,
  ArrowDownCircle, ArrowUpCircle, ArrowRightLeft,
  LayoutGrid, ChevronLeft, BarChart3,
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

interface AnalyticsData {
  warehouseCount: number
  itemCount: number
  categoryCount: number
  totalStockValue: number
  totalItemsInStock: number
  uniqueItemsInStock: number
  lowStockAlerts: Array<{
    itemId: string; itemCode: string; itemName: string
    currentQty: number; minStock: number; warehouse: string; uom?: string
  }>
  pendingActions: {
    materialRequests: number; deliveryNotes: number; pickLists: number
    stockTransfers: number; purchaseReceipts: number; total: number
  }
  topItemsByValue: Array<{
    itemId: string; itemCode: string; itemName: string
    quantity: number; avgCost: number; totalValue: number; uom?: string
  }>
  categoryDistribution: Array<{
    id: string; name: string; count: number; value: number
  }>
  warehouseDistribution: Array<{
    warehouseId: string; warehouseName: string
    totalQuantity: number; itemCount: number; totalValue: number
  }>
  recentMovements: Array<{
    id: string; type: string; number: string; date: string
    itemName: string; itemCode: string; warehouse: string
    quantity: number; unitCost: number; totalCost: number
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
  badge?: number
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function InventoryDashboard() {
  const companyId = useAppStore((s) => s.currentCompanyId)
  const setView = useAppStore((s) => s.setView)
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    if (!companyId) return
    try {
      const res = await fetch(`/api/inventory/analytics?companyId=${companyId}`)
      if (res.ok) setData(await res.json())
    } catch {
      toast.error('فشل في تحميل تحليلات المخزون')
    } finally {
      setLoading(false)
    }
  }, [companyId])

  useEffect(() => { fetchData() }, [fetchData])

  // ── Quick Actions ──
  const quickActions: QuickAction[] = [
    { id: 'warehouses', label: 'المخازن', description: 'إدارة المخازن والمناطق', icon: Warehouse, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200', viewId: 'warehouses' },
    { id: 'items', label: 'الأصناف', description: 'إدارة الأصناف والمنتجات', icon: Package, color: 'text-teal-600', bg: 'bg-teal-50', border: 'border-teal-200', viewId: 'items' },
    { id: 'categories', label: 'الفئات', description: 'تصنيف الأصناف', icon: Tags, color: 'text-purple-600', bg: 'bg-purple-50', border: 'border-purple-200', viewId: 'categories' },
    { id: 'material-requests', label: 'طلب مواد', description: 'إنشاء طلب مواد جديد', icon: ClipboardList, color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200', viewId: 'material-requests', badge: data?.pendingActions.materialRequests },
    { id: 'stock-transfers', label: 'تحويل مخزون', description: 'تحويل بين المخازن', icon: ArrowRightLeft, color: 'text-cyan-600', bg: 'bg-cyan-50', border: 'border-cyan-200', viewId: 'stock-transfers', badge: data?.pendingActions.stockTransfers },
    { id: 'delivery-notes', label: 'إذن صرف', description: 'إذن صرف مرتبط بالبيع', icon: Truck, color: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-200', viewId: 'delivery-notes', badge: data?.pendingActions.deliveryNotes },
    { id: 'purchase-receipts', label: 'إذن استلام', description: 'إذن استلام مشتريات', icon: PackageCheck, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200', viewId: 'purchase-receipts', badge: data?.pendingActions.purchaseReceipts },
    { id: 'pick-lists', label: 'قائمة تحضير', description: 'تحضير الطلبات المعلقة', icon: ClipboardCheck, color: 'text-rose-600', bg: 'bg-rose-50', border: 'border-rose-200', viewId: 'pick-lists', badge: data?.pendingActions.pickLists },
    { id: 'stock-movements', label: 'حركات المخزن', description: 'سجل الحركات', icon: ArrowLeftRight, color: 'text-slate-600', bg: 'bg-slate-50', border: 'border-slate-200', viewId: 'stock-movements' },
    { id: 'item-balances', label: 'أرصدة الأصناف', description: 'رصيد كل صنف', icon: BarChart3, color: 'text-indigo-600', bg: 'bg-indigo-50', border: 'border-indigo-200', viewId: 'item-balances' },
  ]

  // ── Stat Cards Definition ──
  const statCards = [
    { key: 'totalStockValue', label: 'قيمة المخزون', icon: TrendingUp, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200', isCurrency: true },
    { key: 'uniqueItemsInStock', label: 'أصناف بالمخزون', icon: Package, color: 'text-teal-600', bg: 'bg-teal-50', border: 'border-teal-200', isCurrency: false },
    { key: 'warehouseCount', label: 'عدد المخازن', icon: Warehouse, color: 'text-purple-600', bg: 'bg-purple-50', border: 'border-purple-200', isCurrency: false },
    { key: 'lowStockAlerts', label: 'أصناف ناقصة', icon: AlertTriangle, color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-200', isCurrency: false, isAlert: true },
  ] as const

  const statValues: Record<string, number> = data ? {
    totalStockValue: data.totalStockValue,
    uniqueItemsInStock: data.uniqueItemsInStock,
    warehouseCount: data.warehouseCount,
    lowStockAlerts: data.lowStockAlerts.length,
  } : {}

  // ── Movement type styling ──
  const movementStyles: Record<string, { icon: ElementType; color: string; bg: string; label: string }> = {
    IN: { icon: ArrowDownCircle, color: 'text-emerald-600', bg: 'bg-emerald-50', label: 'وارد' },
    OUT: { icon: ArrowUpCircle, color: 'text-orange-600', bg: 'bg-orange-50', label: 'صادر' },
    ADJ: { icon: ArrowRightLeft, color: 'text-slate-600', bg: 'bg-slate-50', label: 'تسوية' },
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
          {Array.from({ length: 10 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
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

      {/* ── Pending Actions Banner ── */}
      {data.pendingActions.total > 0 && (
        <Card className="border-amber-200 bg-gradient-to-l from-amber-50 to-amber-25 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-amber-100">
                <AlertTriangle className="h-5 w-5 text-amber-600" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-amber-800">
                  إجراءات معلقة ({data.pendingActions.total})
                </p>
                <div className="flex flex-wrap gap-2 mt-1.5">
                  {data.pendingActions.materialRequests > 0 && (
                    <button onClick={() => setView('material-requests')} className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full hover:bg-amber-200 transition-colors">
                      {data.pendingActions.materialRequests} طلب مواد
                    </button>
                  )}
                  {data.pendingActions.deliveryNotes > 0 && (
                    <button onClick={() => setView('delivery-notes')} className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full hover:bg-amber-200 transition-colors">
                      {data.pendingActions.deliveryNotes} إذن صرف
                    </button>
                  )}
                  {data.pendingActions.pickLists > 0 && (
                    <button onClick={() => setView('pick-lists')} className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full hover:bg-amber-200 transition-colors">
                      {data.pendingActions.pickLists} قائمة تحضير
                    </button>
                  )}
                  {data.pendingActions.stockTransfers > 0 && (
                    <button onClick={() => setView('stock-transfers')} className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full hover:bg-amber-200 transition-colors">
                      {data.pendingActions.stockTransfers} تحويل
                    </button>
                  )}
                  {data.pendingActions.purchaseReceipts > 0 && (
                    <button onClick={() => setView('purchase-receipts')} className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full hover:bg-amber-200 transition-colors">
                      {data.pendingActions.purchaseReceipts} إذن استلام
                    </button>
                  )}
                </div>
              </div>
              <ChevronLeft className="h-4 w-4 text-amber-400" />
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Quick Actions / Shortcuts ── */}
      <Card className="border shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-emerald-50 flex items-center justify-center">
              <LayoutGrid className="h-4.5 w-4.5 text-emerald-600" />
            </div>
            <CardTitle className="text-base font-semibold">اختصارات المخازن</CardTitle>
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
                {action.badge !== undefined && action.badge > 0 && (
                  <span className="absolute top-2 left-2 min-w-[20px] h-5 flex items-center justify-center bg-red-500 text-white text-[10px] font-bold rounded-full px-1">
                    {action.badge}
                  </span>
                )}
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

      {/* ── Analytics Row ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Top Items by Value */}
        <Card className="border shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-emerald-50 flex items-center justify-center">
                  <TrendingUp className="h-4 w-4 text-emerald-600" />
                </div>
                <CardTitle className="text-sm font-semibold">أعلى الأصناف قيمة</CardTitle>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {data.topItemsByValue.length > 0 ? (
              <div className="space-y-2 max-h-72 overflow-y-auto">
                {data.topItemsByValue.map((item, i) => {
                  const maxVal = data.topItemsByValue[0]?.totalValue || 1
                  const pct = Math.round((item.totalValue / maxVal) * 100)
                  return (
                    <div key={item.itemId} className="flex items-center gap-3">
                      <span className="text-xs font-mono text-slate-400 w-4">{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium text-slate-700 truncate">{item.itemName}</p>
                          <span className="text-sm font-bold text-slate-900 ltr:ml-2 rtl:mr-2 whitespace-nowrap">
                            {formatCurrency(item.totalValue)}
                          </span>
                        </div>
                        <div className="mt-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-emerald-400 rounded-full transition-all duration-500"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <p className="text-[10px] text-slate-400 mt-0.5">
                          {item.quantity.toLocaleString('ar-EG')} {item.uom || ''} × {formatCurrency(item.avgCost)}
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-32 text-slate-400">
                <Package className="h-8 w-8 mb-2 text-slate-200" />
                <p className="text-xs">لا توجد بيانات</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Warehouse Distribution */}
        <Card className="border shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-purple-50 flex items-center justify-center">
                <Warehouse className="h-4 w-4 text-purple-600" />
              </div>
              <CardTitle className="text-sm font-semibold">توزيع المخزون</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {data.warehouseDistribution.length > 0 ? (
              <div className="space-y-3 max-h-72 overflow-y-auto">
                {data.warehouseDistribution.map((wh) => {
                  const maxQty = Math.max(...data.warehouseDistribution.map(w => w.totalQuantity), 1)
                  const pct = Math.round((wh.totalQuantity / maxQty) * 100)
                  const colors = ['bg-emerald-400', 'bg-purple-400', 'bg-teal-400', 'bg-amber-400', 'bg-rose-400']
                  const colorIdx = data.warehouseDistribution.indexOf(wh) % colors.length
                  return (
                    <div key={wh.warehouseId}>
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-sm font-medium text-slate-700">{wh.warehouseName}</p>
                        <div className="flex items-center gap-3">
                          <span className="text-[10px] text-slate-400">{wh.itemCount} صنف</span>
                          <span className="text-xs font-semibold text-slate-600">
                            {wh.totalQuantity.toLocaleString('ar-EG')}
                          </span>
                        </div>
                      </div>
                      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className={cn('h-full rounded-full transition-all duration-500', colors[colorIdx])}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-32 text-slate-400">
                <Warehouse className="h-8 w-8 mb-2 text-slate-200" />
                <p className="text-xs">لا توجد بيانات</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Low Stock Alerts + Recent Movements ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Low Stock Alerts */}
        <Card className="border shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-red-50 flex items-center justify-center">
                  <AlertTriangle className="h-4 w-4 text-red-600" />
                </div>
                <CardTitle className="text-sm font-semibold">تنبيهات النقص</CardTitle>
              </div>
              {data.lowStockAlerts.length > 0 && (
                <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 text-xs">
                  {data.lowStockAlerts.length} صنف
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {data.lowStockAlerts.length > 0 ? (
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {data.lowStockAlerts.map((alert) => (
                  <div key={alert.itemId + alert.warehouse} className="flex items-center gap-3 p-2 rounded-lg bg-red-50/50 border border-red-100">
                    <div className="h-8 w-8 rounded-lg bg-red-100 flex items-center justify-center shrink-0">
                      <AlertTriangle className="h-4 w-4 text-red-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-700 truncate">{alert.itemName}</p>
                      <p className="text-[10px] text-slate-400">{alert.warehouse} • الحد الأدنى: {alert.minStock} {alert.uom || ''}</p>
                    </div>
                    <Badge variant="outline" className="bg-red-100 text-red-700 border-red-200 text-xs shrink-0">
                      {alert.currentQty} {alert.uom || ''}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-32 text-slate-400">
                <Package className="h-8 w-8 mb-2 text-emerald-200" />
                <p className="text-xs text-emerald-600 font-medium">المخزون كافي ✓</p>
                <p className="text-[10px] text-slate-300 mt-0.5">لا توجد أصناف أقل من الحد الأدنى</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Movements */}
        <Card className="border shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-cyan-50 flex items-center justify-center">
                  <ArrowLeftRight className="h-4 w-4 text-cyan-600" />
                </div>
                <CardTitle className="text-sm font-semibold">آخر حركات المخزن</CardTitle>
              </div>
              <button onClick={() => setView('stock-movements')} className="text-xs text-emerald-600 hover:text-emerald-700 font-medium">
                عرض الكل ←
              </button>
            </div>
          </CardHeader>
          <CardContent>
            {data.recentMovements.length > 0 ? (
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {data.recentMovements.map((mv) => {
                  const style = movementStyles[mv.type] || movementStyles.ADJ
                  return (
                    <div key={mv.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50 transition-colors">
                      <div className={cn('h-8 w-8 rounded-lg flex items-center justify-center shrink-0', style.bg)}>
                        <style.icon className={cn('h-4 w-4', style.color)} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-slate-700 truncate">{mv.itemName}</p>
                          <Badge variant="outline" className={cn('text-[9px] px-1.5 py-0', style.bg, style.color, 'border-0')}>
                            {style.label}
                          </Badge>
                        </div>
                        <p className="text-[10px] text-slate-400">{mv.warehouse} • {formatDate(mv.date)}</p>
                      </div>
                      <div className="text-left">
                        <p className="text-sm font-mono font-semibold text-slate-700" dir="ltr">
                          {mv.quantity.toLocaleString('ar-EG')}
                        </p>
                        <p className="text-[10px] text-slate-400" dir="ltr">{formatCurrency(mv.totalCost)}</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-32 text-slate-400">
                <ArrowLeftRight className="h-8 w-8 mb-2 text-slate-200" />
                <p className="text-xs">لا توجد حركات</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Category Distribution ── */}
      {data.categoryDistribution.length > 0 && (
        <Card className="border shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-purple-50 flex items-center justify-center">
                <Tags className="h-4 w-4 text-purple-600" />
              </div>
              <CardTitle className="text-sm font-semibold">توزيع الأصناف حسب الفئة</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {data.categoryDistribution.map((cat) => {
                const maxVal = Math.max(...data.categoryDistribution.map(c => c.value), 1)
                const pct = Math.round((cat.value / maxVal) * 100)
                const colors = ['bg-emerald-400', 'bg-purple-400', 'bg-teal-400', 'bg-amber-400', 'bg-rose-400', 'bg-cyan-400', 'bg-orange-400', 'bg-indigo-400']
                const colorIdx = data.categoryDistribution.indexOf(cat) % colors.length
                return (
                  <div key={cat.id} className="p-3 rounded-xl border border-slate-100 bg-white hover:shadow-sm transition-shadow">
                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden mb-2">
                      <div
                        className={cn('h-full rounded-full', colors[colorIdx])}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <p className="text-sm font-medium text-slate-700 truncate">{cat.name}</p>
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-[10px] text-slate-400">{cat.count} صنف</span>
                      <span className="text-xs font-semibold text-slate-600">{formatCurrency(cat.value)}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
