'use client'

import { useState, useEffect, useCallback } from 'react'
import { formatCurrency, getAccountTypeLabel } from '@/lib/erp-utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { useAppStore } from '@/lib/store'
import { Printer, Scale, Loader2, Calendar } from 'lucide-react'

interface TrialBalanceLine {
  accountCode: string
  accountNameAr: string
  accountType: string
  totalDebit: number
  totalCredit: number
  balance: number
  isParent: boolean
  indent: number
}

interface TrialBalanceData {
  asOfDate: string
  lines: TrialBalanceLine[]
  grandTotals: { totalDebit: number; totalCredit: number; balance: number }
}

const accountTypeColors: Record<string, string> = {
  ASSET: 'bg-emerald-100 text-emerald-800',
  LIABILITY: 'bg-orange-100 text-orange-800',
  EQUITY: 'bg-purple-100 text-purple-800',
  REVENUE: 'bg-teal-100 text-teal-800',
  EXPENSE: 'bg-red-100 text-red-800',
}

export default function TrialBalanceReport() {
  const companyId = useAppStore(state => state.currentCompanyId)
  const [asOfDate, setAsOfDate] = useState(new Date().toISOString().split('T')[0])
  const [data, setData] = useState<TrialBalanceData | null>(null)
  const [loading, setLoading] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/reports/trial-balance?companyId=${companyId}&asOfDate=${asOfDate}`)
      if (res.ok) {
        const json = await res.json()
        setData(json)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [asOfDate])

  useEffect(() => { fetchData() }, [fetchData])

  const handlePrint = () => window.print()

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 bg-emerald-100 rounded-xl flex items-center justify-center">
            <Scale className="h-5 w-5 text-emerald-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900">ميزان المراجعة</h2>
            <p className="text-sm text-slate-500">تقرير أرصدة الحسابات</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 bg-white border rounded-lg px-3 py-1.5">
            <Calendar className="h-4 w-4 text-slate-400" />
            <Input
              type="date"
              value={asOfDate}
              onChange={(e) => setAsOfDate(e.target.value)}
              className="border-0 p-0 h-7 text-sm focus-visible:ring-0 w-36"
            />
          </div>
          <Button onClick={handlePrint} variant="outline" size="sm" className="gap-2">
            <Printer className="h-4 w-4" />
            طباعة
          </Button>
        </div>
      </div>

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
                    <TableHead className="text-right font-semibold">كود الحساب</TableHead>
                    <TableHead className="text-right font-semibold">اسم الحساب</TableHead>
                    <TableHead className="text-right font-semibold">النوع</TableHead>
                    <TableHead className="text-right font-semibold">مدين</TableHead>
                    <TableHead className="text-right font-semibold">دائن</TableHead>
                    <TableHead className="text-right font-semibold">الرصيد</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.lines.map((line, idx) => (
                    <TableRow
                      key={idx}
                      className={line.isParent ? 'bg-slate-50/80 font-semibold' : ''}
                    >
                      <TableCell className="font-mono text-sm">
                        {'  '.repeat(line.indent)}{line.accountCode}
                      </TableCell>
                      <TableCell className={line.isParent ? 'font-bold' : ''}>
                        {'  '.repeat(line.indent)}{line.accountNameAr}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="secondary"
                          className={accountTypeColors[line.accountType] || 'bg-slate-100 text-slate-800'}
                        >
                          {getAccountTypeLabel(line.accountType)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-left font-mono">
                        {line.totalDebit > 0 ? formatCurrency(line.totalDebit) : '-'}
                      </TableCell>
                      <TableCell className="text-left font-mono">
                        {line.totalCredit > 0 ? formatCurrency(line.totalCredit) : '-'}
                      </TableCell>
                      <TableCell className={`text-left font-mono font-semibold ${line.balance > 0 ? 'text-emerald-600' : line.balance < 0 ? 'text-red-600' : ''}`}>
                        {line.balance !== 0 ? formatCurrency(Math.abs(line.balance)) : '-'}
                        {line.balance > 0 && ' م'}
                        {line.balance < 0 && ' د'}
                      </TableCell>
                    </TableRow>
                  ))}
                  {/* Grand Totals */}
                  <TableRow className="bg-emerald-50 font-bold border-t-2 border-emerald-200">
                    <TableCell colSpan={3} className="text-center text-emerald-800">
                      الإجمالي العام
                    </TableCell>
                    <TableCell className="text-left font-mono text-emerald-800">
                      {formatCurrency(data.grandTotals.totalDebit)}
                    </TableCell>
                    <TableCell className="text-left font-mono text-emerald-800">
                      {formatCurrency(data.grandTotals.totalCredit)}
                    </TableCell>
                    <TableCell className={`text-left font-mono ${data.grandTotals.balance === 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                      {formatCurrency(Math.abs(data.grandTotals.balance))}
                      {data.grandTotals.balance !== 0 && (data.grandTotals.balance > 0 ? ' م' : ' د')}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-64 text-slate-400">
              <Scale className="h-12 w-12 mb-3 text-slate-200" />
              <p className="text-sm">لا توجد بيانات</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
