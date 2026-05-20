'use client'

import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import {
  Save, Send, Loader2, ClipboardList, Plus, XCircle,
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

interface MaterialRequestDetail {
  id: string
  number: string
  date: string
  status: string
  requestedBy: string | null
  approvedBy: string | null
  notes: string | null
  lines: MaterialRequestLine[]
}

interface LineInput {
  itemId: string
  quantity: string
  notes: string
}

const emptyLine: LineInput = {
  itemId: '',
  quantity: '1',
  notes: '',
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function MaterialRequestFormPage() {
  const companyId = useAppStore(state => state.currentCompanyId)
  const setModule = useAppStore(state => state.setModule)
  const setView = useAppStore(state => state.setView)
  const editingDocId = useAppStore(state => state.editingDocId)

  const [items, setItems] = useState<Item[]>([])
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // Form state
  const [requestDate, setRequestDate] = useState(new Date().toISOString().split('T')[0])
  const [requestedBy, setRequestedBy] = useState('')
  const [requestNotes, setRequestNotes] = useState('')
  const [requestLines, setRequestLines] = useState<LineInput[]>([{ ...emptyLine }])
  const [currentStatus, setCurrentStatus] = useState<string>('DRAFT')
  const [requestNumber, setRequestNumber] = useState<string>('')
  const [requestId, setRequestId] = useState<string>('')

  // Barcode & search
  const [barcodeInput, setBarcodeInput] = useState('')
  const [searchQuery, setSearchQuery] = useState('')

  // Load editing request
  useEffect(() => {
    fetchItems()
    if (editingDocId && editingDocId !== 'new') {
      loadRequest(editingDocId)
    }
  }, [])

  const loadRequest = async (id: string) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/inventory/material-requests/${id}?companyId=${companyId}`)
      if (res.ok) {
        const req: MaterialRequestDetail = await res.json()
        setRequestId(req.id)
        setRequestNumber(req.number)
        setCurrentStatus(req.status)
        setRequestDate(req.date.split('T')[0])
        setRequestedBy(req.requestedBy || '')
        setRequestNotes(req.notes || '')
        setRequestLines(req.lines.map(l => ({
          itemId: l.itemId,
          quantity: String(l.quantity),
          notes: l.notes || '',
        })))
      }
    } catch {
      toast.error('فشل في تحميل بيانات طلب المواد')
    } finally {
      setLoading(false)
    }
  }

  const fetchItems = async () => {
    try {
      const res = await fetch(`/api/inventory/items?activeOnly=true&companyId=${companyId}`)
      if (res.ok) setItems(await res.json())
    } catch { /* silent */ }
  }

  const handleGoBack = () => {
    setModule('inventory')
    setView('material-requests')
  }

  // ── Line handlers ──

  const updateLine = (index: number, field: keyof LineInput, value: string) => {
    setRequestLines((prev) => {
      const updated = [...prev]
      updated[index] = { ...updated[index], [field]: value }
      return updated
    })
  }

  const addLine = () => {
    setRequestLines((prev) => [...prev, { ...emptyLine }])
  }

  const removeLine = (index: number) => {
    if (requestLines.length <= 1) return
    setRequestLines((prev) => prev.filter((_, i) => i !== index))
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
    const existing = requestLines.findIndex(l => l.itemId === itemId)
    if (existing >= 0) {
      updateLine(existing, 'quantity', String(parseFloat(requestLines[existing].quantity) + 1))
    } else {
      setRequestLines(prev => [...prev, { itemId, quantity: '1', notes: '' }])
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
    if (!requestDate) {
      toast.error('يرجى تحديد التاريخ')
      return
    }
    const validLines = requestLines.filter(l => l.itemId && parseFloat(l.quantity) > 0)
    if (validLines.length === 0) {
      toast.error('يجب إضافة سطر واحد على الأقل')
      return
    }

    setSubmitting(true)
    try {
      const payload = {
        date: requestDate,
        requestedBy: requestedBy || undefined,
        notes: requestNotes || undefined,
        lines: validLines.map(l => ({
          itemId: l.itemId,
          quantity: parseFloat(l.quantity),
          notes: l.notes || undefined,
        })),
        companyId,
      }

      let res
      if (requestId) {
        res = await fetch(`/api/inventory/material-requests/${requestId}?companyId=${companyId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...payload, action: 'update' }),
        })
      } else {
        res = await fetch(`/api/inventory/material-requests?companyId=${companyId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
      }

      if (res.ok) {
        const data = await res.json()
        setRequestId(data.id)
        setRequestNumber(data.number)
        setCurrentStatus('DRAFT')
        toast.success('تم حفظ طلب المواد كمسودة')
      } else {
        const err = await res.json()
        toast.error(err.error || 'فشل في حفظ طلب المواد')
      }
    } catch {
      toast.error('حدث خطأ أثناء حفظ طلب المواد')
    } finally {
      setSubmitting(false)
    }
  }

  // ── Submit (Confirm) ──

  const handleSubmit = async () => {
    if (!requestDate) {
      toast.error('يرجى تحديد التاريخ')
      return
    }
    const validLines = requestLines.filter(l => l.itemId && parseFloat(l.quantity) > 0)
    if (validLines.length === 0) {
      toast.error('يجب إضافة سطر واحد على الأقل')
      return
    }

    setSubmitting(true)
    try {
      if (!requestId) {
        // Save first then submit
        const payload = {
          date: requestDate,
          requestedBy: requestedBy || undefined,
          notes: requestNotes || undefined,
          lines: validLines.map(l => ({
            itemId: l.itemId,
            quantity: parseFloat(l.quantity),
            notes: l.notes || undefined,
          })),
          companyId,
        }
        const res = await fetch(`/api/inventory/material-requests?companyId=${companyId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        if (res.ok) {
          const data = await res.json()
          setRequestId(data.id)
          setRequestNumber(data.number)
          await submitRequest(data.id)
        } else {
          const err = await res.json()
          toast.error(err.error || 'فشل في حفظ طلب المواد')
        }
      } else {
        await submitRequest(requestId)
      }
    } catch {
      toast.error('حدث خطأ أثناء تأكيد طلب المواد')
    } finally {
      setSubmitting(false)
    }
  }

  const submitRequest = async (id: string) => {
    try {
      const res = await fetch(`/api/inventory/material-requests/${id}?companyId=${companyId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'submit', companyId }),
      })
      if (res.ok) {
        setCurrentStatus('PENDING')
        toast.success('تم إرسال طلب المواد للمراجعة بنجاح')
      } else {
        const err = await res.json()
        toast.error(err.error || 'فشل في إرسال طلب المواد')
      }
    } catch {
      toast.error('حدث خطأ أثناء إرسال طلب المواد')
    }
  }

  const isEditable = currentStatus === 'DRAFT' || currentStatus === 'NEW'

  // ── Workflow stepper ──

  const workflowSteps = (() => {
    const steps = [
      { label: 'طلب المواد', status: 'upcoming' as const },
      { label: 'اعتماد', status: 'upcoming' as const },
      { label: 'تلبية', status: 'upcoming' as const },
    ]
    switch (currentStatus) {
      case 'DRAFT':
      case 'NEW':
        steps[0].status = 'current'
        break
      case 'PENDING':
        steps[0].status = 'completed'
        steps[1].status = 'current'
        break
      case 'APPROVED':
        steps[0].status = 'completed'
        steps[1].status = 'completed'
        steps[2].status = 'current'
        break
      case 'FULFILLED':
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
        <Loader2 className="h-8 w-8 animate-spin text-violet-600" />
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* ── Page Header ── */}
      <DocumentPageHeader
        icon={ClipboardList}
        iconBg="bg-violet-50"
        iconColor="text-violet-600"
        newTitle="طلب مواد جديد"
        editTitlePrefix="طلب مواد"
        documentNumber={requestNumber || undefined}
        status={currentStatus}
        subtitle={requestId ? 'تعديل أو إرسال طلب المواد' : 'إنشاء طلب مواد جديد'}
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
                },
                {
                  label: 'تأكيد',
                  icon: Send,
                  onClick: handleSubmit,
                  disabled: submitting,
                  loading: submitting,
                },
              ]
            : undefined
        }
      />

      {/* ── Workflow Stepper ── */}
      <div className="bg-white border rounded-xl px-5 py-3 shadow-sm">
        <WorkflowStepper steps={workflowSteps} />
      </div>

      {/* ── Request Info Section ── */}
      <DocumentSection
        title="بيانات طلب المواد"
        icon={ClipboardList}
        iconColor="text-violet-600"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>التاريخ</Label>
            <Input
              type="date"
              value={requestDate}
              onChange={(e) => setRequestDate(e.target.value)}
              disabled={!isEditable}
              dir="ltr"
            />
          </div>
          <div className="space-y-2">
            <Label>الطالب</Label>
            <Input
              value={requestedBy}
              onChange={(e) => setRequestedBy(e.target.value)}
              placeholder="اسم الطالب..."
              disabled={!isEditable}
            />
          </div>
        </div>
      </DocumentSection>

      {/* ── Lines Section ── */}
      <DocumentSection
        title="بنود طلب المواد"
        icon={Package}
        iconColor="text-violet-600"
        action={
          isEditable ? (
            <Button
              variant="outline"
              size="sm"
              onClick={addLine}
              className="gap-1.5 text-emerald-600 border-emerald-200 hover:bg-emerald-50"
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
                        className="w-full text-right px-3 py-2 text-sm hover:bg-emerald-50 border-b last:border-0 transition-colors"
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

          {/* Header row */}
          <div className="grid grid-cols-12 gap-2 px-5 py-2.5 bg-slate-50 border-b">
            <div className="col-span-4 text-xs font-semibold text-slate-500">الصنف</div>
            <div className="col-span-2 text-xs font-semibold text-slate-500">الكمية</div>
            <div className="col-span-5 text-xs font-semibold text-slate-500">ملاحظات</div>
            <div className="col-span-1"></div>
          </div>

          {/* Line items with alternating row backgrounds */}
          {requestLines.map((line, idx) => (
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
                {isEditable && requestLines.length > 1 && (
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
          {requestLines.length === 0 && (
            <div className="px-5 py-8 text-center text-sm text-slate-400">
              لم يتم إضافة بنود بعد
            </div>
          )}
        </div>
      </DocumentSection>

      {/* ── Notes Section ── */}
      <DocumentSection
        title="ملاحظات إضافية"
        icon={FileText}
        iconColor="text-violet-600"
      >
        <Textarea
          value={requestNotes}
          onChange={(e) => setRequestNotes(e.target.value)}
          placeholder="ملاحظات إضافية..."
          rows={4}
          disabled={!isEditable}
          className="resize-none"
        />
      </DocumentSection>
    </div>
  )
}
