'use client'

import { useState, useEffect, useCallback } from 'react'
import { formatCurrency, formatDate } from '@/lib/erp-utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { useAppStore } from '@/lib/store'
import { Printer, PieChart, Loader2, Calendar, CheckCircle2, AlertTriangle } from 'lucide-react'

interface AccountLine {
  accountCode: string
  accountNameAr: string
  balance: number
}

interface BalanceSheetData {
  asOfDate: string
  assets: { accounts: AccountLine[]; total: number }
  liabilities: { accounts: AccountLine[]; total: number }
  equity: { accounts: AccountLine[]; netIncome: number; total: number }
  totalLiabilitiesAndEquity: number
  isBalanced: boolean
}

export default function BalanceSheetReport() {
  const companyId = useAppStore(state => state.currentCompanyId)
  const [asOfDate, setAsOfDate] = useState(new Date().toISOString().split('T')[0])
  const [data, setData] = useState<BalanceSheetData | null>(null)
  const [loading, setLoading] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/reports/balance-sheet?companyId=${companyId}&asOfDate=${asOfDate}`)
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
            <PieChart className="h-5 w-5 text-emerald-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900">الميزانية العمومية</h2>
            <p className="text-sm text-slate-500">كما في {formatDate(asOfDate)}</p>
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

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
        </div>
      ) : data ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 print:grid-cols-2 print:gap-2">
          {/* Assets Side */}
          <Card className="border-emerald-200 print:shadow-none">
            <CardHeader className="bg-emerald-50 pb-3">
              <CardTitle className="text-lg font-bold text-emerald-800">الأصول</CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              {data.assets.accounts.filter(a => a.balance !== 0).length > 0 ? (
                <div className="space-y-2">
                  {data.assets.accounts.filter(a => a.balance !== 0).map((acc) => (
                    <div key={acc.accountCode} className="flex justify-between items-center py-1.5 px-2 rounded hover:bg-slate-50">
                      <span className="text-sm">
                        <span className="font-mono text-slate-400 ml-2">{acc.accountCode}</span>
                        {acc.accountNameAr}
                      </span>
                      <span className="font-mono font-semibold text-sm">{formatCurrency(acc.balance)}</span>
                    </div>
                  ))}
                  <Separator className="my-2" />
                  <div className="flex justify-between items-center py-2 px-2 bg-emerald-50 rounded-lg font-bold">
                    <span className="text-emerald-800">إجمالي الأصول</span>
                    <span className="font-mono text-emerald-800">{formatCurrency(data.assets.total)}</span>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-slate-400 text-center py-8">لا توجد أرصدة</p>
              )}
            </CardContent>
          </Card>

          {/* Liabilities + Equity Side */}
          <div className="space-y-4">
            <Card className="border-orange-200 print:shadow-none">
              <CardHeader className="bg-orange-50 pb-3">
                <CardTitle className="text-lg font-bold text-orange-800">الخصوم</CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                {data.liabilities.accounts.filter(a => a.balance !== 0).length > 0 ? (
                  <div className="space-y-2">
                    {data.liabilities.accounts.filter(a => a.balance !== 0).map((acc) => (
                      <div key={acc.accountCode} className="flex justify-between items-center py-1.5 px-2 rounded hover:bg-slate-50">
                        <span className="text-sm">
                          <span className="font-mono text-slate-400 ml-2">{acc.accountCode}</span>
                          {acc.accountNameAr}
                        </span>
                        <span className="font-mono font-semibold text-sm">{formatCurrency(acc.balance)}</span>
                      </div>
                    ))}
                    <Separator className="my-2" />
                    <div className="flex justify-between items-center py-2 px-2 bg-orange-50 rounded-lg font-bold">
                      <span className="text-orange-800">إجمالي الخصوم</span>
                      <span className="font-mono text-orange-800">{formatCurrency(data.liabilities.total)}</span>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-slate-400 text-center py-4">لا توجد أرصدة</p>
                )}
              </CardContent>
            </Card>

            <Card className="border-purple-200 print:shadow-none">
              <CardHeader className="bg-purple-50 pb-3">
                <CardTitle className="text-lg font-bold text-purple-800">حقوق الملكية</CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                <div className="space-y-2">
                  {data.equity.accounts.filter(a => a.balance !== 0).map((acc) => (
                    <div key={acc.accountCode} className="flex justify-between items-center py-1.5 px-2 rounded hover:bg-slate-50">
                      <span className="text-sm">
                        <span className="font-mono text-slate-400 ml-2">{acc.accountCode}</span>
                        {acc.accountNameAr}
                      </span>
                      <span className="font-mono font-semibold text-sm">{formatCurrency(acc.balance)}</span>
                    </div>
                  ))}
                  {data.equity.netIncome !== 0 && (
                    <div className="flex justify-between items-center py-1.5 px-2 rounded hover:bg-slate-50">
                      <span className="text-sm font-medium text-teal-700">صافي الربح (قائمة الدخل)</span>
                      <span className="font-mono font-semibold text-sm text-teal-700">{formatCurrency(data.equity.netIncome)}</span>
                    </div>
                  )}
                  <Separator className="my-2" />
                  <div className="flex justify-between items-center py-2 px-2 bg-purple-50 rounded-lg font-bold">
                    <span className="text-purple-800">إجمالي حقوق الملكية</span>
                    <span className="font-mono text-purple-800">{formatCurrency(data.equity.total)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Total Liabilities + Equity */}
            <div className="flex justify-between items-center py-3 px-4 bg-slate-100 rounded-xl font-bold text-lg">
              <span>إجمالي الخصوم + حقوق الملكية</span>
              <span className="font-mono">{formatCurrency(data.totalLiabilitiesAndEquity)}</span>
            </div>
          </div>

          {/* Balance Check */}
          <div className="lg:col-span-2 print:col-span-2">
            {data.isBalanced ? (
              <div className="flex items-center gap-3 p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
                <CheckCircle2 className="h-6 w-6 text-emerald-600 shrink-0" />
                <div>
                  <p className="font-bold text-emerald-800">الميزانية متوازنة</p>
                  <p className="text-sm text-emerald-600">الأصول = الخصوم + حقوق الملكية</p>
                </div>
                <Badge className="bg-emerald-600 text-white mr-auto">✓ متوازن</Badge>
              </div>
            ) : (
              <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-xl">
                <AlertTriangle className="h-6 w-6 text-red-600 shrink-0" />
                <div>
                  <p className="font-bold text-red-800">الميزانية غير متوازنة</p>
                  <p className="text-sm text-red-600">
                    الفرق: {formatCurrency(Math.abs(data.assets.total - data.totalLiabilitiesAndEquity))}
                  </p>
                </div>
                <Badge variant="destructive" className="mr-auto">✗ غير متوازن</Badge>
              </div>
            )}
          </div>
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center h-64 text-slate-400">
            <PieChart className="h-12 w-12 mb-3 text-slate-200" />
            <p className="text-sm">لا توجد بيانات</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
