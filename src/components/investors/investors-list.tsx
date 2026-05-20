'use client'

import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import {
  Users,
  Plus,
  Search,
  Loader2,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Eye,
  Pencil,
  Banknote,
  HandCoins,
  ArrowDownFromLine,
  Trash2,
  AlertTriangle,
  X,
  Star,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { Progress } from '@/components/ui/progress'
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
import InvestorLedger from './investor-ledger'
import DistributionsList from './distributions-list'

interface InvestorSummary {
  id: string
  code: string
  fullName: string
  phone: string | null
  email: string | null
  nationalId: string | null
  joinDate: string
  status: string
  totalInvestment: number
  totalProfitShare: number
  pendingProfit: number
  totalWithdrawals: number
}

interface InvestorFormData {
  fullName: string
  phone: string
  email: string
  nationalId: string
  status: string
}

const initialFormData: InvestorFormData = {
  fullName: '',
  phone: '',
  email: '',
  nationalId: '',
  status: 'active',
}

export default function InvestorsList() {
  const [investors, setInvestors] = useState<InvestorSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formData, setFormData] = useState<InvestorFormData>(initialFormData)
  const [submitting, setSubmitting] = useState(false)

  // Sub-dialogs
  const [ledgerInvestorId, setLedgerInvestorId] = useState<string | null>(null)
  const [investmentDialogOpen, setInvestmentDialogOpen] = useState(false)
  const [investmentInvestorId, setInvestmentInvestorId] = useState<string | null>(null)
  const [investmentAmount, setInvestmentAmount] = useState('')
  const [investmentDate, setInvestmentDate] = useState(new Date().toISOString().split('T')[0])
  const [investmentType, setInvestmentType] = useState('cash')
  const [investmentNotes, setInvestmentNotes] = useState('')
  const [investmentSubmitting, setInvestmentSubmitting] = useState(false)

  const [distributionDialogOpen, setDistributionDialogOpen] = useState(false)
  const [showDistributions, setShowDistributions] = useState(false)

  const [withdrawalDialogOpen, setWithdrawalDialogOpen] = useState(false)
  const [withdrawalInvestorId, setWithdrawalInvestorId] = useState<string | null>(null)
  const [withdrawalAmount, setWithdrawalAmount] = useState('')
  const [withdrawalDate, setWithdrawalDate] = useState(new Date().toISOString().split('T')[0])
  const [withdrawalType, setWithdrawalType] = useState('profit')
  const [withdrawalNotes, setWithdrawalNotes] = useState('')
  const [withdrawalSubmitting, setWithdrawalSubmitting] = useState(false)

  // Delete dialog
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deletingInvestor, setDeletingInvestor] = useState<InvestorSummary | null>(null)
  const [deleting, setDeleting] = useState(false)

  const fetchInvestors = useCallback(async () => {
    try {
      const res = await fetch('/api/investors')
      if (res.ok) {
        const data = await res.json()
        setInvestors(data)
      }
    } catch {
      toast.error('فشل في تحميل بيانات المستثمرين')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchInvestors()
  }, [fetchInvestors])

  // Summary calculations
  const totalCapital = investors.reduce((sum, i) => sum + i.totalInvestment, 0)
  const totalProfitDistributed = investors.reduce((sum, i) => sum + i.totalProfitShare, 0)
  const totalWithdrawals = investors.reduce((sum, i) => sum + i.totalWithdrawals, 0)

  // Filter
  const filteredInvestors = investors.filter((inv) => {
    if (!searchTerm) return true
    return (
      inv.fullName.includes(searchTerm) ||
      inv.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (inv.phone && inv.phone.includes(searchTerm))
    )
  })

  // Ownership calculation
  const getOwnership = (inv: InvestorSummary) => {
    if (totalCapital === 0) return 0
    return Math.round((inv.totalInvestment / totalCapital) * 10000) / 100
  }

  const handleOpenAdd = () => {
    setEditingId(null)
    setFormData(initialFormData)
    setDialogOpen(true)
  }

  const handleOpenEdit = (inv: InvestorSummary) => {
    setEditingId(inv.id)
    setFormData({
      fullName: inv.fullName,
      phone: inv.phone || '',
      email: inv.email || '',
      nationalId: inv.nationalId || '',
      status: inv.status,
    })
    setDialogOpen(true)
  }

  const handleSubmit = async () => {
    if (!formData.fullName.trim()) {
      toast.error('يرجى إدخال اسم المستثمر')
      return
    }

    setSubmitting(true)
    try {
      if (editingId) {
        // Update investor
        const res = await fetch(`/api/investors`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: editingId, ...formData }),
        })
        if (res.ok) {
          toast.success('تم تحديث بيانات المستثمر بنجاح')
          setDialogOpen(false)
          fetchInvestors()
        } else {
          const err = await res.json()
          toast.error(err.error || 'فشل في التحديث')
        }
      } else {
        const res = await fetch('/api/investors', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData),
        })
        if (res.ok) {
          toast.success('تم إضافة المستثمر بنجاح')
          setDialogOpen(false)
          fetchInvestors()
        } else {
          const err = await res.json()
          toast.error(err.error || 'فشل في الإضافة')
        }
      }
    } catch {
      toast.error('حدث خطأ أثناء حفظ البيانات')
    } finally {
      setSubmitting(false)
    }
  }

  const handleRecordInvestment = async () => {
    if (!investmentInvestorId || !investmentAmount || parseFloat(investmentAmount) <= 0) {
      toast.error('يرجى إدخال مبلغ الاستثمار')
      return
    }

    setInvestmentSubmitting(true)
    try {
      const res = await fetch('/api/investors/investments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          investorId: investmentInvestorId,
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
        fetchInvestors()
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

  const handleDeleteInvestor = async () => {
    if (!deletingInvestor) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/investors/${deletingInvestor.id}`, {
        method: 'DELETE',
      })
      if (res.ok) {
        toast.success('تم حذف المستثمر بنجاح')
        setDeleteOpen(false)
        setDeletingInvestor(null)
        fetchInvestors()
      } else {
        const err = await res.json()
        toast.error(err.error || 'فشل في حذف المستثمر')
      }
    } catch {
      toast.error('حدث خطأ أثناء حذف المستثمر')
    } finally {
      setDeleting(false)
    }
  }

  const handleRecordWithdrawal = async () => {
    if (!withdrawalInvestorId || !withdrawalAmount || parseFloat(withdrawalAmount) <= 0) {
      toast.error('يرجى إدخال مبلغ السحب')
      return
    }

    setWithdrawalSubmitting(true)
    try {
      const res = await fetch('/api/investors/withdrawals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          investorId: withdrawalInvestorId,
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
        fetchInvestors()
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

  // Show distributions view
  if (showDistributions) {
    return <DistributionsList onBack={() => { setShowDistributions(false); fetchInvestors() }} />
  }

  // Show ledger view
  if (ledgerInvestorId) {
    return (
      <InvestorLedger
        investorId={ledgerInvestorId}
        onBack={() => { setLedgerInvestorId(null); fetchInvestors() }}
      />
    )
  }

  if (loading) {
    return (
      <Card className="border shadow-sm">
        <CardHeader>
          <div className="flex items-center justify-between">
            <Skeleton className="h-7 w-48" />
            <Skeleton className="h-10 w-36" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-24 w-full" />
            ))}
          </div>
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
      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card className="border shadow-sm border-emerald-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-emerald-50">
                <DollarSign className="h-5 w-5 text-emerald-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-slate-500">إجمالي رأس المال</p>
                <p className="text-lg font-bold text-slate-900 font-mono" dir="ltr">
                  {formatCurrency(totalCapital)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border shadow-sm border-teal-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-teal-50">
                <Users className="h-5 w-5 text-teal-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-slate-500">عدد المستثمرين</p>
                <p className="text-lg font-bold text-slate-900">
                  {investors.filter((i) => i.status === 'active').length}
                  <span className="text-xs text-slate-400 font-normal mr-1">نشط</span>
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
              <div className="flex-1 min-w-0">
                <p className="text-xs text-slate-500">إجمالي الأرباح الموزعة</p>
                <p className="text-lg font-bold text-slate-900 font-mono" dir="ltr">
                  {formatCurrency(totalProfitDistributed)}
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
              <div className="flex-1 min-w-0">
                <p className="text-xs text-slate-500">إجمالي المسحوبات</p>
                <p className="text-lg font-bold text-slate-900 font-mono" dir="ltr">
                  {formatCurrency(totalWithdrawals)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Card */}
      <Card className="border shadow-sm">
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-emerald-50 flex items-center justify-center">
                <Users className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <CardTitle className="text-lg">المستثمرون</CardTitle>
                <p className="text-xs text-slate-400 mt-0.5">
                  {investors.length.toLocaleString('ar-EG')} مستثمر
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Button
                onClick={() => setShowDistributions(true)}
                variant="outline"
                className="border-amber-300 text-amber-700 hover:bg-amber-50 gap-2"
              >
                <HandCoins className="h-4 w-4" />
                التوزيعات
              </Button>
              <Button
                onClick={handleOpenAdd}
                className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
              >
                <Plus className="h-4 w-4" />
                إضافة مستثمر
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Search */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mb-4">
            <div className="relative flex-1">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="بحث بالاسم أو الكود أو الهاتف..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pr-9"
              />
            </div>
          </div>

          {/* Table */}
          <div className="max-h-[calc(100vh-420px)] overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50/80 hover:bg-slate-50/80">
                  <TableHead className="text-right font-semibold">الكود</TableHead>
                  <TableHead className="text-right font-semibold">الاسم</TableHead>
                  <TableHead className="text-right font-semibold">إجمالي الاستثمار</TableHead>
                  <TableHead className="text-right font-semibold">نسبة الملكية %</TableHead>
                  <TableHead className="text-right font-semibold">الأرباح المستحقة</TableHead>
                  <TableHead className="text-right font-semibold">الحالة</TableHead>
                  <TableHead className="text-right font-semibold">إجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredInvestors.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-12">
                      <div className="flex flex-col items-center text-slate-400">
                        <Users className="h-12 w-12 mb-3 text-slate-200" />
                        <p className="text-sm">
                          {searchTerm
                            ? 'لا يوجد مستثمرون مطابقون للبحث'
                            : 'لا يوجد مستثمرون مسجلون'}
                        </p>
                        <p className="text-xs mt-1 text-slate-300">
                          اضغط على &quot;إضافة مستثمر&quot; لإضافة مستثمر جديد
                        </p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredInvestors.map((inv) => {
                    const ownership = getOwnership(inv)
                    return (
                      <TableRow key={inv.id} className="group">
                        <TableCell className="font-mono text-sm">{inv.code}</TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{inv.fullName}</p>
                            {inv.phone && (
                              <p className="text-xs text-slate-400" dir="ltr">{inv.phone}</p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="font-mono font-semibold" dir="ltr">
                          {formatCurrency(inv.totalInvestment)}
                        </TableCell>
                        <TableCell>
                          <div className="min-w-[80px]">
                            <p className="text-sm font-medium mb-1">{ownership.toFixed(1)}%</p>
                            <Progress value={ownership} className="h-1.5" />
                          </div>
                        </TableCell>
                        <TableCell className="font-mono" dir="ltr">
                          <span className={inv.pendingProfit > 0 ? 'text-amber-600 font-semibold' : 'text-slate-400'}>
                            {formatCurrency(inv.pendingProfit)}
                          </span>
                        </TableCell>
                        <TableCell>
                          {inv.status === 'active' ? (
                            <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200">
                              نشط
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="bg-slate-100 text-slate-500">
                              غير نشط
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setLedgerInvestorId(inv.id)}
                              className="h-8 w-8 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50"
                              title="عرض الدفتر"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleOpenEdit(inv)}
                              className="h-8 w-8 text-slate-500 hover:text-teal-600 hover:bg-teal-50"
                              title="تعديل"
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                setInvestmentInvestorId(inv.id)
                                setInvestmentDialogOpen(true)
                              }}
                              className="h-8 w-8 text-slate-500 hover:text-blue-600 hover:bg-blue-50"
                              title="تسجيل استثمار"
                            >
                              <Banknote className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                setWithdrawalInvestorId(inv.id)
                                setWithdrawalType('profit')
                                setWithdrawalDialogOpen(true)
                              }}
                              className="h-8 w-8 text-slate-500 hover:text-rose-600 hover:bg-rose-50"
                              title="سحب"
                            >
                              <ArrowDownFromLine className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                setDeletingInvestor(inv)
                                setDeleteOpen(true)
                              }}
                              className="h-8 w-8 text-slate-500 hover:text-red-600 hover:bg-red-50"
                              title="حذف"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
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

      {/* Add/Edit Investor Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId ? 'تعديل بيانات المستثمر' : 'إضافة مستثمر جديد'}</DialogTitle>
            <DialogDescription>
              {editingId ? 'قم بتعديل بيانات المستثمر' : 'أدخل بيانات المستثمر الجديد'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="inv-fullName">
                الاسم الكامل <span className="text-red-500">*</span>
              </Label>
              <Input
                id="inv-fullName"
                value={formData.fullName}
                onChange={(e) => setFormData((p) => ({ ...p, fullName: e.target.value }))}
                placeholder="أحمد محمد علي"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="inv-phone">الهاتف</Label>
              <Input
                id="inv-phone"
                value={formData.phone}
                onChange={(e) => setFormData((p) => ({ ...p, phone: e.target.value }))}
                placeholder="01012345678"
                dir="ltr"
                className="text-left"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="inv-email">البريد الإلكتروني</Label>
              <Input
                id="inv-email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData((p) => ({ ...p, email: e.target.value }))}
                placeholder="email@example.com"
                dir="ltr"
                className="text-left"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="inv-nationalId">الرقم القومي</Label>
              <Input
                id="inv-nationalId"
                value={formData.nationalId}
                onChange={(e) => setFormData((p) => ({ ...p, nationalId: e.target.value }))}
                placeholder="29901011234567"
                dir="ltr"
                className="text-left"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="inv-status">الحالة</Label>
              <Select
                value={formData.status}
                onValueChange={(val) => setFormData((p) => ({ ...p, status: val }))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">نشط</SelectItem>
                  <SelectItem value="inactive">غير نشط</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              إلغاء
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={submitting}
              className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {editingId ? 'تحديث' : 'إضافة'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Record Investment Dialog */}
      <Dialog open={investmentDialogOpen} onOpenChange={setInvestmentDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>تسجيل استثمار</DialogTitle>
            <DialogDescription>
              تسجيل مساهمة رأس مال جديدة للمستثمر
            </DialogDescription>
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
            <Button variant="outline" onClick={() => setInvestmentDialogOpen(false)}>
              إلغاء
            </Button>
            <Button
              onClick={handleRecordInvestment}
              disabled={investmentSubmitting}
              className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
            >
              {investmentSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
              تسجيل الاستثمار
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Withdrawal Dialog */}
      <Dialog open={withdrawalDialogOpen} onOpenChange={setWithdrawalDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>تسجيل سحب</DialogTitle>
            <DialogDescription>
              تسجيل سحب رأس مال أو أرباح للمستثمر
            </DialogDescription>
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
            <Button variant="outline" onClick={() => setWithdrawalDialogOpen(false)}>
              إلغاء
            </Button>
            <Button
              onClick={handleRecordWithdrawal}
              disabled={withdrawalSubmitting}
              className="bg-rose-600 hover:bg-rose-700 text-white gap-2"
            >
              {withdrawalSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
              تسجيل السحب
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-700">
              <AlertTriangle className="h-5 w-5" />
              حذف المستثمر
            </DialogTitle>
            <DialogDescription>
              هل أنت متأكد من حذف &quot;{deletingInvestor?.fullName}&quot;؟
            </DialogDescription>
          </DialogHeader>
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-red-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-bold text-red-800">
                  سيتم حذف جميع بيانات المستثمر نهائياً بما فيها الاستثمارات والسحوبات والتوزيعات.
                </p>
                <p className="text-xs text-red-600 mt-1">
                  لا يمكن التراجع عن هذا الإجراء.
                </p>
              </div>
            </div>
          </div>
          {deletingInvestor && deletingInvestor.totalInvestment > 0 && (
            <div className="bg-slate-50 rounded-lg p-3">
              <p className="text-xs font-semibold text-slate-600 mb-2">بيانات المستثمر:</p>
              <div className="grid grid-cols-2 gap-1.5">
                <div className="flex items-center justify-between text-xs bg-white rounded px-2 py-1.5">
                  <span className="text-slate-600">إجمالي الاستثمار</span>
                  <span className="font-mono font-bold text-emerald-600" dir="ltr">
                    {formatCurrency(deletingInvestor.totalInvestment)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs bg-white rounded px-2 py-1.5">
                  <span className="text-slate-600">الأرباح المستحقة</span>
                  <span className="font-mono font-bold text-amber-600" dir="ltr">
                    {formatCurrency(deletingInvestor.pendingProfit)}
                  </span>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)} disabled={deleting}>
              تراجع
            </Button>
            <Button
              onClick={handleDeleteInvestor}
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700 text-white gap-2"
            >
              {deleting && <Loader2 className="h-4 w-4 animate-spin" />}
              <Trash2 className="h-4 w-4" />
              حذف نهائي
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
