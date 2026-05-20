'use client'

import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import {
  ArrowRight,
  Loader2,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Users,
  Banknote,
  HandCoins,
  ArrowDownFromLine,
  PieChart,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
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
import { formatCurrency, formatDate } from '@/lib/erp-utils'

interface InvestorLedgerProps {
  investorId: string
  onBack: () => void
}

interface LedgerData {
  investor: {
    id: string
    code: string
    fullName: string
    phone: string | null
    email: string | null
    nationalId: string | null
    joinDate: string
    status: string
  }
  summary: {
    totalInvestment: number
    totalProfitShare: number
    totalPaidProfit: number
    totalWithdrawals: number
    netCapital: number
    pendingProfit: number
    ownershipPercent: number
  }
  transactions: Array<{
    id: string
    date: string
    type: 'investment' | 'profit_distribution' | 'withdrawal'
    description: string
    amount: number
    balance: number
    extra: Record<string, unknown>
  }>
}

export default function InvestorLedger({ investorId, onBack }: InvestorLedgerProps) {
  const [data, setData] = useState<LedgerData | null>(null)
  const [loading, setLoading] = useState(true)

  // Sub-dialogs
  const [investmentDialogOpen, setInvestmentDialogOpen] = useState(false)
  const [investmentAmount, setInvestmentAmount] = useState('')
  const [investmentDate, setInvestmentDate] = useState(new Date().toISOString().split('T')[0])
  const [investmentType, setInvestmentType] = useState('cash')
  const [investmentNotes, setInvestmentNotes] = useState('')
  const [investmentSubmitting, setInvestmentSubmitting] = useState(false)

  const [withdrawalDialogOpen, setWithdrawalDialogOpen] = useState(false)
  const [withdrawalAmount, setWithdrawalAmount] = useState('')
  const [withdrawalDate, setWithdrawalDate] = useState(new Date().toISOString().split('T')[0])
  const [withdrawalType, setWithdrawalType] = useState('profit')
  const [withdrawalNotes, setWithdrawalNotes] = useState('')
  const [withdrawalSubmitting, setWithdrawalSubmitting] = useState(false)

  const fetchLedger = useCallback(async () => {
    try {
      const res = await fetch(`/api/investors/${investorId}/ledger`)
      if (res.ok) {
        const result = await res.json()
        setData(result)
      }
    } catch {
      toast.error('فشل في تحميل دفتر المستثمر')
    } finally {
      setLoading(false)
    }
  }, [investorId])

  useEffect(() => {
    fetchLedger()
  }, [fetchLedger])

  const handleRecordInvestment = async () => {
    if (!investmentAmount || parseFloat(investmentAmount) <= 0) {
      toast.error('يرجى إدخال مبلغ الاستثمار')
      return
    }
    setInvestmentSubmitting(true)
    try {
      const res = await fetch('/api/investors/investments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          investorId,
          date: investmentDate,
          amount: parseFloat(investmentAmount),
          type: investmentType,
          notes: investmentNotes,
        }),
      })
      if (res.ok) {
        toast.success('تم تسجيل الاستثمار بنجاح')
        setInvestmentDialogOpen(false)
        setInvestmentAmount('')
        setInvestmentNotes('')
        fetchLedger()
      } else {
        const err = await res.json()
        toast.error(err.error || 'فشل في تسجيل الاستثمار')
      }
    } catch {
      toast.error('حدث خطأ')
    } finally {
      setInvestmentSubmitting(false)
    }
  }

  const handleRecordWithdrawal = async () => {
    if (!withdrawalAmount || parseFloat(withdrawalAmount) <= 0) {
      toast.error('يرجى إدخال مبلغ السحب')
      return
    }
    setWithdrawalSubmitting(true)
    try {
      const res = await fetch('/api/investors/withdrawals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          investorId,
          date: withdrawalDate,
          amount: parseFloat(withdrawalAmount),
          type: withdrawalType,
          notes: withdrawalNotes,
        }),
      })
      if (res.ok) {
        toast.success('تم تسجيل السحب بنجاح')
        setWithdrawalDialogOpen(false)
        setWithdrawalAmount('')
        setWithdrawalNotes('')
        fetchLedger()
      } else {
        const err = await res.json()
        toast.error(err.error || 'فشل في تسجيل السحب')
      }
    } catch {
      toast.error('حدث خطأ')
    } finally {
      setWithdrawalSubmitting(false)
    }
  }

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'investment':
        return { label: 'استثمار', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' }
      case 'profit_distribution':
        return { label: 'توزيع أرباح', color: 'bg-amber-50 text-amber-700 border-amber-200' }
      case 'withdrawal':
        return { label: 'سحب', color: 'bg-rose-50 text-rose-700 border-rose-200' }
      default:
        return { label: type, color: 'bg-slate-50 text-slate-700 border-slate-200' }
    }
  }

  if (loading) {
    return (
      <Card className="border shadow-sm">
        <CardContent className="p-6">
          <div className="space-y-4">
            <Skeleton className="h-8 w-40" />
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-24 w-full" />
              ))}
            </div>
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!data) return null

  const { investor, summary, transactions } = data

  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onBack} className="hover:bg-slate-100">
            <ArrowRight className="h-5 w-5" />
          </Button>
          <div className="h-10 w-10 rounded-xl bg-emerald-50 flex items-center justify-center">
            <Users className="h-5 w-5 text-emerald-600" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              {investor.fullName}
            </h2>
            <p className="text-xs text-slate-400">{investor.code}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={() => setInvestmentDialogOpen(true)}
            className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
          >
            <Banknote className="h-4 w-4" />
            تسجيل مساهمة
          </Button>
          <Button
            onClick={() => setWithdrawalDialogOpen(true)}
            variant="outline"
            className="border-rose-300 text-rose-700 hover:bg-rose-50 gap-2"
          >
            <ArrowDownFromLine className="h-4 w-4" />
            تسجيل سحب
          </Button>
        </div>
      </div>

      {/* Investor Info Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card className="border shadow-sm border-emerald-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-emerald-50">
                <DollarSign className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-xs text-slate-500">صافي رأس المال</p>
                <p className="text-lg font-bold text-slate-900 font-mono" dir="ltr">
                  {formatCurrency(summary.netCapital)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border shadow-sm border-teal-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-teal-50">
                <PieChart className="h-5 w-5 text-teal-600" />
              </div>
              <div>
                <p className="text-xs text-slate-500">نسبة الملكية</p>
                <p className="text-lg font-bold text-slate-900">
                  {summary.ownershipPercent.toFixed(1)}%
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border shadow-sm border-amber-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-amber-50">
                <TrendingUp className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-xs text-slate-500">الأرباح المستحقة</p>
                <p className="text-lg font-bold text-slate-900 font-mono" dir="ltr">
                  {formatCurrency(summary.pendingProfit)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border shadow-sm border-rose-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-rose-50">
                <TrendingDown className="h-5 w-5 text-rose-600" />
              </div>
              <div>
                <p className="text-xs text-slate-500">إجمالي المسحوبات</p>
                <p className="text-lg font-bold text-slate-900 font-mono" dir="ltr">
                  {formatCurrency(summary.totalWithdrawals)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Contact Info */}
      <Card className="border shadow-sm mb-6">
        <CardContent className="p-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
            <div>
              <span className="text-slate-400">الهاتف:</span>{' '}
              <span className="font-medium" dir="ltr">{investor.phone || '—'}</span>
            </div>
            <div>
              <span className="text-slate-400">البريد:</span>{' '}
              <span className="font-medium" dir="ltr">{investor.email || '—'}</span>
            </div>
            <div>
              <span className="text-slate-400">الرقم القومي:</span>{' '}
              <span className="font-medium" dir="ltr">{investor.nationalId || '—'}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Transaction Table */}
      <Card className="border shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">سجل المعاملات</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="max-h-[calc(100vh-560px)] overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50/80 hover:bg-slate-50/80">
                  <TableHead className="text-right font-semibold">التاريخ</TableHead>
                  <TableHead className="text-right font-semibold">النوع</TableHead>
                  <TableHead className="text-right font-semibold">البيان</TableHead>
                  <TableHead className="text-right font-semibold">المبلغ</TableHead>
                  <TableHead className="text-right font-semibold">الرصيد التراكمي</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-12">
                      <div className="flex flex-col items-center text-slate-400">
                        <p className="text-sm">لا توجد معاملات</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  transactions.map((tx) => {
                    const typeInfo = getTypeLabel(tx.type)
                    return (
                      <TableRow key={tx.id}>
                        <TableCell className="text-sm text-slate-500">
                          {formatDate(tx.date)}
                        </TableCell>
                        <TableCell>
                          <Badge className={`${typeInfo.color} border`}>
                            {typeInfo.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm">{tx.description}</TableCell>
                        <TableCell
                          className={`font-mono font-semibold ${
                            tx.amount >= 0 ? 'text-emerald-600' : 'text-rose-600'
                          }`}
                          dir="ltr"
                        >
                          {tx.amount >= 0 ? '+' : ''}{formatCurrency(tx.amount)}
                        </TableCell>
                        <TableCell className="font-mono" dir="ltr">
                          {formatCurrency(tx.balance)}
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Record Investment Dialog */}
      <Dialog open={investmentDialogOpen} onOpenChange={setInvestmentDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>تسجيل مساهمة رأس مال</DialogTitle>
            <DialogDescription>تسجيل مساهمة جديدة للمستثمر {investor.fullName}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="space-y-2">
              <Label>المبلغ <span className="text-red-500">*</span></Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={investmentAmount}
                onChange={(e) => setInvestmentAmount(e.target.value)}
                placeholder="0.00"
                dir="ltr"
                className="text-left"
              />
            </div>
            <div className="space-y-2">
              <Label>التاريخ</Label>
              <Input
                type="date"
                value={investmentDate}
                onChange={(e) => setInvestmentDate(e.target.value)}
                dir="ltr"
                className="text-left"
              />
            </div>
            <div className="space-y-2">
              <Label>طريقة الدفع</Label>
              <Select value={investmentType} onValueChange={setInvestmentType}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">نقدي</SelectItem>
                  <SelectItem value="bank">تحويل بنكي</SelectItem>
                  <SelectItem value="asset">أصول</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>ملاحظات</Label>
              <Textarea
                value={investmentNotes}
                onChange={(e) => setInvestmentNotes(e.target.value)}
                placeholder="ملاحظات إضافية..."
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInvestmentDialogOpen(false)}>إلغاء</Button>
            <Button
              onClick={handleRecordInvestment}
              disabled={investmentSubmitting}
              className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
            >
              {investmentSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
              تسجيل
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Withdrawal Dialog */}
      <Dialog open={withdrawalDialogOpen} onOpenChange={setWithdrawalDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>تسجيل سحب</DialogTitle>
            <DialogDescription>تسجيل سحب للمستثمر {investor.fullName}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="space-y-2">
              <Label>نوع السحب</Label>
              <Select value={withdrawalType} onValueChange={setWithdrawalType}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="profit">سحب أرباح</SelectItem>
                  <SelectItem value="capital">سحب رأس مال</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>المبلغ <span className="text-red-500">*</span></Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={withdrawalAmount}
                onChange={(e) => setWithdrawalAmount(e.target.value)}
                placeholder="0.00"
                dir="ltr"
                className="text-left"
              />
            </div>
            <div className="space-y-2">
              <Label>التاريخ</Label>
              <Input
                type="date"
                value={withdrawalDate}
                onChange={(e) => setWithdrawalDate(e.target.value)}
                dir="ltr"
                className="text-left"
              />
            </div>
            <div className="space-y-2">
              <Label>ملاحظات</Label>
              <Textarea
                value={withdrawalNotes}
                onChange={(e) => setWithdrawalNotes(e.target.value)}
                placeholder="ملاحظات إضافية..."
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setWithdrawalDialogOpen(false)}>إلغاء</Button>
            <Button
              onClick={handleRecordWithdrawal}
              disabled={withdrawalSubmitting}
              className="bg-rose-600 hover:bg-rose-700 text-white gap-2"
            >
              {withdrawalSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
              تسجيل
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
