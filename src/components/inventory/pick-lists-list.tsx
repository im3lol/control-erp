'use client'

import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import {
  ClipboardCheck,
  Plus,
  Loader2,
  Eye,
  CheckCircle2,
  XCircle,
  Trash2,
  Play,
  Save,
  Zap,
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

interface PickListLine {
  id: string
  itemId: string
  quantity: number
  pickedQty: number
  salesInvoiceId: string | null
  notes: string | null
  item?: { id: string; code: string; nameAr?: string; nameEn?: string; uom?: { nameAr: string } | null }
}

interface PickList {
  id: string
  number: string
  date: string
  status: string
  warehouseId: string
  notes: string | null
  createdAt: string
  warehouse?: { id: string; code: string; nameAr: string; nameEn?: string }
  _count?: { lines: number }
  lines?: PickListLine[]
}

interface PickListLineInput {
  itemId: string
  quantity: number
  notes?: string
}

// ─── Constants ────────────────────────────────────────────────────────────────

const statusLabels: Record<string, string> = {
  DRAFT: 'مسودة',
  IN_PROGRESS: 'قيد التحضير',
  COMPLETED: 'مكتمل',
  CANCELLED: 'ملغى',
}

const statusBadgeStyles: Record<string, string> = {
  DRAFT: 'bg-slate-50 text-slate-700 border-slate-200',
  IN_PROGRESS: 'bg-amber-50 text-amber-700 border-amber-200',
  COMPLETED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  CANCELLED: 'bg-red-50 text-red-700 border-red-200',
}

const initialLineInput: PickListLineInput = {
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

export default function PickListsList() {
  const companyId = useAppStore((state) => state.currentCompanyId)
  const [pickLists, setPickLists] = useState<PickList[]>([])
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [items, setItems] = useState<Item[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  // Create dialog
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [createForm, setCreateForm] = useState({
    warehouseId: '',
    date: new Date().toISOString().split('T')[0],
    notes: '',
  })
  const [createLines, setCreateLines] = useState<PickListLineInput[]>([{ ...initialLineInput }])

  // View dialog
  const [viewDialogOpen, setViewDialogOpen] = useState(false)
  const [selectedPickList, setSelectedPickList] = useState<PickList | null>(null)
  const [viewLoading, setViewLoading] = useState(false)
  const [editedLines, setEditedLines] = useState<PickListLine[]>([])

  // Cancel confirmation
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false)

  // ── Data Fetching ─────────────────────────────────────────────────────────

  const fetchPickLists = useCallback(async () => {
    try {
      const res = await fetch(`/api/inventory/pick-lists?companyId=${companyId}`)
      if (res.ok) {
        const data = await res.json()
        setPickLists(data)
      }
    } catch {
      toast.error('فشل في تحميل قوائم التحضير')
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
      fetchPickLists()
      fetchWarehouses()
      fetchItems()
    }
  }, [companyId, fetchPickLists, fetchWarehouses, fetchItems])

  // ── Warehouse Display Name ────────────────────────────────────────────────

  const getWarehouseDisplayName = (warehouseId: string, whData?: { nameAr: string; nameEn?: string }) => {
    const wh = warehouses.find((w) => w.id === warehouseId)
    if (wh) {
      return buildWarehouseDisplayName(wh)
    }
    return whData?.nameAr || warehouseId
  }

  // ── Create Pick List Handlers ────────────────────────────────────────────

  const handleAddLine = () => {
    setCreateLines((prev) => [...prev, { ...initialLineInput }])
  }

  const handleRemoveLine = (index: number) => {
    setCreateLines((prev) => prev.filter((_, i) => i !== index))
  }

  const handleLineChange = (index: number, field: keyof PickListLineInput, value: string | number) => {
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
      const res = await fetch(`/api/inventory/pick-lists?companyId=${companyId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          warehouseId: createForm.warehouseId,
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
        toast.success('تم إنشاء قائمة التحضير بنجاح')
        setCreateDialogOpen(false)
        resetCreateForm()
        fetchPickLists()
      } else {
        const err = await res.json()
        toast.error(err.error || 'فشل في إنشاء قائمة التحضير')
      }
    } catch {
      toast.error('حدث خطأ أثناء إنشاء قائمة التحضير')
    } finally {
      setSubmitting(false)
    }
  }

  const resetCreateForm = () => {
    setCreateForm({
      warehouseId: '',
      date: new Date().toISOString().split('T')[0],
      notes: '',
    })
    setCreateLines([{ ...initialLineInput }])
  }

  // ── Generate from Pending Sales ──────────────────────────────────────────

  const handleGenerateFromPendingSales = async () => {
    if (!companyId) return
    setSubmitting(true)
    try {
      const res = await fetch(`/api/inventory/pick-lists?companyId=${companyId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          fromPendingSales: true,
        }),
      })

      if (res.ok) {
        toast.success('تم توليد قائمة التحضير من المبيعات المعلقة بنجاح')
        fetchPickLists()
      } else {
        const err = await res.json()
        toast.error(err.error || 'فشل في توليد قائمة التحضير')
      }
    } catch {
      toast.error('حدث خطأ أثناء توليد قائمة التحضير')
    } finally {
      setSubmitting(false)
    }
  }

  // ── View Pick List ───────────────────────────────────────────────────────

  const handleViewPickList = async (pickListId: string) => {
    setViewLoading(true)
    setViewDialogOpen(true)
    try {
      const res = await fetch(`/api/inventory/pick-lists/${pickListId}?companyId=${companyId}`)
      if (res.ok) {
        const data = await res.json()
        setSelectedPickList(data)
        setEditedLines(data.lines ? data.lines.map((l: PickListLine) => ({ ...l })) : [])
      } else {
        toast.error('فشل في تحميل تفاصيل قائمة التحضير')
        setViewDialogOpen(false)
      }
    } catch {
      toast.error('حدث خطأ أثناء تحميل التفاصيل')
      setViewDialogOpen(false)
    } finally {
      setViewLoading(false)
    }
  }

  // ── Status Action Handlers ───────────────────────────────────────────────

  const handleStartPicking = async () => {
    if (!selectedPickList) return
    setSubmitting(true)
    try {
      const res = await fetch(`/api/inventory/pick-lists/${selectedPickList.id}?companyId=${companyId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId, action: 'start' }),
      })
      if (res.ok) {
        const updated = await res.json()
        setSelectedPickList(updated)
        setEditedLines(updated.lines ? updated.lines.map((l: PickListLine) => ({ ...l })) : [])
        toast.success('تم بدء التحضير بنجاح')
        fetchPickLists()
      } else {
        const err = await res.json()
        toast.error(err.error || 'فشل في بدء التحضير')
      }
    } catch {
      toast.error('حدث خطأ أثناء بدء التحضير')
    } finally {
      setSubmitting(false)
    }
  }

  const handleCompletePicking = async () => {
    if (!selectedPickList) return
    setSubmitting(true)
    try {
      const res = await fetch(`/api/inventory/pick-lists/${selectedPickList.id}?companyId=${companyId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId, action: 'complete' }),
      })
      if (res.ok) {
        const updated = await res.json()
        setSelectedPickList(updated)
        setEditedLines(updated.lines ? updated.lines.map((l: PickListLine) => ({ ...l })) : [])
        toast.success('تم إكمال التحضير بنجاح')
        fetchPickLists()
      } else {
        const err = await res.json()
        toast.error(err.error || 'فشل في إكمال التحضير')
      }
    } catch {
      toast.error('حدث خطأ أثناء إكمال التحضير')
    } finally {
      setSubmitting(false)
    }
  }

  const handleCancelPickList = async () => {
    if (!selectedPickList) return
    setSubmitting(true)
    try {
      const res = await fetch(`/api/inventory/pick-lists/${selectedPickList.id}?companyId=${companyId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId, action: 'cancel' }),
      })
      if (res.ok) {
        const updated = await res.json()
        setSelectedPickList(updated)
        setEditedLines(updated.lines ? updated.lines.map((l: PickListLine) => ({ ...l })) : [])
        toast.success('تم إلغاء قائمة التحضير بنجاح')
        fetchPickLists()
      } else {
        const err = await res.json()
        toast.error(err.error || 'فشل في إلغاء قائمة التحضير')
      }
    } catch {
      toast.error('حدث خطأ أثناء إلغاء قائمة التحضير')
    } finally {
      setSubmitting(false)
      setCancelConfirmOpen(false)
    }
  }

  const handleUpdateLines = async () => {
    if (!selectedPickList) return
    setSubmitting(true)
    try {
      const res = await fetch(`/api/inventory/pick-lists/${selectedPickList.id}?companyId=${companyId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          action: 'updateLines',
          lines: editedLines.map((l) => ({
            id: l.id,
            pickedQty: l.pickedQty,
            notes: l.notes,
          })),
        }),
      })
      if (res.ok) {
        const updated = await res.json()
        setSelectedPickList(updated)
        setEditedLines(updated.lines ? updated.lines.map((l: PickListLine) => ({ ...l })) : [])
        toast.success('تم تحديث بيانات التحضير بنجاح')
        fetchPickLists()
      } else {
        const err = await res.json()
        toast.error(err.error || 'فشل في تحديث بيانات التحضير')
      }
    } catch {
      toast.error('حدث خطأ أثناء تحديث بيانات التحضير')
    } finally {
      setSubmitting(false)
    }
  }

  const handlePickedQtyChange = (lineId: string, value: number) => {
    setEditedLines((prev) =>
      prev.map((l) => (l.id === lineId ? { ...l, pickedQty: value } : l))
    )
  }

  const handleLineNotesChange = (lineId: string, value: string) => {
    setEditedLines((prev) =>
      prev.map((l) => (l.id === lineId ? { ...l, notes: value } : l))
    )
  }

  // ── Inline Status Actions (in table) ────────────────────────────────────

  const handleInlineStart = async (pickListId: string) => {
    setSubmitting(true)
    try {
      const res = await fetch(`/api/inventory/pick-lists/${pickListId}?companyId=${companyId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId, action: 'start' }),
      })
      if (res.ok) {
        toast.success('تم بدء التحضير بنجاح')
        fetchPickLists()
      } else {
        const err = await res.json()
        toast.error(err.error || 'فشل في بدء التحضير')
      }
    } catch {
      toast.error('حدث خطأ أثناء بدء التحضير')
    } finally {
      setSubmitting(false)
    }
  }

  const handleInlineCancel = async (pickListId: string) => {
    try {
      const res = await fetch(`/api/inventory/pick-lists/${pickListId}?companyId=${companyId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId, action: 'cancel' }),
      })
      if (res.ok) {
        toast.success('تم إلغاء قائمة التحضير بنجاح')
        fetchPickLists()
      } else {
        const err = await res.json()
        toast.error(err.error || 'فشل في إلغاء قائمة التحضير')
      }
    } catch {
      toast.error('حدث خطأ أثناء إلغاء قائمة التحضير')
    }
  }

  // ─── Loading State ──────────────────────────────────────────────────────

  if (loading) {
    return (
      <Card className="border shadow-sm">
        <CardHeader>
          <div className="flex items-center justify-between">
            <Skeleton className="h-7 w-52" />
            <div className="flex gap-2">
              <Skeleton className="h-10 w-44" />
              <Skeleton className="h-10 w-52" />
            </div>
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
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-teal-50 flex items-center justify-center">
                <ClipboardCheck className="h-5 w-5 text-teal-600" />
              </div>
              <CardTitle className="text-lg">قوائم التحضير</CardTitle>
            </div>
            <div className="flex items-center gap-2">
              <Button
                onClick={() => {
                  resetCreateForm()
                  setCreateDialogOpen(true)
                }}
                className="bg-teal-600 hover:bg-teal-700 text-white gap-2"
              >
                <Plus className="h-4 w-4" />
                قائمة تحضير جديدة
              </Button>
              <Button
                onClick={handleGenerateFromPendingSales}
                disabled={submitting}
                variant="outline"
                className="gap-2 text-amber-700 border-amber-200 hover:bg-amber-50"
              >
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Zap className="h-4 w-4" />
                )}
                توليد من المبيعات المعلقة
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Table */}
          <div className="max-h-[calc(100vh-300px)] overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50/80 hover:bg-slate-50/80">
                  <TableHead className="text-right font-semibold">رقم القائمة</TableHead>
                  <TableHead className="text-right font-semibold">التاريخ</TableHead>
                  <TableHead className="text-right font-semibold">المخزن</TableHead>
                  <TableHead className="text-right font-semibold">عدد الأصناف</TableHead>
                  <TableHead className="text-right font-semibold">الحالة</TableHead>
                  <TableHead className="text-right font-semibold">إجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pickLists.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-12">
                      <div className="flex flex-col items-center text-slate-400">
                        <ClipboardCheck className="h-12 w-12 mb-3 text-slate-200" />
                        <p className="text-sm">لا توجد قوائم تحضير</p>
                        <p className="text-xs mt-1 text-slate-300">
                          اضغط على &quot;قائمة تحضير جديدة&quot; لإنشاء قائمة
                        </p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  pickLists.map((pl) => (
                    <TableRow key={pl.id} className="hover:bg-slate-50/50">
                      <TableCell className="font-mono text-sm font-medium">
                        {pl.number}
                      </TableCell>
                      <TableCell className="text-slate-500 text-sm whitespace-nowrap">
                        {formatDate(pl.date)}
                      </TableCell>
                      <TableCell className="text-sm">
                        <span className="text-slate-700">
                          {getWarehouseDisplayName(pl.warehouseId, pl.warehouse)}
                        </span>
                      </TableCell>
                      <TableCell className="text-center font-mono text-sm">
                        {pl._count?.lines ?? 0}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={statusBadgeStyles[pl.status] || 'bg-slate-50 text-slate-700'}
                        >
                          {statusLabels[pl.status] || pl.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-slate-500 hover:text-teal-600"
                            onClick={() => handleViewPickList(pl.id)}
                            title="عرض التفاصيل"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          {pl.status === 'DRAFT' && (
                            <>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-slate-500 hover:text-amber-600"
                                onClick={() => handleInlineStart(pl.id)}
                                title="بدء التحضير"
                                disabled={submitting}
                              >
                                <Play className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-slate-500 hover:text-red-600"
                                onClick={() => handleInlineCancel(pl.id)}
                                title="إلغاء"
                              >
                                <XCircle className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                          {pl.status === 'IN_PROGRESS' && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-slate-500 hover:text-red-600"
                              onClick={() => handleInlineCancel(pl.id)}
                              title="إلغاء"
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

      {/* ─── Create Pick List Dialog ──────────────────────────────────────── */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ClipboardCheck className="h-5 w-5 text-teal-600" />
              قائمة تحضير جديدة
            </DialogTitle>
            <DialogDescription>
              إنشاء قائمة تحضير جديدة للمخزن
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

          {/* Pick List Lines */}
          <div className="space-y-3 mt-2">
            <div className="flex items-center justify-between">
              <Label className="text-base font-semibold">أصناف التحضير</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddLine}
                className="gap-1 text-teal-600 border-teal-200 hover:bg-teal-50"
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
              className="bg-teal-600 hover:bg-teal-700 text-white gap-2"
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              إنشاء قائمة التحضير
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── View Pick List Dialog ───────────────────────────────────────── */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
          {viewLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
            </div>
          ) : selectedPickList ? (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <ClipboardCheck className="h-5 w-5 text-teal-600" />
                  قائمة تحضير {selectedPickList.number}
                </DialogTitle>
                <DialogDescription>
                  تفاصيل قائمة التحضير والإجراءات
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-2">
                {/* Pick List Info */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <p className="text-xs text-slate-500">المخزن</p>
                    <p className="text-sm font-medium text-slate-800">
                      {getWarehouseDisplayName(
                        selectedPickList.warehouseId,
                        selectedPickList.warehouse
                      )}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-slate-500">التاريخ</p>
                    <p className="text-sm font-medium text-slate-800">
                      {formatDate(selectedPickList.date)}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-slate-500">الحالة</p>
                    <Badge
                      variant="outline"
                      className={
                        statusBadgeStyles[selectedPickList.status] ||
                        'bg-slate-50 text-slate-700'
                      }
                    >
                      {statusLabels[selectedPickList.status] || selectedPickList.status}
                    </Badge>
                  </div>
                </div>

                {selectedPickList.notes && (
                  <div className="space-y-1">
                    <p className="text-xs text-slate-500">ملاحظات</p>
                    <p className="text-sm text-slate-700 bg-slate-50 p-3 rounded-lg">
                      {selectedPickList.notes}
                    </p>
                  </div>
                )}

                {/* Pick List Lines */}
                {editedLines.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm font-semibold text-slate-700">أصناف التحضير</p>
                    <div className="max-h-72 overflow-y-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-slate-50/80 hover:bg-slate-50/80">
                            <TableHead className="text-right font-semibold">الصنف</TableHead>
                            <TableHead className="text-right font-semibold">الكود</TableHead>
                            <TableHead className="text-right font-semibold">الكمية المطلوبة</TableHead>
                            <TableHead className="text-right font-semibold">الكمية المحضرة</TableHead>
                            <TableHead className="text-right font-semibold">الوحدة</TableHead>
                            <TableHead className="text-right font-semibold">ملاحظات</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {editedLines.map((line) => (
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
                              <TableCell>
                                {selectedPickList.status === 'IN_PROGRESS' ? (
                                  <Input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={line.pickedQty || ''}
                                    onChange={(e) =>
                                      handlePickedQtyChange(line.id, parseFloat(e.target.value) || 0)
                                    }
                                    dir="ltr"
                                    className="text-left h-8 w-24 font-mono text-sm"
                                    placeholder="0"
                                  />
                                ) : (
                                  <span className="font-mono" dir="ltr">
                                    {line.pickedQty.toLocaleString('ar-EG')}
                                  </span>
                                )}
                              </TableCell>
                              <TableCell className="text-slate-500 text-sm">
                                {line.item?.uom?.nameAr || '—'}
                              </TableCell>
                              <TableCell>
                                {selectedPickList.status === 'IN_PROGRESS' ? (
                                  <Input
                                    value={line.notes || ''}
                                    onChange={(e) =>
                                      handleLineNotesChange(line.id, e.target.value)
                                    }
                                    placeholder="ملاحظات..."
                                    className="h-8 text-sm"
                                  />
                                ) : (
                                  <span className="text-slate-500 text-sm">
                                    {line.notes || '—'}
                                  </span>
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
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
                {selectedPickList.status === 'DRAFT' && (
                  <>
                    <Button
                      onClick={handleStartPicking}
                      disabled={submitting}
                      className="bg-amber-600 hover:bg-amber-700 text-white gap-2"
                    >
                      {submitting ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Play className="h-4 w-4" />
                      )}
                      بدء التحضير
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={() => setCancelConfirmOpen(true)}
                      disabled={submitting}
                      className="gap-2"
                    >
                      <XCircle className="h-4 w-4" />
                      إلغاء القائمة
                    </Button>
                  </>
                )}
                {selectedPickList.status === 'IN_PROGRESS' && (
                  <>
                    <Button
                      onClick={handleUpdateLines}
                      disabled={submitting}
                      variant="outline"
                      className="gap-2 text-teal-600 border-teal-200 hover:bg-teal-50"
                    >
                      {submitting ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Save className="h-4 w-4" />
                      )}
                      حفظ بيانات التحضير
                    </Button>
                    <Button
                      onClick={handleCompletePicking}
                      disabled={submitting}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
                    >
                      {submitting ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <CheckCircle2 className="h-4 w-4" />
                      )}
                      إكمال التحضير
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={() => setCancelConfirmOpen(true)}
                      disabled={submitting}
                      className="gap-2"
                    >
                      <XCircle className="h-4 w-4" />
                      إلغاء القائمة
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
            <AlertDialogTitle>تأكيد إلغاء قائمة التحضير</AlertDialogTitle>
            <AlertDialogDescription>
              هل أنت متأكد من إلغاء قائمة التحضير{' '}
              <span className="font-mono font-semibold">{selectedPickList?.number}</span>؟
              {selectedPickList?.status === 'IN_PROGRESS' &&
                ' سيتم إلغاء قائمة التحضير أثناء العملية.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>تراجع</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCancelPickList}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              نعم، إلغاء القائمة
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
