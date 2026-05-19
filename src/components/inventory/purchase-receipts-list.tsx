'use client'

import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import {
  PackageCheck,
  Plus,
  Loader2,
  Eye,
  CheckCircle2,
  XCircle,
  Trash2,
  FileText,
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

interface Supplier {
  id: string
  code: string
  nameAr: string
  nameEn?: string
}

interface PurchaseInvoice {
  id: string
  number: string
  supplierId: string
  status: string
  date: string
  supplier?: { id: string; code: string; nameAr: string; nameEn?: string }
  lines?: PurchaseInvoiceLine[]
}

interface PurchaseInvoiceLine {
  id: string
  itemId: string
  quantity: number
  unitPrice: number
  item?: { id: string; code: string; nameAr?: string; nameEn?: string }
}

interface PurchaseReceiptLine {
  id: string
  itemId: string
  quantity: number
  notes: string | null
  item?: { id: string; code: string; nameAr?: string; nameEn?: string; uom?: { nameAr: string } | null }
}

interface PurchaseReceipt {
  id: string
  number: string
  date: string
  status: string
  purchaseInvoiceId: string | null
  purchaseOrderId: string | null
  supplierId: string | null
  warehouseId: string
  notes: string | null
  createdAt: string
  supplier?: { id: string; code: string; nameAr: string; nameEn?: string }
  warehouse?: { id: string; code: string; nameAr: string; nameEn?: string }
  purchaseInvoice?: { id: string; number: string }
  purchaseOrder?: { id: string; number: string }
  _count?: { lines: number }
  lines?: PurchaseReceiptLine[]
}

interface PurchaseReceiptLineInput {
  itemId: string
  quantity: number
  notes: string
}

interface PurchaseOrder {
  id: string
  number: string
  supplierId: string
  warehouseId: string
  status: string
  supplier?: { id: string; code: string; nameAr: string; nameEn?: string }
  _count?: { lines: number }
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

const initialLineInput: PurchaseReceiptLineInput = {
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

export default function PurchaseReceiptsList() {
  const companyId = useAppStore((state) => state.currentCompanyId)
  const [receipts, setReceipts] = useState<PurchaseReceipt[]>([])
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [items, setItems] = useState<Item[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [purchaseInvoices, setPurchaseInvoices] = useState<PurchaseInvoice[]>([])
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  // Create dialog
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [createForm, setCreateForm] = useState({
    warehouseId: '',
    purchaseInvoiceId: '',
    purchaseOrderId: '',
    supplierId: '',
    date: new Date().toISOString().split('T')[0],
    notes: '',
  })
  const [createLines, setCreateLines] = useState<PurchaseReceiptLineInput[]>([{ ...initialLineInput }])
  const [invoiceLoading, setInvoiceLoading] = useState(false)

  // View dialog
  const [viewDialogOpen, setViewDialogOpen] = useState(false)
  const [selectedReceipt, setSelectedReceipt] = useState<PurchaseReceipt | null>(null)
  const [viewLoading, setViewLoading] = useState(false)

  // Cancel confirmation
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false)

  // ── Data Fetching ─────────────────────────────────────────────────────────

  const fetchReceipts = useCallback(async () => {
    try {
      const res = await fetch(`/api/inventory/purchase-receipts?companyId=${companyId}`)
      if (res.ok) {
        const data = await res.json()
        setReceipts(data)
      }
    } catch {
      toast.error('فشل في تحميل أذون الاستلام')
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

  const fetchSuppliers = useCallback(async () => {
    try {
      const res = await fetch(`/api/purchases/suppliers?companyId=${companyId}`)
      if (res.ok) {
        const data = await res.json()
        setSuppliers(data)
      }
    } catch {
      // silently fail
    }
  }, [companyId])

  const fetchPurchaseInvoices = useCallback(async () => {
    try {
      const res = await fetch(`/api/purchases/invoices?companyId=${companyId}`)
      if (res.ok) {
        const data = await res.json()
        setPurchaseInvoices(data)
      }
    } catch {
      // silently fail
    }
  }, [companyId])

  const fetchPurchaseOrders = useCallback(async () => {
    try {
      const res = await fetch(`/api/purchases/orders?companyId=${companyId}&status=CONFIRMED`)
      if (res.ok) {
        const data = await res.json()
        setPurchaseOrders(data)
      }
    } catch {
      // silently fail
    }
  }, [companyId])

  useEffect(() => {
    if (companyId) {
      fetchReceipts()
      fetchWarehouses()
      fetchItems()
      fetchSuppliers()
      fetchPurchaseInvoices()
      fetchPurchaseOrders()
    }
  }, [companyId, fetchReceipts, fetchWarehouses, fetchItems, fetchSuppliers, fetchPurchaseInvoices, fetchPurchaseOrders])

  // ── localStorage: Auto-fill from incoming Purchase Order ────────────────
  useEffect(() => {
    try {
      const pending = localStorage.getItem('pendingPurchaseReceipt')
      if (pending) {
        const data = JSON.parse(pending)
        localStorage.removeItem('pendingPurchaseReceipt')

        setCreateForm({
          warehouseId: data.warehouseId || '',
          purchaseInvoiceId: '',
          purchaseOrderId: data.purchaseOrderId || '',
          supplierId: data.supplierId || '',
          date: data.date || new Date().toISOString().split('T')[0],
          notes: '',
        })

        // Pre-fill lines with remaining qty from order
        if (data.lines && data.lines.length > 0) {
          const orderLines: PurchaseReceiptLineInput[] = data.lines
            .filter((l: { remainingQty: number }) => l.remainingQty > 0)
            .map((l: { itemId: string; remainingQty: number }) => ({
              itemId: l.itemId,
              quantity: l.remainingQty,
              notes: '',
            }))
          if (orderLines.length > 0) {
            setCreateLines(orderLines)
          }
        }

        setCreateDialogOpen(true)
      }
    } catch {
      // silently fail
    }
  }, [])

  // ── Display Name Helpers ────────────────────────────────────────────────

  const getWarehouseDisplayName = (warehouseId: string, whData?: { nameAr: string; nameEn?: string }) => {
    const wh = warehouses.find((w) => w.id === warehouseId)
    if (wh) {
      return buildWarehouseDisplayName(wh)
    }
    return whData?.nameAr || warehouseId
  }

  const getSupplierDisplayName = (supplierId: string | null, suppData?: { nameAr: string; nameEn?: string } | null) => {
    if (!supplierId) return '—'
    const supplier = suppliers.find((s) => s.id === supplierId)
    if (supplier) return supplier.nameAr
    return suppData?.nameAr || supplierId
  }

  // ── Purchase Invoice Auto-fill ──────────────────────────────────────────

  const handlePurchaseInvoiceChange = async (invoiceId: string) => {
    if (!invoiceId || invoiceId === '__none__') {
      setCreateForm((p) => ({ ...p, purchaseInvoiceId: '', supplierId: '', purchaseOrderId: '' }))
      setCreateLines([{ ...initialLineInput }])
      return
    }

    setCreateForm((p) => ({ ...p, purchaseInvoiceId: invoiceId, purchaseOrderId: '' }))
    setInvoiceLoading(true)

    try {
      const res = await fetch(`/api/purchases/invoices/${invoiceId}?companyId=${companyId}`)
      if (res.ok) {
        const invoice: PurchaseInvoice = await res.json()
        // Auto-fill supplierId from the invoice
        setCreateForm((p) => ({ ...p, supplierId: invoice.supplierId }))

        // Pre-populate lines from invoice items
        if (invoice.lines && invoice.lines.length > 0) {
          const invoiceLines: PurchaseReceiptLineInput[] = invoice.lines.map((l) => ({
            itemId: l.itemId,
            quantity: l.quantity,
            notes: '',
          }))
          setCreateLines(invoiceLines)
        }
      } else {
        toast.error('فشل في تحميل تفاصيل فاتورة الشراء')
      }
    } catch {
      toast.error('حدث خطأ أثناء تحميل الفاتورة')
    } finally {
      setInvoiceLoading(false)
    }
  }

  // ── Purchase Order Auto-fill ──────────────────────────────────────────

  const handlePurchaseOrderChange = async (orderId: string) => {
    if (!orderId || orderId === '__none__') {
      setCreateForm((p) => ({ ...p, purchaseOrderId: '', supplierId: '', warehouseId: '', purchaseInvoiceId: '' }))
      setCreateLines([{ ...initialLineInput }])
      return
    }

    setCreateForm((p) => ({ ...p, purchaseOrderId: orderId, purchaseInvoiceId: '' }))
    setInvoiceLoading(true)

    try {
      const res = await fetch(`/api/purchases/orders/${orderId}?companyId=${companyId}`)
      if (res.ok) {
        const order = await res.json()
        // Auto-fill supplierId and warehouseId from the purchase order
        setCreateForm((p) => ({
          ...p,
          supplierId: order.supplierId,
          warehouseId: order.warehouseId,
        }))

        // Pre-populate lines from order items (remaining qty)
        if (order.lines && order.lines.length > 0) {
          const orderLines: PurchaseReceiptLineInput[] = order.lines
            .filter((l: { quantity: number; receivedQty: number }) => (l.quantity - l.receivedQty) > 0)
            .map((l: { itemId: string; quantity: number; receivedQty: number }) => ({
              itemId: l.itemId,
              quantity: l.quantity - l.receivedQty,
              notes: '',
            }))
          if (orderLines.length > 0) {
            setCreateLines(orderLines)
          } else {
            toast.info('جميع أصناف أمر الشراء تم استلامها بالكامل')
            setCreateLines([{ ...initialLineInput }])
          }
        }
      } else {
        toast.error('فشل في تحميل تفاصيل أمر الشراء')
      }
    } catch {
      toast.error('حدث خطأ أثناء تحميل أمر الشراء')
    } finally {
      setInvoiceLoading(false)
    }
  }

  // ── Create Purchase Receipt Handlers ──────────────────────────────────────

  const handleOpenCreate = () => {
    setCreateForm({
      warehouseId: '',
      purchaseInvoiceId: '',
      purchaseOrderId: '',
      supplierId: '',
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

  const handleLineChange = (index: number, field: keyof PurchaseReceiptLineInput, value: string | number) => {
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
      const res = await fetch(`/api/inventory/purchase-receipts?companyId=${companyId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          warehouseId: createForm.warehouseId,
          purchaseInvoiceId: createForm.purchaseInvoiceId || undefined,
          purchaseOrderId: createForm.purchaseOrderId || undefined,
          supplierId: createForm.supplierId || undefined,
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
        toast.success('تم إنشاء إذن الاستلام بنجاح')
        setCreateDialogOpen(false)
        fetchReceipts()
      } else {
        const err = await res.json()
        toast.error(err.error || 'فشل في إنشاء إذن الاستلام')
      }
    } catch {
      toast.error('حدث خطأ أثناء إنشاء إذن الاستلام')
    } finally {
      setSubmitting(false)
    }
  }

  // ── View/Confirm/Cancel Handlers ──────────────────────────────────────────

  const handleViewReceipt = async (receiptId: string) => {
    setViewLoading(true)
    setViewDialogOpen(true)
    try {
      const res = await fetch(`/api/inventory/purchase-receipts/${receiptId}?companyId=${companyId}`)
      if (res.ok) {
        const data = await res.json()
        setSelectedReceipt(data)
      } else {
        toast.error('فشل في تحميل تفاصيل إذن الاستلام')
        setViewDialogOpen(false)
      }
    } catch {
      toast.error('حدث خطأ أثناء تحميل التفاصيل')
      setViewDialogOpen(false)
    } finally {
      setViewLoading(false)
    }
  }

  const handleConfirmReceipt = async () => {
    if (!selectedReceipt) return
    setSubmitting(true)
    try {
      const res = await fetch(`/api/inventory/purchase-receipts/${selectedReceipt.id}?companyId=${companyId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId, action: 'confirm' }),
      })
      if (res.ok) {
        const updated = await res.json()
        setSelectedReceipt(updated)
        toast.success('تم تأكيد إذن الاستلام بنجاح')
        fetchReceipts()
      } else {
        const err = await res.json()
        toast.error(err.error || 'فشل في تأكيد إذن الاستلام')
      }
    } catch {
      toast.error('حدث خطأ أثناء تأكيد إذن الاستلام')
    } finally {
      setSubmitting(false)
    }
  }

  const handleCancelReceipt = async () => {
    if (!selectedReceipt) return
    setSubmitting(true)
    try {
      const res = await fetch(`/api/inventory/purchase-receipts/${selectedReceipt.id}?companyId=${companyId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId, action: 'cancel' }),
      })
      if (res.ok) {
        const updated = await res.json()
        setSelectedReceipt(updated)
        toast.success('تم إلغاء إذن الاستلام بنجاح')
        fetchReceipts()
      } else {
        const err = await res.json()
        toast.error(err.error || 'فشل في إلغاء إذن الاستلام')
      }
    } catch {
      toast.error('حدث خطأ أثناء إلغاء إذن الاستلام')
    } finally {
      setSubmitting(false)
      setCancelConfirmOpen(false)
    }
  }

  // Inline status action for table row buttons
  const handleInlineConfirm = async (receiptId: string) => {
    setSubmitting(true)
    try {
      const res = await fetch(`/api/inventory/purchase-receipts/${receiptId}?companyId=${companyId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId, action: 'confirm' }),
      })
      if (res.ok) {
        toast.success('تم تأكيد إذن الاستلام بنجاح')
        fetchReceipts()
      } else {
        const err = await res.json()
        toast.error(err.error || 'فشل في تأكيد إذن الاستلام')
      }
    } catch {
      toast.error('حدث خطأ أثناء تأكيد إذن الاستلام')
    } finally {
      setSubmitting(false)
    }
  }

  const handleInlineCancel = async (receiptId: string) => {
    setSubmitting(true)
    try {
      const res = await fetch(`/api/inventory/purchase-receipts/${receiptId}?companyId=${companyId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId, action: 'cancel' }),
      })
      if (res.ok) {
        toast.success('تم إلغاء إذن الاستلام بنجاح')
        fetchReceipts()
      } else {
        const err = await res.json()
        toast.error(err.error || 'فشل في إلغاء إذن الاستلام')
      }
    } catch {
      toast.error('حدث خطأ أثناء إلغاء إذن الاستلام')
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
                <PackageCheck className="h-5 w-5 text-emerald-600" />
              </div>
              <CardTitle className="text-lg">أذون استلام المشتريات</CardTitle>
            </div>
            <Button
              onClick={handleOpenCreate}
              className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
            >
              <Plus className="h-4 w-4" />
              إذن استلام جديد
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
                  <TableHead className="text-right font-semibold">المورد</TableHead>
                  <TableHead className="text-right font-semibold">المخزن</TableHead>
                  <TableHead className="text-right font-semibold">فاتورة الشراء</TableHead>
                  <TableHead className="text-right font-semibold">أمر الشراء</TableHead>
                  <TableHead className="text-right font-semibold">عدد الأصناف</TableHead>
                  <TableHead className="text-right font-semibold">الحالة</TableHead>
                  <TableHead className="text-right font-semibold">إجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {receipts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-12">
                      <div className="flex flex-col items-center text-slate-400">
                        <PackageCheck className="h-12 w-12 mb-3 text-slate-200" />
                        <p className="text-sm">لا توجد أذون استلام مشتريات</p>
                        <p className="text-xs mt-1 text-slate-300">
                          اضغط على &quot;إذن استلام جديد&quot; لإنشاء إذن
                        </p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  receipts.map((receipt) => (
                    <TableRow key={receipt.id} className="hover:bg-slate-50/50">
                      <TableCell className="font-mono text-sm font-medium">
                        {receipt.number}
                      </TableCell>
                      <TableCell className="text-slate-500 text-sm whitespace-nowrap">
                        {formatDate(receipt.date)}
                      </TableCell>
                      <TableCell className="text-sm text-slate-700">
                        {getSupplierDisplayName(receipt.supplierId, receipt.supplier)}
                      </TableCell>
                      <TableCell className="text-sm">
                        <span className="text-slate-700">
                          {getWarehouseDisplayName(receipt.warehouseId, receipt.warehouse)}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm text-slate-500">
                        {receipt.purchaseInvoice ? receipt.purchaseInvoice.number : '—'}
                      </TableCell>
                      <TableCell className="text-sm text-slate-500">
                        {receipt.purchaseOrder ? receipt.purchaseOrder.number : '—'}
                      </TableCell>
                      <TableCell className="text-center font-mono text-sm">
                        {receipt._count?.lines ?? 0}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={statusBadgeStyles[receipt.status] || 'bg-slate-50 text-slate-700'}
                        >
                          {statusLabels[receipt.status] || receipt.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-slate-500 hover:text-emerald-600"
                            onClick={() => handleViewReceipt(receipt.id)}
                            title="عرض التفاصيل"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          {receipt.status === 'DRAFT' && (
                            <>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-slate-500 hover:text-emerald-600"
                                onClick={() => handleInlineConfirm(receipt.id)}
                                title="تأكيد"
                                disabled={submitting}
                              >
                                <CheckCircle2 className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-slate-500 hover:text-red-600"
                                onClick={() => handleInlineCancel(receipt.id)}
                                title="إلغاء"
                                disabled={submitting}
                              >
                                <XCircle className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                          {receipt.status === 'CONFIRMED' && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-slate-500 hover:text-red-600"
                              onClick={() => {
                                setSelectedReceipt(receipt)
                                setCancelConfirmOpen(true)
                              }}
                              title="إلغاء إذن الاستلام"
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

      {/* ─── Create Purchase Receipt Dialog ──────────────────────────────────── */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PackageCheck className="h-5 w-5 text-emerald-600" />
              إذن استلام جديد
            </DialogTitle>
            <DialogDescription>
              إنشاء إذن استلام مشتريات جديد في المخزن
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

            {/* Purchase Order (optional) */}
            <div className="space-y-2">
              <Label>أمر الشراء (اختياري)</Label>
              <Select
                value={createForm.purchaseOrderId || '__none__'}
                onValueChange={(val) => handlePurchaseOrderChange(val)}
                disabled={invoiceLoading}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="اختر أمر الشراء" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">بدون أمر شراء</SelectItem>
                  {purchaseOrders
                    .filter((po) => po.status === 'CONFIRMED')
                    .map((po) => (
                      <SelectItem key={po.id} value={po.id}>
                        {po.number} - {po.supplier?.nameAr || '—'}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            {/* Purchase Invoice (optional) */}
            <div className="space-y-2">
              <Label>فاتورة الشراء (اختياري)</Label>
              <Select
                value={createForm.purchaseInvoiceId || '__none__'}
                onValueChange={(val) => handlePurchaseInvoiceChange(val)}
                disabled={invoiceLoading}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="اختر فاتورة الشراء" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">بدون فاتورة</SelectItem>
                  {purchaseInvoices
                    .filter((inv) => inv.status === 'CONFIRMED')
                    .map((inv) => (
                      <SelectItem key={inv.id} value={inv.id}>
                        {inv.number} - {inv.supplier?.nameAr || '—'}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            {/* Supplier (auto-filled from invoice or manual) */}
            <div className="space-y-2">
              <Label>المورد</Label>
              <Select
                value={createForm.supplierId}
                onValueChange={(val) =>
                  setCreateForm((p) => ({ ...p, supplierId: val }))
                }
                disabled={!!createForm.purchaseInvoiceId || !!createForm.purchaseOrderId}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="اختر المورد" />
                </SelectTrigger>
                <SelectContent>
                  {suppliers.map((supp) => (
                    <SelectItem key={supp.id} value={supp.id}>
                      {supp.nameAr} ({supp.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {(createForm.purchaseInvoiceId || createForm.purchaseOrderId) && (
                <p className="text-xs text-slate-400">يتم تعبئته تلقائياً من {createForm.purchaseOrderId ? 'أمر الشراء' : 'الفاتورة'}</p>
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

          {/* Purchase Receipt Lines */}
          <div className="space-y-3 mt-2">
            <div className="flex items-center justify-between">
              <Label className="text-base font-semibold">أصناف الإذن</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddLine}
                className="gap-1 text-emerald-600 border-emerald-200 hover:bg-emerald-50"
                disabled={!!createForm.purchaseInvoiceId || !!createForm.purchaseOrderId}
              >
                <Plus className="h-3.5 w-3.5" />
                إضافة صنف
              </Button>
            </div>
            {(createForm.purchaseInvoiceId || createForm.purchaseOrderId) && (
              <p className="text-xs text-slate-400">الأصناف معبأة تلقائياً من {createForm.purchaseOrderId ? 'أمر الشراء' : 'الفاتورة'} المحددة</p>
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
                      disabled={!!createForm.purchaseInvoiceId || !!createForm.purchaseOrderId}
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
                    disabled={createLines.length === 1 || !!createForm.purchaseInvoiceId || !!createForm.purchaseOrderId}
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
              إنشاء إذن الاستلام
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── View Purchase Receipt Dialog ────────────────────────────────── */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          {viewLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
            </div>
          ) : selectedReceipt ? (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <PackageCheck className="h-5 w-5 text-emerald-600" />
                  إذن استلام {selectedReceipt.number}
                </DialogTitle>
                <DialogDescription>
                  تفاصيل إذن الاستلام والإجراءات
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-2">
                {/* Receipt Info */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <p className="text-xs text-slate-500">رقم الإذن</p>
                    <p className="text-sm font-medium text-slate-800 font-mono">
                      {selectedReceipt.number}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-slate-500">التاريخ</p>
                    <p className="text-sm font-medium text-slate-800">
                      {formatDate(selectedReceipt.date)}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-slate-500">المورد</p>
                    <p className="text-sm font-medium text-slate-800">
                      {getSupplierDisplayName(selectedReceipt.supplierId, selectedReceipt.supplier)}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-slate-500">المخزن</p>
                    <p className="text-sm font-medium text-slate-800">
                      {getWarehouseDisplayName(selectedReceipt.warehouseId, selectedReceipt.warehouse)}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-slate-500">فاتورة الشراء</p>
                    <p className="text-sm font-medium text-slate-800">
                      {selectedReceipt.purchaseInvoice ? selectedReceipt.purchaseInvoice.number : '—'}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-slate-500">أمر الشراء</p>
                    <p className="text-sm font-medium text-slate-800">
                      {selectedReceipt.purchaseOrder ? selectedReceipt.purchaseOrder.number : '—'}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-slate-500">الحالة</p>
                    <Badge
                      variant="outline"
                      className={
                        statusBadgeStyles[selectedReceipt.status] ||
                        'bg-slate-50 text-slate-700'
                      }
                    >
                      {statusLabels[selectedReceipt.status] || selectedReceipt.status}
                    </Badge>
                  </div>
                </div>

                {selectedReceipt.notes && (
                  <div className="space-y-1">
                    <p className="text-xs text-slate-500">ملاحظات</p>
                    <p className="text-sm text-slate-700 bg-slate-50 p-3 rounded-lg">
                      {selectedReceipt.notes}
                    </p>
                  </div>
                )}

                {/* Receipt Lines */}
                {selectedReceipt.lines && selectedReceipt.lines.length > 0 && (
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
                        {selectedReceipt.lines.map((line) => (
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
                {selectedReceipt.status === 'DRAFT' && (
                  <>
                    <Button
                      onClick={handleConfirmReceipt}
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
                {selectedReceipt.status === 'CONFIRMED' && (
                  <>
                    <Button
                      onClick={() => {
                        localStorage.setItem('pendingPurchaseInvoice', JSON.stringify({
                          id: selectedReceipt.id,
                          number: selectedReceipt.number,
                          supplierId: selectedReceipt.supplierId,
                          warehouseId: selectedReceipt.warehouseId,
                          lines: (selectedReceipt.lines || []).map((l) => ({
                            itemId: l.itemId,
                            quantity: l.quantity,
                          })),
                        }))
                        useAppStore.getState().setModule('purchases')
                        useAppStore.getState().setView('purchase-invoices')
                      }}
                      className="bg-amber-600 hover:bg-amber-700 text-white gap-2"
                    >
                      <FileText className="h-4 w-4" />
                      إنشاء فاتورة شراء
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={() => setCancelConfirmOpen(true)}
                      disabled={submitting}
                      className="gap-2"
                    >
                      <XCircle className="h-4 w-4" />
                      إلغاء الإذن (عكس حركات المخزون)
                    </Button>
                  </>
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
            <AlertDialogTitle>تأكيد إلغاء إذن الاستلام</AlertDialogTitle>
            <AlertDialogDescription>
              {selectedReceipt?.status === 'CONFIRMED'
                ? 'سيتم عكس حركات المخزون التي تم إنشاؤها عند تأكيد هذا الإذن. هل أنت متأكد؟'
                : 'هل أنت متأكد من إلغاء هذا الإذن؟'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>تراجع</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCancelReceipt}
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
