'use client'

import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import {
  ArrowLeftRight,
  Plus,
  Loader2,
  Eye,
  CheckCircle2,
  XCircle,
  Trash2,
  ArrowRightLeft,
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

interface StockTransferLine {
  id: string
  itemId: string
  quantity: number
  notes?: string | null
  item?: { id: string; code: string; nameAr?: string; nameEn?: string; uom?: { nameAr: string } | null }
}

interface StockTransfer {
  id: string
  number: string
  date: string
  fromWarehouseId: string
  toWarehouseId: string
  status: string
  notes?: string | null
  createdAt: string
  fromWarehouse: { id: string; code: string; nameAr: string; nameEn?: string }
  toWarehouse: { id: string; code: string; nameAr: string; nameEn?: string }
  _count?: { lines: number }
  lines?: StockTransferLine[]
}

interface TransferLineInput {
  itemId: string
  quantity: number
  notes?: string
}

// ─── Constants ────────────────────────────────────────────────────────────────

const statusLabels: Record<string, string> = {
  DRAFT: 'مسودة',
  CONFIRMED: 'مؤكدة',
  CANCELLED: 'ملغية',
}

const statusBadgeStyles: Record<string, string> = {
  DRAFT: 'bg-slate-50 text-slate-700 border-slate-200',
  CONFIRMED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  CANCELLED: 'bg-red-50 text-red-700 border-red-200',
}

const initialLineInput: TransferLineInput = {
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

export default function StockTransfersList() {
  const companyId = useAppStore((state) => state.currentCompanyId)
  const setView = useAppStore((state) => state.setView)
  const setSelectedTransferId = useAppStore((state) => state.setSelectedTransferId)
  const [transfers, setTransfers] = useState<StockTransfer[]>([])
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [items, setItems] = useState<Item[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  // Create dialog
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [createForm, setCreateForm] = useState({
    fromWarehouseId: '',
    toWarehouseId: '',
    date: new Date().toISOString().split('T')[0],
    notes: '',
  })
  const [createLines, setCreateLines] = useState<TransferLineInput[]>([{ ...initialLineInput }])

  // View/Confirm dialog
  const [viewDialogOpen, setViewDialogOpen] = useState(false)
  const [selectedTransfer, setSelectedTransfer] = useState<StockTransfer | null>(null)
  const [viewLoading, setViewLoading] = useState(false)

  // Cancel confirmation
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false)

  // ── Data Fetching ─────────────────────────────────────────────────────────

  const fetchTransfers = useCallback(async () => {
    try {
      const res = await fetch(`/api/inventory/stock-transfers?companyId=${companyId}`)
      if (res.ok) {
        const data = await res.json()
        setTransfers(data)
      }
    } catch {
      toast.error('فشل في تحميل تحويلات المخزون')
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

  useEffect(() => {
    if (companyId) {
      fetchTransfers()
      fetchWarehouses()
      fetchItems()
    }
  }, [companyId, fetchTransfers, fetchWarehouses, fetchItems])

  // ── Warehouse Display Name ────────────────────────────────────────────────

  const getWarehouseDisplayName = (warehouseId: string, whData?: { nameAr: string; nameEn?: string }) => {
    const wh = warehouses.find((w) => w.id === warehouseId)
    if (wh) {
      return buildWarehouseDisplayName(wh)
    }
    return whData?.nameAr || warehouseId
  }

  // ── Create Transfer Handlers ──────────────────────────────────────────────

  const handleOpenCreate = () => {
    setSelectedTransferId(null)
    setView('stock-transfer-form')
  }

  const handleAddLine = () => {
    setCreateLines((prev) => [...prev, { ...initialLineInput }])
  }

  const handleRemoveLine = (index: number) => {
    setCreateLines((prev) => prev.filter((_, i) => i !== index))
  }

  const handleLineChange = (index: number, field: keyof TransferLineInput, value: string | number) => {
    setCreateLines((prev) =>
      prev.map((line, i) => (i === index ? { ...line, [field]: value } : line))
    )
  }

  const handleCreateSubmit = async () => {
    if (!createForm.fromWarehouseId) {
      toast.error('يرجى اختيار المخزن المصدر')
      return
    }
    if (!createForm.toWarehouseId) {
      toast.error('يرجى اختيار المخزن الوجهة')
      return
    }
    if (createForm.fromWarehouseId === createForm.toWarehouseId) {
      toast.error('لا يمكن أن يكون المخزن المصدر والوجهة واحد')
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
      const res = await fetch(`/api/inventory/stock-transfers?companyId=${companyId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          fromWarehouseId: createForm.fromWarehouseId,
          toWarehouseId: createForm.toWarehouseId,
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
        toast.success('تم إنشاء تحويل المخزون بنجاح')
        setCreateDialogOpen(false)
        fetchTransfers()
      } else {
        const err = await res.json()
        toast.error(err.error || 'فشل في إنشاء تحويل المخزون')
      }
    } catch {
      toast.error('حدث خطأ أثناء إنشاء تحويل المخزون')
    } finally {
      setSubmitting(false)
    }
  }

  // ── View/Confirm/Cancel Handlers ──────────────────────────────────────────

  const handleViewTransfer = (transferId: string) => {
    setSelectedTransferId(transferId)
    setView('stock-transfer-form')
  }

  const handleConfirmTransfer = async () => {
    if (!selectedTransfer) return
    setSubmitting(true)
    try {
      const res = await fetch(`/api/inventory/stock-transfers/${selectedTransfer.id}?companyId=${companyId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId, action: 'confirm' }),
      })
      if (res.ok) {
        const updated = await res.json()
        setSelectedTransfer(updated)
        toast.success('تم تأكيد التحويل بنجاح')
        fetchTransfers()
      } else {
        const err = await res.json()
        toast.error(err.error || 'فشل في تأكيد التحويل')
      }
    } catch {
      toast.error('حدث خطأ أثناء تأكيد التحويل')
    } finally {
      setSubmitting(false)
    }
  }

  const handleCancelTransfer = async () => {
    if (!selectedTransfer) return
    setSubmitting(true)
    try {
      const res = await fetch(`/api/inventory/stock-transfers/${selectedTransfer.id}?companyId=${companyId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId, action: 'cancel' }),
      })
      if (res.ok) {
        const updated = await res.json()
        setSelectedTransfer(updated)
        toast.success('تم إلغاء التحويل بنجاح')
        fetchTransfers()
      } else {
        const err = await res.json()
        toast.error(err.error || 'فشل في إلغاء التحويل')
      }
    } catch {
      toast.error('حدث خطأ أثناء إلغاء التحويل')
    } finally {
      setSubmitting(false)
      setCancelConfirmOpen(false)
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
                <ArrowRightLeft className="h-5 w-5 text-emerald-600" />
              </div>
              <CardTitle className="text-lg">تحويلات المخزون</CardTitle>
            </div>
            <Button
              onClick={handleOpenCreate}
              className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
            >
              <Plus className="h-4 w-4" />
              تحويل جديد
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Table */}
          <div className="max-h-[calc(100vh-300px)] overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50/80 hover:bg-slate-50/80">
                  <TableHead className="text-right font-semibold">رقم التحويل</TableHead>
                  <TableHead className="text-right font-semibold">التاريخ</TableHead>
                  <TableHead className="text-right font-semibold">من مخزن</TableHead>
                  <TableHead className="text-right font-semibold">إلى مخزن</TableHead>
                  <TableHead className="text-right font-semibold">عدد الأصناف</TableHead>
                  <TableHead className="text-right font-semibold">الحالة</TableHead>
                  <TableHead className="text-right font-semibold">إجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transfers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-12">
                      <div className="flex flex-col items-center text-slate-400">
                        <ArrowRightLeft className="h-12 w-12 mb-3 text-slate-200" />
                        <p className="text-sm">لا توجد تحويلات مخزون</p>
                        <p className="text-xs mt-1 text-slate-300">
                          اضغط على &quot;تحويل جديد&quot; لإنشاء تحويل
                        </p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  transfers.map((transfer) => (
                    <TableRow key={transfer.id} className="hover:bg-slate-50/50">
                      <TableCell className="font-mono text-sm font-medium">
                        {transfer.number}
                      </TableCell>
                      <TableCell className="text-slate-500 text-sm whitespace-nowrap">
                        {formatDate(transfer.date)}
                      </TableCell>
                      <TableCell className="text-sm">
                        <span className="text-slate-700">
                          {getWarehouseDisplayName(transfer.fromWarehouseId, transfer.fromWarehouse)}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm">
                        <span className="text-slate-700">
                          {getWarehouseDisplayName(transfer.toWarehouseId, transfer.toWarehouse)}
                        </span>
                      </TableCell>
                      <TableCell className="text-center font-mono text-sm">
                        {transfer._count?.lines ?? 0}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={statusBadgeStyles[transfer.status] || 'bg-slate-50 text-slate-700'}
                        >
                          {statusLabels[transfer.status] || transfer.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-slate-500 hover:text-emerald-600"
                            onClick={() => handleViewTransfer(transfer.id)}
                            title="عرض التفاصيل"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          {transfer.status === 'DRAFT' && (
                            <>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-slate-500 hover:text-emerald-600"
                                onClick={async () => {
                                  setSubmitting(true)
                                  try {
                                    const res = await fetch(
                                      `/api/inventory/stock-transfers/${transfer.id}?companyId=${companyId}`,
                                      {
                                        method: 'PUT',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({ companyId, action: 'confirm' }),
                                      }
                                    )
                                    if (res.ok) {
                                      toast.success('تم تأكيد التحويل بنجاح')
                                      fetchTransfers()
                                    } else {
                                      const err = await res.json()
                                      toast.error(err.error || 'فشل في تأكيد التحويل')
                                    }
                                  } catch {
                                    toast.error('حدث خطأ أثناء تأكيد التحويل')
                                  } finally {
                                    setSubmitting(false)
                                  }
                                }}
                                title="تأكيد"
                              >
                                <CheckCircle2 className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-slate-500 hover:text-red-600"
                                onClick={async () => {
                                  try {
                                    const res = await fetch(
                                      `/api/inventory/stock-transfers/${transfer.id}?companyId=${companyId}`,
                                      {
                                        method: 'PUT',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({ companyId, action: 'cancel' }),
                                      }
                                    )
                                    if (res.ok) {
                                      toast.success('تم إلغاء التحويل بنجاح')
                                      fetchTransfers()
                                    } else {
                                      const err = await res.json()
                                      toast.error(err.error || 'فشل في إلغاء التحويل')
                                    }
                                  } catch {
                                    toast.error('حدث خطأ أثناء إلغاء التحويل')
                                  }
                                }}
                                title="إلغاء"
                              >
                                <XCircle className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                          {transfer.status === 'CONFIRMED' && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-slate-500 hover:text-red-600"
                              onClick={() => {
                                setSelectedTransfer(transfer)
                                setCancelConfirmOpen(true)
                              }}
                              title="إلغاء التحويل"
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

      {/* ─── Create Transfer Dialog ──────────────────────────────────────── */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowRightLeft className="h-5 w-5 text-emerald-600" />
              تحويل مخزون جديد
            </DialogTitle>
            <DialogDescription>
              إنشاء تحويل مخزون بين المخازن
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-2">
            {/* From Warehouse */}
            <div className="space-y-2">
              <Label>
                من مخزن <span className="text-red-500">*</span>
              </Label>
              <Select
                value={createForm.fromWarehouseId}
                onValueChange={(val) =>
                  setCreateForm((p) => ({ ...p, fromWarehouseId: val }))
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="اختر المخزن المصدر" />
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

            {/* To Warehouse */}
            <div className="space-y-2">
              <Label>
                إلى مخزن <span className="text-red-500">*</span>
              </Label>
              <Select
                value={createForm.toWarehouseId}
                onValueChange={(val) =>
                  setCreateForm((p) => ({ ...p, toWarehouseId: val }))
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="اختر المخزن الوجهة" />
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
            <div className="space-y-2">
              <Label>ملاحظات</Label>
              <Input
                value={createForm.notes}
                onChange={(e) =>
                  setCreateForm((p) => ({ ...p, notes: e.target.value }))
                }
                placeholder="ملاحظات اختيارية..."
              />
            </div>
          </div>

          {/* Transfer Lines */}
          <div className="space-y-3 mt-2">
            <div className="flex items-center justify-between">
              <Label className="text-base font-semibold">أصناف التحويل</Label>
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
              إنشاء التحويل
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── View/Confirm Transfer Dialog ────────────────────────────────── */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          {viewLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
            </div>
          ) : selectedTransfer ? (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <ArrowRightLeft className="h-5 w-5 text-emerald-600" />
                  تحويل مخزون {selectedTransfer.number}
                </DialogTitle>
                <DialogDescription>
                  تفاصيل التحويل والإجراءات
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-2">
                {/* Transfer Info */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <p className="text-xs text-slate-500">من مخزن</p>
                    <p className="text-sm font-medium text-slate-800">
                      {getWarehouseDisplayName(
                        selectedTransfer.fromWarehouseId,
                        selectedTransfer.fromWarehouse
                      )}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-slate-500">إلى مخزن</p>
                    <p className="text-sm font-medium text-slate-800">
                      {getWarehouseDisplayName(
                        selectedTransfer.toWarehouseId,
                        selectedTransfer.toWarehouse
                      )}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-slate-500">التاريخ</p>
                    <p className="text-sm font-medium text-slate-800">
                      {formatDate(selectedTransfer.date)}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-slate-500">الحالة</p>
                    <Badge
                      variant="outline"
                      className={
                        statusBadgeStyles[selectedTransfer.status] ||
                        'bg-slate-50 text-slate-700'
                      }
                    >
                      {statusLabels[selectedTransfer.status] || selectedTransfer.status}
                    </Badge>
                  </div>
                </div>

                {selectedTransfer.notes && (
                  <div className="space-y-1">
                    <p className="text-xs text-slate-500">ملاحظات</p>
                    <p className="text-sm text-slate-700 bg-slate-50 p-3 rounded-lg">
                      {selectedTransfer.notes}
                    </p>
                  </div>
                )}

                {/* Transfer Lines */}
                {selectedTransfer.lines && selectedTransfer.lines.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm font-semibold text-slate-700">الأصناف المحولة</p>
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-slate-50/80 hover:bg-slate-50/80">
                          <TableHead className="text-right font-semibold">الصنف</TableHead>
                          <TableHead className="text-right font-semibold">الكود</TableHead>
                          <TableHead className="text-right font-semibold">الكمية</TableHead>
                          <TableHead className="text-right font-semibold">ملاحظات</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {selectedTransfer.lines.map((line) => (
                          <TableRow key={line.id}>
                            <TableCell className="font-medium">
                              {line.item?.nameAr || line.item?.nameEn || '—'}
                            </TableCell>
                            <TableCell className="font-mono text-sm text-slate-500">
                              {line.item?.code || '—'}
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
                {selectedTransfer.status === 'DRAFT' && (
                  <>
                    <Button
                      onClick={handleConfirmTransfer}
                      disabled={submitting}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
                    >
                      {submitting ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <CheckCircle2 className="h-4 w-4" />
                      )}
                      تأكيد التحويل
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={() => setCancelConfirmOpen(true)}
                      disabled={submitting}
                      className="gap-2"
                    >
                      <XCircle className="h-4 w-4" />
                      إلغاء التحويل
                    </Button>
                  </>
                )}
                {selectedTransfer.status === 'CONFIRMED' && (
                  <Button
                    variant="destructive"
                    onClick={() => setCancelConfirmOpen(true)}
                    disabled={submitting}
                    className="gap-2"
                  >
                    <XCircle className="h-4 w-4" />
                    إلغاء التحويل (عكس الحركات)
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
            <AlertDialogTitle>تأكيد إلغاء التحويل</AlertDialogTitle>
            <AlertDialogDescription>
              {selectedTransfer?.status === 'CONFIRMED'
                ? 'سيتم عكس حركات المخزون التي تم إنشاؤها عند تأكيد هذا التحويل. هل أنت متأكد؟'
                : 'هل أنت متأكد من إلغاء هذا التحويل؟'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>تراجع</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCancelTransfer}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              نعم، إلغاء التحويل
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
