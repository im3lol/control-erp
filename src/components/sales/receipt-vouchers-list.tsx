'use client'

import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { Plus, Receipt, Loader2, DollarSign } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
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
import { useAppStore } from '@/lib/store'
import { formatCurrency, formatDate } from '@/lib/erp-utils'

interface Customer {
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

interface ReceiptLineInput {
  salesInvoiceId: string
  amount: number
}

interface ReceiptVoucher {
  id: string
  number: string
  customerId: string
  date: string
  amount: number
  paymentMethod: string
  reference: string | null
  notes: string | null
  createdAt: string
  customer: {
    id: string
    code: string
    nameAr: string
    nameEn: string | null
  }
  lines?: Array<{
    id: string
    amount: number
    salesInvoice: {
      id: string
      number: string
      totalAmount: number
      balanceDue: number
    }
  }>
}

export default function ReceiptVouchersList() {
  const companyId = useAppStore(state => state.currentCompanyId)
  const [receipts, setReceipts] = useState<ReceiptVoucher[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [customerFilter, setCustomerFilter] = useState('all')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')

  // New receipt dialog state
  const [dialogOpen, setDialogOpen] = useState(false)
  const [rcptCustomerId, setRcptCustomerId] = useState('')
  const [rcptAmount, setRcptAmount] = useState('')
  const [rcptPaymentMethod, setRcptPaymentMethod] = useState('CASH')
  const [rcptReference, setRcptReference] = useState('')
  const [rcptNotes, setRcptNotes] = useState('')
  const [rcptDate, setRcptDate] = useState(new Date().toISOString().split('T')[0])
  const [rcptLines, setRcptLines] = useState<ReceiptLineInput[]>([])
  const [unpaidInvoices, setUnpaidInvoices] = useState<UnpaidInvoice[]>([])
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    fetchReceipts()
    fetchCustomers()
  }, [])

  const fetchReceipts = async () => {
    try {
      const params = new URLSearchParams()
      if (customerFilter && customerFilter !== 'all') params.set('customerId', customerFilter)
      if (fromDate) params.set('fromDate', fromDate)
      if (toDate) params.set('toDate', toDate)

      const res = await fetch(`/api/sales/receipts?companyId=${companyId}&${params.toString()}`)
      if (res.ok) {
        const data = await res.json()
        setReceipts(data)
      }
    } catch {
      toast.error('فشل في تحميل سندات القبض')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchReceipts()
  }, [customerFilter, fromDate, toDate])

  const fetchCustomers = async () => {
    try {
      const res = await fetch(`/api/sales/customers?activeOnly=true&companyId=${companyId}`)
      if (res.ok) {
        const data = await res.json()
        setCustomers(data)
      }
    } catch {
      // silently fail
    }
  }

  // Load unpaid invoices when customer is selected
  const loadUnpaidInvoices = async (customerId: string) => {
    if (!customerId) {
      setUnpaidInvoices([])
      setRcptLines([])
      return
    }
    try {
      const res = await fetch(`/api/sales/invoices?companyId=${companyId}&customerId=${customerId}&status=CONFIRMED`)
      if (res.ok) {
        const invoices = await res.json()
        // Also get PARTIAL_PAID
        const res2 = await fetch(`/api/sales/invoices?companyId=${companyId}&customerId=${customerId}&status=PARTIAL_PAID`)
        let allInvoices = invoices
        if (res2.ok) {
          const partialInvoices = await res2.json()
          allInvoices = [...invoices, ...partialInvoices]
        }
        const unpaid = allInvoices
          .filter((inv: { balanceDue: number }) => inv.balanceDue > 0.01)
          .map((inv: { id: string; number: string; date: string; totalAmount: number; paidAmount: number; balanceDue: number }) => ({
            id: inv.id,
            number: inv.number,
            date: inv.date,
            totalAmount: inv.totalAmount,
            paidAmount: inv.paidAmount,
            balanceDue: inv.balanceDue,
          }))
        setUnpaidInvoices(unpaid)
        setRcptLines(
          unpaid.map((inv: UnpaidInvoice) => ({
            salesInvoiceId: inv.id,
            amount: 0,
          }))
        )
      }
    } catch {
      // silently fail
    }
  }

