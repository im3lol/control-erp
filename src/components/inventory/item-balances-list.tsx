'use client'

import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { Scale, AlertTriangle } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
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
import { formatCurrency } from '@/lib/erp-utils'

interface Item {
  id: string
  code: string
  nameAr: string
  minStock: number
}

interface Warehouse {
  id: string
  code: string
  nameAr: string
}

interface ItemBalance {
  id: string
  itemId: string
  warehouseId: string
  quantity: number
  avgCost: number
  updatedAt: string
  item?: Item
  warehouse?: Warehouse
}

export default function ItemBalancesList() {
  const [balances, setBalances] = useState<ItemBalance[]>([])
  const [items, setItems] = useState<Item[]>([])
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [loading, setLoading] = useState(true)
  const [warehouseFilter, setWarehouseFilter] = useState('all')
  const [lowStockOnly, setLowStockOnly] = useState(false)

  useEffect(() => {
    fetchBalances()
    fetchItems()
    fetchWarehouses()
  }, [])

  const fetchBalances = async () => {
    try {
      const res = await fetch('/api/inventory/item-balances')
      if (res.ok) {
        const data = await res.json()
        setBalances(data)
      }
    } catch {
      toast.error('فشل في تحميل أرصدة الأصناف')
    } finally {
      setLoading(false)
    }
  }

  const fetchItems = async () => {
    try {
      const res = await fetch('/api/inventory/items')
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
      const res = await fetch('/api/inventory/warehouses')
      if (res.ok) {
        const data = await res.json()
        setWarehouses(data)
      }
    } catch {
      // silently fail
    }
  }

  const getItemInfo = (itemId: string) => {
    return items.find((i) => i.id === itemId)
  }

  const getWarehouseName = (warehouseId: string) => {
    const wh = warehouses.find((w) => w.id === warehouseId)
    return wh?.nameAr || warehouseId
  }

  // Filter balances
  const filteredBalances = balances.filter((bal) => {
    const matchesWarehouse =
      warehouseFilter === 'all' || bal.warehouseId === warehouseFilter

    const itemInfo = getItemInfo(bal.itemId)
    const isLowStock = itemInfo ? bal.quantity <= itemInfo.minStock : false
    const matchesLowStock = !lowStockOnly || isLowStock

    return matchesWarehouse && matchesLowStock
  })

  // Calculate totals
  const totalQuantity = filteredBalances.reduce((sum, bal) => sum + bal.quantity, 0)
  const totalValue = filteredBalances.reduce(
    (sum, bal) => sum + bal.quantity * bal.avgCost,
    0
  )

  // Low stock count
  const lowStockCount = filteredBalances.filter((bal) => {
    const itemInfo = getItemInfo(bal.itemId)
    return itemInfo ? bal.quantity <= itemInfo.minStock : false
  }).length

  if (loading) {
    return (
      <Card className="border shadow-sm">
        <CardHeader>
          <div className="flex items-center justify-between">
            <Skeleton className="h-7 w-44" />
            <Skeleton className="h-8 w-48" />
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
    <Card className="border shadow-sm">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-emerald-50 flex items-center justify-center">
              <Scale className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <CardTitle className="text-lg">أرصدة الأصناف</CardTitle>
              <p className="text-xs text-slate-400 mt-0.5">
                عرض فقط — لا يمكن التعديل
              </p>
            </div>
          </div>
          {lowStockCount > 0 && (
            <Badge className="bg-red-50 text-red-700 border-red-200 gap-1">
              <AlertTriangle className="h-3 w-3" />
              {lowStockCount.toLocaleString('ar-EG')} صنف دون الحد الأدنى
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {/* Filters */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 mb-4">
          <Select value={warehouseFilter} onValueChange={setWarehouseFilter}>
            <SelectTrigger className="w-full sm:w-52">
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
            <Switch
              checked={lowStockOnly}
              onCheckedChange={setLowStockOnly}
            />
            <Label className="text-sm cursor-pointer">الأصناف دون الحد الأدنى فقط</Label>
          </div>
        </div>

        {/* Table */}
        <div className="max-h-[calc(100vh-340px)] overflow-y-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50/80 hover:bg-slate-50/80">
                <TableHead className="text-right font-semibold">كود الصنف</TableHead>
                <TableHead className="text-right font-semibold">اسم الصنف</TableHead>
                <TableHead className="text-right font-semibold">المخزن</TableHead>
                <TableHead className="text-right font-semibold">الكمية</TableHead>
                <TableHead className="text-right font-semibold">متوسط التكلفة</TableHead>
                <TableHead className="text-right font-semibold">القيمة الإجمالية</TableHead>
                <TableHead className="text-right font-semibold">الحد الأدنى</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredBalances.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-12">
                    <div className="flex flex-col items-center text-slate-400">
                      <Scale className="h-12 w-12 mb-3 text-slate-200" />
                      <p className="text-sm">لا توجد أرصدة</p>
                      <p className="text-xs mt-1 text-slate-300">
                        ستظهر الأرصدة هنا بعد إجراء حركات مخزن
                      </p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                <>
                  {filteredBalances.map((bal) => {
                    const itemInfo = getItemInfo(bal.itemId)
                    const isLowStock = itemInfo ? bal.quantity <= itemInfo.minStock : false
                    const totalRowValue = bal.quantity * bal.avgCost

                    return (
                      <TableRow
                        key={bal.id}
                        className={isLowStock ? 'bg-red-50/50' : ''}
                      >
                        <TableCell className="font-mono text-sm">
                          {itemInfo?.code || '—'}
                        </TableCell>
                        <TableCell
                          className={`font-medium ${isLowStock ? 'text-red-700' : ''}`}
                        >
                          <div className="flex items-center gap-2">
                            {itemInfo?.nameAr || '—'}
                            {isLowStock && (
                              <AlertTriangle className="h-3.5 w-3.5 text-red-500" />
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-slate-500">
                          {bal.warehouse?.nameAr || getWarehouseName(bal.warehouseId)}
                        </TableCell>
                        <TableCell
                          className={`font-mono ${isLowStock ? 'text-red-700 font-bold' : ''}`}
                          dir="ltr"
                        >
                          {bal.quantity.toLocaleString('ar-EG')}
                        </TableCell>
                        <TableCell className="font-mono" dir="ltr">
                          {formatCurrency(bal.avgCost)}
                        </TableCell>
                        <TableCell className="font-mono" dir="ltr">
                          {formatCurrency(totalRowValue)}
                        </TableCell>
                        <TableCell
                          className={`font-mono ${isLowStock ? 'text-red-700' : 'text-slate-500'}`}
                          dir="ltr"
                        >
                          {itemInfo?.minStock.toLocaleString('ar-EG') || '0'}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                  {/* Summary Row */}
                  <TableRow className="bg-slate-50/80 hover:bg-slate-50/80 border-t-2 border-slate-200">
                    <TableCell colSpan={3} className="font-bold text-slate-700">
                      الإجمالي
                    </TableCell>
                    <TableCell className="font-mono font-bold text-slate-700" dir="ltr">
                      {totalQuantity.toLocaleString('ar-EG')}
                    </TableCell>
                    <TableCell className="font-mono text-slate-400">—</TableCell>
                    <TableCell className="font-mono font-bold text-emerald-700" dir="ltr">
                      {formatCurrency(totalValue)}
                    </TableCell>
                    <TableCell className="text-slate-400">—</TableCell>
                  </TableRow>
                </>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
}
