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
import { Printer, BarChart3, Loader2, Calendar, TrendingUp, ShoppingCart, DollarSign, Percent } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

interface SalesData {
  totalSales: number
  totalDiscount: number
  totalTax: number
  totalCOGS: number
  grossProfit: number
  invoices: Array<{
    id: string; number: string; date: string; customerName: string;
    totalAmount: number; discountAmount: number; taxAmount: number; status: string;
  }>
  byCustomer: Array<{
    customerId: string; customerName: string; totalSales: number; invoiceCount: number;
  }>
  byMonth: Array<{ month: string; totalSales: number }>
}

export default function SalesReport() {
  const companyId = useAppStore(state => state.currentCompanyId)
  const today = new Date().toISOString().split('T')[0]
  const firstOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]
  const [fromDate, setFromDate] = useState(firstOfMonth)
  const [toDate, setToDate] = useState(today)
  const [customerId, setCustomerId] = useState<string>('all')
  const [data, setData] = useState<SalesData | null>(null)
  const [customers, setCustomers] = useState<Array<{ id: string; code: string; nameAr: string }>>([])
  const [loading, setLoading] = useState(false)

  const fetchCustomers = useCallback(async () => {
    try {
      const res = await fetch(`/api/sales/customers?companyId=${companyId}`)
      if (res.ok) setCustomers(await res.json())
    } catch (err) { console.error(err) }
  }, [])

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (fromDate) params.set('fromDate', fromDate)
      if (toDate) params.set('toDate', toDate)
      if (customerId && customerId !== 'all') params.set('customerId', customerId)
      const res = await fetch(`/api/reports/sales-report?companyId=${companyId}&${params}`)
      if (res.ok) {
        const json = await res.json()
        setData(json)
      }
    } catch (err) { console.error(err) }
    finally { setLoading(false) }
  }, [fromDate, toDate, customerId])

  useEffect(() => { fetchCustomers() }, [fetchCustomers])
  useEffect(() => { fetchData() }, [fetchData])

  const handlePrint = () => window.print()

  const summaryCards = data ? [
    { title: 'إجمالي المبيعات', value: formatCurrency(data.totalSales), icon: TrendingUp, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200' },
    { title: 'الخصومات', value: formatCurrency(data.totalDiscount), icon: Percent, color: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-200' },
    { title: 'الضرائب', value: formatCurrency(data.totalTax), icon: DollarSign, color: 'text-teal-600', bg: 'bg-teal-50', border: 'border-teal-200' },
    { title: 'تكلفة البضاعة', value: formatCurrency(data.totalCOGS), icon: ShoppingCart, color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-200' },
    { title: 'مجمل الربح', value: formatCurrency(data.grossProfit), icon: BarChart3, color: data.grossProfit >= 0 ? 'text-emerald-600' : 'text-red-600', bg: data.grossProfit >= 0 ? 'bg-emerald-50' : 'bg-red-50', border: data.grossProfit >= 0 ? 'border-emerald-200' : 'border-red-200' },
  ] : []

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 bg-emerald-100 rounded-xl flex items-center justify-center">
            <BarChart3 className="h-5 w-5 text-emerald-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900">تقرير المبيعات</h2>
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
          <Select value={customerId} onValueChange={setCustomerId}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="جميع العملاء" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">جميع العملاء</SelectItem>
              {customers.map(c => (
                <SelectItem key={c.id} value={c.id}>{c.nameAr}</SelectItem>
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
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
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
                <CardTitle className="text-base font-semibold">المبيعات الشهرية</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64" dir="ltr">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.byMonth} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} />
                      <Tooltip formatter={(value: number) => formatCurrency(value)} />
                      <Bar dataKey="totalSales" name="المبيعات" fill="#10b981" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Customer Breakdown */}
          {data.byCustomer.length > 0 && (
            <Card className="print:shadow-none">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold">تفصيل حسب العميل</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-slate-50">
                        <TableHead className="text-right font-semibold">العميل</TableHead>
                        <TableHead className="text-right font-semibold">عدد الفواتير</TableHead>
                        <TableHead className="text-right font-semibold">إجمالي المبيعات</TableHead>
                        <TableHead className="text-right font-semibold">النسبة</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.byCustomer.map((c) => (
                        <TableRow key={c.customerId}>
                          <TableCell className="font-medium">{c.customerName}</TableCell>
                          <TableCell className="font-mono">{c.invoiceCount}</TableCell>
                          <TableCell className="font-mono font-semibold">{formatCurrency(c.totalSales)}</TableCell>
                          <TableCell className="font-mono text-sm text-slate-500">
                            {data.totalSales > 0 ? ((c.totalSales / data.totalSales) * 100).toFixed(1) : 0}%
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
            <BarChart3 className="h-12 w-12 mb-3 text-slate-200" />
            <p className="text-sm">لا توجد بيانات</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
