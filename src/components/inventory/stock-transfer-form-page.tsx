'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { toast } from 'sonner'
import {
  ArrowRight,
  ArrowRightLeft,
  Plus,
  Loader2,
  CheckCircle2,
  XCircle,
  Trash2,
  Barcode,
  Warehouse as WarehouseIcon,
  Calendar,
  FileText,
  Package,
  ScanLine,
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
  parent?: {
    id: string
    nameAr: string
    type: string
    parent?: {
      id: string
      nameAr: string
      type: string
      parent?: { id: string; nameAr: string }
    }
  }
}

interface Item {
  id: string
  code: string
  nameAr?: string
  nameEn?: string
  codes?: { codeType: string; code: string; isPrimary: boolean }[]
  uom?: { nameAr: string } | null
}

interface StockTransferLine {
  id: string
  itemId: string
  quantity: number
  notes?: string | null
  item?: {
    id: string
    code: string
    nameAr?: string
    nameEn?: string
    uom?: { nameAr: string } | null
  }
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
  fromWarehouse: { id: string; code: string; nameAr: string; nameEn?: string; type?: string; parent?: Warehouse['parent'] }
  toWarehouse: { id: string; code: string; nameAr: string; nameEn?: string; type?: string; parent?: Warehouse['parent'] }
  lines?: StockTransferLine[]
}

interface TransferLineInput {
  itemId: string
  quantity: number
  notes?: string
}

// ─── Constants ────────────────────────────────────────────────────────────────

const WAREHOUSE_TYPE_LABELS: Record<string, string> = {
  WAREHOUSE: 'مخزن',
  ZONE: 'منطقة',
  RACK: 'راك',
  SHELF: 'رف',
  BOX: 'بوكس',
}

const WAREHOUSE_TYPE_COLORS: Record<string, string> = {
  WAREHOUSE: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  ZONE: 'bg-teal-50 text-teal-700 border-teal-200',
  RACK: 'bg-amber-50 text-amber-700 border-amber-200',
  SHELF: 'bg-purple-50 text-purple-700 border-purple-200',
  BOX: 'bg-rose-50 text-rose-700 border-rose-200',
}

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