  const handleOpenNew = () => {
    setRcptCustomerId('')
    setRcptAmount('')
    setRcptPaymentMethod('CASH')
    setRcptReference('')
    setRcptNotes('')
    setRcptDate(new Date().toISOString().split('T')[0])
    setUnpaidInvoices([])
    setRcptLines([])
    setDialogOpen(true)
  }

  const handleCustomerChange = (customerId: string) => {
    setRcptCustomerId(customerId)
    loadUnpaidInvoices(customerId)
  }

  // Auto-distribute amount across invoices
  const autoDistribute = () => {
    const totalAmount = parseFloat(rcptAmount) || 0
    if (totalAmount <= 0 || unpaidInvoices.length === 0) return

    let remaining = totalAmount
    const newLines = unpaidInvoices.map((inv) => {
      const allocation = Math.min(remaining, inv.balanceDue)
      remaining -= allocation
      return {
        salesInvoiceId: inv.id,
        amount: Math.round(allocation * 100) / 100,
      }
    })
    setRcptLines(newLines)
  }

  // Update line amount
  const updateLineAmount = (invoiceId: string, amount: number) => {
    setRcptLines((prev) =>
      prev.map((l) =>
        l.salesInvoiceId === invoiceId ? { ...l, amount } : l
      )
    )
  }

