'use client'

import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import {
  ClipboardList,
  Plus,
  Loader2,
  Eye,
  CheckCircle2,
  XCircle,
  Trash2,
  Send,
  PackageCheck,
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

interface Item {
  id: string
  code: string
  nameAr?: string
  nameEn?: string
}

interface MaterialRequestLine {
  id: string
  itemId: string
  quantity: number
  fulfilledQty: number
  notes: string | null
  item?: { id: string; code: string; nameAr?: string; nameEn?: string; uom?: { nameAr: string } | null }
}

interface MaterialRequest {
  id: string
  number: string
  date: string
  status: string
  requestedBy: string | null
  approvedBy: string | null
  notes: string | null
  createdAt: string
  _count?: { lines: number }
  lines?: MaterialRequestLine[]
}

interface RequestLineInput {
  itemId: string
  quantity: number
  notes: string
}

// ─── Constants ────────────────────────────────────────────────────────────────

const statusLabels: Record<string, string> = {
  DRAFT: 'مسودة',
  PENDING: 'قيد المراجعة',
  APPROVED: 'معتمد',
  FULFILLED: 'مكتمل',
  CANCELLED: 'ملغى',
}

const statusBadgeStyles: Record<string, string> = {
  DRAFT: 'bg-slate-50 text-slate-700 border-slate-200',
  PENDING: 'bg-amber-50 text-amber-700 border-amber-200',
  APPROVED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  FULFILLED: 'bg-teal-50 text-teal-700 border-teal-200',
  CANCELLED: 'bg-red-50 text-red-700 border-red-200',
}

const initialLineInput: RequestLineInput = {
  itemId: '',
  quantity: 0,
  notes: '',
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function MaterialRequestsList() {
  const companyId = useAppStore((state) => state.currentCompanyId)
  const [requests, setRequests] = useState<MaterialRequest[]>([])
  const [items, setItems] = useState<Item[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  // Create dialog
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [createForm, setCreateForm] = useState({
    date: new Date().toISOString().split('T')[0],
    requestedBy: '',
    notes: '',
  })
  const [createLines, setCreateLines] = useState<RequestLineInput[]>([{ ...initialLineInput }])

  // View dialog
  const [viewDialogOpen, setViewDialogOpen] = useState(false)
  const [selectedRequest, setSelectedRequest] = useState<MaterialRequest | null>(null)
  const [viewLoading, setViewLoading] = useState(false)

  // Cancel confirmation
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false)

  // ── Data Fetching ─────────────────────────────────────────────────────────

  const fetchRequests = useCallback(async () => {
    try {
      const res = await fetch(`/api/inventory/material-requests?companyId=${companyId}`)
      if (res.ok) {
        const data = await res.json()
        setRequests(data)
      }
    } catch {
      toast.error('فشل في تحميل طلبات المواد')
    } finally {
      setLoading(false)
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

  useEffect(() => {
    if (companyId) {
      fetchRequests()
      fetchItems()
    }
  }, [companyId, fetchRequests, fetchItems])

  // ── Create Request Handlers ──────────────────────────────────────────────

  const handleOpenCreate = () => {
    setCreateForm({
      date: new Date().toISOString().split('T')[0],
      requestedBy: '',
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

  const handleLineChange = (index: number, field: keyof RequestLineInput, value: string | number) => {
    setCreateLines((prev) =>
      prev.map((line, i) => (i === index ? { ...line, [field]: value } : line))
    )
  }

  const handleCreateSubmit = async () => {
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
      const res = await fetch(`/api/inventory/material-requests?companyId=${companyId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          date: createForm.date,
          requestedBy: createForm.requestedBy || undefined,
          notes: createForm.notes || undefined,
          lines: validLines.map((l) => ({
            itemId: l.itemId,
            quantity: l.quantity,
            notes: l.notes || undefined,
          })),
        }),
      })

      if (res.ok) {
        toast.success('تم إنشاء طلب المواد بنجاح')
        setCreateDialogOpen(false)
        fetchRequests()
      } else {
        const err = await res.json()
        toast.error(err.error || 'فشل في إنشاء طلب المواد')
      }
    } catch {
      toast.error('حدث خطأ أثناء إنشاء طلب المواد')
    } finally {
      setSubmitting(false)
    }
  }

  // ── View/Status Change Handlers ──────────────────────────────────────────

  const handleViewRequest = async (requestId: string) => {
    setViewLoading(true)
    setViewDialogOpen(true)
    try {
      const res = await fetch(`/api/inventory/material-requests/${requestId}?companyId=${companyId}`)
      if (res.ok) {
        const data = await res.json()
        setSelectedRequest(data)
      } else {
        toast.error('فشل في تحميل تفاصيل الطلب')
        setViewDialogOpen(false)
      }
    } catch {
      toast.error('حدث خطأ أثناء تحميل التفاصيل')
      setViewDialogOpen(false)
    } finally {
      setViewLoading(false)
    }
  }

  const handleStatusAction = async (action: 'submit' | 'approve' | 'fulfill' | 'cancel') => {
    if (!selectedRequest) return
    setSubmitting(true)
    try {
      const res = await fetch(`/api/inventory/material-requests/${selectedRequest.id}?companyId=${companyId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId, action }),
      })
      if (res.ok) {
        const updated = await res.json()
        setSelectedRequest(updated)
        const actionLabels: Record<string, string> = {
          submit: 'إرسال الطلب للمراجعة',
          approve: 'اعتماد الطلب',
          fulfill: 'تلبية الطلب',
          cancel: 'إلغاء الطلب',
        }
        toast.success(`تم ${actionLabels[action]} بنجاح`)
        fetchRequests()
      } else {
        const err = await res.json()
        toast.error(err.error || 'فشل في تنفيذ الإجراء')
      }
    } catch {
      toast.error('حدث خطأ أثناء تنفيذ الإجراء')
    } finally {
      setSubmitting(false)
      setCancelConfirmOpen(false)
    }
  }

  // Inline status action for table row buttons
  const handleInlineStatusAction = async (requestId: string, action: 'submit' | 'approve' | 'fulfill' | 'cancel') => {
    setSubmitting(true)
    try {
      const res = await fetch(`/api/inventory/material-requests/${requestId}?companyId=${companyId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId, action }),
      })
      if (res.ok) {
        const actionLabels: Record<string, string> = {
          submit: 'إرسال الطلب للمراجعة',
          approve: 'اعتماد الطلب',
          fulfill: 'تلبية الطلب',
          cancel: 'إلغاء الطلب',
        }
        toast.success(`تم ${actionLabels[action]} بنجاح`)
        fetchRequests()
      } else {
        const err = await res.json()
        toast.error(err.error || 'فشل في تنفيذ الإجراء')
      }
    } catch {
      toast.error('حدث خطأ أثناء تنفيذ الإجراء')
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
                <ClipboardList className="h-5 w-5 text-emerald-600" />
              </div>
              <CardTitle className="text-lg">طلبات المواد</CardTitle>
            </div>
            <Button
              onClick={handleOpenCreate}
              className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
            >
              <Plus className="h-4 w-4" />
              طلب جديد
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Table */}
          <div className="max-h-[calc(100vh-300px)] overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50/80 hover:bg-slate-50/80">
                  <TableHead className="text-right font-semibold">رقم الطلب</TableHead>
                  <TableHead className="text-right font-semibold">التاريخ</TableHead>
                  <TableHead className="text-right font-semibold">الطالب</TableHead>
                  <TableHead className="text-right font-semibold">الحالة</TableHead>
                  <TableHead className="text-right font-semibold">عدد الأصناف</TableHead>
                  <TableHead className="text-right font-semibold">إجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {requests.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-12">
                      <div className="flex flex-col items-center text-slate-400">
                        <ClipboardList className="h-12 w-12 mb-3 text-slate-200" />
                        <p className="text-sm">لا توجد طلبات مواد</p>
                        <p className="text-xs mt-1 text-slate-300">
                          اضغط على &quot;طلب جديد&quot; لإنشاء طلب
                        </p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  requests.map((request) => (
                    <TableRow key={request.id} className="hover:bg-slate-50/50">
                      <TableCell className="font-mono text-sm font-medium">
                        {request.number}
                      </TableCell>
                      <TableCell className="text-slate-500 text-sm whitespace-nowrap">
                        {formatDate(request.date)}
                      </TableCell>
                      <TableCell className="text-sm text-slate-700">
                        {request.requestedBy || '—'}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={statusBadgeStyles[request.status] || 'bg-slate-50 text-slate-700'}
                        >
                          {statusLabels[request.status] || request.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center font-mono text-sm">
                        {request._count?.lines ?? 0}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-slate-500 hover:text-emerald-600"
                            onClick={() => handleViewRequest(request.id)}
                            title="عرض التفاصيل"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          {request.status === 'DRAFT' && (
                            <>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-slate-500 hover:text-amber-600"
                                onClick={() => handleInlineStatusAction(request.id, 'submit')}
                                title="إرسال للمراجعة"
                                disabled={submitting}
                              >
                                <Send className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-slate-500 hover:text-red-600"
                                onClick={() => handleInlineStatusAction(request.id, 'cancel')}
                                title="إلغاء"
                                disabled={submitting}
                              >
                                <XCircle className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                          {request.status === 'PENDING' && (
                            <>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-slate-500 hover:text-emerald-600"
                                onClick={() => handleInlineStatusAction(request.id, 'approve')}
                                title="اعتماد"
                                disabled={submitting}
                              >
                                <CheckCircle2 className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-slate-500 hover:text-red-600"
                                onClick={() => handleInlineStatusAction(request.id, 'cancel')}
                                title="إلغاء"
                                disabled={submitting}
                              >
                                <XCircle className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                          {request.status === 'APPROVED' && (
                            <>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-slate-500 hover:text-teal-600"
                                onClick={() => handleInlineStatusAction(request.id, 'fulfill')}
                                title="تلبية الطلب"
                                disabled={submitting}
                              >
                                <PackageCheck className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-slate-500 hover:text-red-600"
                                onClick={() => handleInlineStatusAction(request.id, 'cancel')}
                                title="إلغاء"
                                disabled={submitting}
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

      {/* ─── Create Material Request Dialog ──────────────────────────────── */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ClipboardList className="h-5 w-5 text-emerald-600" />
              طلب مواد جديد
            </DialogTitle>
            <DialogDescription>
              إنشاء طلب مواد جديد
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-2">
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

            {/* Requested By */}
            <div className="space-y-2">
              <Label>الطالب</Label>
              <Input
                value={createForm.requestedBy}
                onChange={(e) =>
                  setCreateForm((p) => ({ ...p, requestedBy: e.target.value }))
                }
                placeholder="اسم الطالب..."
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

          {/* Request Lines */}
          <div className="space-y-3 mt-2">
            <div className="flex items-center justify-between">
              <Label className="text-base font-semibold">أصناف الطلب</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddLine}
                className="gap-1 text-emerald-600 border-emerald-200 hover:bg-emerald-50"
              >
                <Plus className="h-3.5 w-3.5" />
                إضافة صنف
              </Button>
            </div>

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
                    disabled={createLines.length === 1}
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
              disabled={submitting}
              className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              إنشاء الطلب
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── View Material Request Dialog ────────────────────────────────── */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          {viewLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
            </div>
          ) : selectedRequest ? (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <ClipboardList className="h-5 w-5 text-emerald-600" />
                  طلب مواد {selectedRequest.number}
                </DialogTitle>
                <DialogDescription>
                  تفاصيل الطلب والإجراءات
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-2">
                {/* Request Info */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <p className="text-xs text-slate-500">رقم الطلب</p>
                    <p className="text-sm font-medium text-slate-800 font-mono">
                      {selectedRequest.number}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-slate-500">التاريخ</p>
                    <p className="text-sm font-medium text-slate-800">
                      {formatDate(selectedRequest.date)}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-slate-500">الطالب</p>
                    <p className="text-sm font-medium text-slate-800">
                      {selectedRequest.requestedBy || '—'}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-slate-500">الحالة</p>
                    <Badge
                      variant="outline"
                      className={
                        statusBadgeStyles[selectedRequest.status] ||
                        'bg-slate-50 text-slate-700'
                      }
                    >
                      {statusLabels[selectedRequest.status] || selectedRequest.status}
                    </Badge>
                  </div>
                  {selectedRequest.approvedBy && (
                    <div className="space-y-1">
                      <p className="text-xs text-slate-500">المعتمد بواسطة</p>
                      <p className="text-sm font-medium text-slate-800">
                        {selectedRequest.approvedBy}
                      </p>
                    </div>
                  )}
                </div>

                {selectedRequest.notes && (
                  <div className="space-y-1">
                    <p className="text-xs text-slate-500">ملاحظات</p>
                    <p className="text-sm text-slate-700 bg-slate-50 p-3 rounded-lg">
                      {selectedRequest.notes}
                    </p>
                  </div>
                )}

                {/* Request Lines */}
                {selectedRequest.lines && selectedRequest.lines.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm font-semibold text-slate-700">أصناف الطلب</p>
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-slate-50/80 hover:bg-slate-50/80">
                          <TableHead className="text-right font-semibold">الصنف</TableHead>
                          <TableHead className="text-right font-semibold">الكود</TableHead>
                          <TableHead className="text-right font-semibold">الوحدة</TableHead>
                          <TableHead className="text-right font-semibold">الكمية المطلوبة</TableHead>
                          <TableHead className="text-right font-semibold">الكمية الملبية</TableHead>
                          <TableHead className="text-right font-semibold">ملاحظات</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {selectedRequest.lines.map((line) => (
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
                            <TableCell className="font-mono" dir="ltr">
                              {line.fulfilledQty.toLocaleString('ar-EG')}
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
                {selectedRequest.status === 'DRAFT' && (
                  <>
                    <Button
                      onClick={() => handleStatusAction('submit')}
                      disabled={submitting}
                      className="bg-amber-600 hover:bg-amber-700 text-white gap-2"
                    >
                      {submitting ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Send className="h-4 w-4" />
                      )}
                      إرسال للمراجعة
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={() => setCancelConfirmOpen(true)}
                      disabled={submitting}
                      className="gap-2"
                    >
                      <XCircle className="h-4 w-4" />
                      إلغاء الطلب
                    </Button>
                  </>
                )}
                {selectedRequest.status === 'PENDING' && (
                  <>
                    <Button
                      onClick={() => handleStatusAction('approve')}
                      disabled={submitting}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
                    >
                      {submitting ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <CheckCircle2 className="h-4 w-4" />
                      )}
                      اعتماد الطلب
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={() => setCancelConfirmOpen(true)}
                      disabled={submitting}
                      className="gap-2"
                    >
                      <XCircle className="h-4 w-4" />
                      إلغاء الطلب
                    </Button>
                  </>
                )}
                {selectedRequest.status === 'APPROVED' && (
                  <>
                    <Button
                      onClick={() => handleStatusAction('fulfill')}
                      disabled={submitting}
                      className="bg-teal-600 hover:bg-teal-700 text-white gap-2"
                    >
                      {submitting ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <PackageCheck className="h-4 w-4" />
                      )}
                      تلبية الطلب
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={() => setCancelConfirmOpen(true)}
                      disabled={submitting}
                      className="gap-2"
                    >
                      <XCircle className="h-4 w-4" />
                      إلغاء الطلب
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
            <AlertDialogTitle>تأكيد إلغاء طلب المواد</AlertDialogTitle>
            <AlertDialogDescription>
              هل أنت متأكد من إلغاء هذا الطلب؟ لا يمكن التراجع عن هذا الإجراء.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>تراجع</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => handleStatusAction('cancel')}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              نعم، إلغاء الطلب
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
