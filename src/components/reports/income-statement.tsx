'use client'

import { useState, useEffect, useCallback } from 'react'
import { formatCurrency, formatDate } from '@/lib/erp-utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { useAppStore } from '@/lib/store'
import { Printer, TrendingUp, TrendingDown, Loader2, Calendar } from 'lucide-react'

interface AccountLine {
  accountCode: string
  accountNameAr: string
  balance: number
}

interface IncomeStatementData {
  fromDate: string
  toDate: string
  revenues: { accounts: AccountLine[]; total: number }
  expenses: { accounts: AccountLine[]; total: number }
  netIncome: number
}

export default function IncomeStatementReport() {
  const companyId = useAppStore(state => state.currentCompanyId)
  const today = new Date().toISOString().split('T')[0]
  const firstOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]
  const [fromDate, setFromDate] = useState(firstOfMonth)
  const [toDate, setToDate] = useState(today)
  const [data, setData] = useState<IncomeStatementData | null>(null)
  const [loading, setLoading] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (fromDate) params.set('fromDate', fromDate)
      if (toDate) params.set('toDate', toDate)
      const res = await fetch(`/api/reports/income-statement?companyId=${companyId}&${params}`)
      if (res.ok) {
        const json = await res.json()
        setData(json)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [fromDate, toDate])

  useEffect(() => { fetchData() }, [fetchData])

  const handlePrint = () => window.print()

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 bg-emerald-100 rounded-xl flex items-center justify-center">
            <TrendingUp className="h-5 w-5 text-emerald-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900">قائمة الدخل</h2>
            <p className="text-sm text-slate-500">
              من {formatDate(fromDate)} إلى {formatDate(toDate)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-2 bg-white border rounded-lg px-3 py-1.5">
            <Calendar className="h-4 w-4 text-slate-400" />
            <Input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="border-0 p-0 h-7 text-sm focus-visible:ring-0 w-32"
            />
            <span className="text-slate-400 text-sm">إلى</span>
            <Input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="border-0 p-0 h-7 text-sm focus-visible:ring-0 w-32"
            />
          </div>
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
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 print:grid-cols-2 print:gap-2">
          {/* Revenues */}
          <Card className="border-teal-200 print:shadow-none">
            <CardHeader className="bg-teal-50 pb-3">
              <CardTitle className="text-lg font-bold text-teal-800 flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                الإيرادات
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              {data.revenues.accounts.filter(a => a.balance !== 0).length > 0 ? (
                <div className="space-y-2">
                  {data.revenues.accounts.filter(a => a.balance !== 0).map((acc) => (
                    <div key={acc.accountCode} className="flex justify-between items-center py-1.5 px-2 rounded hover:bg-slate-50">
                      <span className="text-sm">
                        <span className="font-mono text-slate-400 ml-2">{acc.accountCode}</span>
                        {acc.accountNameAr}
                      </span>
                      <span className="font-mono font-semibold text-sm">{formatCurrency(acc.balance)}</span>
                    </div>
                  ))}
                  <Separator className="my-2" />
                  <div className="flex justify-between items-center py-2 px-3 bg-teal-50 rounded-lg font-bold">
                    <span className="text-teal-800">إجمالي الإيرادات</span>
                    <span className="font-mono text-teal-800">{formatCurrency(data.revenues.total)}</span>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-slate-400 text-center py-8">لا توجد إيرادات</p>
              )}
            </CardContent>
          </Card>

          {/* Expenses */}
          <Card className="border-red-200 print:shadow-none">
            <CardHeader className="bg-red-50 pb-3">
              <CardTitle className="text-lg font-bold text-red-800 flex items-center gap-2">
                <TrendingDown className="h-5 w-5" />
                المصروفات
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              {data.expenses.accounts.filter(a => a.balance !== 0).length > 0 ? (
                <div className="space-y-2">
                  {data.expenses.accounts.filter(a => a.balance !== 0).map((acc) => (
                    <div key={acc.accountCode} className="flex justify-between items-center py-1.5 px-2 rounded hover:bg-slate-50">
                      <span className="text-sm">
                        <span className="font-mono text-slate-400 ml-2">{acc.accountCode}</span>
                        {acc.accountNameAr}
                      </span>
                      <span className="font-mono font-semibold text-sm">{formatCurrency(acc.balance)}</span>
                    </div>
                  ))}
                  <Separator className="my-2" />
                  <div className="flex justify-between items-center py-2 px-3 bg-red-50 rounded-lg font-bold">
                    <span className="text-red-800">إجمالي المصروفات</span>
                    <span className="font-mono text-red-800">{formatCurrency(data.expenses.total)}</span>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-slate-400 text-center py-8">لا توجد مصروفات</p>
              )}
            </CardContent>
          </Card>

          {/* Net Income */}
          <div className="lg:col-span-2 print:col-span-2">
            <div className={`flex items-center justify-between p-5 rounded-xl border-2 ${data.netIncome >= 0 ? 'bg-emerald-50 border-emerald-300' : 'bg-red-50 border-red-300'}`}>
              <div className="flex items-center gap-3">
                {data.netIncome >= 0 ? (
                  <TrendingUp className="h-7 w-7 text-emerald-600" />
                ) : (
                  <TrendingDown className="h-7 w-7 text-red-600" />
                )}
                <div>
                  <p className={`text-lg font-bold ${data.netIncome >= 0 ? 'text-emerald-800' : 'text-red-800'}`}>
                    {data.netIncome >= 0 ? 'صافي الربح' : 'صافي الخسارة'}
                  </p>
                  <p className="text-sm text-slate-500">الإيرادات - المصروفات</p>
                </div>
              </div>
              <span className={`text-3xl font-bold font-mono ${data.netIncome >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                {formatCurrency(Math.abs(data.netIncome))}
              </span>
            </div>
          </div>
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center h-64 text-slate-400">
            <TrendingUp className="h-12 w-12 mb-3 text-slate-200" />
            <p className="text-sm">لا توجد بيانات</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
