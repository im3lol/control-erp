'use client'

import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import {
  Plus,
  Loader2,
  FileText,
  CheckCircle2,
  XCircle,
  Eye,
  Truck,
  X,
  Receipt,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
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
import { formatCurrency, formatDate, getStatusColor, getStatusLabel } from '@/lib/erp-utils'

// ── Extended status helpers (CLOSED is not in erp-utils) ──

function getOrderStatusColor(status: string): string {
  if (status === 'CLOSED') return 'bg-teal-100 text-teal-800'
  return getStatusColor(status)
}

function getOrderStatusLabel(status: string): string {
  if (status === 'CLOSED') return 'مغلق'
  return getStatusLabel(status)
}

// ── Interfaces ──

interface Customer {
  id: string
  code: string
  nameAr: string
  nameEn: string | null
}

interface OrderLine {
  id?: string
  itemId: string
  quantity: number
  deliveredQty?: number
  unitPrice: number
  discountAmount: number
  taxAmount: number
  totalAmount: number
  notes?: string | null
  item?: { id: string; code: string; nameAr: string; uom?: { nameAr: string; code: string } | null }
}

interface DeliveryNoteRef {
  id: string
  number: string
  date: string
  status: string
  _count: { lines: number }
}

interface SalesOrder {
  id: string
  number: string
  customerId: string
  date: string
  dueDate: string | null
  status: string
  subtotal: number
  discountAmount: number
  discountPercent: number
  taxAmount: number
  taxPercent: number
  totalAmount: number
  notes: string | null
  customer: Customer
  lines: OrderLine[]
  deliveryNotes?: DeliveryNoteRef[]
  _count?: { lines: number }
}

interface OrderLineInput {
  itemId: string
  quantity: number
  unitPrice: number
  discountAmount: number
  taxAmount: number
}

const emptyLine: OrderLineInput = {
  itemId: '',
  quantity: 1,
  unitPrice: 0,
  discountAmount: 0,
  taxAmount: 0,
}

export default function SalesOrdersList() {
  const companyId = useAppStore(state => state.currentCompanyId)
  const setView = useAppStore(state => state.setView)
  const setEditingDocId = useAppStore(state => state.setEditingDocId)
  const itemFilter = useAppStore(state => state.itemFilter)
  const setItemFilter = useAppStore(state => state.setItemFilter)
  const [orders, setOrders] = useState<SalesOrder[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('all')
  const [customerFilter, setCustomerFilter] = useState('all')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')

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
  const [detailOrder, setDetailOrder] = useState<SalesOrder | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  const fetchOrders = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (statusFilter && statusFilter !== 'all') params.set('status', statusFilter)
      if (customerFilter && customerFilter !== 'all') params.set('customerId', customerFilter)
      if (fromDate) params.set('fromDate', fromDate)
      if (toDate) params.set('toDate', toDate)
      if (itemFilter) params.set('itemId', itemFilter)

      const res = await fetch(`/api/sales/orders?companyId=${companyId}&${params.toString()}`)
      if (res.ok) {
        const data = await res.json()
        setOrders(data)
      }
    } catch {
      toast.error('فشل في تحميل أوامر البيع')
    } finally {
      setLoading(false)
    }
  }, [statusFilter, customerFilter, fromDate, toDate, itemFilter])

  const fetchCustomers = useCallback(async () => {
    try {
      const res = await fetch(`/api/sales/customers?companyId=${companyId}&activeOnly=true`)
      if (res.ok) {
        const data = await res.json()
        setCustomers(data)
      }
    } catch {
      // silently fail - customers are for filter only
    }
  }, [companyId])

  useEffect(() => {
    fetchOrders()
    fetchCustomers()
  }, [fetchOrders, fetchCustomers])



  const fetchOrderDetail = async (id: string) => {
    setDetailLoading(true)
    try {
      const res = await fetch(`/api/sales/orders/${id}?companyId=${companyId}`)
      if (res.ok) {
        const data = await res.json()
        setDetailOrder(data)
        setDetailDialogOpen(true)
      }
    } catch {
      toast.error('فشل في تحميل تفاصيل أمر البيع')
    } finally {
      setDetailLoading(false)
    }
  }

  // Navigate to create new order
  const handleOpenNew = () => {
    setEditingDocId(null)
    setView('sales-order-form')
  }

  // Navigate to edit existing order
  const handleOpenEdit = (id: string) => {
    setEditingDocId(id)
    setView('sales-order-form')
  }

  // Confirm order
  const handleConfirm = async () => {
    if (!confirmingId) return
    setConfirming(true)
    try {
      const res = await fetch(`/api/sales/orders/${confirmingId}?companyId=${companyId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'confirm', companyId }),
      })
      if (res.ok) {
        toast.success('تم تأكيد أمر البيع بنجاح')
        fetchOrders()
      } else {
        const err = await res.json()
        toast.error(err.error || 'فشل في تأكيد أمر البيع')
      }
    } catch {
      toast.error('حدث خطأ أثناء تأكيد أمر البيع')
    } finally {
      setConfirming(false)
      setConfirmDialogOpen(false)
      setConfirmingId(null)
    }
  }

  // Cancel order
  const handleCancel = async () => {
    if (!cancellingId) return
    setCancelling(true)
    try {
      const res = await fetch(`/api/sales/orders/${cancellingId}?companyId=${companyId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'cancel', companyId }),
      })
      if (res.ok) {
        toast.success('تم إلغاء أمر البيع بنجاح')
        fetchOrders()
      } else {
        const err = await res.json()
        toast.error(err.error || 'فشل في إلغاء أمر البيع')
      }
    } catch {
      toast.error('حدث خطأ أثناء إلغاء أمر البيع')
    } finally {
      setCancelling(false)
      setCancelDialogOpen(false)
      setCancellingId(null)
    }
  }

  // Create Delivery Note from confirmed order
  const handleCreateDeliveryNote = (order: SalesOrder) => {
    // Store order data in localStorage for the delivery note to pick up
    localStorage.setItem(
      'pendingDeliveryNote',
      JSON.stringify({
        salesOrderId: order.id,
        salesOrderNumber: order.number,
        customerId: order.customerId,
        customerName: order.customer.nameAr,
        lines: order.lines.map((l) => ({
          itemId: l.itemId,
          itemName: l.item?.nameAr || '',
          itemCode: l.item?.code || '',
          quantity: l.quantity - (l.deliveredQty || 0), // remaining qty
          orderedQty: l.quantity,
          deliveredQty: l.deliveredQty || 0,
          unitPrice: l.unitPrice,
        })),
      })
    )
    // Navigate to inventory > delivery-notes
    useAppStore.getState().setModule('inventory')
    useAppStore.getState().setView('delivery-notes')
    toast.success('تم تحويل أمر البيع إلى إذن صرف')
  }

  // Create Sales Invoice from confirmed order
  const handleCreateSalesInvoice = (order: SalesOrder) => {
    // Store order data in localStorage for the sales invoice to pick up
    localStorage.setItem(
      'pendingSalesInvoice',
      JSON.stringify({
        customerId: order.customerId,
        notes: `من أمر بيع ${order.number}`,
        lines: order.lines.map((l) => ({
          itemId: l.itemId,
          quantity: l.quantity,
        })),
      })
    )
    useAppStore.getState().setModule('sales')
    useAppStore.getState().setView('sales-invoice-form')
    toast.success('سيتم إنشاء فاتورة بيع من أمر البيع')
  }

  // Calculate delivered percentage for an order
  const getDeliveredInfo = (order: SalesOrder) => {
    // We only have this info from the detail endpoint
    // For the list view, we show a simpler indicator
    if (!order.lines || order.lines.length === 0) return { delivered: 0, total: 0, percent: 0 }
    const total = order.lines.reduce((sum, l) => sum + l.quantity, 0)
    const delivered = order.lines.reduce((sum, l) => sum + (l.deliveredQty || 0), 0)
    const percent = total > 0 ? Math.round((delivered / total) * 100) : 0
    return { delivered, total, percent }
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
                <CardTitle className="text-lg">أوامر البيع</CardTitle>
                <p className="text-xs text-slate-400 mt-0.5">
                  {orders.length.toLocaleString('ar-EG')} أمر بيع
                </p>
              </div>
            </div>
            <Button
              onClick={handleOpenNew}
              className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
            >
              <Plus className="h-4 w-4" />
              أمر بيع جديد
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
                  <SelectItem value="CANCELLED">ملغية</SelectItem>
                  <SelectItem value="CLOSED">مغلقة</SelectItem>
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
                  <TableHead className="text-right font-semibold">الإجمالي</TableHead>
                  <TableHead className="text-right font-semibold">المسلم</TableHead>
                  <TableHead className="text-right font-semibold">الحالة</TableHead>
                  <TableHead className="text-right font-semibold">إجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-12">
                      <div className="flex flex-col items-center text-slate-400">
                        <FileText className="h-12 w-12 mb-3 text-slate-200" />
                        <p className="text-sm">لا توجد أوامر بيع</p>
                        <p className="text-xs mt-1 text-slate-300">
                          اضغط على &quot;أمر بيع جديد&quot; لإنشاء أمر بيع
                        </p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  orders.map((order) => {
                    const delInfo = getDeliveredInfo(order)
                    return (
                      <TableRow key={order.id}>
                        <TableCell>
                          <button
                            onClick={() => fetchOrderDetail(order.id)}
                            className="font-mono text-sm text-emerald-700 hover:text-emerald-900 hover:underline font-semibold"
                          >
                            {order.number}
                          </button>
                        </TableCell>
                        <TableCell className="font-medium">{order.customer.nameAr}</TableCell>
                        <TableCell className="text-slate-500 text-sm">
                          {formatDate(order.date)}
                        </TableCell>
                        <TableCell className="font-mono font-semibold" dir="ltr">
                          {formatCurrency(order.totalAmount)}
                        </TableCell>
                        <TableCell>
                          {delInfo.percent > 0 ? (
                            <div className="flex items-center gap-2">
                              <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden min-w-[60px]">
                                <div
                                  className="h-full bg-emerald-500 rounded-full transition-all"
                                  style={{ width: `${delInfo.percent}%` }}
                                />
                              </div>
                              <span className="text-xs font-mono text-emerald-600" dir="ltr">
                                {delInfo.percent}%
                              </span>
                            </div>
                          ) : (
                            <span className="text-xs text-slate-400">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge className={`${getOrderStatusColor(order.status)} text-xs`}>
                            {getOrderStatusLabel(order.status)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            {order.status === 'DRAFT' && (
                              <>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => {
                                    setConfirmingId(order.id)
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
                                  onClick={() => handleOpenEdit(order.id)}
                                  className="h-8 w-8 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50"
                                  title="تعديل"
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => {
                                    setCancellingId(order.id)
                                    setCancelDialogOpen(true)
                                  }}
                                  className="h-8 w-8 text-slate-500 hover:text-red-600 hover:bg-red-50"
                                  title="إلغاء"
                                >
                                  <XCircle className="h-4 w-4" />
                                </Button>
                              </>
                            )}
                            {order.status === 'CONFIRMED' && (
                              <>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => fetchOrderDetail(order.id)}
                                  className="h-8 w-8 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50"
                                  title="عرض التفاصيل"
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleCreateDeliveryNote(order)}
                                  className="h-8 w-8 text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50"
                                  title="إنشاء إذن صرف"
                                >
                                  <Truck className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleCreateSalesInvoice(order)}
                                  className="h-8 w-8 text-slate-500 hover:text-orange-600 hover:bg-orange-50"
                                  title="إنشاء فاتورة بيع"
                                >
                                  <Receipt className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => {
                                    setCancellingId(order.id)
                                    setCancelDialogOpen(true)
                                  }}
                                  className="h-8 w-8 text-slate-500 hover:text-red-600 hover:bg-red-50"
                                  title="إلغاء"
                                >
                                  <XCircle className="h-4 w-4" />
                                </Button>
                              </>
                            )}
                            {order.status === 'CLOSED' && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => fetchOrderDetail(order.id)}
                                className="h-8 w-8 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50"
                                title="عرض التفاصيل"
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                            )}
                            {order.status === 'CANCELLED' && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => fetchOrderDetail(order.id)}
                                className="h-8 w-8 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50"
                                title="عرض التفاصيل"
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
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

      {/* Confirm Dialog */}
      <AlertDialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>تأكيد أمر البيع</AlertDialogTitle>
            <AlertDialogDescription>
              هل أنت متأكد من تأكيد أمر البيع؟ بعد التأكيد يمكنك إنشاء أذون صرف من هذا الأمر. لا يمكن التراجع عن هذا الإجراء.
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
            <AlertDialogTitle>إلغاء أمر البيع</AlertDialogTitle>
            <AlertDialogDescription>
              هل أنت متأكد من إلغاء أمر البيع؟ سيتم إلغاء الأمر ولن يتمكن من إنشاء أذون صرف منه.
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
              إلغاء أمر البيع
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Order Detail Dialog */}
      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
          {detailLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
            </div>
          ) : detailOrder ? (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-3">
                  <span>أمر بيع {detailOrder.number}</span>
                  <Badge className={`${getOrderStatusColor(detailOrder.status)} text-xs`}>
                    {getOrderStatusLabel(detailOrder.status)}
                  </Badge>
                </DialogTitle>
                <DialogDescription>
                  {formatDate(detailOrder.date)} — {detailOrder.customer.nameAr}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                {/* Customer info */}
                <div className="grid grid-cols-2 gap-4 bg-slate-50 rounded-lg p-4">
                  <div>
                    <span className="text-xs text-slate-400">العميل</span>
                    <p className="font-medium">{detailOrder.customer.nameAr}</p>
                    <p className="text-xs text-slate-400" dir="ltr">{detailOrder.customer.code}</p>
                  </div>
                  <div>
                    <span className="text-xs text-slate-400">التاريخ</span>
                    <p className="font-medium">{formatDate(detailOrder.date)}</p>
                    {detailOrder.dueDate && (
                      <p className="text-xs text-slate-400">استحقاق: {formatDate(detailOrder.dueDate)}</p>
                    )}
                  </div>
                </div>

                {/* Notes */}
                {detailOrder.notes && (
                  <div className="bg-slate-50 rounded-lg p-3">
                    <span className="text-xs text-slate-400">ملاحظات</span>
                    <p className="text-sm mt-1">{detailOrder.notes}</p>
                  </div>
                )}

                {/* Lines */}
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-slate-50/80 hover:bg-slate-50/80">
                        <TableHead className="text-right">الصنف</TableHead>
                        <TableHead className="text-right">الكمية</TableHead>
                        <TableHead className="text-right">المسلمة</TableHead>
                        <TableHead className="text-right">سعر الوحدة</TableHead>
                        <TableHead className="text-right">الخصم</TableHead>
                        <TableHead className="text-right">الإجمالي</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {detailOrder.lines.map((line) => {
                        const deliveredQty = line.deliveredQty || 0
                        const remaining = line.quantity - deliveredQty
                        const isFullyDelivered = deliveredQty >= line.quantity
                        return (
                          <TableRow key={line.id}>
                            <TableCell>
                              <div>
                                <p className="font-medium text-sm">{line.item?.nameAr || '—'}</p>
                                <p className="text-xs text-slate-400" dir="ltr">{line.item?.code || ''}</p>
                              </div>
                            </TableCell>
                            <TableCell className="font-mono text-sm" dir="ltr">
                              {line.quantity}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <span className={`font-mono text-sm ${isFullyDelivered ? 'text-emerald-600' : remaining > 0 && deliveredQty > 0 ? 'text-amber-600' : ''}`} dir="ltr">
                                  {deliveredQty}
                                </span>
                                {!isFullyDelivered && deliveredQty > 0 && (
                                  <Badge className="bg-amber-100 text-amber-700 text-[10px] px-1.5 py-0">
                                    متبقي {remaining}
                                  </Badge>
                                )}
                                {isFullyDelivered && (
                                  <Badge className="bg-emerald-100 text-emerald-700 text-[10px] px-1.5 py-0">
                                    مكتمل
                                  </Badge>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="font-mono text-sm" dir="ltr">
                              {formatCurrency(line.unitPrice)}
                            </TableCell>
                            <TableCell className="font-mono text-sm" dir="ltr">
                              {formatCurrency(line.discountAmount)}
                            </TableCell>
                            <TableCell className="font-mono text-sm font-semibold" dir="ltr">
                              {formatCurrency(line.totalAmount)}
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </div>

                {/* Totals summary */}
                <div className="bg-slate-50 rounded-lg p-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">المجموع الفرعي</span>
                    <span className="font-mono" dir="ltr">{formatCurrency(detailOrder.subtotal)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">الخصم</span>
                    <span className="font-mono text-red-500" dir="ltr">-{formatCurrency(detailOrder.discountAmount)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">الضريبة ({detailOrder.taxPercent}%)</span>
                    <span className="font-mono text-orange-500" dir="ltr">+{formatCurrency(detailOrder.taxAmount)}</span>
                  </div>
                  <Separator />
                  <div className="flex justify-between text-lg font-bold">
                    <span>الإجمالي</span>
                    <span className="font-mono text-emerald-700" dir="ltr">{formatCurrency(detailOrder.totalAmount)}</span>
                  </div>
                </div>

                {/* Linked Delivery Notes */}
                {detailOrder.deliveryNotes && detailOrder.deliveryNotes.length > 0 && (
                  <div className="space-y-2">
                    <Label className="text-base font-semibold flex items-center gap-2">
                      <Truck className="h-4 w-4 text-emerald-600" />
                      أذون الصرف المرتبطة
                    </Label>
                    <div className="border rounded-lg overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-slate-50/80 hover:bg-slate-50/80">
                            <TableHead className="text-right">رقم الإذن</TableHead>
                            <TableHead className="text-right">التاريخ</TableHead>
                            <TableHead className="text-right">عدد الأصناف</TableHead>
                            <TableHead className="text-right">الحالة</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {detailOrder.deliveryNotes.map((dn) => (
                            <TableRow key={dn.id}>
                              <TableCell className="font-mono text-sm text-emerald-700" dir="ltr">
                                {dn.number}
                              </TableCell>
                              <TableCell className="text-sm text-slate-500">
                                {formatDate(dn.date)}
                              </TableCell>
                              <TableCell className="text-sm">
                                {dn._count.lines}
                              </TableCell>
                              <TableCell>
                                <Badge className={`${getStatusColor(dn.status)} text-xs`}>
                                  {getStatusLabel(dn.status)}
                                </Badge>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}

                {/* Actions in detail dialog */}
                <div className="flex justify-end gap-3 pt-2">
                  {detailOrder.status === 'CONFIRMED' && (
                    <>
                      <Button
                        onClick={() => {
                          handleCreateDeliveryNote(detailOrder)
                          setDetailDialogOpen(false)
                        }}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
                      >
                        <Truck className="h-4 w-4" />
                        إنشاء إذن صرف
                      </Button>
                      <Button
                        onClick={() => {
                          handleCreateSalesInvoice(detailOrder)
                          setDetailDialogOpen(false)
                        }}
                        className="bg-orange-600 hover:bg-orange-700 text-white gap-2"
                      >
                        <Receipt className="h-4 w-4" />
                        إنشاء فاتورة بيع
                      </Button>
                    </>
                  )}
                  <Button variant="outline" onClick={() => setDetailDialogOpen(false)}>
                    إغلاق
                  </Button>
                </div>
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  )
}
