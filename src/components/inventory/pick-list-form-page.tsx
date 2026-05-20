'use client'

import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import {
  Save, Send, Loader2, ClipboardCheck, Plus, XCircle,
  ScanLine, Search, Package, FileText,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useAppStore } from '@/lib/store'
import DocumentPageHeader, { getDocumentStatusBadge } from '@/components/shared/document-page-header'
import { DocumentSection } from '@/components/shared/document-section'
import WorkflowStepper from '@/components/shared/workflow-stepper'

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

interface PickListDetail {
  id: string
  number: string
  date: string
  status: string
  warehouseId: string
  notes: string | null
  warehouse?: { id: string; code: string; nameAr: string; nameEn?: string }
  lines: PickListLine[]
}

interface LineInput {
  itemId: string
  quantity: string
  notes: string
}

interface PickedLineInput {
  id: string
  pickedQty: string
  notes: string
}

const emptyLine: LineInput = {
  itemId: '',
  quantity: '1',
  notes: '',
}

// ─── Helper ───────────────────────────────────────────────────────────────────

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

export default function PickListFormPage() {
  const companyId = useAppStore(state => state.currentCompanyId)
  const setModule = useAppStore(state => state.setModule)
  const setView = useAppStore(state => state.setView)
  const editingDocId = useAppStore(state => state.editingDocId)

  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [items, setItems] = useState<Item[]>([])
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // Form state
  const [listWarehouseId, setListWarehouseId] = useState('')
  const [listDate, setListDate] = useState(new Date().toISOString().split('T')[0])
  const [listNotes, setListNotes] = useState('')
  const [listLines, setListLines] = useState<LineInput[]>([{ ...emptyLine }])
  const [currentStatus, setCurrentStatus] = useState<string>('DRAFT')
  const [listNumber, setListNumber] = useState<string>('')
  const [listId, setListId] = useState<string>('')

  // For IN_PROGRESS picked qty editing
  const [pickedLines, setPickedLines] = useState<PickedLineInput[]>([])

  // Barcode & search
  const [barcodeInput, setBarcodeInput] = useState('')
  const [searchQuery, setSearchQuery] = useState('')

  // Load data
  useEffect(() => {
    fetchWarehouses()
    fetchItems()
    if (editingDocId && editingDocId !== 'new') {
      loadPickList(editingDocId)
    }
  }, [])

  const loadPickList = async (id: string) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/inventory/pick-lists/${id}?companyId=${companyId}`)
      if (res.ok) {
        const pl: PickListDetail = await res.json()
        setListId(pl.id)
        setListNumber(pl.number)
        setCurrentStatus(pl.status)
        setListWarehouseId(pl.warehouseId)
        setListDate(pl.date.split('T')[0])
        setListNotes(pl.notes || '')
        setListLines(pl.lines.map(l => ({
          itemId: l.itemId,
          quantity: String(l.quantity),
          notes: l.notes || '',
        })))
        setPickedLines(pl.lines.map(l => ({
          id: l.id,
          pickedQty: String(l.pickedQty),
          notes: l.notes || '',
        })))
      }
    } catch {
      toast.error('فشل في تحميل بيانات قائمة التحضير')
    } finally {
      setLoading(false)
    }
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

  const handleGoBack = () => {
    setModule('inventory')
    setView('pick-lists')
  }

  // ── Line handlers ──

  const updateLine = (index: number, field: keyof LineInput, value: string) => {
    setListLines((prev) => {
      const updated = [...prev]
      updated[index] = { ...updated[index], [field]: value }
      return updated
    })
  }

  const addLine = () => {
    setListLines((prev) => [...prev, { ...emptyLine }])
  }

  const removeLine = (index: number) => {
    if (listLines.length <= 1) return
    setListLines((prev) => prev.filter((_, i) => i !== index))
  }

  // ── Picked qty handlers (for IN_PROGRESS status) ──

  const updatePickedLine = (index: number, field: keyof PickedLineInput, value: string) => {
    setPickedLines((prev) => {
      const updated = [...prev]
      updated[index] = { ...updated[index], [field]: value }
      return updated
    })
  }

  // ── Barcode scanning ──

  const handleBarcodeScan = async (e: React.KeyboardEvent) => {
    if (e.key !== 'Enter' || !barcodeInput.trim()) return
    try {
      const res = await fetch(`/api/inventory/item-codes?companyId=${companyId}&code=${encodeURIComponent(barcodeInput.trim())}`)
      if (res.ok) {
        const data = await res.json()
        if (data.itemId) {
          handleAddItemById(data.itemId)
          setBarcodeInput('')
          toast.success('تم إضافة الصنف')
        } else {
          toast.error('لم يتم العثور على صنف بهذا الباركود')
        }
      }
    } catch {
      toast.error('حدث خطأ في البحث')
    }
  }

  const handleAddItemById = (itemId: string) => {
    const existing = listLines.findIndex(l => l.itemId === itemId)
    if (existing >= 0) {
      updateLine(existing, 'quantity', String(parseFloat(listLines[existing].quantity) + 1))
    } else {
      setListLines(prev => [...prev, { itemId, quantity: '1', notes: '' }])
    }
  }

  // ── Search filtering ──

  const filteredItems = searchQuery.trim()
    ? items.filter(it =>
        (it.nameAr && it.nameAr.includes(searchQuery)) ||
        (it.nameEn && it.nameEn.toLowerCase().includes(searchQuery.toLowerCase())) ||
        it.code.includes(searchQuery)
      )
    : []

  // ── Save Draft ──

  const handleSaveDraft = async () => {
    if (!listWarehouseId) {
      toast.error('يرجى اختيار المخزن')
      return
    }
    if (!listDate) {
      toast.error('يرجى تحديد التاريخ')
      return
    }
    const validLines = listLines.filter(l => l.itemId && parseFloat(l.quantity) > 0)
    if (validLines.length === 0) {
      toast.error('يجب إضافة سطر واحد على الأقل')
      return
    }

    setSubmitting(true)
    try {
      const payload = {
        warehouseId: listWarehouseId,
        date: listDate,
        notes: listNotes || undefined,
        lines: validLines.map(l => ({
          itemId: l.itemId,
          quantity: parseFloat(l.quantity),
          notes: l.notes || undefined,
        })),
        companyId,
      }

      let res
      if (listId) {
        res = await fetch(`/api/inventory/pick-lists/${listId}?companyId=${companyId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...payload, action: 'update' }),
        })
      } else {
        res = await fetch(`/api/inventory/pick-lists?companyId=${companyId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
      }

      if (res.ok) {
        const data = await res.json()
        setListId(data.id)
        setListNumber(data.number)
        setCurrentStatus('DRAFT')
        toast.success('تم حفظ قائمة التحضير كمسودة')
      } else {
        const err = await res.json()
        toast.error(err.error || 'فشل في حفظ قائمة التحضير')
      }
    } catch {
      toast.error('حدث خطأ أثناء حفظ قائمة التحضير')
    } finally {
      setSubmitting(false)
    }
  }

  // ── Submit (Start picking / Confirm) ──

  const handleSubmit = async () => {
    if (!listWarehouseId) {
      toast.error('يرجى اختيار المخزن')
      return
    }
    if (!listDate) {
      toast.error('يرجى تحديد التاريخ')
      return
    }
    const validLines = listLines.filter(l => l.itemId && parseFloat(l.quantity) > 0)
    if (validLines.length === 0) {
      toast.error('يجب إضافة سطر واحد على الأقل')
      return
    }

    setSubmitting(true)
    try {
      if (!listId) {
        const payload = {
          warehouseId: listWarehouseId,
          date: listDate,
          notes: listNotes || undefined,
          lines: validLines.map(l => ({
            itemId: l.itemId,
            quantity: parseFloat(l.quantity),
            notes: l.notes || undefined,
          })),
          companyId,
        }
        const res = await fetch(`/api/inventory/pick-lists?companyId=${companyId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        if (res.ok) {
          const data = await res.json()
          setListId(data.id)
          setListNumber(data.number)
          await startPicking(data.id)
        } else {
          const err = await res.json()
          toast.error(err.error || 'فشل في حفظ قائمة التحضير')
        }
      } else {
        await startPicking(listId)
      }
    } catch {
      toast.error('حدث خطأ أثناء تأكيد قائمة التحضير')
    } finally {
      setSubmitting(false)
    }
  }

  const startPicking = async (id: string) => {
    try {
      const res = await fetch(`/api/inventory/pick-lists/${id}?companyId=${companyId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'start', companyId }),
      })
      if (res.ok) {
        setCurrentStatus('IN_PROGRESS')
        toast.success('تم بدء التحضير بنجاح')
      } else {
        const err = await res.json()
        toast.error(err.error || 'فشل في بدء التحضير')
      }
    } catch {
      toast.error('حدث خطأ أثناء بدء التحضير')
    }
  }

  // ── Update picked lines ──

  const handleUpdatePickedLines = async () => {
    if (!listId) return
    setSubmitting(true)
    try {
      const res = await fetch(`/api/inventory/pick-lists/${listId}?companyId=${companyId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'updateLines',
          companyId,
          lines: pickedLines.map(l => ({
            id: l.id,
            pickedQty: parseFloat(l.pickedQty) || 0,
            notes: l.notes,
          })),
        }),
      })
      if (res.ok) {
        toast.success('تم تحديث بيانات التحضير بنجاح')
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

  // ── Complete picking ──

  const handleCompletePicking = async () => {
    if (!listId) return
    setSubmitting(true)
    try {
      const res = await fetch(`/api/inventory/pick-lists/${listId}?companyId=${companyId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'complete', companyId }),
      })
      if (res.ok) {
        setCurrentStatus('COMPLETED')
        toast.success('تم إكمال التحضير بنجاح')
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

  const isEditable = currentStatus === 'DRAFT' || currentStatus === 'NEW'
  const isInProgress = currentStatus === 'IN_PROGRESS'

  // ── Workflow stepper ──

  const workflowSteps = (() => {
    const steps = [
      { label: 'قائمة التحضير', status: 'upcoming' as const },
      { label: 'تحضير', status: 'upcoming' as const },
      { label: 'اكتمال', status: 'upcoming' as const },
    ]
    switch (currentStatus) {
      case 'DRAFT':
      case 'NEW':
        steps[0].status = 'current'
        break
      case 'IN_PROGRESS':
        steps[0].status = 'completed'
        steps[1].status = 'current'
        break
      case 'COMPLETED':
        steps[0].status = 'completed'
        steps[1].status = 'completed'
        steps[2].status = 'completed'
        break
      case 'CANCELLED':
        steps[0].status = 'current'
        break
      default:
        steps[0].status = 'current'
    }
    return steps
  })()

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* ── Page Header ── */}
      <DocumentPageHeader
        icon={ClipboardCheck}
        iconBg="bg-teal-50"
        iconColor="text-teal-600"
        newTitle="قائمة تحضير جديدة"
        editTitlePrefix="قائمة تحضير"
        documentNumber={listNumber || undefined}
        status={currentStatus}
        subtitle={listId ? 'تعديل أو بدء تحضير القائمة' : 'إنشاء قائمة تحضير جديدة للمخزن'}
        onGoBack={handleGoBack}
        primaryActions={
          isEditable
            ? [
                {
                  label: 'حفظ كمسودة',
                  icon: Save,
                  onClick: handleSaveDraft,
                  disabled: submitting,
                  loading: submitting,
                  className: 'border-teal-200 text-teal-700 hover:bg-teal-50',
                },
                {
                  label: 'تأكيد',
                  icon: Send,
                  onClick: handleSubmit,
                  disabled: submitting,
                  loading: submitting,
                  className: 'bg-teal-600 hover:bg-teal-700 text-white',
                },
              ]
            : isInProgress
            ? [
                {
                  label: 'حفظ بيانات التحضير',
                  icon: Save,
                  onClick: handleUpdatePickedLines,
                  disabled: submitting,
                  loading: submitting,
                  className: 'border-teal-200 text-teal-700 hover:bg-teal-50',
                },
                {
                  label: 'إكمال التحضير',
                  icon: ClipboardCheck,
                  onClick: handleCompletePicking,
                  disabled: submitting,
                  loading: submitting,
                  className: 'bg-emerald-600 hover:bg-emerald-700 text-white',
                },
              ]
            : undefined
        }
      />

      {/* ── Workflow Stepper ── */}
      <div className="bg-white border rounded-xl px-5 py-3 shadow-sm">
        <WorkflowStepper steps={workflowSteps} />
      </div>

      {/* ── Pick List Info Section ── */}
      <DocumentSection
        title="بيانات قائمة التحضير"
        icon={ClipboardCheck}
        iconColor="text-teal-600"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>المخزن <span className="text-red-500">*</span></Label>
            <Select
              value={listWarehouseId}
              onValueChange={setListWarehouseId}
              disabled={!isEditable}
            >
              <SelectTrigger>
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

          <div className="space-y-2">
            <Label>التاريخ</Label>
            <Input
              type="date"
              value={listDate}
              onChange={(e) => setListDate(e.target.value)}
              disabled={!isEditable}
              dir="ltr"
            />
          </div>
        </div>
      </DocumentSection>

      {/* ── Lines Section ── */}
      <DocumentSection
        title="بنود قائمة التحضير"
        icon={Package}
        iconColor="text-teal-600"
        action={
          isEditable ? (
            <Button
              variant="outline"
              size="sm"
              onClick={addLine}
              className="gap-1.5 text-teal-600 border-teal-200 hover:bg-teal-50"
            >
              <Plus className="h-3.5 w-3.5" />
              إضافة سطر
            </Button>
          ) : undefined
        }
        noPadding
      >
        <div className="space-y-0">
          {/* Barcode & Search Area */}
          {isEditable && (
            <div className="flex flex-col sm:flex-row gap-2 px-5 pt-4 pb-3 bg-slate-50/60 border-b">
              <div className="flex-1 relative">
                <ScanLine className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="مسح الباركود..."
                  value={barcodeInput}
                  onChange={(e) => setBarcodeInput(e.target.value)}
                  onKeyDown={handleBarcodeScan}
                  className="pr-10 h-9 bg-white"
                  dir="ltr"
                />
              </div>
              <div className="flex-1 relative">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="بحث بالاسم أو الكود..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pr-10 h-9 bg-white"
                />
                {searchQuery && filteredItems.length > 0 && (
                  <div className="absolute top-full right-0 left-0 bg-white border rounded-lg shadow-lg z-50 max-h-40 overflow-y-auto mt-1">
                    {filteredItems.map((item) => (
                      <button
                        key={item.id}
                        onClick={() => {
                          handleAddItemById(item.id)
                          setSearchQuery('')
                        }}
                        className="w-full text-right px-3 py-2 text-sm hover:bg-teal-50 border-b last:border-0 transition-colors"
                      >
                        <span className="font-medium">{item.nameAr || item.nameEn || item.code}</span>
                        <span className="text-slate-400 mr-2 font-mono text-xs">({item.code})</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {isInProgress && pickedLines.length > 0 ? (
            // IN_PROGRESS mode: show editable pickedQty
            <>
              {/* Header row */}
              <div className="grid grid-cols-12 gap-2 px-5 py-2.5 bg-slate-50 border-b">
                <div className="col-span-3 text-xs font-semibold text-slate-500">الصنف</div>
                <div className="col-span-2 text-xs font-semibold text-slate-500">الكمية المطلوبة</div>
                <div className="col-span-2 text-xs font-semibold text-slate-500">الكمية المحضرة</div>
                <div className="col-span-4 text-xs font-semibold text-slate-500">ملاحظات</div>
                <div className="col-span-1"></div>
              </div>

              {/* Picked line items with alternating row backgrounds */}
              {listLines.map((line, idx) => {
                const item = items.find(i => i.id === line.itemId)
                const pickedLine = pickedLines[idx]
                return (
                  <div
                    key={idx}
                    className={`grid grid-cols-12 gap-2 items-center px-5 py-2.5 border-b last:border-b-0 ${
                      idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'
                    }`}
                  >
                    <div className="col-span-3">
                      <span className="text-sm">
                        {item ? `${item.nameAr || item.nameEn || item.code} (${item.code})` : line.itemId}
                      </span>
                    </div>
                    <div className="col-span-2">
                      <Input
                        type="number"
                        value={line.quantity}
                        className="h-9 text-sm"
                        dir="ltr"
                        disabled
                      />
                    </div>
                    <div className="col-span-2">
                      {pickedLine && (
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={pickedLine.pickedQty}
                          onChange={(e) => updatePickedLine(idx, 'pickedQty', e.target.value)}
                          className="h-9 text-sm"
                          dir="ltr"
                          placeholder="0"
                        />
                      )}
                    </div>
                    <div className="col-span-4">
                      {pickedLine && (
                        <Input
                          value={pickedLine.notes}
                          onChange={(e) => updatePickedLine(idx, 'notes', e.target.value)}
                          placeholder="ملاحظات..."
                          className="h-9 text-sm"
                        />
                      )}
                    </div>
                    <div className="col-span-1"></div>
                  </div>
                )
              })}
            </>
          ) : (
            // DRAFT or read-only mode
            <>
              {/* Header row */}
              <div className="grid grid-cols-12 gap-2 px-5 py-2.5 bg-slate-50 border-b">
                <div className="col-span-4 text-xs font-semibold text-slate-500">الصنف</div>
                <div className="col-span-2 text-xs font-semibold text-slate-500">الكمية</div>
                <div className="col-span-5 text-xs font-semibold text-slate-500">ملاحظات</div>
                <div className="col-span-1"></div>
              </div>

              {/* Line items with alternating row backgrounds */}
              {listLines.map((line, idx) => (
                <div
                  key={idx}
                  className={`grid grid-cols-12 gap-2 items-center px-5 py-2.5 border-b last:border-b-0 ${
                    idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'
                  }`}
                >
                  <div className="col-span-4">
                    <Select
                      value={line.itemId}
                      onValueChange={(val) => updateLine(idx, 'itemId', val)}
                      disabled={!isEditable}
                    >
                      <SelectTrigger className="h-9 text-sm">
                        <SelectValue placeholder="اختر الصنف" />
                      </SelectTrigger>
                      <SelectContent>
                        {items.map((it) => (
                          <SelectItem key={it.id} value={it.id}>
                            {it.nameAr || it.nameEn || it.code} ({it.code})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-2">
                    <Input
                      type="number"
                      min="0"
                      step="1"
                      value={line.quantity}
                      onChange={(e) => updateLine(idx, 'quantity', e.target.value)}
                      className="h-9 text-sm"
                      dir="ltr"
                      disabled={!isEditable}
                    />
                  </div>
                  <div className="col-span-5">
                    <Input
                      value={line.notes}
                      onChange={(e) => updateLine(idx, 'notes', e.target.value)}
                      placeholder="ملاحظات..."
                      className="h-9 text-sm"
                      disabled={!isEditable}
                    />
                  </div>
                  <div className="col-span-1 flex items-center justify-center">
                    {isEditable && listLines.length > 1 && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeLine(idx)}
                        className="h-7 w-7 text-red-400 hover:text-red-600 hover:bg-red-50"
                      >
                        <XCircle className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}

              {/* Empty state */}
              {listLines.length === 0 && (
                <div className="px-5 py-8 text-center text-sm text-slate-400">
                  لم يتم إضافة بنود بعد
                </div>
              )}
            </>
          )}
        </div>
      </DocumentSection>

      {/* ── Notes Section ── */}
      <DocumentSection
        title="ملاحظات إضافية"
        icon={FileText}
        iconColor="text-teal-600"
      >
        <Textarea
          value={listNotes}
          onChange={(e) => setListNotes(e.target.value)}
          placeholder="ملاحظات إضافية..."
          rows={4}
          disabled={!isEditable}
          className="resize-none"
        />
      </DocumentSection>
    </div>
  )
}
