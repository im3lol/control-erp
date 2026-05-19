'use client'

import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import {
  Plus,
  Search,
  Loader2,
  FileText,
  CheckCircle2,
  XCircle,
  Pencil,
  Eye,
  DollarSign,
  Trash2,
} from 'lucide-react'
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { useAppStore } from '@/lib/store'
import { formatCurrency, formatDate, getStatusColor, getStatusLabel } from '@/lib/erp-utils'
import { X } from 'lucide-react'

interface Customer {
  id: string
  code: string
  nameAr: string
  nameEn: string | null
}

interface Item {
  id: string
  code: string
  nameAr: string
  nameEn: string | null
  sellPrice: number
}

interface InvoiceLine {
  id?: string
  itemId: string
  quantity: number
  unitPrice: number
  discountAmount: number
  taxAmount: number
  totalAmount: number
  item?: Item & { uom?: { nameAr: string; code: string } | null }
  costAmount?: number
}

interface SalesInvoice {
  id: string
  number: string
  customerId: string
  date: string
  dueDate: string | null
  status: string
  subtotal: number
  discountAmount: number
  taxAmount: number
  totalAmount: number
  paidAmount: number
  balanceDue: number
  notes: string | null
  customer: Customer
  lines: InvoiceLine[]
  _count?: { lines: number }
  receiptLines?: Array<{
    id: string
    amount: number
    receiptVoucher: {
      id: string
      number: string
      date: string
      amount: number
      paymentMethod: string
    }
  }>
}

interface InvoiceLineInput {
  itemId: string
  quantity: number
  unitPrice: number
  discountAmount: number
  taxAmount: number
}

const emptyLine: InvoiceLineInput = {
  itemId: '',
  quantity: 1,
  unitPrice: 0,
  discountAmount: 0,
  taxAmount: 0,
}

