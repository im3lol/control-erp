'use client'

import { useState, useEffect, useCallback } from 'react'
import { formatCurrency } from '@/lib/erp-utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { useAppStore } from '@/lib/store'
import { Printer, Users, Loader2 } from 'lucide-react'

interface CustomerAgingLine {
  customerCode: string
  customerName: string
  totalOutstanding: number
  current: number
  days30: number
  days60: number
  days90plus: number
}

interface CustomerAgingData {
  customers: CustomerAgingLine[]
  grandTotal: {
    totalOutstanding: number
    current: number
    days30: number
    days60: number
    days90plus: number
  }
}

function getAgingColor(amount: number, threshold: 'current' | '30' | '60' | '90+'): string {
  if (amount === 0) return ''
  switch (threshold) {
    case 'current': return 'text-emerald-700'
    case '30': return 'text-yellow-700'
    case '60': return 'text-orange-700'
    case '90+': return 'text-red-700 font-bold'
  }
}

function getAgingBg(amount: number, threshold: 'current' | '30' | '60' | '90+'): string {
  if (amount === 0) return ''
  switch (threshold) {
    case 'current': return 'bg-emerald-50'
    case '30': return 'bg-yellow-50'
    case '60': return 'bg-orange-50'
    case '90+': return 'bg-red-50'
  }
}

export default function CustomerAgingReport() {
  const companyId = useAppStore(state => state.currentCompanyId)
  const [data, setData] = useState<CustomerAgingData | null>(null)
  const [loading, setLoading] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/reports/customer-aging?companyId=${companyId}`)
      if (res.ok) {
        const json = await res.json()
        setData(json)
      }
    } catch (err) { console.error(err) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const handlePrint = () => window.print()

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 bg-emerald-100 rounded-xl flex items-center justify-center">
            <Users className="h-5 w-5 text-emerald-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900">أرصدة العملاء</h2>
            <p className="text-sm text-slate-500">تقرير تقادم المديونيات</p>
          </div>
        </div>
        <Button onClick={handlePrint} variant="outline" size="sm" className="gap-2">
          <Printer className="h-4 w-4" />
          طباعة
        </Button>
      </div>

      {/* Color Legend */}
      <div className="flex items-center gap-4 flex-wrap text-xs">
        <div className="flex items-center gap-1.5">
          <div className="h-3 w-3 rounded bg-emerald-200" />
          <span className="text-slate-600">حالي (0-30 يوم)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-3 w-3 rounded bg-yellow-200" />
          <span className="text-slate-600">31-60 يوم</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-3 w-3 rounded bg-orange-200" />
          <span className="text-slate-600">61-90 يوم</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-3 w-3 rounded bg-red-200" />
          <span className="text-slate-600">أكثر من 90 يوم</span>
        </div>
      </div>

      {/* Table */}
      <Card className="print:shadow-none print:border-0">
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
            </div>
          ) : data && data.customers.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50">
                    <TableHead className="text-right font-semibold">العميل</TableHead>
                    <TableHead className="text-right font-semibold">الإجمالي</TableHead>
                    <TableHead className="text-right font-semibold">حالي</TableHead>
                    <TableHead className="text-right font-semibold">30 يوم</TableHead>
                    <TableHead className="text-right font-semibold">60 يوم</TableHead>
                    <TableHead className="text-right font-semibold">90+ يوم</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.customers.map((c) => (
                    <TableRow key={c.customerCode}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{c.customerName}</p>
                          <p className="text-xs text-slate-400 font-mono">{c.customerCode}</p>
                        </div>
                      </TableCell>
                      <TableCell className="font-mono font-semibold">{formatCurrency(c.totalOutstanding)}</TableCell>
                      <TableCell className={`font-mono ${getAgingColor(c.current, 'current')}`}>
                        {c.current > 0 ? formatCurrency(c.current) : '-'}
                      </TableCell>
                      <TableCell className={`font-mono ${getAgingColor(c.days30, '30')}`}>
                        {c.days30 > 0 ? formatCurrency(c.days30) : '-'}
                      </TableCell>
                      <TableCell className={`font-mono ${getAgingColor(c.days60, '60')}`}>
                        {c.days60 > 0 ? formatCurrency(c.days60) : '-'}
                      </TableCell>
                      <TableCell className={`font-mono ${getAgingColor(c.days90plus, '90+')}`}>
                        {c.days90plus > 0 ? formatCurrency(c.days90plus) : '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                  {/* Grand Totals */}
                  <TableRow className="bg-emerald-50 font-bold border-t-2 border-emerald-200">
                    <TableCell className="text-emerald-800">الإجمالي العام</TableCell>
                    <TableCell className="font-mono text-emerald-800">{formatCurrency(data.grandTotal.totalOutstanding)}</TableCell>
                    <TableCell className={`font-mono ${getAgingBg(data.grandTotal.current, 'current')} ${getAgingColor(data.grandTotal.current, 'current')}`}>
                      {data.grandTotal.current > 0 ? formatCurrency(data.grandTotal.current) : '-'}
                    </TableCell>
                    <TableCell className={`font-mono ${getAgingBg(data.grandTotal.days30, '30')} ${getAgingColor(data.grandTotal.days30, '30')}`}>
                      {data.grandTotal.days30 > 0 ? formatCurrency(data.grandTotal.days30) : '-'}
                    </TableCell>
                    <TableCell className={`font-mono ${getAgingBg(data.grandTotal.days60, '60')} ${getAgingColor(data.grandTotal.days60, '60')}`}>
                      {data.grandTotal.days60 > 0 ? formatCurrency(data.grandTotal.days60) : '-'}
                    </TableCell>
                    <TableCell className={`font-mono ${getAgingBg(data.grandTotal.days90plus, '90+')} ${getAgingColor(data.grandTotal.days90plus, '90+')}`}>
                      {data.grandTotal.days90plus > 0 ? formatCurrency(data.grandTotal.days90plus) : '-'}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-64 text-slate-400">
              <Users className="h-12 w-12 mb-3 text-slate-200" />
              <p className="text-sm">لا توجد أرصدة مستحقة</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