function buildWarehouseDisplayName(wh: Warehouse | StockTransfer['fromWarehouse']): string {
  const parts: string[] = [wh.nameAr]
  let current = (wh as Warehouse).parent
  while (current) {
    parts.push(current.nameAr)
    current = (current as Warehouse['parent'])?.parent
  }
  return parts.reverse().join(' → ')
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function StockTransferFormPage() {
  const companyId = useAppStore((state) => state.currentCompanyId)
  const setView = useAppStore((state) => state.setView)
  const selectedTransferId = useAppStore((state) => state.selectedTransferId)
  const setSelectedTransferId = useAppStore((state) => state.setSelectedTransferId)

  // ── Data states ─────────────────────────────────────────────────────────────
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [items, setItems] = useState<Item[]>([])
  const [transfer, setTransfer] = useState<StockTransfer | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  // ── Create form states ──────────────────────────────────────────────────────
  const [form, setForm] = useState({
    fromWarehouseId: '',
    toWarehouseId: '',
    date: new Date().toISOString().split('T')[0],
    notes: '',
  })
  const [lines, setLines] = useState<TransferLineInput[]>([{ ...initialLineInput }])

  // ── Barcode scanning ────────────────────────────────────────────────────────
  const barcodeInputRef = useRef<HTMLInputElement>(null)
  const [barcodeValue, setBarcodeValue] = useState('')
  const [barcodeFlash, setBarcodeFlash] = useState(false)

  // ── Cancel confirmation ─────────────────────────────────────────────────────
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false)

  const isViewMode = !!selectedTransferId

  // ── Data Fetching ───────────────────────────────────────────────────────────

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

  const fetchTransfer = useCallback(async () => {
    if (!selectedTransferId || !companyId) return
    setLoading(true)
    try {
      const res = await fetch(
        `/api/inventory/stock-transfers/${selectedTransferId}?companyId=${companyId}`
      )
      if (res.ok) {
        const data = await res.json()
        setTransfer(data)
      } else {
        toast.error('فشل في تحميل تفاصيل التحويل')
        setSelectedTransferId(null)
        setView('stock-transfers')
      }
    } catch {
      toast.error('فشل في تحميل تفاصيل التحويل')
      setSelectedTransferId(null)
      setView('stock-transfers')
    } finally {
      setLoading(false)
    }
  }, [selectedTransferId, companyId, setSelectedTransferId, setView])

  useEffect(() => {
    if (!companyId) return
    if (isViewMode) {
      fetchTransfer()
    } else {
      // Create mode: load warehouses and items
      Promise.all([fetchWarehouses(), fetchItems()]).finally(() => setLoading(false))
    }
  }, [companyId, isViewMode, fetchTransfer, fetchWarehouses, fetchItems])

  // ── Navigation ──────────────────────────────────────────────────────────────

  const handleBack = () => {
    setSelectedTransferId(null)
    setView('stock-transfers')
  }

  // ── Warehouse display helper ────────────────────────────────────────────────

  const getWarehouseDisplayName = (
    warehouseId: string,
    whData?: { nameAr: string; nameEn?: string }
  ) => {
    const wh = warehouses.find((w) => w.id === warehouseId)
    if (wh) return buildWarehouseDisplayName(wh)
    return whData?.nameAr || warehouseId
  }

  // ── Line handlers ───────────────────────────────────────────────────────────

  const handleAddLine = () => {
    setLines((prev) => [...prev, { ...initialLineInput }])
  }

  const handleRemoveLine = (index: number) => {
    setLines((prev) => prev.filter((_, i) => i !== index))
  }

  const handleLineChange = (
    index: number,
    field: keyof TransferLineInput,
    value: string | number
  ) => {
    setLines((prev) =>
      prev.map((line, i) => (i === index ? { ...line, [field]: value } : line))
    )
  }

  // ── Barcode scanning handler ────────────────────────────────────────────────

  const handleBarcodeScan = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return
    if (!barcodeValue.trim()) return

    const scannedCode = barcodeValue.trim()

    // Search all items' codes for a matching code value
    const matchedItem = items.find((item) =>
      item.codes?.some((c) => c.code === scannedCode)
    )

    if (!matchedItem) {
      toast.error(`لم يتم العثور على صنف بالكود: ${scannedCode}`)
      setBarcodeValue('')
      barcodeInputRef.current?.focus()
      return
    }

    // Check if item already exists in lines
    const existingIndex = lines.findIndex((l) => l.itemId === matchedItem.id)

    if (existingIndex >= 0) {
      // Increment quantity
      setLines((prev) =>
        prev.map((line, i) =>
          i === existingIndex
            ? { ...line, quantity: line.quantity + 1 }
            : line
        )
      )
    } else {
      // Add new line with quantity 1
      setLines((prev) => [
        ...prev,
        { itemId: matchedItem.id, quantity: 1, notes: '' },
      ])
    }

    // Visual feedback - flash green border
    setBarcodeFlash(true)
    setTimeout(() => setBarcodeFlash(false), 600)

    toast.success(`تمت إضافة: ${matchedItem.nameAr || matchedItem.code}`)
    setBarcodeValue('')
    barcodeInputRef.current?.focus()
  }

  // ── Create transfer handler ─────────────────────────────────────────────────

  const handleCreateSubmit = async () => {
    if (!form.fromWarehouseId) {
      toast.error('يرجى اختيار المخزن المصدر')
      return
    }
    if (!form.toWarehouseId) {
      toast.error('يرجى اختيار المخزن الوجهة')
      return
    }
    if (form.fromWarehouseId === form.toWarehouseId) {
      toast.error('لا يمكن أن يكون المخزن المصدر والوجهة واحد')
      return
    }
    if (!form.date) {
      toast.error('يرجى تحديد التاريخ')
      return
    }

    const validLines = lines.filter((l) => l.itemId && l.quantity > 0)
    if (validLines.length === 0) {
      toast.error('يرجى إضافة سطر واحد على الأقل بصنف وكمية صحيحة')
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch(
        `/api/inventory/stock-transfers?companyId=${companyId}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            companyId,
            fromWarehouseId: form.fromWarehouseId,
            toWarehouseId: form.toWarehouseId,
            date: form.date,
            notes: form.notes,
            lines: validLines.map((l) => ({
              itemId: l.itemId,
              quantity: l.quantity,
              notes: l.notes || undefined,
            })),
          }),
        }
      )

      if (res.ok) {
        toast.success('تم إنشاء تحويل المخزون بنجاح')
        handleBack()
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

  // ── Confirm/Cancel transfer handlers ────────────────────────────────────────

  const handleConfirmTransfer = async () => {
    if (!transfer) return
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
        const updated = await res.json()
        setTransfer(updated)
        toast.success('تم تأكيد التحويل بنجاح')
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
    if (!transfer) return
    setSubmitting(true)
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
        const updated = await res.json()
        setTransfer(updated)
        toast.success('تم إلغاء التحويل بنجاح')
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

  // ── Get item display info ───────────────────────────────────────────────────

  const getItemDisplay = (itemId: string) => {
    const item = items.find((i) => i.id === itemId)
    return item
      ? { name: item.nameAr || item.nameEn || item.code, code: item.code, uom: item.uom }
      : null
  }

  // ─── Loading State ──────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="space-y-6">
        {/* Header skeleton */}
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-32" />
          <div className="space-y-2 flex-1">
            <Skeleton className="h-7 w-64" />
          </div>
        </div>
        {/* Form skeleton */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
        {/* Barcode skeleton */}
        <Skeleton className="h-16 rounded-xl" />
        {/* Lines skeleton */}
        <Skeleton className="h-48 rounded-xl" />
        {/* Buttons skeleton */}
        <div className="flex gap-3">
          <Skeleton className="h-10 w-40" />
          <Skeleton className="h-10 w-24" />
        </div>
      </div>
    )
  }

  // ─── VIEW MODE: Existing Transfer ──────────────────────────────────────────

  if (isViewMode) {
    if (!transfer) {
      return (
        <Card className="border shadow-sm">
          <CardContent className="py-20">
            <div className="flex flex-col items-center text-slate-400">
              <ArrowRightLeft className="h-16 w-16 mb-4 text-slate-200" />
              <p className="text-base font-medium">لم يتم العثور على التحويل</p>
              <Button
                onClick={handleBack}
                variant="outline"
                className="mt-4 gap-2"
              >
                <ArrowRight className="h-4 w-4" />
                العودة لتحويلات المخزون
              </Button>
            </div>
          </CardContent>
        </Card>
      )
    }

    const fromWh = warehouses.find((w) => w.id === transfer.fromWarehouseId)
    const toWh = warehouses.find((w) => w.id === transfer.toWarehouseId)

    return (
      <div className="space-y-6">
        {/* ═══ Back Button & Header ═══ */}
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            onClick={handleBack}
            className="gap-2 shrink-0"
          >
            <ArrowRight className="h-4 w-4" />
            العودة لتحويلات المخزون
          </Button>
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="h-10 w-10 rounded-xl bg-emerald-50 flex items-center justify-center shrink-0">
              <ArrowRightLeft className="h-5 w-5 text-emerald-600" />
            </div>
            <div className="flex items-center gap-3 min-w-0">
              <h1 className="text-xl font-bold text-slate-900 truncate">
                تحويل مخزون #{transfer.number}
              </h1>
              <Badge
                variant="outline"
                className={`shrink-0 ${statusBadgeStyles[transfer.status] || 'bg-slate-50 text-slate-700'}`}
              >
                {statusLabels[transfer.status] || transfer.status}
              </Badge>
            </div>
          </div>
        </div>

        {/* ═══ Transfer Info Cards ═══ */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* From Warehouse */}
          <Card className="border shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="h-7 w-7 rounded-lg bg-emerald-50 flex items-center justify-center">
                  <WarehouseIcon className="h-3.5 w-3.5 text-emerald-600" />
                </div>
                <span className="text-xs text-slate-400">من مخزن</span>
              </div>
              <p className="text-sm font-semibold text-slate-800 truncate">
                {fromWh
                  ? buildWarehouseDisplayName(fromWh)
                  : transfer.fromWarehouse.nameAr}
              </p>
              {fromWh && (
                <Badge
                  variant="outline"
                  className={`mt-1.5 text-[10px] ${WAREHOUSE_TYPE_COLORS[fromWh.type] || 'bg-slate-50 text-slate-600'}`}
                >
                  {WAREHOUSE_TYPE_LABELS[fromWh.type] || fromWh.type}
                </Badge>
              )}
            </CardContent>
          </Card>

          {/* To Warehouse */}
          <Card className="border shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="h-7 w-7 rounded-lg bg-teal-50 flex items-center justify-center">
                  <WarehouseIcon className="h-3.5 w-3.5 text-teal-600" />
                </div>
                <span className="text-xs text-slate-400">إلى مخزن</span>
              </div>
              <p className="text-sm font-semibold text-slate-800 truncate">
                {toWh
                  ? buildWarehouseDisplayName(toWh)
                  : transfer.toWarehouse.nameAr}
              </p>
              {toWh && (
                <Badge
                  variant="outline"
                  className={`mt-1.5 text-[10px] ${WAREHOUSE_TYPE_COLORS[toWh.type] || 'bg-slate-50 text-slate-600'}`}
                >
                  {WAREHOUSE_TYPE_LABELS[toWh.type] || toWh.type}
                </Badge>
              )}
            </CardContent>
          </Card>

          {/* Date */}
          <Card className="border shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="h-7 w-7 rounded-lg bg-amber-50 flex items-center justify-center">
                  <Calendar className="h-3.5 w-3.5 text-amber-600" />
                </div>
                <span className="text-xs text-slate-400">التاريخ</span>
              </div>
              <p className="text-sm font-semibold text-slate-800">
                {formatDate(transfer.date)}
              </p>
            </CardContent>
          </Card>

          {/* Status */}
          <Card className="border shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="h-7 w-7 rounded-lg bg-slate-50 flex items-center justify-center">
                  <FileText className="h-3.5 w-3.5 text-slate-500" />
                </div>
                <span className="text-xs text-slate-400">الحالة</span>
              </div>
              <Badge
                variant="outline"
                className={`text-sm ${statusBadgeStyles[transfer.status] || 'bg-slate-50 text-slate-700'}`}
              >
                {statusLabels[transfer.status] || transfer.status}
              </Badge>
            </CardContent>
          </Card>
        </div>

        {/* ═══ Notes ═══ */}
        {transfer.notes && (
          <Card className="border shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="h-7 w-7 rounded-lg bg-slate-50 flex items-center justify-center">
                  <FileText className="h-3.5 w-3.5 text-slate-400" />
                </div>
                <span className="text-xs text-slate-400">ملاحظات</span>
              </div>
              <p className="text-sm text-slate-700 bg-slate-50 p-3 rounded-lg">
                {transfer.notes}
              </p>
            </CardContent>
          </Card>
        )}

        {/* ═══ Transfer Lines Table ═══ */}
        <Card className="border shadow-sm">
          <CardHeader>
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-emerald-50 flex items-center justify-center">
                <Package className="h-4 w-4 text-emerald-600" />
              </div>
              <CardTitle className="text-base">الأصناف المحولة</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {!transfer.lines || transfer.lines.length === 0 ? (
              <div className="flex flex-col items-center py-10 text-slate-400">
                <Package className="h-12 w-12 mb-3 text-slate-200" />
                <p className="text-sm">لا توجد أصناف في هذا التحويل</p>
              </div>
            ) : (
              <div className="max-h-96 overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50/80 hover:bg-slate-50/80">
                      <TableHead className="text-right font-semibold">#</TableHead>
                      <TableHead className="text-right font-semibold">الصنف</TableHead>
                      <TableHead className="text-right font-semibold">الكود</TableHead>
                      <TableHead className="text-right font-semibold">الكمية</TableHead>
                      <TableHead className="text-right font-semibold">وحدة القياس</TableHead>
                      <TableHead className="text-right font-semibold">ملاحظات</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {transfer.lines.map((line, idx) => (
                      <TableRow key={line.id}>
                        <TableCell className="text-slate-400 font-mono text-xs">
                          {idx + 1}
                        </TableCell>
                        <TableCell className="font-medium">
                          {line.item?.nameAr || line.item?.nameEn || '—'}
                        </TableCell>
                        <TableCell className="font-mono text-sm text-slate-500">
                          {line.item?.code || '—'}
                        </TableCell>
                        <TableCell className="font-mono" dir="ltr">
                          {line.quantity.toLocaleString('ar-EG')}
                        </TableCell>
                        <TableCell className="text-sm text-slate-500">
                          {line.item?.uom?.nameAr || '—'}
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
          </CardContent>
        </Card>

        {/* ═══ Action Buttons ═══ */}
        {transfer.status === 'DRAFT' && (
          <div className="flex items-center gap-3">
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
          </div>
        )}
        {transfer.status === 'CONFIRMED' && (
          <div className="flex items-center gap-3">
            <Button
              variant="destructive"
              onClick={() => setCancelConfirmOpen(true)}
              disabled={submitting}
              className="gap-2"
            >
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <XCircle className="h-4 w-4" />
              )}
              إلغاء التحويل (عكس الحركات)
            </Button>
          </div>
        )}

        {/* ═══ Cancel Confirmation Dialog ═══ */}
        <AlertDialog open={cancelConfirmOpen} onOpenChange={setCancelConfirmOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>تأكيد إلغاء التحويل</AlertDialogTitle>
              <AlertDialogDescription>
                {transfer?.status === 'CONFIRMED'
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
      </div>
    )
  }

  // ─── CREATE MODE: New Transfer Form ────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* ═══ Back Button & Header ═══ */}
      <div className="flex items-center gap-4">
        <Button
          variant="outline"
          onClick={handleBack}
          className="gap-2 shrink-0"
        >
          <ArrowRight className="h-4 w-4" />
          العودة لتحويلات المخزون
        </Button>
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-emerald-50 flex items-center justify-center">
            <ArrowRightLeft className="h-5 w-5 text-emerald-600" />
          </div>
          <h1 className="text-xl font-bold text-slate-900">
            تحويل مخزون جديد
          </h1>
        </div>
      </div>

      {/* ═══ Form Grid ═══ */}
      <Card className="border shadow-sm">
        <CardHeader>
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-emerald-50 flex items-center justify-center">
              <FileText className="h-4 w-4 text-emerald-600" />
            </div>
            <CardTitle className="text-base">بيانات التحويل</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {/* From Warehouse */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">
                من مخزن <span className="text-red-500">*</span>
              </Label>
              <Select
                value={form.fromWarehouseId}
                onValueChange={(val) =>
                  setForm((p) => ({ ...p, fromWarehouseId: val }))
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="اختر المخزن المصدر" />
                </SelectTrigger>
                <SelectContent>
                  {warehouses.length === 0 ? (
                    <div className="px-2 py-4 text-center text-sm text-slate-400">
                      لا توجد مخازن
                    </div>
                  ) : (
                    warehouses.map((wh) => (
                      <SelectItem key={wh.id} value={wh.id}>
                        <div className="flex items-center gap-2">
                          <Badge
                            variant="outline"
                            className={`text-[9px] px-1 py-0 ${WAREHOUSE_TYPE_COLORS[wh.type] || 'bg-slate-50 text-slate-600'}`}
                          >
                            {WAREHOUSE_TYPE_LABELS[wh.type] || wh.type}
                          </Badge>
                          <span className="truncate">
                            {buildWarehouseDisplayName(wh)}
                          </span>
                        </div>
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              {form.fromWarehouseId && (
                <div className="text-xs text-slate-400 bg-slate-50 px-2 py-1 rounded">
                  {(() => {
                    const wh = warehouses.find((w) => w.id === form.fromWarehouseId)
                    return wh ? buildWarehouseDisplayName(wh) : ''
                  })()}
                </div>
              )}
            </div>

            {/* To Warehouse */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">
                إلى مخزن <span className="text-red-500">*</span>
              </Label>
              <Select
                value={form.toWarehouseId}
                onValueChange={(val) =>
                  setForm((p) => ({ ...p, toWarehouseId: val }))
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="اختر المخزن الوجهة" />
                </SelectTrigger>
                <SelectContent>
                  {warehouses.length === 0 ? (
                    <div className="px-2 py-4 text-center text-sm text-slate-400">
                      لا توجد مخازن
                    </div>
                  ) : (
                    warehouses.map((wh) => (
                      <SelectItem key={wh.id} value={wh.id}>
                        <div className="flex items-center gap-2">
                          <Badge
                            variant="outline"
                            className={`text-[9px] px-1 py-0 ${WAREHOUSE_TYPE_COLORS[wh.type] || 'bg-slate-50 text-slate-600'}`}
                          >
                            {WAREHOUSE_TYPE_LABELS[wh.type] || wh.type}
                          </Badge>
                          <span className="truncate">
                            {buildWarehouseDisplayName(wh)}
                          </span>
                        </div>
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              {form.toWarehouseId && (
                <div className="text-xs text-slate-400 bg-slate-50 px-2 py-1 rounded">
                  {(() => {
                    const wh = warehouses.find((w) => w.id === form.toWarehouseId)
                    return wh ? buildWarehouseDisplayName(wh) : ''
                  })()}
                </div>
              )}
            </div>

            {/* Date */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">
                التاريخ <span className="text-red-500">*</span>
              </Label>
              <Input
                type="date"
                value={form.date}
                onChange={(e) =>
                  setForm((p) => ({ ...p, date: e.target.value }))
                }
                dir="ltr"
                className="text-left"
              />
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">ملاحظات</Label>
              <Textarea
                value={form.notes}
                onChange={(e) =>
                  setForm((p) => ({ ...p, notes: e.target.value }))
                }
                placeholder="ملاحظات اختيارية..."
                rows={1}
                className="resize-none"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ═══ Barcode Scan Section ═══ */}
      <Card className="border shadow-sm">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div
              className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 transition-colors duration-300 ${
                barcodeFlash
                  ? 'bg-emerald-100'
                  : 'bg-emerald-50'
              }`}
            >
              <Barcode
                className={`h-5 w-5 transition-colors duration-300 ${
                  barcodeFlash ? 'text-emerald-700' : 'text-emerald-600'
                }`}
              />
            </div>
            <div className="flex-1">
              <Input
                ref={barcodeInputRef}
                value={barcodeValue}
                onChange={(e) => setBarcodeValue(e.target.value)}
                onKeyDown={handleBarcodeScan}
                placeholder="امسح الباركود أو اكتب الكود..."
                className={`h-10 font-mono transition-all duration-300 ${
                  barcodeFlash
                    ? 'border-emerald-400 ring-2 ring-emerald-200'
                    : 'border-slate-200'
                }`}
                dir="ltr"
              />
            </div>
          </div>
          <p className="text-xs text-slate-400 mt-2 flex items-center gap-1.5">
            <ScanLine className="h-3 w-3" />
            امسح الباركود لإضافة صنف تلقائياً
          </p>
        </CardContent>
      </Card>

      {/* ═══ Transfer Lines Section ═══ */}
      <Card className="border shadow-sm">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-emerald-50 flex items-center justify-center">
                <Package className="h-4 w-4 text-emerald-600" />
              </div>
              <CardTitle className="text-base">أصناف التحويل</CardTitle>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleAddLine}
              className="gap-1.5 text-emerald-600 border-emerald-200 hover:bg-emerald-50"
            >
              <Plus className="h-3.5 w-3.5" />
              إضافة صنف
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {items.length === 0 ? (
            <div className="flex flex-col items-center py-10 text-slate-400">
              <Package className="h-12 w-12 mb-3 text-slate-200" />
              <p className="text-sm">لا توجد أصناف متاحة</p>
              <p className="text-xs mt-1 text-slate-300">
                يرجى إضافة أصناف أولاً قبل إنشاء تحويل
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Header labels */}
              <div className="hidden sm:grid sm:grid-cols-[1fr_120px_1fr_36px] gap-2 items-center px-1">
                <span className="text-xs font-medium text-slate-400">الصنف</span>
                <span className="text-xs font-medium text-slate-400">الكمية</span>
                <span className="text-xs font-medium text-slate-400">ملاحظات</span>
                <span />
              </div>

              {/* Lines */}
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {lines.map((line, index) => {
                  const itemInfo = getItemDisplay(line.itemId)
                  return (
                    <div
                      key={index}
                      className="grid grid-cols-1 sm:grid-cols-[1fr_120px_1fr_36px] gap-2 items-center p-3 bg-slate-50/50 rounded-lg border border-slate-100"
                    >
                      {/* Item selector */}
                      <div className="space-y-1">
                        <Label className="text-xs text-slate-400 sm:hidden">الصنف</Label>
                        <Select
                          value={line.itemId}
                          onValueChange={(val) =>
                            handleLineChange(index, 'itemId', val)
                          }
                        >
                          <SelectTrigger className="w-full h-9">
                            <SelectValue placeholder="اختر الصنف" />
                          </SelectTrigger>
                          <SelectContent>
                            {items.map((item) => (
                              <SelectItem key={item.id} value={item.id}>
                                <span className="truncate">
                                  {item.nameAr || item.nameEn || item.code}
                                </span>
                                <span className="text-slate-400 mr-1 font-mono text-xs">
                                  ({item.code})
                                </span>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Quantity */}
                      <div className="space-y-1">
                        <Label className="text-xs text-slate-400 sm:hidden">الكمية</Label>
                        <div className="flex items-center gap-1">
                          <Input
                            type="number"
                            min="0.01"
                            step="0.01"
                            value={line.quantity || ''}
                            onChange={(e) =>
                              handleLineChange(
                                index,
                                'quantity',
                                parseFloat(e.target.value) || 0
                              )
                            }
                            placeholder="0"
                            dir="ltr"
                            className="text-left h-9"
                          />
                          {itemInfo?.uom && (
                            <span className="text-xs text-slate-400 whitespace-nowrap shrink-0">
                              {itemInfo.uom.nameAr}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Notes */}
                      <div className="space-y-1">
                        <Label className="text-xs text-slate-400 sm:hidden">ملاحظات</Label>
                        <Input
                          value={line.notes || ''}
                          onChange={(e) =>
                            handleLineChange(index, 'notes', e.target.value)
                          }
                          placeholder="ملاحظات..."
                          className="h-9"
                        />
                      </div>

                      {/* Delete */}
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 text-red-400 hover:text-red-600 justify-self-center"
                        onClick={() => handleRemoveLine(index)}
                        disabled={lines.length === 1}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  )
                })}
              </div>

              {/* Lines summary */}
              {lines.filter((l) => l.itemId && l.quantity > 0).length > 0 && (
                <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                  <span className="text-sm text-slate-500">
                    إجمالي الأصناف:{' '}
                    <span className="font-semibold text-slate-700">
                      {lines.filter((l) => l.itemId && l.quantity > 0).length}
                    </span>
                  </span>
                  <span className="text-sm text-slate-500">
                    إجمالي الكمية:{' '}
                    <span className="font-semibold text-emerald-700" dir="ltr">
                      {lines
                        .filter((l) => l.itemId && l.quantity > 0)
                        .reduce((sum, l) => sum + l.quantity, 0)
                        .toLocaleString('ar-EG')}
                    </span>
                  </span>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ═══ Submit Buttons ═══ */}
      <div className="flex items-center gap-3">
        <Button
          onClick={handleCreateSubmit}
          disabled={submitting}
          className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
        >
          {submitting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <ArrowRightLeft className="h-4 w-4" />
          )}
          إنشاء التحويل
        </Button>
        <Button
          variant="outline"
          onClick={handleBack}
          disabled={submitting}
        >
          إلغاء
        </Button>
      </div>
    </div>
  )
}
