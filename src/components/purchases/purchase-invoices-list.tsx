'use client'

import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import {
  Plus, FileText, Loader2, CheckCircle,
  Eye, XCircle, CreditCard,
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
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function PurchaseInvoicesList() {
  const companyId = useAppStore(state => state.currentCompanyId)
  const itemFilter = useAppStore(state => state.itemFilter)
  const setItemFilter = useAppStore(state => state.setItemFilter)
  const setModule = useAppStore(state => state.setModule)
  const setView = useAppStore(state => state.setView)
  const setEditingDocId = useAppStore(state => state.setEditingDocId)
  const [invoices, setInvoices] = useState<PurchaseInvoice[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  // Filters
  const [statusFilter, setStatusFilter] = useState('all')
  const [supplierFilter, setSupplierFilter] = useState('all')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')

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

  useEffect(() => {
    if (!loading) fetchInvoices()
  }, [statusFilter, supplierFilter, fromDate, toDate, itemFilter])

  // ── Navigation handlers ──

  const handleOpenAdd = () => {
    setEditingDocId(null)
    setModule('purchases')
    setView('purchase-invoice-form')
  }

  const handleOpenEdit = (id: string) => {
    setEditingDocId(id)
    setModule('purchases')
    setView('purchase-invoice-form')
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
              onClick={handleOpenAdd}
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
                    <TableRow
                      key={inv.id}
                      className="cursor-pointer hover:bg-slate-50/50"
                      onClick={() => handleOpenEdit(inv.id)}
                    >
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
                        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
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
            <div className="space-y-4 py-2 max-h-[65vh] overflow-y-auto">
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
                ? 'سيتم تأكيد فاتورة الشراء. هل أنت متأكد؟'
                : 'سيتم إلغاء فاتورة الشراء. هل أنت متأكد؟'}
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
