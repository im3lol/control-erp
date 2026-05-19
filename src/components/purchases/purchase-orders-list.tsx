'use client'

import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import {
  Plus, FileText, Search, Loader2, CheckCircle,
  Eye, Pencil, XCircle, PackageCheck,
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

interface OrderLine {
  id?: string
  itemId: string
  quantity: string
  unitPrice: string
  discountAmount: string
  taxAmount: string
  totalAmount: number
}

interface PurchaseOrder {
  id: string
  number: string
  supplierId: string
  warehouseId: string
  date: string
  status: string
  subtotal: number
  discountAmount: number
  taxAmount: number
  totalAmount: number
  notes: string | null
  supplier: { id: string; code: string; nameAr: string; nameEn: string | null }
  warehouse: { id: string; code: string; nameAr: string }
  lines?: Array<{
    id: string
    itemId: string
    quantity: number
    receivedQty: number
    unitPrice: number
    discountAmount: number
    taxAmount: number
    totalAmount: number
    item: { id: string; code: string; nameAr: string; nameEn: string | null; uom?: { nameAr: string } | null }
  }>
  purchaseReceipts?: Array<{
    id: string
    number: string
    date: string
    status: string
  }>
  _count?: { lines: number }
}

const emptyLine: OrderLine = {
  itemId: '',
  quantity: '1',
  unitPrice: '0',
  discountAmount: '0',
  taxAmount: '0',
  totalAmount: 0,
}

// ─── Extended status helpers ───────────────────────────────────────────────────

function getOrderStatusColor(status: string): string {
  if (status === 'CLOSED') return 'bg-teal-100 text-teal-800'
  return getStatusColor(status)
}

function getOrderStatusLabel(status: string): string {
  if (status === 'CLOSED') return 'مغلق'
  return getStatusLabel(status)
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function PurchaseOrdersList() {
  const companyId = useAppStore(state => state.currentCompanyId)
  const setModule = useAppStore(state => state.setModule)
  const setView = useAppStore(state => state.setView)
  const [orders, setOrders] = useState<PurchaseOrder[]>([])
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

  // New order dialog
  const [newDialogOpen, setNewDialogOpen] = useState(false)
  const [orderSupplierId, setOrderSupplierId] = useState('')
  const [orderWarehouseId, setOrderWarehouseId] = useState('')
  const [orderDate, setOrderDate] = useState(new Date().toISOString().split('T')[0])
  const [orderNotes, setOrderNotes] = useState('')
  const [orderLines, setOrderLines] = useState<OrderLine[]>([{ ...emptyLine }])
  const [orderDiscountAmount, setOrderDiscountAmount] = useState('0')
  const [orderTaxPercent, setOrderTaxPercent] = useState('0')

  // Detail dialog
  const [detailDialogOpen, setDetailDialogOpen] = useState(false)
  const [detailOrder, setDetailOrder] = useState<PurchaseOrder | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  // Confirm dialog
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false)
  const [confirmOrderId, setConfirmOrderId] = useState<string | null>(null)
  const [confirmAction, setConfirmAction] = useState<string>('')

  useEffect(() => {
    fetchOrders()
    fetchSuppliers()
    fetchWarehouses()
    fetchItems()
  }, [])

  const fetchOrders = async () => {
    try {
      const params = new URLSearchParams()
      if (statusFilter !== 'all') params.set('status', statusFilter)
      if (supplierFilter !== 'all') params.set('supplierId', supplierFilter)
      if (fromDate) params.set('fromDate', fromDate)
      if (toDate) params.set('toDate', toDate)

      const res = await fetch(`/api/purchases/orders?companyId=${companyId}&${params.toString()}`)
      if (res.ok) {
        const data = await res.json()
        setOrders(data)
      }
    } catch {
      toast.error('فشل في تحميل أوامر الشراء')
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
    if (!loading) fetchOrders()
  }, [statusFilter, supplierFilter, fromDate, toDate])

  // ── Line calculations ──

  const calcLineTotal = useCallback((line: OrderLine) => {
    const qty = parseFloat(line.quantity) || 0
    const price = parseFloat(line.unitPrice) || 0
    const disc = parseFloat(line.discountAmount) || 0
    const tax = parseFloat(line.taxAmount) || 0
    return qty * price - disc + tax
  }, [])

  const calcOrderTotals = useCallback(() => {
    const rawSubtotal = orderLines.reduce((sum, l) => {
      const qty = parseFloat(l.quantity) || 0
      const price = parseFloat(l.unitPrice) || 0
      return sum + qty * price
    }, 0)
    const totalLineDiscounts = orderLines.reduce((sum, l) => sum + (parseFloat(l.discountAmount) || 0), 0)
    const totalLineTaxes = orderLines.reduce((sum, l) => sum + (parseFloat(l.taxAmount) || 0), 0)

    const invDiscount = parseFloat(orderDiscountAmount) || 0
    const invTaxPercent = parseFloat(orderTaxPercent) || 0
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
  }, [orderLines, orderDiscountAmount, orderTaxPercent])

  const updateLine = (index: number, field: keyof OrderLine, value: string) => {
    setOrderLines((prev) => {
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
    setOrderLines((prev) => [...prev, { ...emptyLine }])
  }

  const removeLine = (index: number) => {
    if (orderLines.length <= 1) return
    setOrderLines((prev) => prev.filter((_, i) => i !== index))
  }

  // ── Save Draft ──

  const handleSaveDraft = async () => {
    if (!orderSupplierId) {
      toast.error('يرجى اختيار المورد')
      return
    }
    if (!orderWarehouseId) {
      toast.error('يرجى اختيار المخزن')
      return
    }
    const validLines = orderLines.filter((l) => l.itemId && parseFloat(l.quantity) > 0)
    if (validLines.length === 0) {
      toast.error('يجب إضافة سطر واحد على الأقل')
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch(`/api/purchases/orders?companyId=${companyId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supplierId: orderSupplierId,
          warehouseId: orderWarehouseId,
          date: orderDate,
          notes: orderNotes,
          discountAmount: parseFloat(orderDiscountAmount) || 0,
          taxPercent: parseFloat(orderTaxPercent) || 0,
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
        toast.success('تم حفظ أمر الشراء كمسودة')
        setNewDialogOpen(false)
        resetNewForm()
        fetchOrders()
      } else {
        const err = await res.json()
        toast.error(err.error || 'فشل في حفظ أمر الشراء')
      }
    } catch {
      toast.error('حدث خطأ أثناء حفظ أمر الشراء')
    } finally {
      setSubmitting(false)
    }
  }

  const resetNewForm = () => {
    setOrderSupplierId('')
    setOrderWarehouseId('')
    setOrderDate(new Date().toISOString().split('T')[0])
    setOrderNotes('')
    setOrderLines([{ ...emptyLine }])
    setOrderDiscountAmount('0')
    setOrderTaxPercent('0')
  }

  // ── View Detail ──

  const handleViewDetail = async (orderId: string) => {
    setDetailLoading(true)
    setDetailDialogOpen(true)
    try {
      const res = await fetch(`/api/purchases/orders/${orderId}?companyId=${companyId}`)
      if (res.ok) {
        setDetailOrder(await res.json())
      }
    } catch {
      toast.error('فشل في تحميل تفاصيل أمر الشراء')
    } finally {
      setDetailLoading(false)
    }
  }

  // ── Confirm / Cancel ──

  const handleAction = async () => {
    if (!confirmOrderId) return
    setSubmitting(true)
    try {
      const res = await fetch(`/api/purchases/orders/${confirmOrderId}?companyId=${companyId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: confirmAction, companyId }),
      })
      if (res.ok) {
        toast.success(
          confirmAction === 'confirm' ? 'تم تأكيد أمر الشراء بنجاح' : 'تم إلغاء أمر الشراء'
        )
        fetchOrders()
      } else {
        const err = await res.json()
        toast.error(err.error || 'فشل في تنفيذ الإجراء')
      }
    } catch {
      toast.error('حدث خطأ')
    } finally {
      setSubmitting(false)
      setConfirmDialogOpen(false)
      setConfirmOrderId(null)
    }
  }

  const openConfirmDialog = (orderId: string, action: string) => {
    setConfirmOrderId(orderId)
    setConfirmAction(action)
    setConfirmDialogOpen(true)
  }

  // ── Create Purchase Receipt ──

  const handleCreatePurchaseReceipt = async (order: PurchaseOrder) => {
    // Fetch full order details first
    try {
      const res = await fetch(`/api/purchases/orders/${order.id}?companyId=${companyId}`)
      if (!res.ok) {
        toast.error('فشل في تحميل بيانات أمر الشراء')
        return
      }
      const fullOrder = await res.json()

      // Store in localStorage for the purchase receipt component to pick up
      localStorage.setItem('pendingPurchaseReceipt', JSON.stringify({
        purchaseOrderId: fullOrder.id,
        purchaseOrderNumber: fullOrder.number,
        supplierId: fullOrder.supplierId,
        warehouseId: fullOrder.warehouseId,
        date: new Date().toISOString().split('T')[0],
        lines: fullOrder.lines.map((line: { itemId: string; item: { nameAr: string; code: string }; quantity: number; receivedQty: number; unitPrice: number }) => ({
          itemId: line.itemId,
          itemName: line.item.nameAr,
          itemCode: line.item.code,
          orderedQty: line.quantity,
          receivedQty: line.receivedQty,
          remainingQty: line.quantity - line.receivedQty,
          unitPrice: line.unitPrice,
        })),
      }))

      // Navigate to inventory > purchase-receipts
      setModule('inventory')
      setView('purchase-receipts')

      toast.success('سيتم إنشاء إذن استلام من أمر الشراء')
    } catch {
      toast.error('حدث خطأ أثناء تجهيز إذن الاستلام')
    }
  }

  // ── Received Qty Helpers ──

  const getReceivedInfo = (order: PurchaseOrder) => {
    // For list view, we only have _count.lines, not detailed lines
    // So we show a simple status based on the order status
    if (order.status === 'CLOSED') return { text: 'مكتمل', color: 'text-teal-600' }
    if (order.status === 'CANCELLED') return { text: '—', color: 'text-slate-400' }
    if (order.status === 'CONFIRMED') return { text: 'قيد الاستلام', color: 'text-amber-600' }
    return { text: '—', color: 'text-slate-400' }
  }

  const totals = calcOrderTotals()

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
                <CardTitle className="text-lg">أوامر الشراء</CardTitle>
                <p className="text-xs text-slate-400 mt-0.5">
                  {orders.length.toLocaleString('ar-EG')} أمر شراء
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
              أمر شراء جديد
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mb-4">
            <div className="relative flex-1">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-40">
                  <SelectValue placeholder="كل الحالات" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">كل الحالات</SelectItem>
                  <SelectItem value="DRAFT">مسودة</SelectItem>
                  <SelectItem value="CONFIRMED">مؤكدة</SelectItem>
                  <SelectItem value="CANCELLED">ملغية</SelectItem>
                  <SelectItem value="CLOSED">مغلقة</SelectItem>
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
                  <TableHead className="text-right font-semibold">المستلم</TableHead>
                  <TableHead className="text-right font-semibold">الحالة</TableHead>
                  <TableHead className="text-right font-semibold">إجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-12">
                      <div className="flex flex-col items-center text-slate-400">
                        <FileText className="h-12 w-12 mb-3 text-slate-200" />
                        <p className="text-sm">لا توجد أوامر شراء</p>
                        <p className="text-xs mt-1 text-slate-300">
                          اضغط على &quot;أمر شراء جديد&quot; لإنشاء أمر شراء
                        </p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  orders.map((ord) => {
                    const receivedInfo = getReceivedInfo(ord)
                    return (
                      <TableRow key={ord.id}>
                        <TableCell className="font-mono text-sm">{ord.number}</TableCell>
                        <TableCell className="font-medium">{ord.supplier.nameAr}</TableCell>
                        <TableCell className="text-slate-500">{ord.warehouse.nameAr}</TableCell>
                        <TableCell className="text-slate-500 text-sm">
                          {formatDate(ord.date)}
                        </TableCell>
                        <TableCell className="font-mono" dir="ltr">
                          {formatCurrency(ord.totalAmount)}
                        </TableCell>
                        <TableCell className={`text-sm font-medium ${receivedInfo.color}`}>
                          {receivedInfo.text}
                        </TableCell>
                        <TableCell>
                          <Badge className={getOrderStatusColor(ord.status)}>
                            {getOrderStatusLabel(ord.status)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleViewDetail(ord.id)}
                              className="h-8 w-8 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50"
                              title="عرض التفاصيل"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            {ord.status === 'DRAFT' && (
                              <>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => openConfirmDialog(ord.id, 'confirm')}
                                  className="h-8 w-8 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50"
                                  title="تأكيد"
                                >
                                  <CheckCircle className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => openConfirmDialog(ord.id, 'cancel')}
                                  className="h-8 w-8 text-slate-500 hover:text-red-600 hover:bg-red-50"
                                  title="إلغاء"
                                >
                                  <XCircle className="h-4 w-4" />
                                </Button>
                              </>
                            )}
                            {ord.status === 'CONFIRMED' && (
                              <>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleCreatePurchaseReceipt(ord)}
                                  className="h-8 w-8 text-slate-500 hover:text-teal-600 hover:bg-teal-50"
                                  title="إنشاء إذن استلام"
                                >
                                  <PackageCheck className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => openConfirmDialog(ord.id, 'cancel')}
                                  className="h-8 w-8 text-slate-500 hover:text-red-600 hover:bg-red-50"
                                  title="إلغاء"
                                >
                                  <XCircle className="h-4 w-4" />
                                </Button>
                              </>
                            )}
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

      {/* ── New Order Dialog ── */}
      <Dialog open={newDialogOpen} onOpenChange={setNewDialogOpen}>
        <DialogContent className="sm:max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>أمر شراء جديد</DialogTitle>
            <DialogDescription>
              إنشاء أمر شراء جديد من المورد
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="max-h-[65vh] pr-1">
            <div className="space-y-4 py-2">
              {/* Order header */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>المورد <span className="text-red-500">*</span></Label>
                  <Select value={orderSupplierId} onValueChange={setOrderSupplierId}>
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
                  <Select value={orderWarehouseId} onValueChange={setOrderWarehouseId}>
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
                    value={orderDate}
                    onChange={(e) => setOrderDate(e.target.value)}
                  />
                </div>
              </div>

              {/* Lines */}
              <div className="border rounded-lg overflow-hidden">
                <div className="bg-slate-50 px-4 py-2">
                  <span className="text-sm font-semibold text-slate-700">بنود أمر الشراء</span>
                </div>
                <div className="p-4 space-y-3">
                  {orderLines.map((line, idx) => (
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
                        {orderLines.length > 1 && (
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

              {/* Order-level totals */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>ملاحظات</Label>
                  <Textarea
                    value={orderNotes}
                    onChange={(e) => setOrderNotes(e.target.value)}
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
                    <span className="text-slate-500">خصم الأمر</span>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={orderDiscountAmount}
                      onChange={(e) => setOrderDiscountAmount(e.target.value)}
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
                      value={orderTaxPercent}
                      onChange={(e) => setOrderTaxPercent(e.target.value)}
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
            <DialogTitle>تفاصيل أمر الشراء</DialogTitle>
          </DialogHeader>
          {detailLoading ? (
            <div className="space-y-3 py-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-8 w-full" />
              ))}
            </div>
          ) : detailOrder ? (
            <ScrollArea className="max-h-[65vh] pr-1">
              <div className="space-y-4 py-2">
                {/* Order header info */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div>
                    <span className="text-xs text-slate-400">رقم أمر الشراء</span>
                    <p className="font-mono text-sm font-medium">{detailOrder.number}</p>
                  </div>
                  <div>
                    <span className="text-xs text-slate-400">المورد</span>
                    <p className="text-sm font-medium">{detailOrder.supplier.nameAr}</p>
                  </div>
                  <div>
                    <span className="text-xs text-slate-400">المخزن</span>
                    <p className="text-sm font-medium">{detailOrder.warehouse.nameAr}</p>
                  </div>
                  <div>
                    <span className="text-xs text-slate-400">التاريخ</span>
                    <p className="text-sm font-medium">{formatDate(detailOrder.date)}</p>
                  </div>
                  <div>
                    <span className="text-xs text-slate-400">الحالة</span>
                    <Badge className={getOrderStatusColor(detailOrder.status)}>
                      {getOrderStatusLabel(detailOrder.status)}
                    </Badge>
                  </div>
                </div>

                <Separator />

                {/* Lines table with received qty */}
                {detailOrder.lines && (
                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-slate-50/80">
                          <TableHead className="text-right text-xs">الصنف</TableHead>
                          <TableHead className="text-right text-xs">الكمية</TableHead>
                          <TableHead className="text-right text-xs">المستلم</TableHead>
                          <TableHead className="text-right text-xs">المتبقي</TableHead>
                          <TableHead className="text-right text-xs">سعر الوحدة</TableHead>
                          <TableHead className="text-right text-xs">الخصم</TableHead>
                          <TableHead className="text-right text-xs">الضريبة</TableHead>
                          <TableHead className="text-right text-xs">الإجمالي</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {detailOrder.lines.map((line) => {
                          const remaining = line.quantity - line.receivedQty
                          return (
                            <TableRow key={line.id}>
                              <TableCell className="text-sm">
                                {line.item.nameAr}
                                {line.item.uom && (
                                  <span className="text-xs text-slate-400 mr-1">({line.item.uom.nameAr})</span>
                                )}
                              </TableCell>
                              <TableCell className="font-mono text-sm" dir="ltr">{line.quantity}</TableCell>
                              <TableCell className={`font-mono text-sm ${line.receivedQty >= line.quantity ? 'text-teal-600' : line.receivedQty > 0 ? 'text-amber-600' : 'text-slate-400'}`} dir="ltr">
                                {line.receivedQty}
                              </TableCell>
                              <TableCell className={`font-mono text-sm ${remaining > 0 ? 'text-red-600' : 'text-teal-600'}`} dir="ltr">
                                {remaining > 0 ? remaining : '✓'}
                              </TableCell>
                              <TableCell className="font-mono text-sm" dir="ltr">{formatCurrency(line.unitPrice)}</TableCell>
                              <TableCell className="font-mono text-sm" dir="ltr">{formatCurrency(line.discountAmount)}</TableCell>
                              <TableCell className="font-mono text-sm" dir="ltr">{formatCurrency(line.taxAmount)}</TableCell>
                              <TableCell className="font-mono text-sm font-medium" dir="ltr">{formatCurrency(line.totalAmount)}</TableCell>
                            </TableRow>
                          )
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}

                {/* Totals */}
                <div className="border rounded-lg p-4 bg-slate-50 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">المجموع الفرعي</span>
                    <span className="font-mono" dir="ltr">{formatCurrency(detailOrder.subtotal)}</span>
                  </div>
                  {detailOrder.discountAmount > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">الخصم</span>
                      <span className="font-mono text-red-600" dir="ltr">-{formatCurrency(detailOrder.discountAmount)}</span>
                    </div>
                  )}
                  {detailOrder.taxAmount > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">الضريبة</span>
                      <span className="font-mono" dir="ltr">{formatCurrency(detailOrder.taxAmount)}</span>
                    </div>
                  )}
                  <Separator />
                  <div className="flex justify-between text-base font-bold">
                    <span>الإجمالي</span>
                    <span className="font-mono text-emerald-700" dir="ltr">{formatCurrency(detailOrder.totalAmount)}</span>
                  </div>
                </div>

                {/* Linked Purchase Receipts */}
                {detailOrder.purchaseReceipts && detailOrder.purchaseReceipts.length > 0 && (
                  <div>
                    <span className="text-xs text-slate-400">أذون الاستلام المرتبطة</span>
                    <div className="mt-2 space-y-2">
                      {detailOrder.purchaseReceipts.map((pr) => (
                        <div
                          key={pr.id}
                          className="flex items-center justify-between px-3 py-2 rounded-lg border bg-white"
                        >
                          <div className="flex items-center gap-2">
                            <PackageCheck className="h-4 w-4 text-teal-500" />
                            <span className="font-mono text-sm">{pr.number}</span>
                            <span className="text-xs text-slate-400">{formatDate(pr.date)}</span>
                          </div>
                          <Badge className={getStatusColor(pr.status)}>
                            {getStatusLabel(pr.status)}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Create Purchase Receipt button for CONFIRMED orders */}
                {detailOrder.status === 'CONFIRMED' && (
                  <Button
                    onClick={() => {
                      setDetailDialogOpen(false)
                      handleCreatePurchaseReceipt(detailOrder)
                    }}
                    className="w-full bg-teal-600 hover:bg-teal-700 text-white gap-2"
                  >
                    <PackageCheck className="h-4 w-4" />
                    إنشاء إذن استلام مشتريات
                  </Button>
                )}

                {detailOrder.notes && (
                  <div>
                    <span className="text-xs text-slate-400">ملاحظات</span>
                    <p className="text-sm text-slate-600 mt-1">{detailOrder.notes}</p>
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
              {confirmAction === 'confirm' ? 'تأكيد أمر الشراء' : 'إلغاء أمر الشراء'}
            </DialogTitle>
            <DialogDescription>
              {confirmAction === 'confirm'
                ? 'سيتم تأكيد أمر الشراء. يمكنك بعد ذلك إنشاء إذن استلام مشتريات منه. هل أنت متأكد؟'
                : 'سيتم إلغاء أمر الشراء. هل أنت متأكد؟'}
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
              {confirmAction === 'confirm' ? 'تأكيد' : 'إلغاء أمر الشراء'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
