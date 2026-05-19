'use client'

import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import {
  Truck,
  Plus,
  Loader2,
  Eye,
  CheckCircle2,
  XCircle,
  Trash2,
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
import { useAppStore } from '@/lib/store'
import { formatDate } from '@/lib/erp-utils'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Warehouse {
  id: string
  code: string
  nameAr: string
  nameEn?: string
  type: string
  parentId?: string | null
  parent?: { id: string; nameAr: string; parent?: { id: string; nameAr: string; parent?: { id: string; nameAr: string } } }
}

interface Item {
  id: string
  code: string
  nameAr?: string
  nameEn?: string
}

interface Customer {
  id: string
  code: string
  nameAr: string
  nameEn?: string
}

interface SalesInvoice {
  id: string
  number: string
  customerId: string
  status: string
  date: string
  customer?: { id: string; code: string; nameAr: string; nameEn?: string }
  lines?: SalesInvoiceLine[]
}

interface SalesInvoiceLine {
  id: string
  itemId: string
  quantity: number
  unitPrice: number
  item?: { id: string; code: string; nameAr?: string; nameEn?: string }
}

interface DeliveryNoteLine {
  id: string
  itemId: string
  quantity: number
  notes: string | null
  item?: { id: string; code: string; nameAr?: string; nameEn?: string; uom?: { nameAr: string } | null }
}

interface DeliveryNote {
  id: string
  number: string
  date: string
  status: string
  salesInvoiceId: string | null
  customerId: string | null
  warehouseId: string
  notes: string | null
  createdAt: string
  customer?: { id: string; code: string; nameAr: string; nameEn?: string }
  warehouse?: { id: string; code: string; nameAr: string; nameEn?: string }
  salesInvoice?: { id: string; number: string }
  _count?: { lines: number }
  lines?: DeliveryNoteLine[]
}

interface DeliveryNoteLineInput {
  itemId: string
  quantity: number
  notes: string
}

// ─── Constants ────────────────────────────────────────────────────────────────

const statusLabels: Record<string, string> = {
  DRAFT: 'مسودة',
  CONFIRMED: 'مؤكد',
  CANCELLED: 'ملغى',
}

const statusBadgeStyles: Record<string, string> = {
  DRAFT: 'bg-slate-50 text-slate-700 border-slate-200',
  CONFIRMED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  CANCELLED: 'bg-red-50 text-red-700 border-red-200',
}

const initialLineInput: DeliveryNoteLineInput = {
  itemId: '',
  quantity: 0,
  notes: '',
}

// ─── Helper: Build warehouse hierarchy display name ───────────────────────────

function buildWarehouseDisplayName(wh: Warehouse): string {
  const parts: string[] = [wh.nameAr]
  let current = wh.parent
  while (current) {
    parts.push(current.nameAr)
    current = current.parent
  }
  return parts.reverse().join(' → ')
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function DeliveryNotesList() {
  const companyId = useAppStore((state) => state.currentCompanyId)
  const [deliveryNotes, setDeliveryNotes] = useState<DeliveryNote[]>([])
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [items, setItems] = useState<Item[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [salesInvoices, setSalesInvoices] = useState<SalesInvoice[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  // Create dialog
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [createForm, setCreateForm] = useState({
    warehouseId: '',
    salesInvoiceId: '',
    customerId: '',
    date: new Date().toISOString().split('T')[0],
    notes: '',
  })
  const [createLines, setCreateLines] = useState<DeliveryNoteLineInput[]>([{ ...initialLineInput }])
  const [invoiceLoading, setInvoiceLoading] = useState(false)

  // View dialog
  const [viewDialogOpen, setViewDialogOpen] = useState(false)
  const [selectedNote, setSelectedNote] = useState<DeliveryNote | null>(null)
  const [viewLoading, setViewLoading] = useState(false)

  // Cancel confirmation
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false)

  // ── Data Fetching ─────────────────────────────────────────────────────────

  const fetchDeliveryNotes = useCallback(async () => {
    try {
      const res = await fetch(`/api/inventory/delivery-notes?companyId=${companyId}`)
      if (res.ok) {
        const data = await res.json()
        setDeliveryNotes(data)
      }
    } catch {
      toast.error('فشل في تحميل أذون الصرف')
    } finally {
      setLoading(false)
    }
  }, [companyId])

  const fetchWarehouses = useCallback(async () => {
    try {
      const res = await fetch(`/api/inventory/warehouses?companyId=${companyId}`)
      if (res.ok) {
        const data = await res.json()
        setWarehouses(data)
      }
    } catch {
      // silently fail
    }
  }, [companyId])

  const fetchItems = useCallback(async () => {
    try {
      const res = await fetch(`/api/inventory/items?companyId=${companyId}`)
      if (res.ok) {
        const data = await res.json()
        setItems(data)
      }
    } catch {
      // silently fail
    }
  }, [companyId])

  const fetchCustomers = useCallback(async () => {
    try {
      const res = await fetch(`/api/sales/customers?companyId=${companyId}`)
      if (res.ok) {
        const data = await res.json()
        setCustomers(data)
      }
    } catch {
      // silently fail
    }
  }, [companyId])

  const fetchSalesInvoices = useCallback(async () => {
    try {
      const res = await fetch(`/api/sales/invoices?companyId=${companyId}`)
      if (res.ok) {
        const data = await res.json()
        setSalesInvoices(data)
      }
    } catch {
      // silently fail
    }
  }, [companyId])

  useEffect(() => {
    if (companyId) {
      fetchDeliveryNotes()
      fetchWarehouses()
      fetchItems()
      fetchCustomers()
      fetchSalesInvoices()
    }
  }, [companyId, fetchDeliveryNotes, fetchWarehouses, fetchItems, fetchCustomers, fetchSalesInvoices])

  // ── Warehouse Display Name ────────────────────────────────────────────────

  const getWarehouseDisplayName = (warehouseId: string, whData?: { nameAr: string; nameEn?: string }) => {
    const wh = warehouses.find((w) => w.id === warehouseId)
    if (wh) {
      return buildWarehouseDisplayName(wh)
    }
    return whData?.nameAr || warehouseId
  }

  const getCustomerDisplayName = (customerId: string | null, custData?: { nameAr: string; nameEn?: string } | null) => {
    if (!customerId) return '—'
    const customer = customers.find((c) => c.id === customerId)
    if (customer) return customer.nameAr
    return custData?.nameAr || customerId
  }

  // ── Sales Invoice Auto-fill ──────────────────────────────────────────────

  const handleSalesInvoiceChange = async (invoiceId: string) => {
    if (!invoiceId) {
      setCreateForm((p) => ({ ...p, salesInvoiceId: '', customerId: '' }))
      setCreateLines([{ ...initialLineInput }])
      return
    }

    setCreateForm((p) => ({ ...p, salesInvoiceId: invoiceId }))
    setInvoiceLoading(true)

    try {
      const res = await fetch(`/api/sales/invoices/${invoiceId}?companyId=${companyId}`)
      if (res.ok) {
        const invoice: SalesInvoice = await res.json()
        // Auto-fill customerId from the invoice
        setCreateForm((p) => ({ ...p, customerId: invoice.customerId }))

        // Pre-populate lines from invoice items
        if (invoice.lines && invoice.lines.length > 0) {
          const invoiceLines: DeliveryNoteLineInput[] = invoice.lines.map((l) => ({
            itemId: l.itemId,
            quantity: l.quantity,
            notes: '',
          }))
          setCreateLines(invoiceLines)
        }
      } else {
        toast.error('فشل في تحميل تفاصيل الفاتورة')
      }
    } catch {
      toast.error('حدث خطأ أثناء تحميل الفاتورة')
    } finally {
      setInvoiceLoading(false)
    }
  }

  // ── Create Delivery Note Handlers ────────────────────────────────────────

  const handleOpenCreate = () => {
    setCreateForm({
      warehouseId: '',
      salesInvoiceId: '',
      customerId: '',
      date: new Date().toISOString().split('T')[0],
      notes: '',
    })
    setCreateLines([{ ...initialLineInput }])
    setCreateDialogOpen(true)
  }

  const handleAddLine = () => {
    setCreateLines((prev) => [...prev, { ...initialLineInput }])
  }

  const handleRemoveLine = (index: number) => {
    setCreateLines((prev) => prev.filter((_, i) => i !== index))
  }

  const handleLineChange = (index: number, field: keyof DeliveryNoteLineInput, value: string | number) => {
    setCreateLines((prev) =>
      prev.map((line, i) => (i === index ? { ...line, [field]: value } : line))
    )
  }

  const handleCreateSubmit = async () => {
    if (!createForm.warehouseId) {
      toast.error('يرجى اختيار المخزن')
      return
    }
    if (!createForm.date) {
      toast.error('يرجى تحديد التاريخ')
      return
    }

    const validLines = createLines.filter((l) => l.itemId && l.quantity > 0)
    if (validLines.length === 0) {
      toast.error('يرجى إضافة سطر واحد على الأقل بصنف وكمية صحيحة')
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch(`/api/inventory/delivery-notes?companyId=${companyId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          warehouseId: createForm.warehouseId,
          salesInvoiceId: createForm.salesInvoiceId || undefined,
          customerId: createForm.customerId || undefined,
          date: createForm.date,
          notes: createForm.notes,
          lines: validLines.map((l) => ({
            itemId: l.itemId,
            quantity: l.quantity,
            notes: l.notes || undefined,
          })),
        }),
      })

      if (res.ok) {
        toast.success('تم إنشاء إذن الصرف بنجاح')
        setCreateDialogOpen(false)
        fetchDeliveryNotes()
      } else {
        const err = await res.json()
        toast.error(err.error || 'فشل في إنشاء إذن الصرف')
      }
    } catch {
      toast.error('حدث خطأ أثناء إنشاء إذن الصرف')
    } finally {
      setSubmitting(false)
    }
  }

  // ── View/Confirm/Cancel Handlers ──────────────────────────────────────────

  const handleViewNote = async (noteId: string) => {
    setViewLoading(true)
    setViewDialogOpen(true)
    try {
      const res = await fetch(`/api/inventory/delivery-notes/${noteId}?companyId=${companyId}`)
      if (res.ok) {
        const data = await res.json()
        setSelectedNote(data)
      } else {
        toast.error('فشل في تحميل تفاصيل إذن الصرف')
        setViewDialogOpen(false)
      }
    } catch {
      toast.error('حدث خطأ أثناء تحميل التفاصيل')
      setViewDialogOpen(false)
    } finally {
      setViewLoading(false)
    }
  }

  const handleConfirmNote = async () => {
    if (!selectedNote) return
    setSubmitting(true)
    try {
      const res = await fetch(`/api/inventory/delivery-notes/${selectedNote.id}?companyId=${companyId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId, action: 'confirm' }),
      })
      if (res.ok) {
        const updated = await res.json()
        setSelectedNote(updated)
        toast.success('تم تأكيد إذن الصرف بنجاح')
        fetchDeliveryNotes()
      } else {
        const err = await res.json()
        toast.error(err.error || 'فشل في تأكيد إذن الصرف')
      }
    } catch {
      toast.error('حدث خطأ أثناء تأكيد إذن الصرف')
    } finally {
      setSubmitting(false)
    }
  }

  const handleCancelNote = async () => {
    if (!selectedNote) return
    setSubmitting(true)
    try {
      const res = await fetch(`/api/inventory/delivery-notes/${selectedNote.id}?companyId=${companyId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId, action: 'cancel' }),
      })
      if (res.ok) {
        const updated = await res.json()
        setSelectedNote(updated)
        toast.success('تم إلغاء إذن الصرف بنجاح')
        fetchDeliveryNotes()
      } else {
        const err = await res.json()
        toast.error(err.error || 'فشل في إلغاء إذن الصرف')
      }
    } catch {
      toast.error('حدث خطأ أثناء إلغاء إذن الصرف')
    } finally {
      setSubmitting(false)
      setCancelConfirmOpen(false)
    }
  }

  // Inline status action for table row buttons
  const handleInlineConfirm = async (noteId: string) => {
    setSubmitting(true)
    try {
      const res = await fetch(`/api/inventory/delivery-notes/${noteId}?companyId=${companyId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId, action: 'confirm' }),
      })
      if (res.ok) {
        toast.success('تم تأكيد إذن الصرف بنجاح')
        fetchDeliveryNotes()
      } else {
        const err = await res.json()
        toast.error(err.error || 'فشل في تأكيد إذن الصرف')
      }
    } catch {
      toast.error('حدث خطأ أثناء تأكيد إذن الصرف')
    } finally {
      setSubmitting(false)
    }
  }

  const handleInlineCancel = async (noteId: string) => {
    setSubmitting(true)
    try {
      const res = await fetch(`/api/inventory/delivery-notes/${noteId}?companyId=${companyId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId, action: 'cancel' }),
      })
      if (res.ok) {
        toast.success('تم إلغاء إذن الصرف بنجاح')
        fetchDeliveryNotes()
      } else {
        const err = await res.json()
        toast.error(err.error || 'فشل في إلغاء إذن الصرف')
      }
    } catch {
      toast.error('حدث خطأ أثناء إلغاء إذن الصرف')
    } finally {
      setSubmitting(false)
    }
  }

  // ─── Loading State ──────────────────────────────────────────────────────

  if (loading) {
    return (
      <Card className="border shadow-sm">
        <CardHeader>
          <div className="flex items-center justify-between">
            <Skeleton className="h-7 w-52" />
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

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <>
      <Card className="border shadow-sm">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-emerald-50 flex items-center justify-center">
                <Truck className="h-5 w-5 text-emerald-600" />
              </div>
              <CardTitle className="text-lg">أذون الصرف</CardTitle>
            </div>
            <Button
              onClick={handleOpenCreate}
              className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
            >
              <Plus className="h-4 w-4" />
              إذن صرف جديد
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Table */}
          <div className="max-h-[calc(100vh-300px)] overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50/80 hover:bg-slate-50/80">
                  <TableHead className="text-right font-semibold">رقم الإذن</TableHead>
                  <TableHead className="text-right font-semibold">التاريخ</TableHead>
                  <TableHead className="text-right font-semibold">العميل</TableHead>
                  <TableHead className="text-right font-semibold">المخزن</TableHead>
                  <TableHead className="text-right font-semibold">فاتورة البيع</TableHead>
                  <TableHead className="text-right font-semibold">عدد الأصناف</TableHead>
                  <TableHead className="text-right font-semibold">الحالة</TableHead>
                  <TableHead className="text-right font-semibold">إجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {deliveryNotes.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-12">
                      <div className="flex flex-col items-center text-slate-400">
                        <Truck className="h-12 w-12 mb-3 text-slate-200" />
                        <p className="text-sm">لا توجد أذون صرف</p>
                        <p className="text-xs mt-1 text-slate-300">
                          اضغط على &quot;إذن صرف جديد&quot; لإنشاء إذن
                        </p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  deliveryNotes.map((note) => (
                    <TableRow key={note.id} className="hover:bg-slate-50/50">
                      <TableCell className="font-mono text-sm font-medium">
                        {note.number}
                      </TableCell>
                      <TableCell className="text-slate-500 text-sm whitespace-nowrap">
                        {formatDate(note.date)}
                      </TableCell>
                      <TableCell className="text-sm text-slate-700">
                        {getCustomerDisplayName(note.customerId, note.customer)}
                      </TableCell>
                      <TableCell className="text-sm">
                        <span className="text-slate-700">
                          {getWarehouseDisplayName(note.warehouseId, note.warehouse)}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm text-slate-500">
                        {note.salesInvoice ? note.salesInvoice.number : '—'}
                      </TableCell>
                      <TableCell className="text-center font-mono text-sm">
                        {note._count?.lines ?? 0}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={statusBadgeStyles[note.status] || 'bg-slate-50 text-slate-700'}
                        >
                          {statusLabels[note.status] || note.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-slate-500 hover:text-emerald-600"
                            onClick={() => handleViewNote(note.id)}
                            title="عرض التفاصيل"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          {note.status === 'DRAFT' && (
                            <>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-slate-500 hover:text-emerald-600"
                                onClick={() => handleInlineConfirm(note.id)}
                                title="تأكيد"
                                disabled={submitting}
                              >
                                <CheckCircle2 className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-slate-500 hover:text-red-600"
                                onClick={() => handleInlineCancel(note.id)}
                                title="إلغاء"
                                disabled={submitting}
                              >
                                <XCircle className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                          {note.status === 'CONFIRMED' && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-slate-500 hover:text-red-600"
                              onClick={() => {
                                setSelectedNote(note)
                                setCancelConfirmOpen(true)
                              }}
                              title="إلغاء إذن الصرف"
                            >
                              <XCircle className="h-4 w-4" />
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

      {/* ─── Create Delivery Note Dialog ──────────────────────────────────── */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Truck className="h-5 w-5 text-emerald-600" />
              إذن صرف جديد
            </DialogTitle>
            <DialogDescription>
              إنشاء إذن صرف جديد من المخزن
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-2">
            {/* Warehouse */}
            <div className="space-y-2">
              <Label>
                المخزن <span className="text-red-500">*</span>
              </Label>
              <Select
                value={createForm.warehouseId}
                onValueChange={(val) =>
                  setCreateForm((p) => ({ ...p, warehouseId: val }))
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="اختر المخزن" />
                </SelectTrigger>
                <SelectContent>
                  {warehouses.map((wh) => (
                    <SelectItem key={wh.id} value={wh.id}>
                      {buildWarehouseDisplayName(wh)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Sales Invoice (optional) */}
            <div className="space-y-2">
              <Label>فاتورة البيع (اختياري)</Label>
              <Select
                value={createForm.salesInvoiceId}
                onValueChange={(val) => handleSalesInvoiceChange(val)}
                disabled={invoiceLoading}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="اختر فاتورة البيع" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">بدون فاتورة</SelectItem>
                  {salesInvoices
                    .filter((inv) => inv.status === 'CONFIRMED')
                    .map((inv) => (
                      <SelectItem key={inv.id} value={inv.id}>
                        {inv.number} - {inv.customer?.nameAr || '—'}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            {/* Customer (auto-filled from invoice or manual) */}
            <div className="space-y-2">
              <Label>العميل</Label>
              <Select
                value={createForm.customerId}
                onValueChange={(val) =>
                  setCreateForm((p) => ({ ...p, customerId: val }))
                }
                disabled={!!createForm.salesInvoiceId}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="اختر العميل" />
                </SelectTrigger>
                <SelectContent>
                  {customers.map((cust) => (
                    <SelectItem key={cust.id} value={cust.id}>
                      {cust.nameAr} ({cust.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {createForm.salesInvoiceId && (
                <p className="text-xs text-slate-400">يتم تعبئته تلقائياً من الفاتورة</p>
              )}
            </div>

            {/* Date */}
            <div className="space-y-2">
              <Label>
                التاريخ <span className="text-red-500">*</span>
              </Label>
              <Input
                type="date"
                value={createForm.date}
                onChange={(e) =>
                  setCreateForm((p) => ({ ...p, date: e.target.value }))
                }
                dir="ltr"
              />
            </div>

            {/* Notes */}
            <div className="space-y-2 sm:col-span-2">
              <Label>ملاحظات</Label>
              <Textarea
                value={createForm.notes}
                onChange={(e) =>
                  setCreateForm((p) => ({ ...p, notes: e.target.value }))
                }
                placeholder="ملاحظات اختيارية..."
                rows={2}
              />
            </div>
          </div>

          {/* Delivery Note Lines */}
          <div className="space-y-3 mt-2">
            <div className="flex items-center justify-between">
              <Label className="text-base font-semibold">أصناف الإذن</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddLine}
                className="gap-1 text-emerald-600 border-emerald-200 hover:bg-emerald-50"
                disabled={!!createForm.salesInvoiceId}
              >
                <Plus className="h-3.5 w-3.5" />
                إضافة صنف
              </Button>
            </div>
            {createForm.salesInvoiceId && (
              <p className="text-xs text-slate-400">الأصناف معبأة تلقائياً من الفاتورة المحددة</p>
            )}

            <div className="space-y-2 max-h-60 overflow-y-auto">
              {createLines.map((line, index) => (
                <div
                  key={index}
                  className="grid grid-cols-[1fr_100px_1fr_36px] gap-2 items-end"
                >
                  <div>
                    {index === 0 && (
                      <Label className="text-xs text-slate-500">الصنف</Label>
                    )}
                    <Select
                      value={line.itemId}
                      onValueChange={(val) => handleLineChange(index, 'itemId', val)}
                      disabled={!!createForm.salesInvoiceId}
                    >
                      <SelectTrigger className="w-full h-9">
                        <SelectValue placeholder="اختر الصنف" />
                      </SelectTrigger>
                      <SelectContent>
                        {items.map((item) => (
                          <SelectItem key={item.id} value={item.id}>
                            {item.nameAr || item.nameEn || item.code} ({item.code})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    {index === 0 && (
                      <Label className="text-xs text-slate-500">الكمية</Label>
                    )}
                    <Input
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={line.quantity || ''}
                      onChange={(e) =>
                        handleLineChange(index, 'quantity', parseFloat(e.target.value) || 0)
                      }
                      placeholder="0"
                      dir="ltr"
                      className="text-left h-9"
                    />
                  </div>
                  <div>
                    {index === 0 && (
                      <Label className="text-xs text-slate-500">ملاحظات</Label>
                    )}
                    <Input
                      value={line.notes || ''}
                      onChange={(e) => handleLineChange(index, 'notes', e.target.value)}
                      placeholder="ملاحظات..."
                      className="h-9"
                    />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 text-red-400 hover:text-red-600"
                    onClick={() => handleRemoveLine(index)}
                    disabled={createLines.length === 1 || !!createForm.salesInvoiceId}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>

          <DialogFooter className="mt-4">
            <Button
              variant="outline"
              onClick={() => setCreateDialogOpen(false)}
            >
              إلغاء
            </Button>
            <Button
              onClick={handleCreateSubmit}
              disabled={submitting || invoiceLoading}
              className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              إنشاء إذن الصرف
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── View Delivery Note Dialog ────────────────────────────────────── */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          {viewLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
            </div>
          ) : selectedNote ? (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Truck className="h-5 w-5 text-emerald-600" />
                  إذن صرف {selectedNote.number}
                </DialogTitle>
                <DialogDescription>
                  تفاصيل إذن الصرف والإجراءات
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-2">
                {/* Delivery Note Info */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <p className="text-xs text-slate-500">رقم الإذن</p>
                    <p className="text-sm font-medium text-slate-800 font-mono">
                      {selectedNote.number}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-slate-500">التاريخ</p>
                    <p className="text-sm font-medium text-slate-800">
                      {formatDate(selectedNote.date)}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-slate-500">العميل</p>
                    <p className="text-sm font-medium text-slate-800">
                      {getCustomerDisplayName(selectedNote.customerId, selectedNote.customer)}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-slate-500">المخزن</p>
                    <p className="text-sm font-medium text-slate-800">
                      {getWarehouseDisplayName(selectedNote.warehouseId, selectedNote.warehouse)}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-slate-500">فاتورة البيع</p>
                    <p className="text-sm font-medium text-slate-800">
                      {selectedNote.salesInvoice ? selectedNote.salesInvoice.number : '—'}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-slate-500">الحالة</p>
                    <Badge
                      variant="outline"
                      className={
                        statusBadgeStyles[selectedNote.status] ||
                        'bg-slate-50 text-slate-700'
                      }
                    >
                      {statusLabels[selectedNote.status] || selectedNote.status}
                    </Badge>
                  </div>
                </div>

                {selectedNote.notes && (
                  <div className="space-y-1">
                    <p className="text-xs text-slate-500">ملاحظات</p>
                    <p className="text-sm text-slate-700 bg-slate-50 p-3 rounded-lg">
                      {selectedNote.notes}
                    </p>
                  </div>
                )}

                {/* Delivery Note Lines */}
                {selectedNote.lines && selectedNote.lines.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm font-semibold text-slate-700">أصناف الإذن</p>
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-slate-50/80 hover:bg-slate-50/80">
                          <TableHead className="text-right font-semibold">الصنف</TableHead>
                          <TableHead className="text-right font-semibold">الكود</TableHead>
                          <TableHead className="text-right font-semibold">الوحدة</TableHead>
                          <TableHead className="text-right font-semibold">الكمية</TableHead>
                          <TableHead className="text-right font-semibold">ملاحظات</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {selectedNote.lines.map((line) => (
                          <TableRow key={line.id}>
                            <TableCell className="font-medium">
                              {line.item?.nameAr || line.item?.nameEn || '—'}
                            </TableCell>
                            <TableCell className="font-mono text-sm text-slate-500">
                              {line.item?.code || '—'}
                            </TableCell>
                            <TableCell className="text-sm text-slate-500">
                              {line.item?.uom?.nameAr || '—'}
                            </TableCell>
                            <TableCell className="font-mono" dir="ltr">
                              {line.quantity.toLocaleString('ar-EG')}
                            </TableCell>
                            <TableCell className="text-slate-500 text-sm">
                              {line.notes || '—'}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>

              <DialogFooter className="gap-2">
                <Button
                  variant="outline"
                  onClick={() => setViewDialogOpen(false)}
                >
                  إغلاق
                </Button>
                {selectedNote.status === 'DRAFT' && (
                  <>
                    <Button
                      onClick={handleConfirmNote}
                      disabled={submitting}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
                    >
                      {submitting ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <CheckCircle2 className="h-4 w-4" />
                      )}
                      تأكيد الإذن
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={() => setCancelConfirmOpen(true)}
                      disabled={submitting}
                      className="gap-2"
                    >
                      <XCircle className="h-4 w-4" />
                      إلغاء الإذن
                    </Button>
                  </>
                )}
                {selectedNote.status === 'CONFIRMED' && (
                  <Button
                    variant="destructive"
                    onClick={() => setCancelConfirmOpen(true)}
                    disabled={submitting}
                    className="gap-2"
                  >
                    <XCircle className="h-4 w-4" />
                    إلغاء الإذن (عكس الحركات)
                  </Button>
                )}
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* ─── Cancel Confirmation Dialog ──────────────────────────────────── */}
      <AlertDialog open={cancelConfirmOpen} onOpenChange={setCancelConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>تأكيد إلغاء إذن الصرف</AlertDialogTitle>
            <AlertDialogDescription>
              {selectedNote?.status === 'CONFIRMED'
                ? 'سيتم عكس حركات المخزون التي تم إنشاؤها عند تأكيد هذا الإذن. هل أنت متأكد؟'
                : 'هل أنت متأكد من إلغاء هذا الإذن؟'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>تراجع</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCancelNote}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              نعم، إلغاء الإذن
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
