'use client'

import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import {
  Plus, Undo2, Loader2, Eye, CheckCircle, XCircle,
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

interface SalesReturn {
  id: string
  number: string
  customerId: string
  warehouseId: string
  date: string
  status: string
  totalAmount: number
  notes: string | null
  salesOrderId: string | null
  salesInvoiceId: string | null
  deliveryNoteId: string | null
  customer: { id: string; code: string; nameAr: string; nameEn: string | null }
  warehouse: { id: string; code: string; nameAr: string; nameEn: string | null }
  salesOrder: { id: string; number: string } | null
  salesInvoice: { id: string; number: string } | null
  deliveryNote: { id: string; number: string } | null
  lines?: Array<{
    id: string
    itemId: string
    quantity: number
    unitPrice: number
    totalAmount: number
    item: { id: string; code: string; nameAr: string; nameEn: string | null; uom?: { nameAr: string } | null }
  }>
  _count?: { lines: number }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getLinkedDocumentLabel(ret: SalesReturn): string {
  if (ret.salesInvoice) return ret.salesInvoice.number
  if (ret.deliveryNote) return ret.deliveryNote.number
  if (ret.salesOrder) return ret.salesOrder.number
  return '—'
}

function getLinkedDocumentTypeLabel(ret: SalesReturn): string {
  if (ret.salesInvoice) return 'فاتورة بيع'
  if (ret.deliveryNote) return 'إذن صرف'
  if (ret.salesOrder) return 'أمر بيع'
  return ''
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function SalesReturnsList() {
  const companyId = useAppStore(state => state.currentCompanyId)
  const setModule = useAppStore(state => state.setModule)
  const setView = useAppStore(state => state.setView)
  const setEditingDocId = useAppStore(state => state.setEditingDocId)

  const [returns, setReturns] = useState<SalesReturn[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  // Filters
  const [statusFilter, setStatusFilter] = useState('all')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')

  // Detail dialog
  const [detailDialogOpen, setDetailDialogOpen] = useState(false)
  const [detailReturn, setDetailReturn] = useState<SalesReturn | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  // Confirm dialog
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false)
  const [confirmReturnId, setConfirmReturnId] = useState<string | null>(null)
  const [confirmAction, setConfirmAction] = useState<string>('')

  useEffect(() => {
    fetchReturns()
  }, [])

  const fetchReturns = async () => {
    try {
      const params = new URLSearchParams()
      if (statusFilter !== 'all') params.set('status', statusFilter)
      if (fromDate) params.set('fromDate', fromDate)
      if (toDate) params.set('toDate', toDate)

      const res = await fetch(`/api/sales/returns?companyId=${companyId}&${params.toString()}`)
      if (res.ok) {
        const data = await res.json()
        setReturns(data)
      }
    } catch {
      toast.error('فشل في تحميل مرتجعات البيع')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!loading) fetchReturns()
  }, [statusFilter, fromDate, toDate])

  // ── Navigation handlers ──

  const handleOpenAdd = () => {
    setEditingDocId(null)
    setModule('sales')
    setView('sales-return-form')
  }

  const handleOpenEdit = (id: string) => {
    setEditingDocId(id)
    setModule('sales')
    setView('sales-return-form')
  }

  // ── View Detail ──

  const handleViewDetail = async (returnId: string) => {
    setDetailLoading(true)
    setDetailDialogOpen(true)
    try {
      const res = await fetch(`/api/sales/returns/${returnId}?companyId=${companyId}`)
      if (res.ok) {
        setDetailReturn(await res.json())
      }
    } catch {
      toast.error('فشل في تحميل تفاصيل مرتجع البيع')
    } finally {
      setDetailLoading(false)
    }
  }

  // ── Confirm / Cancel ──

  const handleAction = async () => {
    if (!confirmReturnId) return
    setSubmitting(true)
    try {
      const res = await fetch(`/api/sales/returns/${confirmReturnId}?companyId=${companyId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: confirmAction, companyId }),
      })
      if (res.ok) {
        toast.success(
          confirmAction === 'confirm' ? 'تم تأكيد مرتجع البيع بنجاح' : 'تم إلغاء مرتجع البيع'
        )
        fetchReturns()
      } else {
        const err = await res.json()
        toast.error(err.error || 'فشل في تنفيذ الإجراء')
      }
    } catch {
      toast.error('حدث خطأ')
    } finally {
      setSubmitting(false)
      setConfirmDialogOpen(false)
      setConfirmReturnId(null)
    }
  }

  const openConfirmDialog = (returnId: string, action: string) => {
    setConfirmReturnId(returnId)
    setConfirmAction(action)
    setConfirmDialogOpen(true)
  }

  // ── Loading state ──

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
              <div className="h-10 w-10 rounded-xl bg-red-50 flex items-center justify-center">
                <Undo2 className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <CardTitle className="text-lg">مرتجعات البيع</CardTitle>
                <p className="text-xs text-slate-400 mt-0.5">
                  {returns.length.toLocaleString('ar-EG')} مرتجع بيع
                </p>
              </div>
            </div>
            <Button
              onClick={handleOpenAdd}
              className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
            >
              <Plus className="h-4 w-4" />
              إضافة مرتجع
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
                </SelectContent>
              </Select>
            </div>
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
                  <TableHead className="text-right font-semibold">التاريخ</TableHead>
                  <TableHead className="text-right font-semibold">العميل</TableHead>
                  <TableHead className="text-right font-semibold">المخزن</TableHead>
                  <TableHead className="text-right font-semibold">المستند المرتبط</TableHead>
                  <TableHead className="text-right font-semibold">الإجمالي</TableHead>
                  <TableHead className="text-right font-semibold">الحالة</TableHead>
                  <TableHead className="text-right font-semibold">إجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {returns.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-12">
                      <div className="flex flex-col items-center text-slate-400">
                        <Undo2 className="h-12 w-12 mb-3 text-slate-200" />
                        <p className="text-sm">لا توجد مرتجعات بيع</p>
                        <p className="text-xs mt-1 text-slate-300">
                          اضغط على &quot;إضافة مرتجع&quot; لإنشاء مرتجع بيع جديد
                        </p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  returns.map((ret) => (
                    <TableRow
                      key={ret.id}
                      className="cursor-pointer hover:bg-slate-50/50"
                      onClick={() => handleOpenEdit(ret.id)}
                    >
                      <TableCell>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleOpenEdit(ret.id)
                          }}
                          className="font-mono text-sm text-emerald-700 hover:text-emerald-900 hover:underline font-semibold"
                        >
                          {ret.number}
                        </button>
                      </TableCell>
                      <TableCell className="text-slate-500 text-sm">
                        {formatDate(ret.date)}
                      </TableCell>
                      <TableCell className="font-medium">{ret.customer.nameAr}</TableCell>
                      <TableCell className="text-slate-500">{ret.warehouse.nameAr}</TableCell>
                      <TableCell>
                        {getLinkedDocumentLabel(ret) !== '—' ? (
                          <div className="flex flex-col">
                            <span className="font-mono text-sm text-slate-600">
                              {getLinkedDocumentLabel(ret)}
                            </span>
                            <span className="text-[10px] text-slate-400">
                              {getLinkedDocumentTypeLabel(ret)}
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-300 text-sm">—</span>
                        )}
                      </TableCell>
                      <TableCell className="font-mono" dir="ltr">
                        {formatCurrency(ret.totalAmount)}
                      </TableCell>
                      <TableCell>
                        <Badge className={getStatusColor(ret.status)}>
                          {getStatusLabel(ret.status)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleViewDetail(ret.id)}
                            className="h-8 w-8 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50"
                            title="عرض التفاصيل"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          {ret.status === 'DRAFT' && (
                            <>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => openConfirmDialog(ret.id, 'confirm')}
                                className="h-8 w-8 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50"
                                title="تأكيد"
                              >
                                <CheckCircle className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => openConfirmDialog(ret.id, 'cancel')}
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
            <DialogTitle>تفاصيل مرتجع البيع</DialogTitle>
          </DialogHeader>
          {detailLoading ? (
            <div className="space-y-3 py-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-8 w-full" />
              ))}
            </div>
          ) : detailReturn ? (
            <div className="space-y-4 py-2 max-h-[65vh] overflow-y-auto">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <span className="text-xs text-slate-400">رقم المرتجع</span>
                  <p className="font-mono text-sm font-medium">{detailReturn.number}</p>
                </div>
                <div>
                  <span className="text-xs text-slate-400">العميل</span>
                  <p className="text-sm font-medium">{detailReturn.customer.nameAr}</p>
                </div>
                <div>
                  <span className="text-xs text-slate-400">المخزن</span>
                  <p className="text-sm font-medium">{detailReturn.warehouse.nameAr}</p>
                </div>
                <div>
                  <span className="text-xs text-slate-400">التاريخ</span>
                  <p className="text-sm font-medium">{formatDate(detailReturn.date)}</p>
                </div>
                <div>
                  <span className="text-xs text-slate-400">الحالة</span>
                  <Badge className={getStatusColor(detailReturn.status)}>
                    {getStatusLabel(detailReturn.status)}
                  </Badge>
                </div>
                {getLinkedDocumentLabel(detailReturn) !== '—' && (
                  <div>
                    <span className="text-xs text-slate-400">المستند المرتبط</span>
                    <p className="text-sm font-medium">
                      {getLinkedDocumentTypeLabel(detailReturn)}{' '}
                      <span className="font-mono">{getLinkedDocumentLabel(detailReturn)}</span>
                    </p>
                  </div>
                )}
              </div>

              <Separator />

              {detailReturn.lines && detailReturn.lines.length > 0 && (
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-slate-50/80">
                        <TableHead className="text-right text-xs">الصنف</TableHead>
                        <TableHead className="text-right text-xs">الكمية</TableHead>
                        <TableHead className="text-right text-xs">سعر الوحدة</TableHead>
                        <TableHead className="text-right text-xs">الإجمالي</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {detailReturn.lines.map((line) => (
                        <TableRow key={line.id}>
                          <TableCell className="text-sm">
                            {line.item.nameAr}
                            {line.item.uom && (
                              <span className="text-xs text-slate-400 mr-1">({line.item.uom.nameAr})</span>
                            )}
                          </TableCell>
                          <TableCell className="font-mono text-sm" dir="ltr">{line.quantity}</TableCell>
                          <TableCell className="font-mono text-sm" dir="ltr">{formatCurrency(line.unitPrice)}</TableCell>
                          <TableCell className="font-mono text-sm font-medium" dir="ltr">{formatCurrency(line.totalAmount)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}

              <div className="border rounded-lg p-4 bg-slate-50 space-y-2">
                <div className="flex justify-between text-base font-bold">
                  <span>إجمالي المرتجع</span>
                  <span className="font-mono text-red-700" dir="ltr">{formatCurrency(detailReturn.totalAmount)}</span>
                </div>
              </div>

              {detailReturn.notes && (
                <div>
                  <span className="text-xs text-slate-400">ملاحظات</span>
                  <p className="text-sm text-slate-600 mt-1">{detailReturn.notes}</p>
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
              {confirmAction === 'confirm' ? 'تأكيد مرتجع البيع' : 'إلغاء مرتجع البيع'}
            </DialogTitle>
            <DialogDescription>
              {confirmAction === 'confirm'
                ? 'سيتم تأكيد مرتجع البيع وإنشاء حركات مخزنية واردة. هل أنت متأكد؟'
                : 'سيتم إلغاء مرتجع البيع. هل أنت متأكد؟'}
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
              {confirmAction === 'confirm' ? 'تأكيد' : 'إلغاء المرتجع'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
