'use client'

import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import {
  ArrowRight,
  Package,
  Pencil,
  Trash2,
  Barcode,
  Receipt,
  ShoppingCart,
  ArrowLeftRight,
  Sliders,
  Warehouse,
  Tag,
  Ruler,
  DollarSign,
  TrendingDown,
  TrendingUp,
  FileText,
  ChevronLeft,
  AlertTriangle,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { useAppStore } from '@/lib/store'
import { formatCurrency } from '@/lib/erp-utils'

// ── Interfaces ──────────────────────────────────────────────────────────────────
interface Category {
  id: string
  code: string
  nameAr: string
  nameEn: string | null
  parentId: string | null
}

interface UOM {
  id: string
  code: string
  nameAr: string
  nameEn: string
}

interface ItemCode {
  id?: string
  codeType: string
  code: string
  isPrimary: boolean
}

interface ItemStats {
  salesCount: number
  purchaseCount: number
  movementCount: number
  adjustmentCount: number
}

interface Item {
  id: string
  code: string
  nameAr: string | null
  nameEn: string | null
  categoryId: string | null
  uomId: string | null
  costMethod: string
  sellPrice: number
  minStock: number
  maxStock: number | null
  description: string | null
  image: string | null
  isActive: boolean
  category?: Category | null
  uom?: UOM | null
  codes?: ItemCode[]
  _stats?: ItemStats
}

interface ItemBalance {
  id: string
  itemId: string
  warehouseId: string
  quantity: number
  avgCost: number
  warehouse?: {
    id: string
    code: string
    nameAr: string
    nameEn?: string
    type: string
    parentId?: string | null
    parent?: { id: string; nameAr: string; parent?: { id: string; nameAr: string } }
  }
}

// ── Code type styling ───────────────────────────────────────────────────────────
const CODE_TYPE_COLORS: Record<string, string> = {
  UPC: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  EAN: 'bg-teal-50 text-teal-700 border-teal-200',
  SKU: 'bg-amber-50 text-amber-700 border-amber-200',
  ASIN: 'bg-purple-50 text-purple-700 border-purple-200',
  FNSKU: 'bg-rose-50 text-rose-700 border-rose-200',
  OTHER: 'bg-slate-50 text-slate-700 border-slate-200',
}

const CODE_TYPE_LABELS: Record<string, string> = {
  UPC: 'باركود UPC',
  EAN: 'باركود EAN',
  SKU: 'رمز التخزين SKU',
  ASIN: 'أمازون ASIN',
  FNSKU: 'أمازون FNSKU',
  OTHER: 'أخرى',
}

const COST_METHOD_LABELS: Record<string, string> = {
  FIFO: 'الوارد أولاً يصرف أولاً (FIFO)',
  WAC: 'متوسط التكلفة المرجح (WAC)',
}

export default function ItemDetailPage() {
  const companyId = useAppStore(state => state.currentCompanyId)
  const setModule = useAppStore(state => state.setModule)
  const setView = useAppStore(state => state.setView)
  const setItemFilter = useAppStore(state => state.setItemFilter)
  const selectedItemId = useAppStore(state => state.selectedItemId)
  const setSelectedItemId = useAppStore(state => state.setSelectedItemId)

  const [item, setItem] = useState<Item | null>(null)
  const [stats, setStats] = useState<ItemStats | null>(null)
  const [balances, setBalances] = useState<ItemBalance[]>([])
  const [loading, setLoading] = useState(true)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)

  // ── Fetch item data ──────────────────────────────────────────────────────────
  const fetchItem = useCallback(async () => {
    if (!selectedItemId || !companyId) return
    setLoading(true)
    try {
      const res = await fetch(`/api/inventory/items?companyId=${companyId}`)
      if (res.ok) {
        const data: Item[] = await res.json()
        const found = data.find((i) => i.id === selectedItemId)
        if (found) {
          setItem(found)
        } else {
          toast.error('لم يتم العثور على الصنف')
          setView('items')
        }
      } else {
        toast.error('فشل في تحميل بيانات الصنف')
      }
    } catch {
      toast.error('فشل في تحميل بيانات الصنف')
    } finally {
      setLoading(false)
    }
  }, [selectedItemId, companyId, setView])

  const fetchStats = useCallback(async () => {
    if (!selectedItemId || !companyId) return
    try {
      const res = await fetch(`/api/inventory/items/${selectedItemId}/stats?companyId=${companyId}`)
      if (res.ok) {
        const data = await res.json()
        setStats(data)
      }
    } catch {
      // silently fail
    }
  }, [selectedItemId, companyId])

  const fetchBalances = useCallback(async () => {
    if (!selectedItemId || !companyId) return
    try {
      const res = await fetch(`/api/inventory/item-balances?companyId=${companyId}&itemId=${selectedItemId}`)
      if (res.ok) {
        const data = await res.json()
        setBalances(data)
      }
    } catch {
      // silently fail
    }
  }, [selectedItemId, companyId])

  useEffect(() => {
    fetchItem()
    fetchStats()
    fetchBalances()
  }, [fetchItem, fetchStats, fetchBalances])

  // ── Navigation ───────────────────────────────────────────────────────────────
  const handleBack = () => {
    setSelectedItemId(null)
    setView('items')
  }

  const handleNavigateToRelated = (module: 'sales' | 'purchases' | 'inventory', view: string) => {
    setItemFilter(selectedItemId!)
    setModule(module)
    setView(view)
  }

  const handleDelete = async () => {
    if (!item || !companyId) return
    try {
      const res = await fetch(`/api/inventory/items?companyId=${companyId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: item.id, companyId }),
      })
      if (res.ok) {
        toast.success('تم حذف الصنف بنجاح')
        setSelectedItemId(null)
        setView('items')
      } else {
        const err = await res.json()
        toast.error(err.error || 'فشل في حذف الصنف')
      }
    } catch {
      toast.error('حدث خطأ أثناء الحذف')
    } finally {
      setDeleteDialogOpen(false)
    }
  }

  // ── No item selected ─────────────────────────────────────────────────────────
  if (!selectedItemId) {
    return (
      <Card className="border shadow-sm">
        <CardContent className="py-20">
          <div className="flex flex-col items-center text-slate-400">
            <Package className="h-16 w-16 mb-4 text-slate-200" />
            <p className="text-base font-medium">لم يتم اختيار صنف</p>
            <p className="text-sm mt-1 text-slate-300">
              يرجى العودة لقائمة الأصناف واختيار صنف لعرض التفاصيل
            </p>
            <Button
              onClick={() => setView('items')}
              variant="outline"
              className="mt-4 gap-2"
            >
              <ArrowRight className="h-4 w-4" />
              العودة للأصناف
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  // ── Loading skeleton ─────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="space-y-4">
        {/* Header skeleton */}
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10 rounded-xl" />
          <div className="space-y-2 flex-1">
            <Skeleton className="h-6 w-64" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
        {/* Info cards skeleton */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
        {/* Codes skeleton */}
        <Skeleton className="h-20 rounded-xl" />
        {/* Stats skeleton */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
        {/* Balances skeleton */}
        <Skeleton className="h-48 rounded-xl" />
      </div>
    )
  }

  if (!item) return null

  // ── Computed values ──────────────────────────────────────────────────────────
  const totalQuantity = balances.reduce((sum, b) => sum + b.quantity, 0)
  const totalValue = balances.reduce((sum, b) => sum + b.quantity * b.avgCost, 0)
  const isLowStock = totalQuantity <= item.minStock
  const primaryCode = item.codes?.find((c) => c.isPrimary) || item.codes?.[0]

  const getWarehouseDisplayName = (balance: ItemBalance) => {
    const wh = balance.warehouse
    if (!wh) return '—'
    const parts: string[] = [wh.nameAr]
    if (wh.parent) {
      parts.push(wh.parent.nameAr)
      if (wh.parent.parent) {
        parts.push(wh.parent.parent.nameAr)
      }
    }
    return parts.join(' > ')
  }

  // ── Stat cards config ────────────────────────────────────────────────────────
  const statCards = [
    {
      key: 'sales',
      label: 'فواتير المبيعات',
      count: stats?.salesCount ?? item._stats?.salesCount ?? 0,
      icon: Receipt,
      color: 'emerald',
      bgColor: 'bg-emerald-50',
      iconColor: 'text-emerald-600',
      countColor: 'text-emerald-700',
      onClick: () => handleNavigateToRelated('sales', 'sales-invoices'),
    },
    {
      key: 'purchases',
      label: 'فواتير المشتريات',
      count: stats?.purchaseCount ?? item._stats?.purchaseCount ?? 0,
      icon: ShoppingCart,
      color: 'teal',
      bgColor: 'bg-teal-50',
      iconColor: 'text-teal-600',
      countColor: 'text-teal-700',
      onClick: () => handleNavigateToRelated('purchases', 'purchase-invoices'),
    },
    {
      key: 'movements',
      label: 'حركات المخزن',
      count: stats?.movementCount ?? item._stats?.movementCount ?? 0,
      icon: ArrowLeftRight,
      color: 'amber',
      bgColor: 'bg-amber-50',
      iconColor: 'text-amber-600',
      countColor: 'text-amber-700',
      onClick: () => handleNavigateToRelated('inventory', 'stock-movements'),
    },
    {
      key: 'adjustments',
      label: 'التسويات',
      count: stats?.adjustmentCount ?? item._stats?.adjustmentCount ?? 0,
      icon: Sliders,
      color: 'purple',
      bgColor: 'bg-purple-50',
      iconColor: 'text-purple-600',
      countColor: 'text-purple-700',
      onClick: () => handleNavigateToRelated('inventory', 'stock-movements'),
    },
  ]

  // ── Info items config ────────────────────────────────────────────────────────
  const infoItems = [
    {
      label: 'الفئة',
      value: item.category?.nameAr || '—',
      icon: Tag,
      iconBg: 'bg-emerald-50',
      iconColor: 'text-emerald-600',
    },
    {
      label: 'وحدة القياس',
      value: item.uom ? `${item.uom.nameAr} (${item.uom.code})` : '—',
      icon: Ruler,
      iconBg: 'bg-teal-50',
      iconColor: 'text-teal-600',
    },
    {
      label: 'سعر البيع',
      value: formatCurrency(item.sellPrice),
      icon: DollarSign,
      iconBg: 'bg-amber-50',
      iconColor: 'text-amber-600',
      dir: 'ltr' as const,
    },
    {
      label: 'طريقة التكلفة',
      value: COST_METHOD_LABELS[item.costMethod] || item.costMethod,
      icon: TrendingUp,
      iconBg: 'bg-purple-50',
      iconColor: 'text-purple-600',
    },
    {
      label: 'الحد الأدنى للمخزون',
      value: item.minStock.toLocaleString('ar-EG'),
      icon: TrendingDown,
      iconBg: 'bg-rose-50',
      iconColor: 'text-rose-600',
      dir: 'ltr' as const,
    },
    {
      label: 'الحد الأقصى للمخزون',
      value: item.maxStock !== null ? item.maxStock.toLocaleString('ar-EG') : 'غير محدد',
      icon: TrendingUp,
      iconBg: 'bg-sky-50',
      iconColor: 'text-sky-600',
      dir: 'ltr' as const,
    },
  ]

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* ═══ Back Button & Header ═══ */}
      <div className="flex items-start justify-between gap-4">
        <Button
          variant="outline"
          onClick={handleBack}
          className="gap-2 shrink-0"
        >
          <ArrowRight className="h-4 w-4" />
          العودة للأصناف
        </Button>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              // Navigate to items list where edit dialog can be triggered
              // The items-list component handles edit via its own dialog
              setView('items')
            }}
            className="gap-1.5 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 border-emerald-200"
          >
            <Pencil className="h-3.5 w-3.5" />
            تعديل
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setDeleteDialogOpen(true)}
            className="gap-1.5 text-red-500 hover:text-red-600 hover:bg-red-50 border-red-200"
          >
            <Trash2 className="h-3.5 w-3.5" />
            حذف
          </Button>
        </div>
      </div>

      {/* ═══ Product Header ═══ */}
      <Card className="border shadow-sm overflow-hidden">
        <div className="flex flex-col sm:flex-row gap-6 p-6">
          {/* Product Image */}
          <div className="shrink-0 flex justify-center sm:justify-start">
            {item.image ? (
              <div className="relative">
                <img
                  src={item.image}
                  alt={item.nameAr || item.code}
                  className="h-40 w-40 sm:h-48 sm:w-48 rounded-2xl object-cover border border-slate-100 shadow-sm"
                />
                {primaryCode && (
                  <div className="absolute -bottom-2 left-1/2 -translate-x-1/2">
                    <Badge
                      variant="outline"
                      className={`text-[10px] px-2 py-0.5 shadow-sm ${CODE_TYPE_COLORS[primaryCode.codeType] || CODE_TYPE_COLORS.OTHER}`}
                    >
                      {primaryCode.code}
                    </Badge>
                  </div>
                )}
              </div>
            ) : (
              <div className="h-40 w-40 sm:h-48 sm:w-48 rounded-2xl bg-gradient-to-br from-emerald-50 to-teal-50 flex items-center justify-center border border-emerald-100">
                <Package className="h-16 w-16 text-emerald-200" />
              </div>
            )}
          </div>

          {/* Product Name & Code */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start gap-3 mb-3">
              <div className="flex-1 min-w-0">
                <h1 className="text-xl sm:text-2xl font-bold text-slate-900 truncate">
                  {item.nameAr || item.code}
                </h1>
                {item.nameEn && (
                  <p className="text-sm text-slate-500 mt-0.5" dir="ltr">
                    {item.nameEn}
                  </p>
                )}
              </div>
              <Badge
                className={`shrink-0 ${
                  item.isActive
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : 'bg-slate-100 text-slate-500 border-slate-200'
                }`}
              >
                {item.isActive ? 'نشط' : 'غير نشط'}
              </Badge>
            </div>

            <div className="flex flex-wrap items-center gap-3 mb-4">
              <Badge variant="outline" className="font-mono text-xs bg-slate-50">
                {item.code}
              </Badge>
              {item.costMethod === 'FIFO' ? (
                <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200">
                  FIFO
                </Badge>
              ) : (
                <Badge className="bg-teal-50 text-teal-700 border-teal-200">
                  WAC
                </Badge>
              )}
              {isLowStock && totalQuantity > 0 && (
                <Badge className="bg-amber-50 text-amber-700 border-amber-200 gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  مخزون منخفض
                </Badge>
              )}
              {totalQuantity === 0 && balances.length > 0 && (
                <Badge className="bg-red-50 text-red-700 border-red-200 gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  نفد المخزون
                </Badge>
              )}
            </div>

            {/* Quick summary row */}
            <div className="flex flex-wrap gap-4 text-sm">
              <div className="flex items-center gap-1.5">
                <span className="text-slate-400">الكمية الإجمالية:</span>
                <span className={`font-bold ${totalQuantity === 0 ? 'text-red-600' : isLowStock ? 'text-amber-600' : 'text-emerald-700'}`}>
                  {totalQuantity.toLocaleString('ar-EG')}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-slate-400">القيمة:</span>
                <span className="font-bold text-emerald-700" dir="ltr">
                  {formatCurrency(totalValue)}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-slate-400">سعر البيع:</span>
                <span className="font-bold text-slate-700" dir="ltr">
                  {formatCurrency(item.sellPrice)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* ═══ Info Cards Grid ═══ */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {infoItems.map((info) => (
          <Card
            key={info.label}
            className="border shadow-sm hover:shadow-md transition-shadow"
          >
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className={`h-7 w-7 rounded-lg ${info.iconBg} flex items-center justify-center shrink-0`}>
                  <info.icon className={`h-3.5 w-3.5 ${info.iconColor}`} />
                </div>
                <span className="text-xs text-slate-400 truncate">{info.label}</span>
              </div>
              <p
                className={`text-sm font-semibold text-slate-800 truncate ${info.dir === 'ltr' ? 'text-left' : ''}`}
                dir={info.dir}
              >
                {info.value}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ═══ Product Codes Section ═══ */}
      {item.codes && item.codes.length > 0 && (
        <Card className="border shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-emerald-50 flex items-center justify-center">
                <Barcode className="h-4 w-4 text-emerald-600" />
              </div>
              <CardTitle className="text-base">أكواد المنتج</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {item.codes.map((codeEntry, index) => (
                <div
                  key={codeEntry.id || index}
                  className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg border ${
                    CODE_TYPE_COLORS[codeEntry.codeType] || CODE_TYPE_COLORS.OTHER
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    {codeEntry.isPrimary && (
                      <span className="text-[10px] font-bold bg-white/60 rounded px-1">
                        رئيسي
                      </span>
                    )}
                    <span className="text-xs font-medium">
                      {CODE_TYPE_LABELS[codeEntry.codeType] || codeEntry.codeType}
                    </span>
                  </div>
                  <Separator orientation="vertical" className="h-4 bg-current/20" />
                  <span className="font-mono text-sm font-semibold" dir="ltr">
                    {codeEntry.code}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ═══ Description Section ═══ */}
      {item.description && (
        <Card className="border shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-slate-50 flex items-center justify-center">
                <FileText className="h-4 w-4 text-slate-500" />
              </div>
              <CardTitle className="text-base">الوصف</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">
              {item.description}
            </p>
          </CardContent>
        </Card>
      )}

      {/* ═══ Linked Records (Stats) Section ═══ */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <div className="h-8 w-8 rounded-lg bg-emerald-50 flex items-center justify-center">
            <ChevronLeft className="h-4 w-4 text-emerald-600" />
          </div>
          <h2 className="text-base font-semibold text-slate-800">السجلات المرتبطة</h2>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {statCards.map((stat) => (
            <Card
              key={stat.key}
              className="border shadow-sm cursor-pointer hover:shadow-md transition-all hover:border-emerald-200 group"
              onClick={stat.onClick}
            >
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className={`h-9 w-9 rounded-xl ${stat.bgColor} flex items-center justify-center`}>
                    <stat.icon className={`h-4.5 w-4.5 ${stat.iconColor}`} />
                  </div>
                  <ChevronLeft className="h-4 w-4 text-slate-300 group-hover:text-emerald-400 transition-colors" />
                </div>
                <p className={`text-2xl font-bold ${stat.countColor}`}>
                  {(stat.count).toLocaleString('ar-EG')}
                </p>
                <p className="text-xs text-slate-400 mt-0.5">{stat.label}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* ═══ Stock Balances Section ═══ */}
      <Card className="border shadow-sm">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-emerald-50 flex items-center justify-center">
                <Warehouse className="h-4 w-4 text-emerald-600" />
              </div>
              <CardTitle className="text-base">أرصدة المخازن</CardTitle>
            </div>
            {balances.length > 0 && (
              <div className="flex items-center gap-4 text-sm">
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-400">الإجمالي:</span>
                  <span className={`font-bold ${totalQuantity === 0 ? 'text-red-600' : 'text-emerald-700'}`}>
                    {totalQuantity.toLocaleString('ar-EG')}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-400">القيمة:</span>
                  <span className="font-bold text-emerald-700" dir="ltr">
                    {formatCurrency(totalValue)}
                  </span>
                </div>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {balances.length === 0 ? (
            <div className="flex flex-col items-center py-10 text-slate-400">
              <Warehouse className="h-12 w-12 mb-3 text-slate-200" />
              <p className="text-sm">لا توجد أرصدة في المخازن</p>
              <p className="text-xs mt-1 text-slate-300">
                ستظهر الأرصدة هنا بعد إجراء حركات مخزن لهذا الصنف
              </p>
            </div>
          ) : (
            <div className="max-h-96 overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50/80 hover:bg-slate-50/80">
                    <TableHead className="text-right font-semibold">المخزن</TableHead>
                    <TableHead className="text-right font-semibold">الكمية</TableHead>
                    <TableHead className="text-right font-semibold">متوسط التكلفة</TableHead>
                    <TableHead className="text-right font-semibold">القيمة الإجمالية</TableHead>
                    <TableHead className="text-right font-semibold">الحالة</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {balances.map((balance) => {
                    const balValue = balance.quantity * balance.avgCost
                    const isLow = balance.quantity <= item.minStock
                    const isEmpty = balance.quantity === 0
                    return (
                      <TableRow key={balance.id} className={isEmpty ? 'bg-red-50/50' : isLow ? 'bg-amber-50/50' : ''}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="h-7 w-7 rounded-md bg-slate-50 flex items-center justify-center border border-slate-100 shrink-0">
                              <Warehouse className="h-3.5 w-3.5 text-slate-400" />
                            </div>
                            <span className="font-medium text-sm">
                              {getWarehouseDisplayName(balance)}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell
                          className={`font-mono text-sm ${isEmpty ? 'text-red-700 font-bold' : isLow ? 'text-amber-700 font-bold' : ''}`}
                          dir="ltr"
                        >
                          {balance.quantity.toLocaleString('ar-EG')}
                        </TableCell>
                        <TableCell className="font-mono text-sm" dir="ltr">
                          {formatCurrency(balance.avgCost)}
                        </TableCell>
                        <TableCell className="font-mono text-sm" dir="ltr">
                          {formatCurrency(balValue)}
                        </TableCell>
                        <TableCell>
                          {isEmpty ? (
                            <Badge className="bg-red-50 text-red-700 border-red-200 text-[10px]">
                              نفد
                            </Badge>
                          ) : isLow ? (
                            <Badge className="bg-amber-50 text-amber-700 border-amber-200 text-[10px] gap-0.5">
                              <AlertTriangle className="h-2.5 w-2.5" />
                              منخفض
                            </Badge>
                          ) : (
                            <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px]">
                              متوفر
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                  {/* Summary row */}
                  <TableRow className="bg-slate-50/80 hover:bg-slate-50/80 border-t-2 border-slate-200">
                    <TableCell className="font-bold text-slate-700">الإجمالي</TableCell>
                    <TableCell
                      className={`font-mono font-bold ${totalQuantity === 0 ? 'text-red-700' : 'text-emerald-700'}`}
                      dir="ltr"
                    >
                      {totalQuantity.toLocaleString('ar-EG')}
                    </TableCell>
                    <TableCell className="font-mono text-slate-400">—</TableCell>
                    <TableCell className="font-mono font-bold text-emerald-700" dir="ltr">
                      {formatCurrency(totalValue)}
                    </TableCell>
                    <TableCell />
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ═══ Delete Confirmation Dialog ═══ */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>حذف الصنف</AlertDialogTitle>
            <AlertDialogDescription>
              هل أنت متأكد من حذف الصنف &quot;{item.nameAr || item.code}&quot;؟ لا يمكن التراجع عن هذا الإجراء.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              حذف
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