export default function SalesInvoicesList() {
  const companyId = useAppStore(state => state.currentCompanyId)
  const itemFilter = useAppStore(state => state.itemFilter)
  const setItemFilter = useAppStore(state => state.setItemFilter)
  const [invoices, setInvoices] = useState<SalesInvoice[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [items, setItems] = useState<Item[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('all')
  const [customerFilter, setCustomerFilter] = useState('all')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')

  // New/Edit invoice state
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editingInvoice, setEditingInvoice] = useState<SalesInvoice | null>(null)
  const [invoiceCustomerId, setInvoiceCustomerId] = useState('')
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split('T')[0])
  const [invoiceDueDate, setInvoiceDueDate] = useState('')
  const [invoiceNotes, setInvoiceNotes] = useState('')
  const [invoiceLines, setInvoiceLines] = useState<InvoiceLineInput[]>([{ ...emptyLine }])
  const [invoiceDiscountAmount, setInvoiceDiscountAmount] = useState(0)
  const [invoiceTaxAmount, setInvoiceTaxAmount] = useState(0)
  const [submitting, setSubmitting] = useState(false)

  // Confirm dialog
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false)
  const [confirmingId, setConfirmingId] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)

  // Cancel dialog
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false)
  const [cancellingId, setCancellingId] = useState<string | null>(null)
  const [cancelling, setCancelling] = useState(false)

  // Detail dialog
  const [detailDialogOpen, setDetailDialogOpen] = useState(false)
  const [detailInvoice, setDetailInvoice] = useState<SalesInvoice | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  useEffect(() => {
    fetchInvoices()
    fetchCustomers()
    fetchItems()
  }, [])

  const fetchInvoices = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (statusFilter && statusFilter !== 'all') params.set('status', statusFilter)
      if (customerFilter && customerFilter !== 'all') params.set('customerId', customerFilter)
      if (fromDate) params.set('fromDate', fromDate)
      if (toDate) params.set('toDate', toDate)
      if (itemFilter) params.set('itemId', itemFilter)

      const res = await fetch(`/api/sales/invoices?companyId=${companyId}&${params.toString()}`)
      if (res.ok) {
        const data = await res.json()
        setInvoices(data)
      }
    } catch {
      toast.error('فشل في تحميل فواتير البيع')
    } finally {
      setLoading(false)
    }
  }, [statusFilter, customerFilter, fromDate, toDate, itemFilter])

  useEffect(() => {
    fetchInvoices()
  }, [fetchInvoices])

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

  const fetchItems = async () => {
    try {
      const res = await fetch(`/api/inventory/items?activeOnly=true&companyId=${companyId}`)
      if (res.ok) {
        const data = await res.json()
        setItems(data)
      }
    } catch {
      // silently fail
    }
  }

  const fetchInvoiceDetail = async (id: string) => {
    setDetailLoading(true)
    try {
      const res = await fetch(`/api/sales/invoices/${id}?companyId=${companyId}`)
      if (res.ok) {
        const data = await res.json()
        setDetailInvoice(data)
        setDetailDialogOpen(true)
      }
    } catch {
      toast.error('فشل في تحميل تفاصيل الفاتورة')
    } finally {
      setDetailLoading(false)
    }
  }

  // Calculate line total
  const calcLineTotal = (line: InvoiceLineInput) => {
    return line.quantity * line.unitPrice - line.discountAmount + line.taxAmount
  }

  // Calculate subtotal
  const calcSubtotal = () => {
    return invoiceLines.reduce((sum, l) => sum + calcLineTotal(l), 0)
  }

  // Calculate total
  const calcTotal = () => {
    return calcSubtotal() - invoiceDiscountAmount + invoiceTaxAmount
  }

  // Handle item select in line
  const handleItemSelect = (index: number, itemId: string) => {
    const item = items.find((i) => i.id === itemId)
    setInvoiceLines((prev) => {
      const newLines = [...prev]
      newLines[index] = {
        ...newLines[index],
        itemId,
        unitPrice: item?.sellPrice || 0,
      }
      return newLines
    })
  }

  // Add line
  const addLine = () => {
    setInvoiceLines((prev) => [...prev, { ...emptyLine }])
  }

  // Remove line
  const removeLine = (index: number) => {
    setInvoiceLines((prev) => prev.filter((_, i) => i !== index))
  }

  // Update line field
  const updateLine = (index: number, field: keyof InvoiceLineInput, value: number | string) => {
    setInvoiceLines((prev) => {
      const newLines = [...prev]
      newLines[index] = { ...newLines[index], [field]: value }
      return newLines
    })
  }

  // Open new invoice sheet
  const handleOpenNew = () => {
    setEditingInvoice(null)
    setInvoiceCustomerId('')
    setInvoiceDate(new Date().toISOString().split('T')[0])
    setInvoiceDueDate('')
    setInvoiceNotes('')
    setInvoiceLines([{ ...emptyLine }])
    setInvoiceDiscountAmount(0)
    setInvoiceTaxAmount(0)
    setSheetOpen(true)
  }

  // Open edit invoice
  const handleOpenEdit = (invoice: SalesInvoice) => {
    setEditingInvoice(invoice)
    setInvoiceCustomerId(invoice.customerId)
    setInvoiceDate(new Date(invoice.date).toISOString().split('T')[0])
    setInvoiceDueDate(invoice.dueDate ? new Date(invoice.dueDate).toISOString().split('T')[0] : '')
    setInvoiceNotes(invoice.notes || '')
    setInvoiceDiscountAmount(invoice.discountAmount)
    setInvoiceTaxAmount(invoice.taxAmount)
    setInvoiceLines(
      invoice.lines.map((l) => ({
        itemId: l.itemId,
        quantity: l.quantity,
        unitPrice: l.unitPrice,
        discountAmount: l.discountAmount,
        taxAmount: l.taxAmount,
      }))
    )
    setSheetOpen(true)
  }

  // Submit invoice
  const handleSubmit = async () => {
    if (!invoiceCustomerId) {
      toast.error('يرجى اختيار العميل')
      return
    }

    const validLines = invoiceLines.filter((l) => l.itemId && l.quantity > 0)
    if (validLines.length === 0) {
      toast.error('يجب إضافة سطر واحد على الأقل')
      return
    }

    setSubmitting(true)
    try {
      if (editingInvoice) {
        // Update existing DRAFT
        const res = await fetch(`/api/sales/invoices/${editingInvoice.id}?companyId=${companyId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'update',
            customerId: invoiceCustomerId,
            date: invoiceDate,
            dueDate: invoiceDueDate || null,
            discountAmount: invoiceDiscountAmount,
            taxAmount: invoiceTaxAmount,
            notes: invoiceNotes || null,
            lines: validLines.map((l) => ({
              itemId: l.itemId,
              quantity: l.quantity,
              unitPrice: l.unitPrice,
              discountAmount: l.discountAmount,
              taxAmount: l.taxAmount,
            })),
            companyId,
          }),
        })
        if (res.ok) {
          toast.success('تم تحديث الفاتورة بنجاح')
          setSheetOpen(false)
          fetchInvoices()
        } else {
          const err = await res.json()
          toast.error(err.error || 'فشل في تحديث الفاتورة')
        }
      } else {
        // Create new
        const res = await fetch(`/api/sales/invoices?companyId=${companyId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            customerId: invoiceCustomerId,
            date: invoiceDate,
            dueDate: invoiceDueDate || null,
            discountAmount: invoiceDiscountAmount,
            taxAmount: invoiceTaxAmount,
            notes: invoiceNotes || null,
            lines: validLines.map((l) => ({
              itemId: l.itemId,
              quantity: l.quantity,
              unitPrice: l.unitPrice,
              discountAmount: l.discountAmount,
              taxAmount: l.taxAmount,
            })),
            companyId,
          }),
        })
        if (res.ok) {
          toast.success('تم إنشاء الفاتورة بنجاح')
          setSheetOpen(false)
          fetchInvoices()
        } else {
          const err = await res.json()
          toast.error(err.error || 'فشل في إنشاء الفاتورة')
        }
      }
    } catch {
      toast.error('حدث خطأ أثناء حفظ الفاتورة')
    } finally {
      setSubmitting(false)
    }
  }

  // Confirm invoice
  const handleConfirm = async () => {
    if (!confirmingId) return
    setConfirming(true)
    try {
      const res = await fetch(`/api/sales/invoices/${confirmingId}?companyId=${companyId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'confirm', companyId }),
      })
      if (res.ok) {
        toast.success('تم تأكيد الفاتورة بنجاح')
        fetchInvoices()
      } else {
        const err = await res.json()
        toast.error(err.error || 'فشل في تأكيد الفاتورة')
      }
    } catch {
      toast.error('حدث خطأ أثناء تأكيد الفاتورة')
    } finally {
      setConfirming(false)
      setConfirmDialogOpen(false)
      setConfirmingId(null)
    }
  }

  // Cancel invoice
  const handleCancel = async () => {
    if (!cancellingId) return
    setCancelling(true)
    try {
      const res = await fetch(`/api/sales/invoices/${cancellingId}?companyId=${companyId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'cancel', companyId }),
      })
      if (res.ok) {
        toast.success('تم إلغاء الفاتورة بنجاح')
        fetchInvoices()
      } else {
        const err = await res.json()
        toast.error(err.error || 'فشل في إلغاء الفاتورة')
      }
    } catch {
      toast.error('حدث خطأ أثناء إلغاء الفاتورة')
    } finally {
      setCancelling(false)
      setCancelDialogOpen(false)
      setCancellingId(null)
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
                <FileText className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <CardTitle className="text-lg">فواتير البيع</CardTitle>
                <p className="text-xs text-slate-400 mt-0.5">
                  {invoices.length.toLocaleString('ar-EG')} فاتورة
                </p>
              </div>
            </div>
            <Button
              onClick={handleOpenNew}
              className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
            >
              <Plus className="h-4 w-4" />
              فاتورة بيع جديدة
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mb-4">
            {itemFilter && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-sm text-emerald-700">
                <span>تصفية حسب الصنف</span>
                <button
                  onClick={() => setItemFilter(null)}
                  className="h-5 w-5 rounded-full bg-emerald-200 hover:bg-emerald-300 flex items-center justify-center"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            )}
            <div className="relative flex-1">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-40">
                  <SelectValue placeholder="كل الحالات" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">كل الحالات</SelectItem>
                  <SelectItem value="DRAFT">مسودة</SelectItem>
                  <SelectItem value="CONFIRMED">مؤكدة</SelectItem>
                  <SelectItem value="PARTIAL_PAID">مدفوعة جزئياً</SelectItem>
                  <SelectItem value="PAID">مدفوعة</SelectItem>
                  <SelectItem value="CANCELLED">ملغية</SelectItem>
                </SelectContent>
              </Select>
            </div>
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
          <div className="max-h-[calc(100vh-380px)] overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50/80 hover:bg-slate-50/80">
                  <TableHead className="text-right font-semibold">الرقم</TableHead>
                  <TableHead className="text-right font-semibold">العميل</TableHead>
                  <TableHead className="text-right font-semibold">التاريخ</TableHead>
                  <TableHead className="text-right font-semibold">المجموع</TableHead>
                  <TableHead className="text-right font-semibold">الضريبة</TableHead>
                  <TableHead className="text-right font-semibold">الإجمالي</TableHead>
                  <TableHead className="text-right font-semibold">المدفوع</TableHead>
                  <TableHead className="text-right font-semibold">المتبقي</TableHead>
                  <TableHead className="text-right font-semibold">الحالة</TableHead>
                  <TableHead className="text-right font-semibold">إجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-12">
                      <div className="flex flex-col items-center text-slate-400">
                        <FileText className="h-12 w-12 mb-3 text-slate-200" />
                        <p className="text-sm">لا توجد فواتير بيع</p>
                        <p className="text-xs mt-1 text-slate-300">
                          اضغط على &quot;فاتورة بيع جديدة&quot; لإنشاء فاتورة
                        </p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  invoices.map((inv) => (
                    <TableRow key={inv.id}>
                      <TableCell>
                        <button
                          onClick={() => fetchInvoiceDetail(inv.id)}
                          className="font-mono text-sm text-emerald-700 hover:text-emerald-900 hover:underline font-semibold"
                        >
                          {inv.number}
                        </button>
                      </TableCell>
                      <TableCell className="font-medium">{inv.customer.nameAr}</TableCell>
                      <TableCell className="text-slate-500 text-sm">
                        {formatDate(inv.date)}
                      </TableCell>
                      <TableCell className="font-mono" dir="ltr">
                        {formatCurrency(inv.subtotal)}
                      </TableCell>
                      <TableCell className="font-mono" dir="ltr">
                        {formatCurrency(inv.taxAmount)}
                      </TableCell>
                      <TableCell className="font-mono font-semibold" dir="ltr">
                        {formatCurrency(inv.totalAmount)}
                      </TableCell>
                      <TableCell className="font-mono text-emerald-600" dir="ltr">
                        {formatCurrency(inv.paidAmount)}
                      </TableCell>
                      <TableCell className="font-mono text-red-600" dir="ltr">
                        {formatCurrency(inv.balanceDue)}
                      </TableCell>
                      <TableCell>
                        <Badge className={`${getStatusColor(inv.status)} text-xs`}>
                          {getStatusLabel(inv.status)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          {inv.status === 'DRAFT' && (
                            <>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                  setConfirmingId(inv.id)
                                  setConfirmDialogOpen(true)
                                }}
                                className="h-8 w-8 text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50"
                                title="تأكيد"
                              >
                                <CheckCircle2 className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleOpenEdit(inv)}
                                className="h-8 w-8 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50"
                                title="تعديل"
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                  setCancellingId(inv.id)
                                  setCancelDialogOpen(true)
                                }}
                                className="h-8 w-8 text-slate-500 hover:text-red-600 hover:bg-red-50"
                                title="إلغاء"
                              >
                                <XCircle className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                          {inv.status === 'CONFIRMED' && (
                            <>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => fetchInvoiceDetail(inv.id)}
                                className="h-8 w-8 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50"
                                title="عرض التفاصيل"
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                  setCancellingId(inv.id)
                                  setCancelDialogOpen(true)
                                }}
                                className="h-8 w-8 text-slate-500 hover:text-red-600 hover:bg-red-50"
                                title="إلغاء"
                              >
                                <XCircle className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                          {inv.status === 'PARTIAL_PAID' && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => fetchInvoiceDetail(inv.id)}
                              className="h-8 w-8 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50"
                              title="عرض التفاصيل"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          )}
                          {inv.status === 'PAID' && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => fetchInvoiceDetail(inv.id)}
                              className="h-8 w-8 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50"
                              title="عرض التفاصيل"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          )}
                          {inv.status === 'CANCELLED' && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => fetchInvoiceDetail(inv.id)}
                              className="h-8 w-8 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50"
                              title="عرض التفاصيل"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          )}
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

      {/* New/Edit Invoice Sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="left" className="w-full sm:max-w-3xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>
              {editingInvoice ? 'تعديل فاتورة البيع' : 'فاتورة بيع جديدة'}
            </SheetTitle>
            <SheetDescription>
              {editingInvoice ? 'قم بتعديل بيانات الفاتورة' : 'أدخل بيانات فاتورة البيع الجديدة'}
            </SheetDescription>
          </SheetHeader>

          <div className="mt-6 space-y-6">
            {/* Invoice Header */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>
                  العميل <span className="text-red-500">*</span>
                </Label>
                <Select value={invoiceCustomerId} onValueChange={setInvoiceCustomerId}>
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
                  value={invoiceDate}
                  onChange={(e) => setInvoiceDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>تاريخ الاستحقاق</Label>
                <Input
                  type="date"
                  value={invoiceDueDate}
                  onChange={(e) => setInvoiceDueDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>ملاحظات</Label>
                <Input
                  value={invoiceNotes}
                  onChange={(e) => setInvoiceNotes(e.target.value)}
                  placeholder="ملاحظات إضافية"
                />
              </div>
            </div>

            <Separator />

            {/* Invoice Lines */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-base font-semibold">بنود الفاتورة</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addLine}
                  className="gap-1 text-emerald-600 border-emerald-200 hover:bg-emerald-50"
                >
                  <Plus className="h-3 w-3" />
                  إضافة بند
                </Button>
              </div>

              {invoiceLines.map((line, index) => (
                <div
                  key={index}
                  className="grid grid-cols-12 gap-2 items-end border border-slate-100 rounded-lg p-3 bg-slate-50/50"
                >
                  <div className="col-span-12 sm:col-span-4 space-y-1">
                    <Label className="text-xs">الصنف</Label>
                    <Select
                      value={line.itemId}
                      onValueChange={(val) => handleItemSelect(index, val)}
                    >
                      <SelectTrigger className="h-9 text-sm">
                        <SelectValue placeholder="اختر الصنف" />
                      </SelectTrigger>
                      <SelectContent>
                        {items.map((item) => (
                          <SelectItem key={item.id} value={item.id}>
                            {item.nameAr} ({item.code})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-4 sm:col-span-2 space-y-1">
                    <Label className="text-xs">الكمية</Label>
                    <Input
                      type="number"
                      min="1"
                      value={line.quantity}
                      onChange={(e) => updateLine(index, 'quantity', parseFloat(e.target.value) || 0)}
                      className="h-9 text-sm"
                      dir="ltr"
                    />
                  </div>
                  <div className="col-span-4 sm:col-span-2 space-y-1">
                    <Label className="text-xs">سعر الوحدة</Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={line.unitPrice}
                      onChange={(e) => updateLine(index, 'unitPrice', parseFloat(e.target.value) || 0)}
                      className="h-9 text-sm"
                      dir="ltr"
                    />
                  </div>
                  <div className="col-span-4 sm:col-span-2 space-y-1">
                    <Label className="text-xs">الخصم</Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={line.discountAmount}
                      onChange={(e) => updateLine(index, 'discountAmount', parseFloat(e.target.value) || 0)}
                      className="h-9 text-sm"
                      dir="ltr"
                    />
                  </div>
                  <div className="col-span-8 sm:col-span-1 space-y-1">
                    <Label className="text-xs">الإجمالي</Label>
                    <div className="h-9 px-2 flex items-center bg-white border rounded-md text-sm font-mono" dir="ltr">
                      {formatCurrency(calcLineTotal(line))}
                    </div>
                  </div>
                  <div className="col-span-4 sm:col-span-1 flex justify-center">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeLine(index)}
                      disabled={invoiceLines.length <= 1}
                      className="h-9 w-9 text-red-400 hover:text-red-600 hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            <Separator />

            {/* Totals */}
            <div className="space-y-3 bg-slate-50/50 rounded-lg p-4">
              <div className="flex items-center gap-4">
                <Label className="w-24 text-sm">خصم الفاتورة</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={invoiceDiscountAmount}
                  onChange={(e) => setInvoiceDiscountAmount(parseFloat(e.target.value) || 0)}
                  className="h-9 w-32"
                  dir="ltr"
                />
              </div>
              <div className="flex items-center gap-4">
                <Label className="w-24 text-sm">الضريبة</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={invoiceTaxAmount}
                  onChange={(e) => setInvoiceTaxAmount(parseFloat(e.target.value) || 0)}
                  className="h-9 w-32"
                  dir="ltr"
                />
              </div>
              <Separator />
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">المجموع الفرعي</span>
                <span className="font-mono" dir="ltr">{formatCurrency(calcSubtotal())}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">الخصم</span>
                <span className="font-mono text-red-500" dir="ltr">-{formatCurrency(invoiceDiscountAmount)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">الضريبة</span>
                <span className="font-mono text-orange-500" dir="ltr">+{formatCurrency(invoiceTaxAmount)}</span>
              </div>
              <Separator />
              <div className="flex justify-between text-lg font-bold">
                <span>الإجمالي</span>
                <span className="font-mono text-emerald-700" dir="ltr">{formatCurrency(calcTotal())}</span>
              </div>
            </div>

            {/* Submit Button */}
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setSheetOpen(false)}>
                إلغاء
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={submitting}
                className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
              >
                {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                حفظ كمسودة
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Confirm Dialog */}
      <AlertDialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>تأكيد الفاتورة</AlertDialogTitle>
            <AlertDialogDescription>
              هل أنت متأكد من تأكيد هذه الفاتورة؟ سيتم خصم الكميات من المخزون وإنشاء قيود محاسبية تلقائياً. لا يمكن التراجع عن هذا الإجراء.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={confirming}>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirm}
              disabled={confirming}
              className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
            >
              {confirming && <Loader2 className="h-4 w-4 animate-spin" />}
              تأكيد
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Cancel Dialog */}
      <AlertDialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>إلغاء الفاتورة</AlertDialogTitle>
            <AlertDialogDescription>
              هل أنت متأكد من إلغاء هذه الفاتورة؟ سيتم عكس حركات المخزون والقيود المحاسبية إذا كانت مؤكدة.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={cancelling}>تراجع</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCancel}
              disabled={cancelling}
              className="bg-red-600 hover:bg-red-700 text-white gap-2"
            >
              {cancelling && <Loader2 className="h-4 w-4 animate-spin" />}
              إلغاء الفاتورة
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Invoice Detail Dialog */}
      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
          {detailLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
            </div>
          ) : detailInvoice ? (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-3">
                  <span>فاتورة بيع {detailInvoice.number}</span>
                  <Badge className={`${getStatusColor(detailInvoice.status)} text-xs`}>
                    {getStatusLabel(detailInvoice.status)}
                  </Badge>
                </DialogTitle>
                <DialogDescription>
                  {formatDate(detailInvoice.date)} — {detailInvoice.customer.nameAr}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                {/* Customer info */}
                <div className="grid grid-cols-2 gap-4 bg-slate-50 rounded-lg p-4">
                  <div>
                    <span className="text-xs text-slate-400">العميل</span>
                    <p className="font-medium">{detailInvoice.customer.nameAr}</p>
                    <p className="text-xs text-slate-400" dir="ltr">{detailInvoice.customer.code}</p>
                  </div>
                  <div>
                    <span className="text-xs text-slate-400">التاريخ</span>
                    <p className="font-medium">{formatDate(detailInvoice.date)}</p>
                    {detailInvoice.dueDate && (
                      <p className="text-xs text-slate-400">استحقاق: {formatDate(detailInvoice.dueDate)}</p>
                    )}
                  </div>
                </div>

                {/* Lines */}
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-slate-50">
                        <TableHead className="text-right text-xs">الصنف</TableHead>
                        <TableHead className="text-right text-xs">الكمية</TableHead>
                        <TableHead className="text-right text-xs">سعر الوحدة</TableHead>
                        <TableHead className="text-right text-xs">خصم</TableHead>
                        <TableHead className="text-right text-xs">ضريبة</TableHead>
                        <TableHead className="text-right text-xs">الإجمالي</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {detailInvoice.lines.map((line) => (
                        <TableRow key={line.id}>
                          <TableCell className="font-medium text-sm">
                            {line.item?.nameAr || '—'}
                            <span className="text-xs text-slate-400 block" dir="ltr">
                              {line.item?.code}
                            </span>
                          </TableCell>
                          <TableCell className="font-mono text-sm" dir="ltr">{line.quantity}</TableCell>
                          <TableCell className="font-mono text-sm" dir="ltr">{formatCurrency(line.unitPrice)}</TableCell>
                          <TableCell className="font-mono text-sm" dir="ltr">{formatCurrency(line.discountAmount)}</TableCell>
                          <TableCell className="font-mono text-sm" dir="ltr">{formatCurrency(line.taxAmount)}</TableCell>
                          <TableCell className="font-mono text-sm font-semibold" dir="ltr">
                            {formatCurrency(line.totalAmount)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Totals */}
                <div className="bg-slate-50 rounded-lg p-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">المجموع الفرعي</span>
                    <span className="font-mono" dir="ltr">{formatCurrency(detailInvoice.subtotal)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">الخصم</span>
                    <span className="font-mono text-red-500" dir="ltr">-{formatCurrency(detailInvoice.discountAmount)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">الضريبة</span>
                    <span className="font-mono text-orange-500" dir="ltr">+{formatCurrency(detailInvoice.taxAmount)}</span>
                  </div>
                  <Separator />
                  <div className="flex justify-between text-lg font-bold">
                    <span>الإجمالي</span>
                    <span className="font-mono text-emerald-700" dir="ltr">{formatCurrency(detailInvoice.totalAmount)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-emerald-600">المدفوع</span>
                    <span className="font-mono text-emerald-600" dir="ltr">{formatCurrency(detailInvoice.paidAmount)}</span>
                  </div>
                  <div className="flex justify-between text-sm font-semibold">
                    <span className="text-red-600">المتبقي</span>
                    <span className="font-mono text-red-600" dir="ltr">{formatCurrency(detailInvoice.balanceDue)}</span>
                  </div>
                </div>

                {/* Payment History */}
                {detailInvoice.receiptLines && detailInvoice.receiptLines.length > 0 && (
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold">سجل المدفوعات</Label>
                    <div className="border rounded-lg overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-slate-50">
                            <TableHead className="text-right text-xs">رقم السند</TableHead>
                            <TableHead className="text-right text-xs">التاريخ</TableHead>
                            <TableHead className="text-right text-xs">المبلغ</TableHead>
                            <TableHead className="text-right text-xs">طريقة الدفع</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {detailInvoice.receiptLines.map((rl) => (
                            <TableRow key={rl.id}>
                              <TableCell className="font-mono text-sm">{rl.receiptVoucher.number}</TableCell>
                              <TableCell className="text-sm">{formatDate(rl.receiptVoucher.date)}</TableCell>
                              <TableCell className="font-mono text-sm text-emerald-600" dir="ltr">
                                {formatCurrency(rl.amount)}
                              </TableCell>
                              <TableCell className="text-sm">{rl.receiptVoucher.paymentMethod}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}

                {detailInvoice.notes && (
                  <div className="bg-slate-50 rounded-lg p-4">
                    <span className="text-xs text-slate-400">ملاحظات</span>
                    <p className="text-sm mt-1">{detailInvoice.notes}</p>
                  </div>
                )}
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  )
}
