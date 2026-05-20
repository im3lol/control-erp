'use client'

import { useState, useEffect, useCallback } from 'react'
import { formatCurrency, formatDate } from '@/lib/erp-utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { useAppStore } from '@/lib/store'
import { Printer, ShoppingCart, Loader2, Calendar, Truck, DollarSign, Percent } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

interface PurchaseData {
  totalPurchases: number
  totalDiscount: number
  totalTax: number
  invoices: Array<{
    id: string; number: string; date: string; supplierName: string;
    totalAmount: number; discountAmount: number; taxAmount: number; status: string;
  }>
  bySupplier: Array<{
    supplierId: string; supplierName: string; totalPurchases: number; invoiceCount: number;
  }>
  byMonth: Array<{ month: string; totalPurchases: number }>
}

export default function PurchaseReport() {
  const companyId = useAppStore(state => state.currentCompanyId)
  const today = new Date().toISOString().split('T')[0]
  const firstOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]
  const [fromDate, setFromDate] = useState(firstOfMonth)
  const [toDate, setToDate] = useState(today)
  const [supplierId, setSupplierId] = useState<string>('all')
  const [data, setData] = useState<PurchaseData | null>(null)
  const [suppliers, setSuppliers] = useState<Array<{ id: string; code: string; nameAr: string }>>([])
  const [loading, setLoading] = useState(false)

  const fetchSuppliers = useCallback(async () => {
    try {
      const res = await fetch(`/api/purchases/suppliers?companyId=${companyId}`)
      if (res.ok) setSuppliers(await res.json())
    } catch (err) { console.error(err) }
  }, [])

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (fromDate) params.set('fromDate', fromDate)
      if (toDate) params.set('toDate', toDate)
      if (supplierId && supplierId !== 'all') params.set('supplierId', supplierId)
      const res = await fetch(`/api/reports/purchase-report?companyId=${companyId}&${params}`)
      if (res.ok) {
        const json = await res.json()
        setData(json)
      }
    } catch (err) { console.error(err) }
    finally { setLoading(false) }
  }, [fromDate, toDate, supplierId])

  useEffect(() => { fetchSuppliers() }, [fetchSuppliers])
  useEffect(() => { fetchData() }, [fetchData])

  const handlePrint = () => window.print()

  const summaryCards = data ? [
    { title: 'إجمالي المشتريات', value: formatCurrency(data.totalPurchases), icon: Truck, color: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-200' },
    { title: 'الخصومات', value: formatCurrency(data.totalDiscount), icon: Percent, color: 'text-teal-600', bg: 'bg-teal-50', border: 'border-teal-200' },
    { title: 'الضرائب', value: formatCurrency(data.totalTax), icon: DollarSign, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200' },
  ] : []

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 bg-orange-100 rounded-xl flex items-center justify-center">
            <ShoppingCart className="h-5 w-5 text-orange-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900">تقرير المشتريات</h2>
            <p className="text-sm text-slate-500">من {formatDate(fromDate)} إلى {formatDate(toDate)}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-2 bg-white border rounded-lg px-3 py-1.5">
            <Calendar className="h-4 w-4 text-slate-400" />
            <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="border-0 p-0 h-7 text-sm focus-visible:ring-0 w-32" />
            <span className="text-slate-400 text-sm">إلى</span>
            <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="border-0 p-0 h-7 text-sm focus-visible:ring-0 w-32" />
          </div>
          <Select value={supplierId} onValueChange={setSupplierId}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="جميع الموردين" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">جميع الموردين</SelectItem>
              {suppliers.map(s => (
                <SelectItem key={s.id} value={s.id}>{s.nameAr}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={handlePrint} variant="outline" size="sm" className="gap-2">
            <Printer className="h-4 w-4" />
            طباعة
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
        </div>
      ) : data ? (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {summaryCards.map((card) => (
              <Card key={card.title} className={card.border}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${card.bg}`}>
                      <card.icon className={`h-4 w-4 ${card.color}`} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs text-slate-500 truncate">{card.title}</p>
                      <p className={`text-sm font-bold ${card.color}`}>{card.value}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Monthly Chart */}
          {data.byMonth.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold">المشتريات الشهرية</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64" dir="ltr">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.byMonth} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} />
                      <Tooltip formatter={(value: number) => formatCurrency(value)} />
                      <Bar dataKey="totalPurchases" name="المشتريات" fill="#f97316" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Supplier Breakdown */}
          {data.bySupplier.length > 0 && (
            <Card className="print:shadow-none">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold">تفصيل حسب المورد</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-slate-50">
                        <TableHead className="text-right font-semibold">المورد</TableHead>
                        <TableHead className="text-right font-semibold">عدد الفواتير</TableHead>
                        <TableHead className="text-right font-semibold">إجمالي المشتريات</TableHead>
                        <TableHead className="text-right font-semibold">النسبة</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.bySupplier.map((s) => (
                        <TableRow key={s.supplierId}>
                          <TableCell className="font-medium">{s.supplierName}</TableCell>
                          <TableCell className="font-mono">{s.invoiceCount}</TableCell>
                          <TableCell className="font-mono font-semibold">{formatCurrency(s.totalPurchases)}</TableCell>
                          <TableCell className="font-mono text-sm text-slate-500">
                            {data.totalPurchases > 0 ? ((s.totalPurchases / data.totalPurchases) * 100).toFixed(1) : 0}%
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center h-64 text-slate-400">
            <ShoppingCart className="h-12 w-12 mb-3 text-slate-200" />
            <p className="text-sm">لا توجد بيانات</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
