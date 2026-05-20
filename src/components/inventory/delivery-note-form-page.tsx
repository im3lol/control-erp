'use client'

import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import {
  Save, Send, ArrowRight, Loader2, Truck, Plus, XCircle,
  ScanLine, Search, FileText,
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

interface Customer {
  id: string
  code: string
  nameAr: string
  nameEn?: string
}

interface SalesInvoice {
  id: string
  number: string
  customerId: string
  status: string
  date: string
  customer?: { id: string; code: string; nameAr: string; nameEn?: string }
  lines?: SalesInvoiceLine[]
}

interface SalesInvoiceLine {
  id: string
  itemId: string
  quantity: number
  unitPrice: number
  item?: { id: string; code: string; nameAr?: string; nameEn?: string }
}

interface SalesOrder {
  id: string
  number: string
  customerId: string
  status: string
  date: string
  customer?: { id: string; code: string; nameAr: string; nameEn?: string }
  lines?: SalesOrderLine[]
}

interface SalesOrderLine {
  id: string
  itemId: string
  quantity: number
  deliveredQty?: number
  unitPrice: number
  item?: { id: string; code: string; nameAr?: string; nameEn?: string }
}

interface DeliveryNoteLine {
  id: string
  itemId: string
  quantity: number
  notes: string | null
  item?: { id: string; code: string; nameAr?: string; nameEn?: string; uom?: { nameAr: string } | null }
}

interface DeliveryNoteDetail {
  id: string
  number: string
  date: string
  status: string
  salesInvoiceId: string | null
  salesOrderId: string | null
  customerId: string | null
  warehouseId: string
  notes: string | null
  customer?: { id: string; code: string; nameAr: string; nameEn?: string }
  warehouse?: { id: string; code: string; nameAr: string; nameEn?: string }
  salesInvoice?: { id: string; number: string }
  salesOrder?: { id: string; number: string }
  lines: DeliveryNoteLine[]
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
    case 'CONFIRMED':
      return <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200">مؤكد</Badge>
    case 'CANCELLED':
      return <Badge className="bg-red-50 text-red-700 border-red-200">ملغى</Badge>
    default:
      return <Badge>{status}</Badge>
  }
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

export default function DeliveryNoteFormPage() {
  const companyId = useAppStore(state => state.currentCompanyId)
  const setModule = useAppStore(state => state.setModule)
  const setView = useAppStore(state => state.setView)
  const editingDocId = useAppStore(state => state.editingDocId)

  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [items, setItems] = useState<Item[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [salesInvoices, setSalesInvoices] = useState<SalesInvoice[]>([])
  const [salesOrders, setSalesOrders] = useState<SalesOrder[]>([])
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [orderLoading, setOrderLoading] = useState(false)

  // Form state
  const [noteWarehouseId, setNoteWarehouseId] = useState('')
  const [noteSalesInvoiceId, setNoteSalesInvoiceId] = useState('')
  const [noteSalesOrderId, setNoteSalesOrderId] = useState('')
  const [noteCustomerId, setNoteCustomerId] = useState('')
  const [noteDate, setNoteDate] = useState(new Date().toISOString().split('T')[0])
  const [noteNotes, setNoteNotes] = useState('')
  const [noteLines, setNoteLines] = useState<LineInput[]>([{ ...emptyLine }])
  const [currentStatus, setCurrentStatus] = useState<string>('DRAFT')
  const [noteNumber, setNoteNumber] = useState<string>('')
  const [noteId, setNoteId] = useState<string>('')

  // Barcode & search
  const [barcodeInput, setBarcodeInput] = useState('')
  const [searchQuery, setSearchQuery] = useState('')

  // Check localStorage for pending delivery note from Sales Order
  useEffect(() => {
    try {
      const pending = localStorage.getItem('pendingDeliveryNote')
      if (pending) {
        localStorage.removeItem('pendingDeliveryNote')
        const data = JSON.parse(pending)
        if (data.salesOrderId) setNoteSalesOrderId(data.salesOrderId)
        if (data.customerId) setNoteCustomerId(data.customerId)
        if (data.lines && data.lines.length > 0) {
          const orderLines: LineInput[] = data.lines
            .filter((l: { quantity: number }) => l.quantity > 0)
            .map((l: { itemId: string; quantity: number }) => ({
              itemId: l.itemId,
              quantity: String(l.quantity),
              notes: '',
            }))
          if (orderLines.length > 0) setNoteLines(orderLines)
        }
      }
    } catch { /* silent */ }
  }, [])

  // Load data
  useEffect(() => {
    fetchWarehouses()
    fetchItems()
    fetchCustomers()
    fetchSalesInvoices()
    fetchSalesOrders()
    if (editingDocId && editingDocId !== 'new') {
      loadNote(editingDocId)
    }
  }, [])

  const loadNote = async (id: string) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/inventory/delivery-notes/${id}?companyId=${companyId}`)
      if (res.ok) {
        const note: DeliveryNoteDetail = await res.json()
        setNoteId(note.id)
        setNoteNumber(note.number)
        setCurrentStatus(note.status)
        setNoteWarehouseId(note.warehouseId)
        setNoteSalesInvoiceId(note.salesInvoiceId || '')
        setNoteSalesOrderId(note.salesOrderId || '')
        setNoteCustomerId(note.customerId || '')
        setNoteDate(note.date.split('T')[0])
        setNoteNotes(note.notes || '')
        setNoteLines(note.lines.map(l => ({
          itemId: l.itemId,
          quantity: String(l.quantity),
          notes: l.notes || '',
        })))
      }
    } catch {
      toast.error('فشل في تحميل بيانات إذن الصرف')
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

  const fetchCustomers = async () => {
    try {
      const res = await fetch(`/api/sales/customers?companyId=${companyId}`)
      if (res.ok) setCustomers(await res.json())
    } catch { /* silent */ }
  }

  const fetchSalesInvoices = async () => {
    try {
      const res = await fetch(`/api/sales/invoices?companyId=${companyId}`)
      if (res.ok) setSalesInvoices(await res.json())
    } catch { /* silent */ }
  }

  const fetchSalesOrders = async () => {
    try {
      const res = await fetch(`/api/sales/orders?companyId=${companyId}&status=CONFIRMED`)
      if (res.ok) setSalesOrders(await res.json())
    } catch { /* silent */ }
  }

  const handleGoBack = () => {
    setModule('inventory')
    setView('delivery-notes')
  }

  // ── Sales Invoice auto-fill ──

  const handleSalesInvoiceChange = async (invoiceId: string) => {
    if (!invoiceId || invoiceId === '__none__') {
      setNoteSalesInvoiceId('')
      setNoteCustomerId('')
      setNoteSalesOrderId('')
      setNoteLines([{ ...emptyLine }])
      return
    }

    setNoteSalesInvoiceId(invoiceId)
    setNoteSalesOrderId('')
    setOrderLoading(true)

    try {
      const res = await fetch(`/api/sales/invoices/${invoiceId}?companyId=${companyId}`)
      if (res.ok) {
        const invoice: SalesInvoice = await res.json()
        setNoteCustomerId(invoice.customerId)
        if (invoice.lines && invoice.lines.length > 0) {
          setNoteLines(invoice.lines.map(l => ({
            itemId: l.itemId,
            quantity: String(l.quantity),
            notes: '',
          })))
        }
      } else {
        toast.error('فشل في تحميل تفاصيل الفاتورة')
      }
    } catch {
      toast.error('حدث خطأ أثناء تحميل الفاتورة')
    } finally {
      setOrderLoading(false)
    }
  }

  // ── Sales Order auto-fill ──

  const handleSalesOrderChange = async (orderId: string) => {
    if (!orderId || orderId === '__none__') {
      setNoteSalesOrderId('')
      setNoteCustomerId('')
      setNoteSalesInvoiceId('')
      setNoteLines([{ ...emptyLine }])
      return
    }

    setNoteSalesOrderId(orderId)
    setNoteSalesInvoiceId('')
    setOrderLoading(true)

    try {
      const res = await fetch(`/api/sales/orders/${orderId}?companyId=${companyId}`)
      if (res.ok) {
        const order: SalesOrder = await res.json()
        setNoteCustomerId(order.customerId)
        if (order.lines && order.lines.length > 0) {
          const orderLines = order.lines
            .filter(l => (l.quantity - (l.deliveredQty || 0)) > 0)
            .map(l => ({
              itemId: l.itemId,
              quantity: String(l.quantity - (l.deliveredQty || 0)),
              notes: '',
            }))
          if (orderLines.length > 0) {
            setNoteLines(orderLines)
          } else {
            toast.info('جميع أصناف أمر البيع تم تسليمها بالفعل')
            setNoteLines([{ ...emptyLine }])
          }
        }
      } else {
        toast.error('فشل في تحميل تفاصيل أمر البيع')
      }
    } catch {
      toast.error('حدث خطأ أثناء تحميل أمر البيع')
    } finally {
      setOrderLoading(false)
    }
  }

  // ── Line handlers ──

  const updateLine = (index: number, field: keyof LineInput, value: string) => {
    setNoteLines((prev) => {
      const updated = [...prev]
      updated[index] = { ...updated[index], [field]: value }
      return updated
    })
  }

  const addLine = () => {
    setNoteLines((prev) => [...prev, { ...emptyLine }])
  }

  const removeLine = (index: number) => {
    if (noteLines.length <= 1) return
    setNoteLines((prev) => prev.filter((_, i) => i !== index))
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
    const existing = noteLines.findIndex(l => l.itemId === itemId)
    if (existing >= 0) {
      updateLine(existing, 'quantity', String(parseFloat(noteLines[existing].quantity) + 1))
    } else {
      setNoteLines(prev => [...prev, { itemId, quantity: '1', notes: '' }])
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
    if (!noteWarehouseId) {
      toast.error('يرجى اختيار المخزن')
      return
    }
    if (!noteDate) {
      toast.error('يرجى تحديد التاريخ')
      return
    }
    const validLines = noteLines.filter(l => l.itemId && parseFloat(l.quantity) > 0)
    if (validLines.length === 0) {
      toast.error('يجب إضافة سطر واحد على الأقل')
      return
    }

    setSubmitting(true)
    try {
      const payload = {
        warehouseId: noteWarehouseId,
        salesInvoiceId: noteSalesInvoiceId || undefined,
        salesOrderId: noteSalesOrderId || undefined,
        customerId: noteCustomerId || undefined,
        date: noteDate,
        notes: noteNotes || undefined,
        lines: validLines.map(l => ({
          itemId: l.itemId,
          quantity: parseFloat(l.quantity),
          notes: l.notes || undefined,
        })),
        companyId,
      }

      let res
      if (noteId) {
        res = await fetch(`/api/inventory/delivery-notes/${noteId}?companyId=${companyId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...payload, action: 'update' }),
        })
      } else {
        res = await fetch(`/api/inventory/delivery-notes?companyId=${companyId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
      }

      if (res.ok) {
        const data = await res.json()
        setNoteId(data.id)
        setNoteNumber(data.number)
        setCurrentStatus('DRAFT')
        toast.success('تم حفظ إذن الصرف كمسودة')
      } else {
        const err = await res.json()
        toast.error(err.error || 'فشل في حفظ إذن الصرف')
      }
    } catch {
      toast.error('حدث خطأ أثناء حفظ إذن الصرف')
    } finally {
      setSubmitting(false)
    }
  }

  // ── Submit (Confirm) ──

  const handleSubmit = async () => {
    if (!noteWarehouseId) {
      toast.error('يرجى اختيار المخزن')
      return
    }
    if (!noteDate) {
      toast.error('يرجى تحديد التاريخ')
      return
    }
    const validLines = noteLines.filter(l => l.itemId && parseFloat(l.quantity) > 0)
    if (validLines.length === 0) {
      toast.error('يجب إضافة سطر واحد على الأقل')
      return
    }

    setSubmitting(true)
    try {
      if (!noteId) {
        const payload = {
          warehouseId: noteWarehouseId,
          salesInvoiceId: noteSalesInvoiceId || undefined,
          salesOrderId: noteSalesOrderId || undefined,
          customerId: noteCustomerId || undefined,
          date: noteDate,
          notes: noteNotes || undefined,
          lines: validLines.map(l => ({
            itemId: l.itemId,
            quantity: parseFloat(l.quantity),
            notes: l.notes || undefined,
          })),
          companyId,
        }
        const res = await fetch(`/api/inventory/delivery-notes?companyId=${companyId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        if (res.ok) {
          const data = await res.json()
          setNoteId(data.id)
          setNoteNumber(data.number)
          await confirmNote(data.id)
        } else {
          const err = await res.json()
          toast.error(err.error || 'فشل في حفظ إذن الصرف')
        }
      } else {
        await confirmNote(noteId)
      }
    } catch {
      toast.error('حدث خطأ أثناء تأكيد إذن الصرف')
    } finally {
      setSubmitting(false)
    }
  }

  const confirmNote = async (id: string) => {
    try {
      const res = await fetch(`/api/inventory/delivery-notes/${id}?companyId=${companyId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'confirm', companyId }),
      })
      if (res.ok) {
        setCurrentStatus('CONFIRMED')
        toast.success('تم تأكيد إذن الصرف بنجاح')
      } else {
        const err = await res.json()
        toast.error(err.error || 'فشل في تأكيد إذن الصرف')
      }
    } catch {
      toast.error('حدث خطأ أثناء تأكيد إذن الصرف')
    }
  }

  // ── Create Sales Invoice shortcut ──

  const handleCreateSalesInvoice = () => {
    const pendingData = {
      id: noteId,
      number: noteNumber,
      customerId: noteCustomerId,
      lines: noteLines.filter(l => l.itemId && parseFloat(l.quantity) > 0).map(l => ({
        itemId: l.itemId,
        quantity: parseFloat(l.quantity),
      })),
    }
    localStorage.setItem('pendingSalesInvoice', JSON.stringify(pendingData))
    useAppStore.getState().setModule('sales')
    useAppStore.getState().setView('sales-invoices')
    useAppStore.getState().setEditingDocId('new')
  }

  const isEditable = currentStatus === 'DRAFT' || currentStatus === 'NEW'
  const linesLocked = !!(noteSalesInvoiceId || noteSalesOrderId)

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
              <Truck className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-slate-900">
                  {noteId ? `إذن صرف ${noteNumber}` : 'إذن صرف جديد'}
                </h2>
                {currentStatus !== 'NEW' && getStatusBadge(currentStatus)}
              </div>
              <p className="text-xs text-slate-400">
                {noteId ? 'تعديل أو تأكيد إذن الصرف' : 'إنشاء إذن صرف جديد من المخزن'}
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
                disabled={submitting || orderLoading}
                className="gap-2 border-emerald-200 text-emerald-700 hover:bg-emerald-50"
              >
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                مسودة
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={submitting || orderLoading}
                className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
              >
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                مؤكد
              </Button>
            </>
          )}
          {currentStatus === 'CONFIRMED' && (
            <Button
              onClick={handleCreateSalesInvoice}
              className="gap-2 bg-amber-600 hover:bg-amber-700 text-white"
            >
              <FileText className="h-4 w-4" />
              إنشاء فاتورة بيع
            </Button>
          )}
        </div>
      </div>

      {/* Note Header */}
      <Card className="border shadow-sm">
        <CardHeader className="pb-4">
          <CardTitle className="text-base">بيانات إذن الصرف</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>المخزن <span className="text-red-500">*</span></Label>
              <Select
                value={noteWarehouseId}
                onValueChange={setNoteWarehouseId}
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
              <Label>فاتورة البيع (اختياري)</Label>
              <Select
                value={noteSalesInvoiceId || '__none__'}
                onValueChange={handleSalesInvoiceChange}
                disabled={!isEditable || orderLoading || !!noteSalesOrderId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="اختر فاتورة البيع" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">بدون فاتورة</SelectItem>
                  {salesInvoices
                    .filter(inv => inv.status === 'CONFIRMED')
                    .map(inv => (
                      <SelectItem key={inv.id} value={inv.id}>
                        {inv.number} - {inv.customer?.nameAr || '—'}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>أمر البيع (اختياري)</Label>
              <Select
                value={noteSalesOrderId || '__none__'}
                onValueChange={handleSalesOrderChange}
                disabled={!isEditable || orderLoading || !!noteSalesInvoiceId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="اختر أمر البيع" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">بدون أمر بيع</SelectItem>
                  {salesOrders
                    .filter(ord => ord.status === 'CONFIRMED')
                    .map(ord => (
                      <SelectItem key={ord.id} value={ord.id}>
                        {ord.number} - {ord.customer?.nameAr || '—'}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>العميل</Label>
              <Select
                value={noteCustomerId}
                onValueChange={setNoteCustomerId}
                disabled={!isEditable || !!noteSalesInvoiceId || !!noteSalesOrderId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="اختر العميل" />
                </SelectTrigger>
                <SelectContent>
                  {customers.map(cust => (
                    <SelectItem key={cust.id} value={cust.id}>
                      {cust.nameAr} ({cust.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {(noteSalesInvoiceId || noteSalesOrderId) && (
                <p className="text-xs text-slate-400">يتم تعبئته تلقائياً من المستند المحدد</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>التاريخ</Label>
              <Input
                type="date"
                value={noteDate}
                onChange={(e) => setNoteDate(e.target.value)}
                disabled={!isEditable}
                dir="ltr"
              />
            </div>

            <div className="space-y-2">
              <Label>ملاحظات</Label>
              <Input
                value={noteNotes}
                onChange={(e) => setNoteNotes(e.target.value)}
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
            <CardTitle className="text-base">بنود إذن الصرف</CardTitle>
            {isEditable && !linesLocked && (
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
          {linesLocked && (
            <p className="text-xs text-slate-400 mb-3">الأصناف معبأة تلقائياً من المستند المحدد</p>
          )}

          {/* Barcode & Search */}
          {isEditable && !linesLocked && (
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
            <div className="grid grid-cols-12 gap-2 px-1">
              <div className="col-span-4 text-xs font-semibold text-slate-500">الصنف</div>
              <div className="col-span-2 text-xs font-semibold text-slate-500">الكمية</div>
              <div className="col-span-5 text-xs font-semibold text-slate-500">ملاحظات</div>
              <div className="col-span-1"></div>
            </div>

            {noteLines.map((line, idx) => (
              <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                <div className="col-span-4">
                  <Select
                    value={line.itemId}
                    onValueChange={(val) => updateLine(idx, 'itemId', val)}
                    disabled={!isEditable || linesLocked}
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
                    disabled={!isEditable || linesLocked}
                  />
                </div>
                <div className="col-span-5">
                  <Input
                    value={line.notes}
                    onChange={(e) => updateLine(idx, 'notes', e.target.value)}
                    placeholder="ملاحظات..."
                    className="h-9 text-sm"
                    disabled={!isEditable || linesLocked}
                  />
                </div>
                <div className="col-span-1 flex items-center justify-center">
                  {isEditable && !linesLocked && noteLines.length > 1 && (
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
            value={noteNotes}
            onChange={(e) => setNoteNotes(e.target.value)}
            placeholder="ملاحظات إضافية..."
            rows={3}
            disabled={!isEditable}
          />
        </CardContent>
      </Card>
    </div>
  )
}
