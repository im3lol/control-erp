'use client'

import { useState, useEffect, useCallback } from 'react'
import { formatCurrency } from '@/lib/erp-utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { useAppStore } from '@/lib/store'
import { Printer, Package, Loader2, AlertTriangle, Calendar } from 'lucide-react'

interface InventoryLine {
  itemCode: string
  itemNameAr: string
  warehouseName: string
  warehouseId: string
  quantity: number
  avgCost: number
  totalValue: number
  minStock: number
  isLowStock: boolean
}

interface InventoryData {
  lines: InventoryLine[]
  warehouseSubtotals: Array<{ warehouseId: string; warehouseName: string; totalValue: number; itemCount: number }>
  grandTotal: number
}

export default function InventoryReport() {
  const companyId = useAppStore(state => state.currentCompanyId)
  const [warehouseId, setWarehouseId] = useState<string>('all')
  const [data, setData] = useState<InventoryData | null>(null)
  const [warehouses, setWarehouses] = useState<Array<{ id: string; code: string; nameAr: string }>>([])
  const [loading, setLoading] = useState(false)

  const fetchWarehouses = useCallback(async () => {
    try {
      const res = await fetch(`/api/inventory/warehouses?companyId=${companyId}`)
      if (res.ok) setWarehouses(await res.json())
    } catch (err) { console.error(err) }
  }, [])

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (warehouseId && warehouseId !== 'all') params.set('warehouseId', warehouseId)
      const res = await fetch(`/api/reports/inventory-report?companyId=${companyId}&${params}`)
      if (res.ok) {
        const json = await res.json()
        setData(json)
      }
    } catch (err) { console.error(err) }
    finally { setLoading(false) }
  }, [warehouseId])

  useEffect(() => { fetchWarehouses() }, [fetchWarehouses])
  useEffect(() => { fetchData() }, [fetchData])

  const handlePrint = () => window.print()

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 bg-emerald-100 rounded-xl flex items-center justify-center">
            <Package className="h-5 w-5 text-emerald-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900">تقرير المخازن</h2>
            <p className="text-sm text-slate-500">تقييم المخزون</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={warehouseId} onValueChange={setWarehouseId}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="جميع المخازن" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">جميع المخازن</SelectItem>
              {warehouses.map(w => (
                <SelectItem key={w.id} value={w.id}>{w.nameAr}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={handlePrint} variant="outline" size="sm" className="gap-2">
            <Printer className="h-4 w-4" />
            طباعة
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      {data && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <Card className="border-emerald-200">
            <CardContent className="p-4 text-center">
              <p className="text-xs text-slate-500 mb-1">إجمالي قيمة المخزون</p>
              <p className="text-lg font-bold text-emerald-700">{formatCurrency(data.grandTotal)}</p>
            </CardContent>
          </Card>
          <Card className="border-cyan-200">
            <CardContent className="p-4 text-center">
              <p className="text-xs text-slate-500 mb-1">عدد الأصناف</p>
              <p className="text-lg font-bold text-cyan-700">{data.lines.length}</p>
            </CardContent>
          </Card>
          <Card className="border-red-200">
            <CardContent className="p-4 text-center">
              <p className="text-xs text-slate-500 mb-1">أصناف منخفضة</p>
              <p className="text-lg font-bold text-red-700">{data.lines.filter(l => l.isLowStock).length}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Table */}
      <Card className="print:shadow-none print:border-0">
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
            </div>
          ) : data && data.lines.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50">
                    <TableHead className="text-right font-semibold">كود الصنف</TableHead>
                    <TableHead className="text-right font-semibold">اسم الصنف</TableHead>
                    <TableHead className="text-right font-semibold">المخزن</TableHead>
                    <TableHead className="text-right font-semibold">الكمية</TableHead>
                    <TableHead className="text-right font-semibold">متوسط التكلفة</TableHead>
                    <TableHead className="text-right font-semibold">القيمة الإجمالية</TableHead>
                    <TableHead className="text-right font-semibold">الحد الأدنى</TableHead>
                    <TableHead className="text-right font-semibold">الحالة</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.lines.map((line, idx) => (
                    <TableRow key={idx} className={line.isLowStock ? 'bg-red-50/50' : ''}>
                      <TableCell className="font-mono text-sm">{line.itemCode}</TableCell>
                      <TableCell className={line.isLowStock ? 'font-semibold text-red-700' : ''}>{line.itemNameAr}</TableCell>
                      <TableCell className="text-sm text-slate-600">{line.warehouseName}</TableCell>
                      <TableCell className="font-mono text-sm">{line.quantity}</TableCell>
                      <TableCell className="font-mono text-sm">{formatCurrency(line.avgCost)}</TableCell>
                      <TableCell className="font-mono text-sm font-semibold">{formatCurrency(line.totalValue)}</TableCell>
                      <TableCell className="font-mono text-sm text-slate-500">{line.minStock}</TableCell>
                      <TableCell>
                        {line.isLowStock ? (
                          <Badge variant="destructive" className="gap-1 text-xs">
                            <AlertTriangle className="h-3 w-3" />
                            منخفض
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="bg-emerald-100 text-emerald-800 text-xs">
                            طبيعي
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  {/* Grand Total */}
                  <TableRow className="bg-emerald-50 font-bold border-t-2 border-emerald-200">
                    <TableCell colSpan={5} className="text-center text-emerald-800">
                      الإجمالي العام
                    </TableCell>
                    <TableCell className="font-mono text-emerald-800">{formatCurrency(data.grandTotal)}</TableCell>
                    <TableCell colSpan={2} />
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-64 text-slate-400">
              <Package className="h-12 w-12 mb-3 text-slate-200" />
              <p className="text-sm">لا توجد بيانات</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
