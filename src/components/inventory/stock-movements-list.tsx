'use client'

import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { ArrowLeftRight, SlidersHorizontal, Loader2, X } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useAppStore } from '@/lib/store'
import { formatCurrency, formatDate } from '@/lib/erp-utils'

interface Item {
  id: string
  code: string
  nameAr: string
}

interface Warehouse {
  id: string
  code: string
  nameAr: string
}

interface StockMovement {
  id: string
  number: string
  type: string
  itemId: string
  warehouseId: string
  quantity: number
  unitCost: number
  totalCost: number
  referenceType: string | null
  referenceId: string | null
  reason: string | null
  date: string
  item?: Item
  warehouse?: Warehouse
}

interface AdjustmentFormData {
  itemId: string
  warehouseId: string
  adjustmentType: string
  quantity: string
  reason: string
}

const initialAdjustmentForm: AdjustmentFormData = {
  itemId: '',
  warehouseId: '',
  adjustmentType: 'ADJ+',
  quantity: '',
  reason: '',
}

const typeLabels: Record<string, string> = {
  IN: 'دخول',
  OUT: 'خروج',
  ADJ: 'تسوية',
  'ADJ+': 'تسوية (+)',
  'ADJ-': 'تسوية (-)',
}

const typeBadgeStyles: Record<string, string> = {
  IN: 'bg-green-50 text-green-700 border-green-200',
  OUT: 'bg-red-50 text-red-700 border-red-200',
  ADJ: 'bg-orange-50 text-orange-700 border-orange-200',
  'ADJ+': 'bg-orange-50 text-orange-700 border-orange-200',
  'ADJ-': 'bg-orange-50 text-orange-700 border-orange-200',
}

