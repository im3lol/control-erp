'use client'

import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import {
  Plus, CreditCard, Loader2, Search,
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
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { formatCurrency, formatDate } from '@/lib/erp-utils'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Supplier {
  id: string
  code: string
  nameAr: string
  nameEn: string | null
  balance: number
}

interface UnpaidInvoice {
  id: string
  number: string
  date: string
  totalAmount: number
  paidAmount: number
  balanceDue: number
}

interface PaymentLine {
  purchaseInvoiceId: string
  amount: string
}

interface PaymentVoucher {
  id: string
  number: string
  supplierId: string
  date: string
  amount: number
  paymentMethod: string
  reference: string | null
  notes: string | null
  supplier: { id: string; code: string; nameAr: string; nameEn: string | null }
  lines?: Array<{
    id: string
    purchaseInvoiceId: string
    amount: number
    purchaseInvoice: { id: string; number: string; totalAmount: number }
  }>
}

const paymentMethodLabels: Record<string, string> = {
  CASH: 'نقدي',
  CHECK: 'شيك',
  TRANSFER: 'تحويل بنكي',
  CARD: 'بطاقة',
}

const paymentMethodColors: Record<string, string> = {
  CASH: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  CHECK: 'bg-teal-50 text-teal-700 border-teal-200',
  TRANSFER: 'bg-cyan-50 text-cyan-700 border-cyan-200',
  CARD: 'bg-orange-50 text-orange-700 border-orange-200',
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function PaymentVouchersList() {
  const [payments, setPayments] = useState<PaymentVoucher[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  // Filters
  const [supplierFilter, setSupplierFilter] = useState('all')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')

  // New payment dialog
  const [newDialogOpen, setNewDialogOpen] = useState(false)
  const [paymentSupplierId, setPaymentSupplierId] = useState('')
  const [paymentAmount, setPaymentAmount] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('CASH')
  const [paymentReference, setPaymentReference] = useState('')
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0])
  const [paymentNotes, setPaymentNotes] = useState('')
  const [unpaidInvoices, setUnpaidInvoices] = useState<UnpaidInvoice[]>([])
  const [paymentLines, setPaymentLines] = useState<PaymentLine[]>([])
  const [loadingInvoices, setLoadingInvoices] = useState(false)

  useEffect(() => {
    fetchPayments()
    fetchSuppliers()
  }, [])

  const fetchPayments = async () => {
    try {
      const params = new URLSearchParams()
      if (supplierFilter !== 'all') params.set('supplierId', supplierFilter)
      if (fromDate) params.set('fromDate', fromDate)
      if (toDate) params.set('toDate', toDate)

      const res = await fetch(`/api/purchases/payments?${params.toString()}`)
      if (res.ok) {
        const data = await res.json()
        setPayments(data)
      }
    } catch {
      toast.error('فشل في تحميل سندات الصرف')
    } finally {
      setLoading(false)
    }
  }

  const fetchSuppliers = async () => {
    try {
      const res = await fetch('/api/purchases/suppliers?activeOnly=true')
      if (res.ok) setSuppliers(await res.json())
    } catch { /* silent */ }
  }

  useEffect(() => {
    if (!loading) fetchPayments()
  }, [supplierFilter, fromDate, toDate])

  // Load unpaid invoices when supplier is selected
  const loadUnpaidInvoices = useCallback(async (supplierId: string) => {
    setLoadingInvoices(true)
    try {
      const res = await fetch(`/api/purchases/invoices?supplierId=${supplierId}&status=CONFIRMED`)
      if (res.ok) {
        const allInvoices = await res.json()
        // Also get PARTIAL_PAID invoices
        const res2 = await fetch(`/api/purchases/invoices?supplierId=${supplierId}&status=PARTIAL_PAID`)
        let partialInvoices: UnpaidInvoice[] = []
        if (res2.ok) {
          partialInvoices = await res2.json()
        }
        const combined = [...allInvoices, ...partialInvoices]
          .filter((inv: { balanceDue: number }) => inv.balanceDue > 0)
          .map((inv: { id: string; number: string; date: string; totalAmount: number; paidAmount: number; balanceDue: number }) => ({
            id: inv.id,
            number: inv.number,
            date: inv.date,
            totalAmount: inv.totalAmount,
            paidAmount: inv.paidAmount,
            balanceDue: inv.balanceDue,
          }))
        setUnpaidInvoices(combined)
        setPaymentLines(combined.map((inv: UnpaidInvoice) => ({
          purchaseInvoiceId: inv.id,
          amount: '',
        })))
      }
    } catch {
      toast.error('فشل في تحميل الفواتير المستحقة')
    } finally {
      setLoadingInvoices(false)
    }
  }, [])

  const handleSupplierChange = (supplierId: string) => {
    setPaymentSupplierId(supplierId)
    setPaymentAmount('')
    if (supplierId) {
      loadUnpaidInvoices(supplierId)
    } else {
      setUnpaidInvoices([])
      setPaymentLines([])
    }
  }

  // Auto-distribute amount across invoices
  const autoDistribute = () => {
    const totalAmount = parseFloat(paymentAmount) || 0
    if (totalAmount <= 0 || unpaidInvoices.length === 0) return

    let remaining = totalAmount
    const newLines = unpaidInvoices.map((inv) => {
      const allocated = Math.min(remaining, inv.balanceDue)
      remaining -= allocated
      return {
        purchaseInvoiceId: inv.id,
        amount: allocated > 0 ? String(Math.round(allocated * 100) / 100) : '',
      }
    })
    setPaymentLines(newLines)
  }

  const updatePaymentLine = (index: number, amount: string) => {
    setPaymentLines((prev) => {
      const updated = [...prev]
      updated[index] = { ...updated[index], amount }
      return updated
    })
  }

  const totalAllocated = paymentLines.reduce((sum, l) => sum + (parseFloat(l.amount) || 0), 0)

  // ── Save Payment ──

  const handleSavePayment = async () => {
    if (!paymentSupplierId) {
      toast.error('يرجى اختيار المورد')
      return
    }
    const amount = parseFloat(paymentAmount) || 0
    if (amount <= 0) {
      toast.error('يجب أن يكون المبلغ أكبر من صفر')
      return
    }

    const validLines = paymentLines.filter((l) => parseFloat(l.amount) > 0)
    if (validLines.length === 0) {
      toast.error('يرجى توزيع المبلغ على الفواتير')
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch('/api/purchases/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supplierId: paymentSupplierId,
          date: paymentDate,
          amount,
          paymentMethod,
          reference: paymentReference,
          notes: paymentNotes,
          lines: validLines.map((l) => ({
            purchaseInvoiceId: l.purchaseInvoiceId,
            amount: parseFloat(l.amount),
          })),
        }),
      })

      if (res.ok) {
        toast.success('تم إنشاء سند الصرف بنجاح')
        setNewDialogOpen(false)
        resetNewForm()
        fetchPayments()
      } else {
        const err = await res.json()
        toast.error(err.error || 'فشل في إنشاء سند الصرف')
      }
    } catch {
      toast.error('حدث خطأ أثناء إنشاء سند الصرف')
    } finally {
      setSubmitting(false)
    }
  }

  const resetNewForm = () => {
    setPaymentSupplierId('')
    setPaymentAmount('')
    setPaymentMethod('CASH')
    setPaymentReference('')
    setPaymentDate(new Date().toISOString().split('T')[0])
    setPaymentNotes('')
    setUnpaidInvoices([])
    setPaymentLines([])
  }

  if (loading) {
    return (
      <Card className="border shadow-sm">
        <CardHeader>
          <div className="flex items-center justify-between">
            <Skeleton className="h-7 w-40" />
            <Skeleton className="h-10 w-44" />
          </div>
        </CardHeader>
        <CardContent>
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
      <Card className="border shadow-sm">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-emerald-50 flex items-center justify-center">
                <CreditCard className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <CardTitle className="text-lg">سندات الصرف</CardTitle>
                <p className="text-xs text-slate-400 mt-0.5">
                  {payments.length.toLocaleString('ar-EG')} سند
                </p>
              </div>
            </div>
            <Button
              onClick={() => {
                resetNewForm()
                setNewDialogOpen(true)
              }}
              className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
            >
              <Plus className="h-4 w-4" />
              سند صرف جديد
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mb-4">
            <Select value={supplierFilter} onValueChange={setSupplierFilter}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="كل الموردين" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل الموردين</SelectItem>
                {suppliers.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.nameAr}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="w-full sm:w-40"
              placeholder="من تاريخ"
            />
            <Input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="w-full sm:w-40"
              placeholder="إلى تاريخ"
            />
          </div>

          {/* Table */}
          <div className="max-h-[calc(100vh-340px)] overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50/80 hover:bg-slate-50/80">
                  <TableHead className="text-right font-semibold">الرقم</TableHead>
                  <TableHead className="text-right font-semibold">المورد</TableHead>
                  <TableHead className="text-right font-semibold">التاريخ</TableHead>
                  <TableHead className="text-right font-semibold">المبلغ</TableHead>
                  <TableHead className="text-right font-semibold">طريقة الدفع</TableHead>
                  <TableHead className="text-right font-semibold">المرجع</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-12">
                      <div className="flex flex-col items-center text-slate-400">
                        <CreditCard className="h-12 w-12 mb-3 text-slate-200" />
                        <p className="text-sm">لا توجد سندات صرف</p>
                        <p className="text-xs mt-1 text-slate-300">
                          اضغط على &quot;سند صرف جديد&quot; لإنشاء سند
                        </p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  payments.map((pv) => (
                    <TableRow key={pv.id}>
                      <TableCell className="font-mono text-sm">{pv.number}</TableCell>
                      <TableCell className="font-medium">{pv.supplier.nameAr}</TableCell>
                      <TableCell className="text-slate-500 text-sm">
                        {formatDate(pv.date)}
                      </TableCell>
                      <TableCell className="font-mono font-medium" dir="ltr">
                        {formatCurrency(pv.amount)}
                      </TableCell>
                      <TableCell>
                        <Badge className={paymentMethodColors[pv.paymentMethod] || 'bg-slate-100 text-slate-600'}>
                          {paymentMethodLabels[pv.paymentMethod] || pv.paymentMethod}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-slate-500 text-sm" dir="ltr">
                        {pv.reference || '—'}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* ── New Payment Dialog ── */}
      <Dialog open={newDialogOpen} onOpenChange={setNewDialogOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>سند صرف جديد</DialogTitle>
            <DialogDescription>
              إنشاء سند صرف لدفع المورد
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="max-h-[65vh] pr-1">
            <div className="space-y-4 py-2">
              {/* Payment header */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>المورد <span className="text-red-500">*</span></Label>
                  <Select value={paymentSupplierId} onValueChange={handleSupplierChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="اختر المورد" />
                    </SelectTrigger>
                    <SelectContent>
                      {suppliers.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.nameAr} ({s.code})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>التاريخ</Label>
                  <Input
                    type="date"
                    value={paymentDate}
                    onChange={(e) => setPaymentDate(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>المبلغ <span className="text-red-500">*</span></Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    placeholder="0.00"
                    dir="ltr"
                    className="text-left"
                  />
                </div>
                <div className="space-y-2">
                  <Label>طريقة الدفع</Label>
                  <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="CASH">نقدي</SelectItem>
                      <SelectItem value="CHECK">شيك</SelectItem>
                      <SelectItem value="TRANSFER">تحويل بنكي</SelectItem>
                      <SelectItem value="CARD">بطاقة</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>المرجع</Label>
                  <Input
                    value={paymentReference}
                    onChange={(e) => setPaymentReference(e.target.value)}
                    placeholder="رقم الشيك أو التحويل..."
                    dir="ltr"
                    className="text-left"
                  />
                </div>
                <div className="space-y-2">
                  <Label>&nbsp;</Label>
                  <Button
                    variant="outline"
                    onClick={autoDistribute}
                    disabled={!paymentSupplierId || !paymentAmount}
                    className="w-full gap-2 text-emerald-600 border-emerald-200 hover:bg-emerald-50"
                  >
                    <Search className="h-4 w-4" />
                    توزيع تلقائي
                  </Button>
                </div>
              </div>

              {/* Unpaid invoices */}
              {paymentSupplierId && (
                <>
                  <Separator />
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-semibold text-slate-700">
                        الفواتير المستحقة
                      </span>
                      {loadingInvoices && (
                        <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
                      )}
                    </div>
                    {unpaidInvoices.length === 0 && !loadingInvoices ? (
                      <div className="text-center py-6 text-slate-400 text-sm">
                        لا توجد فواتير مستحقة لهذا المورد
                      </div>
                    ) : (
                      <div className="border rounded-lg overflow-hidden">
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-slate-50/80">
                              <TableHead className="text-right text-xs">رقم الفاتورة</TableHead>
                              <TableHead className="text-right text-xs">الإجمالي</TableHead>
                              <TableHead className="text-right text-xs">المدفوع</TableHead>
                              <TableHead className="text-right text-xs">المتبقي</TableHead>
                              <TableHead className="text-right text-xs">مبلغ السداد</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {unpaidInvoices.map((inv, idx) => (
                              <TableRow key={inv.id}>
                                <TableCell className="font-mono text-sm">{inv.number}</TableCell>
                                <TableCell className="font-mono text-sm" dir="ltr">
                                  {formatCurrency(inv.totalAmount)}
                                </TableCell>
                                <TableCell className="font-mono text-sm text-emerald-600" dir="ltr">
                                  {formatCurrency(inv.paidAmount)}
                                </TableCell>
                                <TableCell className="font-mono text-sm text-red-600" dir="ltr">
                                  {formatCurrency(inv.balanceDue)}
                                </TableCell>
                                <TableCell>
                                  <Input
                                    type="number"
                                    min="0"
                                    max={inv.balanceDue}
                                    step="0.01"
                                    value={paymentLines[idx]?.amount || ''}
                                    onChange={(e) => updatePaymentLine(idx, e.target.value)}
                                    placeholder="0.00"
                                    className="h-8 text-sm w-28"
                                    dir="ltr"
                                  />
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    )}

                    {/* Allocation summary */}
                    <div className="border rounded-lg p-3 mt-3 bg-slate-50 space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-500">إجمالي مبلغ السداد</span>
                        <span className="font-mono font-medium" dir="ltr">{formatCurrency(parseFloat(paymentAmount) || 0)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-500">الموزع على الفواتير</span>
                        <span className={`font-mono font-medium ${totalAllocated === (parseFloat(paymentAmount) || 0) ? 'text-emerald-600' : 'text-orange-600'}`} dir="ltr">
                          {formatCurrency(totalAllocated)}
                        </span>
                      </div>
                      {totalAllocated !== (parseFloat(paymentAmount) || 0) && (
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-500">الفرق</span>
                          <span className="font-mono text-red-600" dir="ltr">
                            {formatCurrency(Math.abs((parseFloat(paymentAmount) || 0) - totalAllocated))}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>ملاحظات</Label>
                    <Textarea
                      value={paymentNotes}
                      onChange={(e) => setPaymentNotes(e.target.value)}
                      placeholder="ملاحظات إضافية..."
                      rows={2}
                    />
                  </div>
                </>
              )}
            </div>
          </ScrollArea>

          <DialogFooter>
            <Button variant="outline" onClick={() => setNewDialogOpen(false)}>
              إلغاء
            </Button>
            <Button
              onClick={handleSavePayment}
              disabled={submitting}
              className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              إنشاء السند
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
