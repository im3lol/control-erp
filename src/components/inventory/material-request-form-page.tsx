'use client'

import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import {
  Save, Send, ArrowRight, Loader2, ClipboardList, Plus, XCircle,
  ScanLine, Search,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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

// ─── Status helpers ───────────────────────────────────────────────────────────

function getStatusBadge(status: string) {
  switch (status) {
    case 'DRAFT':
      return <Badge className="bg-slate-100 text-slate-600">مسودة</Badge>
    case 'PENDING':
      return <Badge className="bg-amber-50 text-amber-700 border-amber-200">قيد المراجعة</Badge>
    case 'APPROVED':
      return <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200">معتمد</Badge>
    case 'FULFILLED':
      return <Badge className="bg-teal-50 text-teal-700 border-teal-200">مكتمل</Badge>
    case 'CANCELLED':
      return <Badge className="bg-red-50 text-red-700 border-red-200">ملغى</Badge>
    default:
      return <Badge>{status}</Badge>
  }
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={handleGoBack} className="hover:bg-slate-100">
            <ArrowRight className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-emerald-50 flex items-center justify-center">
              <ClipboardList className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-slate-900">
                  {requestId ? `طلب مواد ${requestNumber}` : 'طلب مواد جديد'}
                </h2>
                {currentStatus !== 'NEW' && getStatusBadge(currentStatus)}
              </div>
              <p className="text-xs text-slate-400">
                {requestId ? 'تعديل أو إرسال طلب المواد' : 'إنشاء طلب مواد جديد'}
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleGoBack}>
            إلغاء
          </Button>
          {isEditable && (
            <>
              <Button
                variant="outline"
                onClick={handleSaveDraft}
                disabled={submitting}
                className="gap-2 border-emerald-200 text-emerald-700 hover:bg-emerald-50"
              >
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                مسودة
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={submitting}
                className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
              >
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                مؤكد
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Request Header */}
      <Card className="border shadow-sm">
        <CardHeader className="pb-4">
          <CardTitle className="text-base">بيانات طلب المواد</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
            <div className="space-y-2">
              <Label>ملاحظات</Label>
              <Input
                value={requestNotes}
                onChange={(e) => setRequestNotes(e.target.value)}
                placeholder="ملاحظات اختيارية..."
                disabled={!isEditable}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Lines */}
      <Card className="border shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">بنود طلب المواد</CardTitle>
            {isEditable && (
              <Button
                variant="outline"
                size="sm"
                onClick={addLine}
                className="gap-1 text-emerald-600 border-emerald-200 hover:bg-emerald-50"
              >
                <Plus className="h-3 w-3" />
                إضافة سطر
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {/* Barcode & Search */}
          {isEditable && (
            <div className="flex gap-2 mb-3">
              <div className="flex-1 relative">
                <ScanLine className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="مسح الباركود..."
                  value={barcodeInput}
                  onChange={(e) => setBarcodeInput(e.target.value)}
                  onKeyDown={handleBarcodeScan}
                  className="pr-10 h-9"
                  dir="ltr"
                />
              </div>
              <div className="flex-1 relative">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="بحث بالاسم..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pr-10 h-9"
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
                        className="w-full text-right px-3 py-2 text-sm hover:bg-emerald-50 border-b last:border-0"
                      >
                        {item.nameAr || item.nameEn || item.code} ({item.code})
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="space-y-3">
            {/* Header row */}
            <div className="grid grid-cols-12 gap-2 px-1">
              <div className="col-span-4 text-xs font-semibold text-slate-500">الصنف</div>
              <div className="col-span-2 text-xs font-semibold text-slate-500">الكمية</div>
              <div className="col-span-5 text-xs font-semibold text-slate-500">ملاحظات</div>
              <div className="col-span-1"></div>
            </div>

            {requestLines.map((line, idx) => (
              <div key={idx} className="grid grid-cols-12 gap-2 items-center">
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
                      className="h-7 w-7 text-red-400 hover:text-red-600"
                    >
                      <XCircle className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Notes */}
      <Card className="border shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">ملاحظات إضافية</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            value={requestNotes}
            onChange={(e) => setRequestNotes(e.target.value)}
            placeholder="ملاحظات إضافية..."
            rows={3}
            disabled={!isEditable}
          />
        </CardContent>
      </Card>
    </div>
  )
}