export default function StockMovementsList() {
  const companyId = useAppStore(state => state.currentCompanyId)
  const itemFilter = useAppStore(state => state.itemFilter)
  const setItemFilter = useAppStore(state => state.setItemFilter)
  const [movements, setMovements] = useState<StockMovement[]>([])
  const [items, setItems] = useState<Item[]>([])
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [loading, setLoading] = useState(true)
  const [typeFilter, setTypeFilter] = useState('all')
  const [warehouseFilter, setWarehouseFilter] = useState('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [adjustDialogOpen, setAdjustDialogOpen] = useState(false)
  const [adjustForm, setAdjustForm] = useState<AdjustmentFormData>(initialAdjustmentForm)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    fetchMovements()
    fetchItems()
    fetchWarehouses()
  }, [])

  const fetchMovements = async () => {
    try {
      const params = new URLSearchParams()
      if (itemFilter) params.set('itemId', itemFilter)
      const res = await fetch(`/api/inventory/stock-movements?companyId=${companyId}&${params.toString()}`)
      if (res.ok) {
        const data = await res.json()
        setMovements(data)
      }
    } catch {
      toast.error('فشل في تحميل حركات المخزن')
    } finally {
      setLoading(false)
    }
  }

  const fetchItems = async () => {
    try {
      const res = await fetch(`/api/inventory/items?companyId=${companyId}`)
      if (res.ok) {
        const data = await res.json()
        setItems(data)
      }
    } catch {
      // silently fail
    }
  }

  const fetchWarehouses = async () => {
    try {
      const res = await fetch(`/api/inventory/warehouses?companyId=${companyId}`)
      if (res.ok) {
        const data = await res.json()
        setWarehouses(data)
      }
    } catch {
      // silently fail
    }
  }

  const getItemName = (itemId: string) => {
    const item = items.find((i) => i.id === itemId)
    return item?.nameAr || itemId
  }

  const getWarehouseName = (warehouseId: string) => {
    const wh = warehouses.find((w) => w.id === warehouseId)
    return wh?.nameAr || warehouseId
  }

  // Filter movements
  const filteredMovements = movements.filter((mv) => {
    const matchesType =
      typeFilter === 'all' ||
      mv.type === typeFilter ||
      (typeFilter === 'ADJ' && (mv.type === 'ADJ' || mv.type === 'ADJ+' || mv.type === 'ADJ-'))

    const matchesWarehouse =
      warehouseFilter === 'all' || mv.warehouseId === warehouseFilter

    const mvDate = new Date(mv.date)
    const matchesDateFrom = !dateFrom || mvDate >= new Date(dateFrom)
    const matchesDateTo = !dateTo || mvDate <= new Date(dateTo + 'T23:59:59')

    return matchesType && matchesWarehouse && matchesDateFrom && matchesDateTo
  })

  // Refetch when itemFilter changes
  useEffect(() => {
    fetchMovements()
  }, [itemFilter])

  const handleOpenAdjust = () => {
    setAdjustForm(initialAdjustmentForm)
    setAdjustDialogOpen(true)
  }

  const handleAdjustSubmit = async () => {
    if (!adjustForm.itemId || !adjustForm.warehouseId || !adjustForm.quantity || !adjustForm.reason.trim()) {
      toast.error('يرجى ملء جميع الحقول المطلوبة')
      return
    }

    const qty = parseFloat(adjustForm.quantity)
    if (qty <= 0) {
      toast.error('يجب أن تكون الكمية أكبر من صفر')
      return
    }

    setSubmitting(true)
    try {
      const type = adjustForm.adjustmentType
      const payload = {
        itemId: adjustForm.itemId,
        warehouseId: adjustForm.warehouseId,
        type,
        quantity: qty,
        reason: adjustForm.reason,
        date: new Date().toISOString(),
      }

      const res = await fetch(`/api/inventory/stock-movements?companyId=${companyId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payload, companyId }),
      })

      if (res.ok) {
        toast.success('تم إنشاء التسوية بنجاح')
        setAdjustDialogOpen(false)
        fetchMovements()
      } else {
        const err = await res.json()
        toast.error(err.error || 'فشل في إنشاء التسوية')
      }
    } catch {
      toast.error('حدث خطأ أثناء إنشاء التسوية')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <Card className="border shadow-sm">
        <CardHeader>
          <div className="flex items-center justify-between">
            <Skeleton className="h-7 w-44" />
            <Skeleton className="h-10 w-40" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <Card className="border shadow-sm">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-emerald-50 flex items-center justify-center">
                <ArrowLeftRight className="h-5 w-5 text-emerald-600" />
              </div>
              <CardTitle className="text-lg">حركات المخزن</CardTitle>
            </div>
            <Button
              onClick={handleOpenAdjust}
              className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
            >
              <SlidersHorizontal className="h-4 w-4" />
              تسوية مخزن
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mb-4">
            {itemFilter && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-sm text-emerald-700">
                <span>تصفية حسب الصنف</span>
                <button
                  onClick={() => setItemFilter(null)}
                  className="h-5 w-5 rounded-full bg-emerald-200 hover:bg-emerald-300 flex items-center justify-center"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            )}
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-full sm:w-36">
                <SelectValue placeholder="النوع" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">الكل</SelectItem>
                <SelectItem value="IN">دخول</SelectItem>
                <SelectItem value="OUT">خروج</SelectItem>
                <SelectItem value="ADJ">تسوية</SelectItem>
              </SelectContent>
            </Select>
            <Select value={warehouseFilter} onValueChange={setWarehouseFilter}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="كل المخازن" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل المخازن</SelectItem>
                {warehouses.map((wh) => (
                  <SelectItem key={wh.id} value={wh.id}>
                    {wh.nameAr}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex items-center gap-2">
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-full sm:w-40"
                dir="ltr"
              />
              <span className="text-slate-400 text-sm">إلى</span>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-full sm:w-40"
                dir="ltr"
              />
            </div>
          </div>

          {/* Table */}
          <div className="max-h-[calc(100vh-340px)] overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50/80 hover:bg-slate-50/80">
                  <TableHead className="text-right font-semibold">الرقم</TableHead>
                  <TableHead className="text-right font-semibold">النوع</TableHead>
                  <TableHead className="text-right font-semibold">الصنف</TableHead>
                  <TableHead className="text-right font-semibold">المخزن</TableHead>
                  <TableHead className="text-right font-semibold">الكمية</TableHead>
                  <TableHead className="text-right font-semibold">تكلفة الوحدة</TableHead>
                  <TableHead className="text-right font-semibold">إجمالي التكلفة</TableHead>
                  <TableHead className="text-right font-semibold">المرجع</TableHead>
                  <TableHead className="text-right font-semibold">السبب</TableHead>
                  <TableHead className="text-right font-semibold">التاريخ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredMovements.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-12">
                      <div className="flex flex-col items-center text-slate-400">
                        <ArrowLeftRight className="h-12 w-12 mb-3 text-slate-200" />
                        <p className="text-sm">لا توجد حركات مخزن</p>
                        <p className="text-xs mt-1 text-slate-300">
                          اضغط على &quot;تسوية مخزن&quot; لإنشاء حركة جديدة
                        </p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredMovements.map((mv) => (
                    <TableRow key={mv.id}>
                      <TableCell className="font-mono text-sm">{mv.number}</TableCell>
                      <TableCell>
                        <Badge className={typeBadgeStyles[mv.type] || 'bg-slate-50 text-slate-700'}>
                          {typeLabels[mv.type] || mv.type}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium">
                        {mv.item?.nameAr || getItemName(mv.itemId)}
                      </TableCell>
                      <TableCell className="text-slate-500">
                        {mv.warehouse?.nameAr || getWarehouseName(mv.warehouseId)}
                      </TableCell>
                      <TableCell className="font-mono" dir="ltr">
                        {mv.quantity.toLocaleString('ar-EG')}
                      </TableCell>
                      <TableCell className="font-mono" dir="ltr">
                        {formatCurrency(mv.unitCost)}
                      </TableCell>
                      <TableCell className="font-mono" dir="ltr">
                        {formatCurrency(mv.totalCost)}
                      </TableCell>
                      <TableCell className="text-slate-500 text-xs">
                        {mv.referenceType
                          ? `${mv.referenceType}${mv.referenceId ? ` / ${mv.referenceId.slice(0, 8)}` : ''}`
                          : '—'}
                      </TableCell>
                      <TableCell className="text-slate-500 text-xs max-w-[120px] truncate">
                        {mv.reason || '—'}
                      </TableCell>
                      <TableCell className="text-slate-500 text-xs whitespace-nowrap">
                        {formatDate(mv.date)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Stock Adjustment Dialog */}
      <Dialog open={adjustDialogOpen} onOpenChange={setAdjustDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>تسوية مخزن</DialogTitle>
            <DialogDescription>
              إنشاء حركة تسوية مخزن جديدة
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="adj-item">
                الصنف <span className="text-red-500">*</span>
              </Label>
              <Select
                value={adjustForm.itemId}
                onValueChange={(val) => setAdjustForm((p) => ({ ...p, itemId: val }))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="اختر الصنف" />
                </SelectTrigger>
                <SelectContent>
                  {items.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.nameAr} ({item.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="adj-warehouse">
                المخزن <span className="text-red-500">*</span>
              </Label>
              <Select
                value={adjustForm.warehouseId}
                onValueChange={(val) => setAdjustForm((p) => ({ ...p, warehouseId: val }))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="اختر المخزن" />
                </SelectTrigger>
                <SelectContent>
                  {warehouses.map((wh) => (
                    <SelectItem key={wh.id} value={wh.id}>
                      {wh.nameAr}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="adj-type">
                نوع التسوية <span className="text-red-500">*</span>
              </Label>
              <Select
                value={adjustForm.adjustmentType}
                onValueChange={(val) => setAdjustForm((p) => ({ ...p, adjustmentType: val }))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ADJ+">تسوية زيادة (+)</SelectItem>
                  <SelectItem value="ADJ-">تسوية نقص (-)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="adj-quantity">
                الكمية <span className="text-red-500">*</span>
              </Label>
              <Input
                id="adj-quantity"
                type="number"
                min="0.01"
                step="0.01"
                value={adjustForm.quantity}
                onChange={(e) => setAdjustForm((p) => ({ ...p, quantity: e.target.value }))}
                placeholder="0"
                dir="ltr"
                className="text-left"
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="adj-reason">
                السبب <span className="text-red-500">*</span>
              </Label>
              <Input
                id="adj-reason"
                value={adjustForm.reason}
                onChange={(e) => setAdjustForm((p) => ({ ...p, reason: e.target.value }))}
                placeholder="سبب التسوية..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAdjustDialogOpen(false)}>
              إلغاء
            </Button>
            <Button
              onClick={handleAdjustSubmit}
              disabled={submitting}
              className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              إنشاء التسوية
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