  const handleSubmit = async () => {
    if (!rcptCustomerId) {
      toast.error('يرجى اختيار العميل')
      return
    }
    if (!rcptAmount || parseFloat(rcptAmount) <= 0) {
      toast.error('المبلغ يجب أن يكون أكبر من صفر')
      return
    }

    setSubmitting(true)
    try {
      const activeLines = rcptLines.filter((l) => l.amount > 0)

      const res = await fetch(`/api/sales/receipts?companyId=${companyId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: rcptCustomerId,
          date: rcptDate,
          amount: parseFloat(rcptAmount),
          paymentMethod: rcptPaymentMethod,
          reference: rcptReference.trim() || null,
          notes: rcptNotes.trim() || null,
          receiptLines: activeLines.length > 0 ? activeLines : undefined,
          companyId,
        }),
      })

      if (res.ok) {
        toast.success('تم إنشاء سند القبض بنجاح')
        setDialogOpen(false)
        fetchReceipts()
      } else {
        const err = await res.json()
        toast.error(err.error || 'فشل في إنشاء سند القبض')
      }
    } catch {
      toast.error('حدث خطأ أثناء حفظ سند القبض')
    } finally {
      setSubmitting(false)
    }
  }

  const getPaymentMethodBadge = (method: string) => {
    switch (method) {
      case 'CASH':
        return <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200">نقدي</Badge>
      case 'BANK':
        return <Badge className="bg-teal-50 text-teal-700 border-teal-200">بنكي</Badge>
      case 'CHECK':
        return <Badge className="bg-orange-50 text-orange-700 border-orange-200">شيك</Badge>
      default:
        return <Badge variant="secondary">{method}</Badge>
    }
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
                <Receipt className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <CardTitle className="text-lg">سندات القبض</CardTitle>
                <p className="text-xs text-slate-400 mt-0.5">
                  {receipts.length.toLocaleString('ar-EG')} سند
                </p>
              </div>
            </div>
            <Button
              onClick={handleOpenNew}
              className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
            >
              <Plus className="h-4 w-4" />
              سند قبض جديد
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mb-4">
            <Select value={customerFilter} onValueChange={setCustomerFilter}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="كل العملاء" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل العملاء</SelectItem>
                {customers.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.nameAr}
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
                  <TableHead className="text-right font-semibold">العميل</TableHead>
                  <TableHead className="text-right font-semibold">التاريخ</TableHead>
                  <TableHead className="text-right font-semibold">المبلغ</TableHead>
                  <TableHead className="text-right font-semibold">طريقة الدفع</TableHead>
                  <TableHead className="text-right font-semibold">المرجع</TableHead>
                  <TableHead className="text-right font-semibold">إجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {receipts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-12">
                      <div className="flex flex-col items-center text-slate-400">
                        <Receipt className="h-12 w-12 mb-3 text-slate-200" />
                        <p className="text-sm">لا توجد سندات قبض</p>
                        <p className="text-xs mt-1 text-slate-300">
                          اضغط على &quot;سند قبض جديد&quot; لإنشاء سند
                        </p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  receipts.map((rcpt) => (
                    <TableRow key={rcpt.id}>
                      <TableCell className="font-mono text-sm font-semibold text-emerald-700">
                        {rcpt.number}
                      </TableCell>
                      <TableCell className="font-medium">{rcpt.customer.nameAr}</TableCell>
                      <TableCell className="text-slate-500 text-sm">
                        {formatDate(rcpt.date)}
                      </TableCell>
                      <TableCell className="font-mono font-semibold text-emerald-600" dir="ltr">
                        {formatCurrency(rcpt.amount)}
                      </TableCell>
                      <TableCell>{getPaymentMethodBadge(rcpt.paymentMethod)}</TableCell>
                      <TableCell className="text-slate-400 text-sm" dir="ltr">
                        {rcpt.reference || '—'}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <span className="text-xs text-slate-400">
                            {rcpt.lines && rcpt.lines.length > 0
                              ? `${rcpt.lines.length} فاتورة`
                              : 'بدون توزيع'}
                          </span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* New Receipt Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>سند قبض جديد</DialogTitle>
            <DialogDescription>
              إنشاء سند قبض لتحصيل مبلغ من العميل
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>
                  العميل <span className="text-red-500">*</span>
                </Label>
                <Select value={rcptCustomerId} onValueChange={handleCustomerChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="اختر العميل" />
                  </SelectTrigger>
                  <SelectContent>
                    {customers.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.nameAr} ({c.code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>التاريخ</Label>
                <Input
                  type="date"
                  value={rcptDate}
                  onChange={(e) => setRcptDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>
                  المبلغ <span className="text-red-500">*</span>
                </Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={rcptAmount}
                  onChange={(e) => setRcptAmount(e.target.value)}
                  placeholder="0.00"
                  dir="ltr"
                  className="text-left"
                />
              </div>
              <div className="space-y-2">
                <Label>طريقة الدفع</Label>
                <Select value={rcptPaymentMethod} onValueChange={setRcptPaymentMethod}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CASH">نقدي</SelectItem>
                    <SelectItem value="BANK">بنكي</SelectItem>
                    <SelectItem value="CHECK">شيك</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>المرجع</Label>
                <Input
                  value={rcptReference}
                  onChange={(e) => setRcptReference(e.target.value)}
                  placeholder="رقم الشيك أو الإشعار"
                  dir="ltr"
                  className="text-left"
                />
              </div>
              <div className="space-y-2">
                <Label>ملاحظات</Label>
                <Input
                  value={rcptNotes}
                  onChange={(e) => setRcptNotes(e.target.value)}
                  placeholder="ملاحظات إضافية"
                />
              </div>
            </div>

            {/* Unpaid Invoices Allocation */}
            {rcptCustomerId && unpaidInvoices.length > 0 && (
              <>
                <Separator />
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-semibold">توزيع المبلغ على الفواتير</Label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={autoDistribute}
                      className="gap-1 text-emerald-600 border-emerald-200 hover:bg-emerald-50 text-xs"
                    >
                      <DollarSign className="h-3 w-3" />
                      توزيع تلقائي
                    </Button>
                  </div>

                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-slate-50">
                          <TableHead className="text-right text-xs">الفاتورة</TableHead>
                          <TableHead className="text-right text-xs">الإجمالي</TableHead>
                          <TableHead className="text-right text-xs">المدفوع</TableHead>
                          <TableHead className="text-right text-xs">المتبقي</TableHead>
                          <TableHead className="text-right text-xs">التحصيل</TableHead>
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
                                value={rcptLines[idx]?.amount || 0}
                                onChange={(e) =>
                                  updateLineAmount(inv.id, parseFloat(e.target.value) || 0)
                                }
                                className="h-8 w-28 text-sm"
                                dir="ltr"
                              />
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  {/* Distribution summary */}
                  <div className="bg-slate-50 rounded-lg p-3 flex justify-between text-sm">
                    <span>إجمالي التوزيع</span>
                    <span className="font-mono font-semibold" dir="ltr">
                      {formatCurrency(rcptLines.reduce((sum, l) => sum + l.amount, 0))}
                    </span>
                  </div>
                </div>
              </>
            )}

            {rcptCustomerId && unpaidInvoices.length === 0 && (
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 text-center">
                <p className="text-sm text-orange-700">لا توجد فواتير مستحقة لهذا العميل</p>
              </div>
            )}
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
              إنشاء السند
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
