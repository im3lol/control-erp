'use client'

import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import {
  Plus, FileText, Loader2, CheckCircle,
  Eye, XCircle, PackageCheck, Receipt,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
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
import { Separator } from '@/components/ui/separator'
import { useAppStore } from '@/lib/store'
import { formatCurrency, formatDate, getStatusColor, getStatusLabel } from '@/lib/erp-utils'

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
  const setEditingDocId = useAppStore(state => state.setEditingDocId)
  const [orders, setOrders] = useState<PurchaseOrder[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  // Filters
  const [statusFilter, setStatusFilter] = useState('all')
  const [supplierFilter, setSupplierFilter] = useState('all')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')

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

  useEffect(() => {
    if (!loading) fetchOrders()
  }, [statusFilter, supplierFilter, fromDate, toDate])

  // ── Navigation handlers ──

  const handleOpenAdd = () => {
    setEditingDocId(null)
    setModule('purchases')
    setView('purchase-order-form')
  }

  const handleOpenEdit = (id: string) => {
    setEditingDocId(id)
    setModule('purchases')
    setView('purchase-order-form')
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
    try {
      const res = await fetch(`/api/purchases/orders/${order.id}?companyId=${companyId}`)
      if (!res.ok) {
        toast.error('فشل في تحميل بيانات أمر الشراء')
        return
      }
      const fullOrder = await res.json()

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

      setModule('inventory')
      setView('purchase-receipts')
      toast.success('سيتم إنشاء إذن استلام من أمر الشراء')
    } catch {
      toast.error('حدث خطأ أثناء تجهيز إذن الاستلام')
    }
  }

  // ── Create Purchase Invoice from confirmed order ──

  const handleCreatePurchaseInvoice = async (order: PurchaseOrder) => {
    try {
      const res = await fetch(`/api/purchases/orders/${order.id}?companyId=${companyId}`)
      if (!res.ok) {
        toast.error('فشل في تحميل بيانات أمر الشراء')
        return
      }
      const fullOrder = await res.json()

      localStorage.setItem('pendingPurchaseInvoice', JSON.stringify({
        supplierId: fullOrder.supplierId,
        warehouseId: fullOrder.warehouseId,
        notes: `من أمر شراء ${fullOrder.number}`,
        lines: fullOrder.lines.map((line: { itemId: string; quantity: number }) => ({
          itemId: line.itemId,
          quantity: line.quantity,
        })),
      }))

      setModule('purchases')
      setView('purchase-invoice-form')
      toast.success('سيتم إنشاء فاتورة شراء من أمر الشراء')
    } catch {
      toast.error('حدث خطأ أثناء تجهيز فاتورة الشراء')
    }
  }

  // ── Received Qty Helpers ──

  const getReceivedInfo = (order: PurchaseOrder) => {
    if (order.status === 'CLOSED') return { text: 'مكتمل', color: 'text-teal-600' }
    if (order.status === 'CANCELLED') return { text: '—', color: 'text-slate-400' }
    if (order.status === 'CONFIRMED') return { text: 'قيد الاستلام', color: 'text-amber-600' }
    return { text: '—', color: 'text-slate-400' }
  }

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
              onClick={handleOpenAdd}
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
                      <TableRow
                        key={ord.id}
                        className="cursor-pointer hover:bg-slate-50/50"
                        onClick={() => handleOpenEdit(ord.id)}
                      >
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
                          <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
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
                                  onClick={() => handleCreatePurchaseInvoice(ord)}
                                  className="h-8 w-8 text-slate-500 hover:text-orange-600 hover:bg-orange-50"
                                  title="إنشاء فاتورة شراء"
                                >
                                  <Receipt className="h-4 w-4" />
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
            <div className="space-y-4 py-2 max-h-[65vh] overflow-y-auto">
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

              {detailOrder.purchaseReceipts && detailOrder.purchaseReceipts.length > 0 && (
                <div>
                  <span className="text-xs text-slate-400">أذون الاستلام المرتبطة</span>
                  <div className="mt-2 space-y-2">
                    {detailOrder.purchaseReceipts.map((pr) => (
                      <div key={pr.id} className="flex items-center justify-between px-3 py-2 rounded-lg border bg-white">
                        <div className="flex items-center gap-2">
                          <PackageCheck className="h-4 w-4 text-teal-500" />
                          <span className="font-mono text-sm">{pr.number}</span>
                          <span className="text-xs text-slate-400">{formatDate(pr.date)}</span>
                        </div>
                        <Badge className={getStatusColor(pr.status)}>{getStatusLabel(pr.status)}</Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {detailOrder.status === 'CONFIRMED' && (
                <div className="flex gap-3">
                  <Button
                    onClick={() => {
                      setDetailDialogOpen(false)
                      handleCreatePurchaseReceipt(detailOrder)
                    }}
                    className="flex-1 bg-teal-600 hover:bg-teal-700 text-white gap-2"
                  >
                    <PackageCheck className="h-4 w-4" />
                    إنشاء إذن استلام
                  </Button>
                  <Button
                    onClick={() => {
                      setDetailDialogOpen(false)
                      handleCreatePurchaseInvoice(detailOrder)
                    }}
                    className="flex-1 bg-orange-600 hover:bg-orange-700 text-white gap-2"
                  >
                    <Receipt className="h-4 w-4" />
                    إنشاء فاتورة شراء
                  </Button>
                </div>
              )}

              {detailOrder.notes && (
                <div>
                  <span className="text-xs text-slate-400">ملاحظات</span>
                  <p className="text-sm text-slate-600 mt-1">{detailOrder.notes}</p>
                </div>
              )}
            </div>
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
