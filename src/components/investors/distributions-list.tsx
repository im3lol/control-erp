'use client'

import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import {
  ArrowRight,
  Plus,
  Loader2,
  HandCoins,
  CheckCircle2,
  Eye,
  Send,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { formatCurrency, formatDate } from '@/lib/erp-utils'

interface DistributionsListProps {
  onBack: () => void
}

interface InvestorShare {
  id: string
  investorId: string
  ownershipPercent: number
  profitShare: number
  status: string
  paymentDate: string | null
  investor: {
    id: string
    code: string
    fullName: string
  }
}

interface Distribution {
  id: string
  periodName: string
  periodStart: string
  periodEnd: string
  totalProfit: number
  distributionDate: string
  status: string
  investorShares: InvestorShare[]
}

export default function DistributionsList({ onBack }: DistributionsListProps) {
  const [distributions, setDistributions] = useState<Distribution[]>([])
  const [loading, setLoading] = useState(true)
  const [detailId, setDetailId] = useState<string | null>(null)
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // Create distribution form
  const [periodName, setPeriodName] = useState('')
  const [periodStart, setPeriodStart] = useState('')
  const [periodEnd, setPeriodEnd] = useState('')
  const [totalProfit, setTotalProfit] = useState('')
  const [distributionDate, setDistributionDate] = useState(new Date().toISOString().split('T')[0])

  const [distributeSubmitting, setDistributeSubmitting] = useState(false)
  const [paySubmitting, setPaySubmitting] = useState(false)

  const fetchDistributions = useCallback(async () => {
    try {
      const res = await fetch('/api/investors/distributions')
      if (res.ok) {
        const data = await res.json()
        setDistributions(data)
      }
    } catch {
      toast.error('فشل في تحميل بيانات التوزيعات')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchDistributions()
  }, [fetchDistributions])

  const handleCreate = async () => {
    if (!periodName || !periodStart || !periodEnd || !totalProfit || parseFloat(totalProfit) <= 0) {
      toast.error('يرجى ملء جميع الحقول المطلوبة')
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch('/api/investors/distributions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          periodName,
          periodStart,
          periodEnd,
          totalProfit: parseFloat(totalProfit),
          distributionDate,
        }),
      })
      if (res.ok) {
        toast.success('تم إنشاء توزيع الأرباح بنجاح')
        setCreateDialogOpen(false)
        setPeriodName('')
        setPeriodStart('')
        setPeriodEnd('')
        setTotalProfit('')
        fetchDistributions()
      } else {
        const err = await res.json()
        toast.error(err.error || 'فشل في إنشاء التوزيع')
      }
    } catch {
      toast.error('حدث خطأ')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDistribute = async (id: string) => {
    setDistributeSubmitting(true)
    try {
      const res = await fetch(`/api/investors/distributions/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'distribute' }),
      })
      if (res.ok) {
        toast.success('تم توزيع الأرباح بنجاح وإنشاء القيود المحاسبية')
        fetchDistributions()
        setDetailId(null)
      } else {
        const err = await res.json()
        toast.error(err.error || 'فشل في التوزيع')
      }
    } catch {
      toast.error('حدث خطأ')
    } finally {
      setDistributeSubmitting(false)
    }
  }

  const handlePay = async (distributionId: string, shareIds: string[]) => {
    setPaySubmitting(true)
    try {
      const res = await fetch(`/api/investors/distributions/${distributionId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'pay', shareIds }),
      })
      if (res.ok) {
        toast.success('تم صرف الأرباح بنجاح')
        fetchDistributions()
      } else {
        const err = await res.json()
        toast.error(err.error || 'فشل في الصرف')
      }
    } catch {
      toast.error('حدث خطأ')
    } finally {
      setPaySubmitting(false)
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'DRAFT':
        return <Badge className="bg-yellow-50 text-yellow-700 border-yellow-200 border">مسودة</Badge>
      case 'DISTRIBUTED':
        return <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 border">موزعة</Badge>
      case 'PENDING':
        return <Badge className="bg-amber-50 text-amber-700 border-amber-200 border">معلقة</Badge>
      case 'PAID':
        return <Badge className="bg-teal-50 text-teal-700 border-teal-200 border">مدفوعة</Badge>
      default:
        return <Badge variant="secondary">{status}</Badge>
    }
  }

  // Detail view
  const selectedDistribution = distributions.find((d) => d.id === detailId)

  if (loading) {
    return (
      <Card className="border shadow-sm">
        <CardContent className="p-6">
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
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onBack} className="hover:bg-slate-100">
            <ArrowRight className="h-5 w-5" />
          </Button>
          <div className="h-10 w-10 rounded-xl bg-amber-50 flex items-center justify-center">
            <HandCoins className="h-5 w-5 text-amber-600" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">توزيعات الأرباح</h2>
            <p className="text-xs text-slate-400">{distributions.length} توزيع</p>
          </div>
        </div>
        <Button
          onClick={() => setCreateDialogOpen(true)}
          className="bg-amber-600 hover:bg-amber-700 text-white gap-2"
        >
          <Plus className="h-4 w-4" />
          توزيع أرباح جديد
        </Button>
      </div>

      {/* Detail Dialog */}
      {detailId && selectedDistribution && (
        <Dialog open={!!detailId} onOpenChange={(open) => !open && setDetailId(null)}>
          <DialogContent className="sm:max-w-3xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>تفاصيل التوزيع - {selectedDistribution.periodName}</DialogTitle>
              <DialogDescription>
                إجمالي الأرباح: {formatCurrency(selectedDistribution.totalProfit)} | الحالة: {getStatusBadge(selectedDistribution.status)}
              </DialogDescription>
            </DialogHeader>
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50/80">
                  <TableHead className="text-right font-semibold">المستثمر</TableHead>
                  <TableHead className="text-right font-semibold">نسبة الملكية</TableHead>
                  <TableHead className="text-right font-semibold">نصيبه من الأرباح</TableHead>
                  <TableHead className="text-right font-semibold">الحالة</TableHead>
                  <TableHead className="text-right font-semibold">إجراء</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {selectedDistribution.investorShares.map((share) => (
                  <TableRow key={share.id}>
                    <TableCell className="font-medium">
                      {share.investor.fullName}
                      <span className="text-xs text-slate-400 mr-1">({share.investor.code})</span>
                    </TableCell>
                    <TableCell>{share.ownershipPercent.toFixed(1)}%</TableCell>
                    <TableCell className="font-mono font-semibold" dir="ltr">
                      {formatCurrency(share.profitShare)}
                    </TableCell>
                    <TableCell>{getStatusBadge(share.status)}</TableCell>
                    <TableCell>
                      {share.status === 'PENDING' && selectedDistribution.status === 'DISTRIBUTED' && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handlePay(selectedDistribution.id, [share.id])}
                          disabled={paySubmitting}
                          className="gap-1 text-teal-700 border-teal-300 hover:bg-teal-50"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          صرف
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <DialogFooter className="flex-row gap-2 justify-start">
              {selectedDistribution.status === 'DRAFT' && (
                <Button
                  onClick={() => handleDistribute(selectedDistribution.id)}
                  disabled={distributeSubmitting}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
                >
                  {distributeSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                  <Send className="h-4 w-4" />
                  توزيع الأرباح
                </Button>
              )}
              {selectedDistribution.status === 'DISTRIBUTED' && (
                <Button
                  onClick={() => {
                    const pendingShares = selectedDistribution.investorShares
                      .filter((s) => s.status === 'PENDING')
                      .map((s) => s.id)
                    if (pendingShares.length > 0) {
                      handlePay(selectedDistribution.id, pendingShares)
                    } else {
                      toast.info('تم صرف جميع الأرباح')
                    }
                  }}
                  disabled={paySubmitting}
                  variant="outline"
                  className="gap-2 text-teal-700 border-teal-300 hover:bg-teal-50"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  صرف الكل
                </Button>
              )}
              <Button variant="outline" onClick={() => setDetailId(null)}>
                إغلاق
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Main Table */}
      <Card className="border shadow-sm">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50/80 hover:bg-slate-50/80">
                <TableHead className="text-right font-semibold">الفترة</TableHead>
                <TableHead className="text-right font-semibold">إجمالي الأرباح</TableHead>
                <TableHead className="text-right font-semibold">تاريخ التوزيع</TableHead>
                <TableHead className="text-right font-semibold">عدد المستثمرين</TableHead>
                <TableHead className="text-right font-semibold">الحالة</TableHead>
                <TableHead className="text-right font-semibold">إجراءات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {distributions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-12">
                    <div className="flex flex-col items-center text-slate-400">
                      <HandCoins className="h-12 w-12 mb-3 text-slate-200" />
                      <p className="text-sm">لا توجد توزيعات أرباح</p>
                      <p className="text-xs mt-1 text-slate-300">
                        اضغط على &quot;توزيع أرباح جديد&quot; لإنشاء توزيع
                      </p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                distributions.map((dist) => (
                  <TableRow key={dist.id}>
                    <TableCell className="font-medium">{dist.periodName}</TableCell>
                    <TableCell className="font-mono font-semibold" dir="ltr">
                      {formatCurrency(dist.totalProfit)}
                    </TableCell>
                    <TableCell className="text-sm text-slate-500">
                      {formatDate(dist.distributionDate)}
                    </TableCell>
                    <TableCell>{dist.investorShares.length}</TableCell>
                    <TableCell>{getStatusBadge(dist.status)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDetailId(dist.id)}
                          className="h-8 w-8 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50"
                          title="عرض التفاصيل"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        {dist.status === 'DRAFT' && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDistribute(dist.id)}
                            disabled={distributeSubmitting}
                            className="h-8 w-8 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50"
                            title="توزيع"
                          >
                            <Send className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Create Distribution Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>توزيع أرباح جديد</DialogTitle>
            <DialogDescription>
              إنشاء توزيع أرباح جديد للمستثمرين النشطين
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="space-y-2">
              <Label>اسم الفترة <span className="text-red-500">*</span></Label>
              <Input
                value={periodName}
                onChange={(e) => setPeriodName(e.target.value)}
                placeholder="الربع الأول 2026"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>بداية الفترة</Label>
                <Input
                  type="date"
                  value={periodStart}
                  onChange={(e) => setPeriodStart(e.target.value)}
                  dir="ltr"
                  className="text-left"
                />
              </div>
              <div className="space-y-2">
                <Label>نهاية الفترة</Label>
                <Input
                  type="date"
                  value={periodEnd}
                  onChange={(e) => setPeriodEnd(e.target.value)}
                  dir="ltr"
                  className="text-left"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>إجمالي الأرباح <span className="text-red-500">*</span></Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={totalProfit}
                onChange={(e) => setTotalProfit(e.target.value)}
                placeholder="0.00"
                dir="ltr"
                className="text-left"
              />
            </div>
            <div className="space-y-2">
              <Label>تاريخ التوزيع</Label>
              <Input
                type="date"
                value={distributionDate}
                onChange={(e) => setDistributionDate(e.target.value)}
                dir="ltr"
                className="text-left"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>إلغاء</Button>
            <Button
              onClick={handleCreate}
              disabled={submitting}
              className="bg-amber-600 hover:bg-amber-700 text-white gap-2"
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              إنشاء التوزيع
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
