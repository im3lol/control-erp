'use client'

import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import {
  Plus, FileText, Search, Loader2, CheckCircle,
  Eye, Pencil, XCircle, CreditCard,
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
import { useAppStore } from '@/lib/store'
import { formatCurrency, formatDate, getStatusColor, getStatusLabel } from '@/lib/erp-utils'
import { X } from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Supplier {
  id: string
  code: string
  nameAr: string
  nameEn: string | null
}

interface Warehouse {
  id: string
  code: string
  nameAr: string
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
  quantity: string
  unitPrice: string
  discountAmount: string
  taxAmount: string
  totalAmount: number
}

interface PurchaseInvoice {
  id: string
  number: string
  supplierId: string
  warehouseId: string
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
  supplier: { id: string; code: string; nameAr: string; nameEn: string | null }
  warehouse: { id: string; code: string; nameAr: string }
  lines?: Array<{
    id: string
    itemId: string
    quantity: number
    unitPrice: number
    discountAmount: number
    taxAmount: number
    totalAmount: number
    item: { id: string; code: string; nameAr: string; nameEn: string | null; uom?: { nameAr: string } | null }
  }>
  _count?: { lines: number }
}

const emptyLine: InvoiceLine = {
  itemId: '',
  quantity: '1',
  unitPrice: '0',
  discountAmount: '0',
  taxAmount: '0',
  totalAmount: 0,
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function PurchaseInvoicesList() {
  const companyId = useAppStore(state => state.currentCompanyId)
  const itemFilter = useAppStore(state => state.itemFilter)
  const setItemFilter = useAppStore(state => state.setItemFilter)
  const [invoices, setInvoices] = useState<PurchaseInvoice[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [items, setItems] = useState<Item[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  // Filters
  const [statusFilter, setStatusFilter] = useState('all')
  const [supplierFilter, setSupplierFilter] = useState('all')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')

  // New invoice dialog
  const [newDialogOpen, setNewDialogOpen] = useState(false)
  const [invoiceSupplierId, setInvoiceSupplierId] = useState('')
  const [invoiceWarehouseId, setInvoiceWarehouseId] = useState('')
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split('T')[0])
  const [invoiceNotes, setInvoiceNotes] = useState('')
  const [invoiceLines, setInvoiceLines] = useState<InvoiceLine[]>([{ ...emptyLine }])
  const [invoiceDiscountAmount, setInvoiceDiscountAmount] = useState('0')
  const [invoiceTaxPercent, setInvoiceTaxPercent] = useState('0')

  // Detail dialog
  const [detailDialogOpen, setDetailDialogOpen] = useState(false)
  const [detailInvoice, setDetailInvoice] = useState<PurchaseInvoice | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  // Confirm dialog
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false)
  const [confirmInvoiceId, setConfirmInvoiceId] = useState<string | null>(null)
  const [confirmAction, setConfirmAction] = useState<string>('')

  useEffect(() => {
    fetchInvoices()
    fetchSuppliers()
    fetchWarehouses()
    fetchItems()
  }, [])

  const fetchInvoices = async () => {
    try {
      const params = new URLSearchParams()
      if (statusFilter !== 'all') params.set('status', statusFilter)
      if (supplierFilter !== 'all') params.set('supplierId', supplierFilter)
      if (fromDate) params.set('fromDate', fromDate)
      if (toDate) params.set('toDate', toDate)
      if (itemFilter) params.set('itemId', itemFilter)

      const res = await fetch(`/api/purchases/invoices?companyId=${companyId}&${params.toString()}`)
      if (res.ok) {
        const data = await res.json()
        setInvoices(data)
      }
    } catch {
      toast.error('فشل في تحميل فواتير الشراء')
    } finally {
      setLoading(false)
    }
  }

  const fetchSuppliers = async () => {
    try {
      const res = await fetch(`/api/purchases/suppliers?activeOnly=true&companyId=${companyId}`)
      if (res.ok) setSuppliers(await res.json())
    } catch { /* silent */ }
  }

  const fetchWarehouses = async () => {
    try {
      const res = await fetch(`/api/inventory/warehouses?activeOnly=true&companyId=${companyId}`)
      if (res.ok) setWarehouses(await res.json())
    } catch { /* silent */ }
  }

  const fetchItems = async () => {
    try {
      const res = await fetch(`/api/inventory/items?activeOnly=true&companyId=${companyId}`)
      if (res.ok) setItems(await res.json())
    } catch { /* silent */ }
  }

  useEffect(() => {
    if (!loading) fetchInvoices()
  }, [statusFilter, supplierFilter, fromDate, toDate, itemFilter])

  // ── Line calculations ──

  const calcLineTotal = useCallback((line: InvoiceLine) => {
    const qty = parseFloat(line.quantity) || 0
    const price = parseFloat(line.unitPrice) || 0
    const disc = parseFloat(line.discountAmount) || 0
    const tax = parseFloat(line.taxAmount) || 0
    return qty * price - disc + tax
  }, [])

  const calcInvoiceTotals = useCallback(() => {
    const rawSubtotal = invoiceLines.reduce((sum, l) => {
      const qty = parseFloat(l.quantity) || 0
      const price = parseFloat(l.unitPrice) || 0
      return sum + qty * price
    }, 0)
    const totalLineDiscounts = invoiceLines.reduce((sum, l) => sum + (parseFloat(l.discountAmount) || 0), 0)
    const totalLineTaxes = invoiceLines.reduce((sum, l) => sum + (parseFloat(l.taxAmount) || 0), 0)

    const invDiscount = parseFloat(invoiceDiscountAmount) || 0
    const invTaxPercent = parseFloat(invoiceTaxPercent) || 0
    const afterDiscount = rawSubtotal - totalLineDiscounts - invDiscount
    const invTax = invTaxPercent > 0 ? afterDiscount * (invTaxPercent / 100) : 0
    const totalTax = totalLineTaxes + invTax
    const total = afterDiscount + totalTax

    return {
      subtotal: rawSubtotal - totalLineDiscounts,
      totalDiscount: totalLineDiscounts + invDiscount,
      totalTax,
      total,
    }
  }, [invoiceLines, invoiceDiscountAmount, invoiceTaxPercent])

  const updateLine = (index: number, field: keyof InvoiceLine, value: string) => {
    setInvoiceLines((prev) => {
      const updated = [...prev]
      updated[index] = { ...updated[index], [field]: value }
      // Auto-fill unitPrice when item is selected
      if (field === 'itemId') {
        const item = items.find((i) => i.id === value)
        if (item) {
          updated[index].unitPrice = String(item.sellPrice)
        }
      }
      // Recalculate line total
      updated[index].totalAmount = calcLineTotal(updated[index])
      return updated
    })
  }

  const addLine = () => {
    setInvoiceLines((prev) => [...prev, { ...emptyLine }])
  }

  const removeLine = (index: number) => {
    if (invoiceLines.length <= 1) return
    setInvoiceLines((prev) => prev.filter((_, i) => i !== index))
  }

  // ── Save Draft ──

  const handleSaveDraft = async () => {
    if (!invoiceSupplierId) {
      toast.error('يرجى اختيار المورد')
      return
    }
    if (!invoiceWarehouseId) {
      toast.error('يرجى اختيار المخزن')
      return
    }
    const validLines = invoiceLines.filter((l) => l.itemId && parseFloat(l.quantity) > 0)
    if (validLines.length === 0) {
      toast.error('يجب إضافة سطر واحد على الأقل')
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch(`/api/purchases/invoices?companyId=${companyId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supplierId: invoiceSupplierId,
          warehouseId: invoiceWarehouseId,
          date: invoiceDate,
          notes: invoiceNotes,
          discountAmount: parseFloat(invoiceDiscountAmount) || 0,
          taxPercent: parseFloat(invoiceTaxPercent) || 0,
          lines: validLines.map((l) => ({
            itemId: l.itemId,
            quantity: parseFloat(l.quantity),
            unitPrice: parseFloat(l.unitPrice),
            discountAmount: parseFloat(l.discountAmount) || 0,
            taxAmount: parseFloat(l.taxAmount) || 0,
          })),
          companyId,
        }),
      })

      if (res.ok) {
        toast.success('تم حفظ فاتورة الشراء كمسودة')
        setNewDialogOpen(false)
        resetNewForm()
        fetchInvoices()
      } else {
        const err = await res.json()
        toast.error(err.error || 'فشل في حفظ الفاتورة')
      }
    } catch {
      toast.error('حدث خطأ أثناء حفظ الفاتورة')
    } finally {
      setSubmitting(false)
    }
  }

  const resetNewForm = () => {
    setInvoiceSupplierId('')
    setInvoiceWarehouseId('')
    setInvoiceDate(new Date().toISOString().split('T')[0])
    setInvoiceNotes('')
    setInvoiceLines([{ ...emptyLine }])
    setInvoiceDiscountAmount('0')
    setInvoiceTaxPercent('0')
  }

  // ── View Detail ──

  const handleViewDetail = async (invoiceId: string) => {
    setDetailLoading(true)
    setDetailDialogOpen(true)
    try {
      const res = await fetch(`/api/purchases/invoices/${invoiceId}?companyId=${companyId}`)
      if (res.ok) {
        setDetailInvoice(await res.json())
      }
    } catch {
      toast.error('فشل في تحميل تفاصيل الفاتورة')
    } finally {
      setDetailLoading(false)
    }
  }

  // ── Confirm / Cancel ──

  const handleAction = async () => {
    if (!confirmInvoiceId) return
    setSubmitting(true)
    try {
      const res = await fetch(`/api/purchases/invoices/${confirmInvoiceId}?companyId=${companyId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: confirmAction, companyId }),
      })
      if (res.ok) {
        toast.success(
          confirmAction === 'confirm' ? 'تم تأكيد الفاتورة بنجاح' : 'تم إلغاء الفاتورة'
        )
        fetchInvoices()
      } else {
        const err = await res.json()
        toast.error(err.error || 'فشل في تنفيذ الإجراء')
      }
    } catch {
      toast.error('حدث خطأ')
    } finally {
      setSubmitting(false)
      setConfirmDialogOpen(false)
      setConfirmInvoiceId(null)
    }
  }

  const openConfirmDialog = (invoiceId: string, action: string) => {
    setConfirmInvoiceId(invoiceId)
    setConfirmAction(action)
    setConfirmDialogOpen(true)
  }

  const totals = calcInvoiceTotals()

  if (loading) {
    return (
      <Card className="border shadow-sm">
        <CardHeader>
          <div className="flex items-center justify-between">
            <Skeleton className="h-7 w-48" />
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
                <CardTitle className="text-lg">فواتير الشراء</CardTitle>
                <p className="text-xs text-slate-400 mt-0.5">
                  {invoices.length.toLocaleString('ar-EG')} فاتورة
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
              فاتورة شراء جديدة
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
          <div className="max-h-[calc(100vh-380px)] overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50/80 hover:bg-slate-50/80">
                  <TableHead className="text-right font-semibold">الرقم</TableHead>
                  <TableHead className="text-right font-semibold">المورد</TableHead>
                  <TableHead className="text-right font-semibold">المخزن</TableHead>
                  <TableHead className="text-right font-semibold">التاريخ</TableHead>
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
                    <TableCell colSpan={9} className="text-center py-12">
                      <div className="flex flex-col items-center text-slate-400">
                        <FileText className="h-12 w-12 mb-3 text-slate-200" />
                        <p className="text-sm">لا توجد فواتير شراء</p>
                        <p className="text-xs mt-1 text-slate-300">
                          اضغط على &quot;فاتورة شراء جديدة&quot; لإنشاء فاتورة
                        </p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  invoices.map((inv) => (
                    <TableRow key={inv.id}>
                      <TableCell className="font-mono text-sm">{inv.number}</TableCell>
                      <TableCell className="font-medium">{inv.supplier.nameAr}</TableCell>
                      <TableCell className="text-slate-500">{inv.warehouse.nameAr}</TableCell>
                      <TableCell className="text-slate-500 text-sm">
                        {formatDate(inv.date)}
                      </TableCell>
                      <TableCell className="font-mono" dir="ltr">
                        {formatCurrency(inv.totalAmount)}
                      </TableCell>
                      <TableCell className="font-mono text-emerald-600" dir="ltr">
                        {formatCurrency(inv.paidAmount)}
                      </TableCell>
                      <TableCell className={`font-mono ${inv.balanceDue > 0 ? 'text-red-600' : 'text-slate-400'}`} dir="ltr">
                        {formatCurrency(inv.balanceDue)}
                      </TableCell>
                      <TableCell>
                        <Badge className={getStatusColor(inv.status)}>
                          {getStatusLabel(inv.status)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleViewDetail(inv.id)}
                            className="h-8 w-8 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50"
                            title="عرض التفاصيل"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          {inv.status === 'DRAFT' && (
                            <>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => openConfirmDialog(inv.id, 'confirm')}
                                className="h-8 w-8 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50"
                                title="تأكيد"
                              >
                                <CheckCircle className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => openConfirmDialog(inv.id, 'cancel')}
                                className="h-8 w-8 text-slate-500 hover:text-red-600 hover:bg-red-50"
                                title="إلغاء"
                              >
                                <XCircle className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                          {inv.status === 'CONFIRMED' && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => openConfirmDialog(inv.id, 'cancel')}
                              className="h-8 w-8 text-slate-500 hover:text-red-600 hover:bg-red-50"
                              title="إلغاء"
                            >
                              <XCircle className="h-4 w-4" />
                            </Button>
                          )}
                          {inv.status === 'PARTIAL_PAID' && (
                            <Badge className="bg-orange-50 text-orange-700 border-orange-200 text-xs">
                              <CreditCard className="h-3 w-3 ml-1" />
                              سداد
                            </Badge>
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

      {/* ── New Invoice Dialog ── */}
      <Dialog open={newDialogOpen} onOpenChange={setNewDialogOpen}>
        <DialogContent className="sm:max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>فاتورة شراء جديدة</DialogTitle>
            <DialogDescription>
              إنشاء فاتورة شراء جديدة من المورد
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="max-h-[65vh] pr-1">
            <div className="space-y-4 py-2">
              {/* Invoice header */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>المورد <span className="text-red-500">*</span></Label>
                  <Select value={invoiceSupplierId} onValueChange={setInvoiceSupplierId}>
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
                  <Label>المخزن <span className="text-red-500">*</span></Label>
                  <Select value={invoiceWarehouseId} onValueChange={setInvoiceWarehouseId}>
                    <SelectTrigger>
                      <SelectValue placeholder="اختر المخزن" />
                    </SelectTrigger>
                    <SelectContent>
                      {warehouses.map((w) => (
                        <SelectItem key={w.id} value={w.id}>
                          {w.nameAr} ({w.code})
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
              </div>

              {/* Lines */}
              <div className="border rounded-lg overflow-hidden">
                <div className="bg-slate-50 px-4 py-2">
                  <span className="text-sm font-semibold text-slate-700">بنود الفاتورة</span>
                </div>
                <div className="p-4 space-y-3">
                  {invoiceLines.map((line, idx) => (
                    <div key={idx} className="grid grid-cols-12 gap-2 items-end">
                      <div className="col-span-3">
                        {idx === 0 && <Label className="text-xs text-slate-500">الصنف</Label>}
                        <Select value={line.itemId} onValueChange={(val) => updateLine(idx, 'itemId', val)}>
                          <SelectTrigger className="h-9 text-sm">
                            <SelectValue placeholder="اختر الصنف" />
                          </SelectTrigger>
                          <SelectContent>
                            {items.map((it) => (
                              <SelectItem key={it.id} value={it.id}>
                                {it.nameAr} ({it.code})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="col-span-2">
                        {idx === 0 && <Label className="text-xs text-slate-500">الكمية</Label>}
                        <Input
                          type="number"
                          min="0"
                          step="1"
                          value={line.quantity}
                          onChange={(e) => updateLine(idx, 'quantity', e.target.value)}
                          className="h-9 text-sm"
                          dir="ltr"
                        />
                      </div>
                      <div className="col-span-2">
                        {idx === 0 && <Label className="text-xs text-slate-500">سعر الوحدة</Label>}
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={line.unitPrice}
                          onChange={(e) => updateLine(idx, 'unitPrice', e.target.value)}
                          className="h-9 text-sm"
                          dir="ltr"
                        />
                      </div>
                      <div className="col-span-2">
                        {idx === 0 && <Label className="text-xs text-slate-500">الخصم</Label>}
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={line.discountAmount}
                          onChange={(e) => updateLine(idx, 'discountAmount', e.target.value)}
                          className="h-9 text-sm"
                          dir="ltr"
                        />
                      </div>
                      <div className="col-span-2">
                        {idx === 0 && <Label className="text-xs text-slate-500">الضريبة</Label>}
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={line.taxAmount}
                          onChange={(e) => updateLine(idx, 'taxAmount', e.target.value)}
                          className="h-9 text-sm"
                          dir="ltr"
                        />
                      </div>
                      <div className="col-span-1 flex items-center gap-1">
                        {idx === 0 && <Label className="text-xs text-slate-500">الإجمالي</Label>}
                        <span className="text-sm font-mono" dir="ltr">
                          {formatCurrency(calcLineTotal(line))}
                        </span>
                        {invoiceLines.length > 1 && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removeLine(idx)}
                            className="h-7 w-7 text-red-400 hover:text-red-600"
                          >
                            <XCircle className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={addLine}
                    className="gap-1 text-emerald-600 border-emerald-200 hover:bg-emerald-50"
                  >
                    <Plus className="h-3 w-3" />
                    إضافة سطر
                  </Button>
                </div>
              </div>

              {/* Invoice-level totals */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>ملاحظات</Label>
                  <Textarea
                    value={invoiceNotes}
                    onChange={(e) => setInvoiceNotes(e.target.value)}
                    placeholder="ملاحظات إضافية..."
                    rows={2}
                  />
                </div>
                <div className="space-y-3 border rounded-lg p-4 bg-slate-50">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">المجموع الفرعي</span>
                    <span className="font-mono" dir="ltr">{formatCurrency(totals.subtotal)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2 text-sm">
                    <span className="text-slate-500">خصم الفاتورة</span>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={invoiceDiscountAmount}
                      onChange={(e) => setInvoiceDiscountAmount(e.target.value)}
                      className="h-8 w-28 text-sm text-left"
                      dir="ltr"
                    />
                  </div>
                  <div className="flex items-center justify-between gap-2 text-sm">
                    <span className="text-slate-500">نسبة الضريبة %</span>
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      value={invoiceTaxPercent}
                      onChange={(e) => setInvoiceTaxPercent(e.target.value)}
                      className="h-8 w-28 text-sm text-left"
                      dir="ltr"
                    />
                  </div>
                  <Separator />
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">الضريبة</span>
                    <span className="font-mono" dir="ltr">{formatCurrency(totals.totalTax)}</span>
                  </div>
                  <div className="flex justify-between text-base font-bold">
                    <span>الإجمالي</span>
                    <span className="font-mono text-emerald-700" dir="ltr">{formatCurrency(totals.total)}</span>
                  </div>
                </div>
              </div>
            </div>
          </ScrollArea>

          <DialogFooter>
            <Button variant="outline" onClick={() => setNewDialogOpen(false)}>
              إلغاء
            </Button>
            <Button
              onClick={handleSaveDraft}
              disabled={submitting}
              className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              حفظ كمسودة
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Detail Dialog ── */}
      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="sm:max-w-3xl max-h-[85vh]">
          <DialogHeader>
            <DialogTitle>تفاصيل فاتورة الشراء</DialogTitle>
          </DialogHeader>
          {detailLoading ? (
            <div className="space-y-3 py-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-8 w-full" />
              ))}
            </div>
          ) : detailInvoice ? (
            <ScrollArea className="max-h-[65vh] pr-1">
              <div className="space-y-4 py-2">
                {/* Invoice header info */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div>
                    <span className="text-xs text-slate-400">رقم الفاتورة</span>
                    <p className="font-mono text-sm font-medium">{detailInvoice.number}</p>
                  </div>
                  <div>
                    <span className="text-xs text-slate-400">المورد</span>
                    <p className="text-sm font-medium">{detailInvoice.supplier.nameAr}</p>
                  </div>
                  <div>
                    <span className="text-xs text-slate-400">المخزن</span>
                    <p className="text-sm font-medium">{detailInvoice.warehouse.nameAr}</p>
                  </div>
                  <div>
                    <span className="text-xs text-slate-400">التاريخ</span>
                    <p className="text-sm font-medium">{formatDate(detailInvoice.date)}</p>
                  </div>
                  <div>
                    <span className="text-xs text-slate-400">الحالة</span>
                    <Badge className={getStatusColor(detailInvoice.status)}>
                      {getStatusLabel(detailInvoice.status)}
                    </Badge>
                  </div>
                </div>

                <Separator />

                {/* Lines table */}
                {detailInvoice.lines && (
                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-slate-50/80">
                          <TableHead className="text-right text-xs">الصنف</TableHead>
                          <TableHead className="text-right text-xs">الكمية</TableHead>
                          <TableHead className="text-right text-xs">سعر الوحدة</TableHead>
                          <TableHead className="text-right text-xs">الخصم</TableHead>
                          <TableHead className="text-right text-xs">الضريبة</TableHead>
                          <TableHead className="text-right text-xs">الإجمالي</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {detailInvoice.lines.map((line) => (
                          <TableRow key={line.id}>
                            <TableCell className="text-sm">{line.item.nameAr}</TableCell>
                            <TableCell className="font-mono text-sm" dir="ltr">{line.quantity}</TableCell>
                            <TableCell className="font-mono text-sm" dir="ltr">{formatCurrency(line.unitPrice)}</TableCell>
                            <TableCell className="font-mono text-sm" dir="ltr">{formatCurrency(line.discountAmount)}</TableCell>
                            <TableCell className="font-mono text-sm" dir="ltr">{formatCurrency(line.taxAmount)}</TableCell>
                            <TableCell className="font-mono text-sm font-medium" dir="ltr">{formatCurrency(line.totalAmount)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}

                {/* Totals */}
                <div className="border rounded-lg p-4 bg-slate-50 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">المجموع الفرعي</span>
                    <span className="font-mono" dir="ltr">{formatCurrency(detailInvoice.subtotal)}</span>
                  </div>
                  {detailInvoice.discountAmount > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">الخصم</span>
                      <span className="font-mono text-red-600" dir="ltr">-{formatCurrency(detailInvoice.discountAmount)}</span>
                    </div>
                  )}
                  {detailInvoice.taxAmount > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">الضريبة</span>
                      <span className="font-mono" dir="ltr">{formatCurrency(detailInvoice.taxAmount)}</span>
                    </div>
                  )}
                  <Separator />
                  <div className="flex justify-between text-base font-bold">
                    <span>الإجمالي</span>
                    <span className="font-mono text-emerald-700" dir="ltr">{formatCurrency(detailInvoice.totalAmount)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">المدفوع</span>
                    <span className="font-mono text-emerald-600" dir="ltr">{formatCurrency(detailInvoice.paidAmount)}</span>
                  </div>
                  <div className="flex justify-between text-sm font-medium">
                    <span>المتبقي</span>
                    <span className={`font-mono ${detailInvoice.balanceDue > 0 ? 'text-red-600' : 'text-slate-400'}`} dir="ltr">{formatCurrency(detailInvoice.balanceDue)}</span>
                  </div>
                </div>

                {detailInvoice.notes && (
                  <div>
                    <span className="text-xs text-slate-400">ملاحظات</span>
                    <p className="text-sm text-slate-600 mt-1">{detailInvoice.notes}</p>
                  </div>
                )}
              </div>
            </ScrollArea>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* ── Confirm/Cancel Dialog ── */}
      <Dialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {confirmAction === 'confirm' ? 'تأكيد الفاتورة' : 'إلغاء الفاتورة'}
            </DialogTitle>
            <DialogDescription>
              {confirmAction === 'confirm'
                ? 'سيتم تأكيد الفاتورة وتحديث المخزون وإنشاء القيود المحاسبية. هل أنت متأكد؟'
                : 'سيتم إلغاء الفاتورة. هل أنت متأكد؟'}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDialogOpen(false)}>
              تراجع
            </Button>
            <Button
              onClick={handleAction}
              disabled={submitting}
              className={
                confirmAction === 'confirm'
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white gap-2'
                  : 'bg-red-600 hover:bg-red-700 text-white gap-2'
              }
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {confirmAction === 'confirm' ? 'تأكيد' : 'إلغاء الفاتورة'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
