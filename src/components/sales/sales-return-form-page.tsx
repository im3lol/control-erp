'use client'

import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import {
  Save, Send, Loader2, FileText, Plus, XCircle,
  ScanLine, Search, Undo2, ClipboardList, Package, Calculator,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useAppStore } from '@/lib/store'
import { formatCurrency } from '@/lib/erp-utils'
import { cn } from '@/lib/utils'
import DocumentPageHeader, { getDocumentStatusBadge } from '@/components/shared/document-page-header'
import { DocumentSection, LinkedDocumentBadge } from '@/components/shared/document-section'
import WorkflowStepper, { getSalesWorkflow } from '@/components/shared/workflow-stepper'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Customer {
  id: string
  code: string
  nameAr: string
  nameEn: string | null
}

interface Warehouse {
  id: string
  code: string
  nameAr: string
  nameEn: string | null
}

interface Item {
  id: string
  code: string
  nameAr: string
  nameEn: string | null
  sellPrice: number
}

interface ReturnLine {
  id?: string
  itemId: string
  itemCode?: string
  itemName?: string
  originalQty?: number // from source document, for reference
  quantity: string
  unitPrice: string
  totalAmount: number
}

interface SalesReturnDetail {
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
  salesOrder: { id: string; number: string } | null
  salesInvoice: { id: string; number: string } | null
  deliveryNote: { id: string; number: string } | null
  customer: { id: string; code: string; nameAr: string }
  warehouse: { id: string; code: string; nameAr: string }
  lines: Array<{
    id: string
    itemId: string
    quantity: number
    unitPrice: number
    totalAmount: number
    item: { id: string; code: string; nameAr: string; uom?: { nameAr: string } | null }
  }>
}

// localStorage pending data structure
interface PendingSalesReturn {
  sourceType: 'salesOrder' | 'salesInvoice' | 'deliveryNote'
  sourceId: string
  sourceNumber: string
  customerId: string
  customerName: string
  warehouseId?: string
  lines: Array<{
    itemId: string
    itemCode: string
    itemName: string
    quantity: number
    unitPrice: number
  }>
}

const emptyLine: ReturnLine = {
  itemId: '',
  quantity: '1',
  unitPrice: '0',
  totalAmount: 0,
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function SalesReturnFormPage() {
  const companyId = useAppStore(state => state.currentCompanyId)
  const setModule = useAppStore(state => state.setModule)
  const setView = useAppStore(state => state.setView)
  const editingDocId = useAppStore(state => state.editingDocId)
  const setEditingDocId = useAppStore(state => state.setEditingDocId)

  const [customers, setCustomers] = useState<Customer[]>([])
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [items, setItems] = useState<Item[]>([])
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // Form state
  const [returnCustomerId, setReturnCustomerId] = useState('')
  const [returnWarehouseId, setReturnWarehouseId] = useState('')
  const [returnDate, setReturnDate] = useState(new Date().toISOString().split('T')[0])
  const [returnNotes, setReturnNotes] = useState('')
  const [returnLines, setReturnLines] = useState<ReturnLine[]>([{ ...emptyLine }])
  const [currentStatus, setCurrentStatus] = useState<string>('DRAFT')
  const [returnNumber, setReturnNumber] = useState<string>('')
  const [returnId, setReturnId] = useState<string>('')
  const [barcodeInput, setBarcodeInput] = useState('')
  const [searchQuery, setSearchQuery] = useState('')

  // Linked document state
  const [linkedSourceType, setLinkedSourceType] = useState<string>('')
  const [linkedSourceId, setLinkedSourceId] = useState<string>('')
  const [linkedSourceNumber, setLinkedSourceNumber] = useState<string>('')
  const [linkedSalesOrderId, setLinkedSalesOrderId] = useState<string | null>(null)
  const [linkedSalesInvoiceId, setLinkedSalesInvoiceId] = useState<string | null>(null)
  const [linkedDeliveryNoteId, setLinkedDeliveryNoteId] = useState<string | null>(null)
  const [linkedSalesOrderNumber, setLinkedSalesOrderNumber] = useState<string>('')
  const [linkedSalesInvoiceNumber, setLinkedSalesInvoiceNumber] = useState<string>('')
  const [linkedDeliveryNoteNumber, setLinkedDeliveryNoteNumber] = useState<string>('')

  // Load editing return or pre-fill from localStorage
  useEffect(() => {
    fetchCustomers()
    fetchWarehouses()
    fetchItems()

    if (editingDocId && editingDocId !== 'new') {
      loadReturn(editingDocId)
    } else {
      // Check localStorage for pending sales return data
      prefillFromLocalStorage()
    }
  }, [])

  const prefillFromLocalStorage = () => {
    try {
      const raw = localStorage.getItem('pendingSalesReturn')
      if (!raw) return

      const pending: PendingSalesReturn = JSON.parse(raw)
      // Clear the localStorage key after reading
      localStorage.removeItem('pendingSalesReturn')

      setReturnCustomerId(pending.customerId || '')
      setReturnWarehouseId(pending.warehouseId || '')
      setLinkedSourceType(pending.sourceType || '')
      setLinkedSourceId(pending.sourceId || '')
      setLinkedSourceNumber(pending.sourceNumber || '')

      // Set linked document IDs based on source type
      if (pending.sourceType === 'salesOrder') {
        setLinkedSalesOrderId(pending.sourceId)
        setLinkedSalesOrderNumber(pending.sourceNumber)
      } else if (pending.sourceType === 'salesInvoice') {
        setLinkedSalesInvoiceId(pending.sourceId)
        setLinkedSalesInvoiceNumber(pending.sourceNumber)
      } else if (pending.sourceType === 'deliveryNote') {
        setLinkedDeliveryNoteId(pending.sourceId)
        setLinkedDeliveryNoteNumber(pending.sourceNumber)
      }

      // Pre-fill lines from source document
      if (pending.lines && pending.lines.length > 0) {
        setReturnLines(
          pending.lines.map((l) => ({
            itemId: l.itemId,
            itemCode: l.itemCode,
            itemName: l.itemName,
            originalQty: l.quantity,
            quantity: String(l.quantity),
            unitPrice: String(l.unitPrice),
            totalAmount: l.quantity * l.unitPrice,
          }))
        )
      }

      toast.success('تم تحميل بيانات المستند المرجعي')
    } catch {
      // Silently ignore parse errors
    }
  }

  const loadReturn = async (id: string) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/sales/returns/${id}?companyId=${companyId}`)
      if (res.ok) {
        const data: SalesReturnDetail = await res.json()
        setReturnId(data.id)
        setReturnNumber(data.number)
        setCurrentStatus(data.status)
        setReturnCustomerId(data.customerId)
        setReturnWarehouseId(data.warehouseId)
        setReturnDate(data.date.split('T')[0])
        setReturnNotes(data.notes || '')
        setReturnLines(
          data.lines.map((l) => ({
            id: l.id,
            itemId: l.itemId,
            itemCode: l.item.code,
            itemName: l.item.nameAr,
            quantity: String(l.quantity),
            unitPrice: String(l.unitPrice),
            totalAmount: l.totalAmount,
          }))
        )

        // Load linked document info
        if (data.salesOrder) {
          setLinkedSalesOrderId(data.salesOrderId)
          setLinkedSalesOrderNumber(data.salesOrder.number)
        }
        if (data.salesInvoice) {
          setLinkedSalesInvoiceId(data.salesInvoiceId)
          setLinkedSalesInvoiceNumber(data.salesInvoice.number)
        }
        if (data.deliveryNote) {
          setLinkedDeliveryNoteId(data.deliveryNoteId)
          setLinkedDeliveryNoteNumber(data.deliveryNote.number)
        }
      }
    } catch {
      toast.error('فشل في تحميل بيانات مرتجع البيع')
    } finally {
      setLoading(false)
    }
  }

  const fetchCustomers = async () => {
    try {
      const res = await fetch(`/api/sales/customers?activeOnly=true&companyId=${companyId}`)
      if (res.ok) setCustomers(await res.json())
    } catch { /* silent */ }
  }

  const fetchWarehouses = async () => {
    try {
      const res = await fetch(`/api/inventory/warehouses?companyId=${companyId}`)
      if (res.ok) {
        const data = await res.json()
        setWarehouses(Array.isArray(data) ? data : [])
      }
    } catch { /* silent */ }
  }

  const fetchItems = async () => {
    try {
      const res = await fetch(`/api/inventory/items?activeOnly=true&companyId=${companyId}`)
      if (res.ok) setItems(await res.json())
    } catch { /* silent */ }
  }

  const handleGoBack = () => {
    setModule('sales')
    setView('sales-returns')
    setEditingDocId(null)
  }

  // ── Line calculations ──

  const calcLineTotal = useCallback((line: ReturnLine) => {
    const qty = parseFloat(line.quantity) || 0
    const price = parseFloat(line.unitPrice) || 0
    return qty * price
  }, [])

  const calcTotalAmount = useCallback(() => {
    return returnLines.reduce((sum, l) => sum + calcLineTotal(l), 0)
  }, [returnLines, calcLineTotal])

  const updateLine = (index: number, field: keyof ReturnLine, value: string) => {
    setReturnLines((prev) => {
      const updated = [...prev]
      updated[index] = { ...updated[index], [field]: value }
      if (field === 'itemId') {
        const item = items.find((i) => i.id === value)
        if (item) {
          updated[index].unitPrice = String(item.sellPrice)
          updated[index].itemCode = item.code
          updated[index].itemName = item.nameAr
        }
      }
      updated[index].totalAmount = calcLineTotal(updated[index])
      return updated
    })
  }

  const addLine = () => {
    setReturnLines((prev) => [...prev, { ...emptyLine }])
  }

  const removeLine = (index: number) => {
    if (returnLines.length <= 1) return
    setReturnLines((prev) => prev.filter((_, i) => i !== index))
  }

  // ── Save Draft ──

  const handleSaveDraft = async () => {
    if (!returnCustomerId) {
      toast.error('يرجى اختيار العميل')
      return
    }
    if (!returnWarehouseId) {
      toast.error('يرجى اختيار المخزن')
      return
    }
    const validLines = returnLines.filter((l) => l.itemId && parseFloat(l.quantity) > 0)
    if (validLines.length === 0) {
      toast.error('يجب إضافة سطر واحد على الأقل')
      return
    }

    setSubmitting(true)
    try {
      const payload = {
        customerId: returnCustomerId,
        warehouseId: returnWarehouseId,
        date: returnDate,
        notes: returnNotes,
        salesOrderId: linkedSalesOrderId || undefined,
        salesInvoiceId: linkedSalesInvoiceId || undefined,
        deliveryNoteId: linkedDeliveryNoteId || undefined,
        lines: validLines.map((l) => ({
          itemId: l.itemId,
          quantity: parseFloat(l.quantity),
          unitPrice: parseFloat(l.unitPrice),
        })),
        companyId,
      }

      let res
      if (returnId) {
        // Update existing
        res = await fetch(`/api/sales/returns/${returnId}?companyId=${companyId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...payload, action: 'update' }),
        })
      } else {
        // Create new
        res = await fetch(`/api/sales/returns?companyId=${companyId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
      }

      if (res.ok) {
        const data = await res.json()
        setReturnId(data.id)
        setReturnNumber(data.number)
        setCurrentStatus('DRAFT')
        toast.success('تم حفظ مرتجع البيع كمسودة')
      } else {
        const err = await res.json()
        toast.error(err.error || 'فشل في حفظ مرتجع البيع')
      }
    } catch {
      toast.error('حدث خطأ أثناء حفظ مرتجع البيع')
    } finally {
      setSubmitting(false)
    }
  }

  // ── Confirm Return ──

  const handleConfirm = async () => {
    // If not yet saved, save first then confirm
    if (!returnId) {
      if (!returnCustomerId) {
        toast.error('يرجى اختيار العميل')
        return
      }
      if (!returnWarehouseId) {
        toast.error('يرجى اختيار المخزن')
        return
      }
      const validLines = returnLines.filter((l) => l.itemId && parseFloat(l.quantity) > 0)
      if (validLines.length === 0) {
        toast.error('يجب إضافة سطر واحد على الأقل')
        return
      }

      setSubmitting(true)
      try {
        const payload = {
          customerId: returnCustomerId,
          warehouseId: returnWarehouseId,
          date: returnDate,
          notes: returnNotes,
          salesOrderId: linkedSalesOrderId || undefined,
          salesInvoiceId: linkedSalesInvoiceId || undefined,
          deliveryNoteId: linkedDeliveryNoteId || undefined,
          lines: validLines.map((l) => ({
            itemId: l.itemId,
            quantity: parseFloat(l.quantity),
            unitPrice: parseFloat(l.unitPrice),
          })),
          companyId,
        }

        const res = await fetch(`/api/sales/returns?companyId=${companyId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })

        if (res.ok) {
          const data = await res.json()
          setReturnId(data.id)
          setReturnNumber(data.number)
          // Now confirm
          await confirmReturn(data.id)
        } else {
          const err = await res.json()
          toast.error(err.error || 'فشل في حفظ مرتجع البيع')
        }
      } catch {
        toast.error('حدث خطأ أثناء حفظ مرتجع البيع')
      } finally {
        setSubmitting(false)
      }
    } else {
      // Already saved, just confirm
      setSubmitting(true)
      await confirmReturn(returnId)
      setSubmitting(false)
    }
  }

  const confirmReturn = async (id: string) => {
    try {
      const res = await fetch(`/api/sales/returns/${id}?companyId=${companyId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'confirm', companyId }),
      })
      if (res.ok) {
        setCurrentStatus('CONFIRMED')
        toast.success('تم تأكيد مرتجع البيع بنجاح')
      } else {
        const err = await res.json()
        toast.error(err.error || 'فشل في تأكيد مرتجع البيع')
      }
    } catch {
      toast.error('حدث خطأ أثناء تأكيد مرتجع البيع')
    }
  }

  // ── Barcode & Search ──

  const filteredItems = searchQuery.length > 1
    ? items.filter(it =>
        (it.nameAr && it.nameAr.includes(searchQuery)) ||
        (it.nameEn && it.nameEn.toLowerCase().includes(searchQuery.toLowerCase())) ||
        it.code.includes(searchQuery)
      )
    : []

  const handleBarcodeScan = async (e: React.KeyboardEvent) => {
    if (e.key !== 'Enter' || !barcodeInput.trim()) return
    try {
      const res = await fetch(`/api/inventory/item-codes?companyId=${companyId}&code=${encodeURIComponent(barcodeInput.trim())}`)
      if (res.ok) {
        const data = await res.json()
        if (data.itemId) {
          const item = items.find(i => i.id === data.itemId)
          addLine()
          const newLines = [...returnLines, { ...emptyLine }]
          const lastIdx = newLines.length - 1
          newLines[lastIdx] = { ...newLines[lastIdx], itemId: data.itemId, unitPrice: String(item?.sellPrice || 0), itemCode: item?.code, itemName: item?.nameAr }
          newLines[lastIdx].totalAmount = calcLineTotal(newLines[lastIdx])
          setReturnLines(newLines)
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
    const item = items.find(i => i.id === itemId)
    addLine()
    const newLines = [...returnLines, { ...emptyLine }]
    const lastIdx = newLines.length - 1
    newLines[lastIdx] = { ...newLines[lastIdx], itemId, unitPrice: String(item?.sellPrice || 0), itemCode: item?.code, itemName: item?.nameAr }
    newLines[lastIdx].totalAmount = calcLineTotal(newLines[lastIdx])
    setReturnLines(newLines)
    setSearchQuery('')
  }

  const totalAmount = calcTotalAmount()
  const isEditable = currentStatus === 'DRAFT' || currentStatus === 'NEW'

  // Determine workflow status for sales return
  const srStepStatus = currentStatus === 'CONFIRMED' || currentStatus === 'CANCELLED' ? 'completed' : 'current'
  const workflowSteps = getSalesWorkflow('SO', {
    soNumber: linkedSalesOrderNumber || undefined,
    dnNumber: linkedDeliveryNoteNumber || undefined,
    siNumber: linkedSalesInvoiceNumber || undefined,
  })
  // Add return step to the workflow
  const returnWorkflowSteps = [
    ...workflowSteps,
    { label: 'مرتجع البيع', status: srStepStatus, number: returnNumber || undefined },
  ]

  // Source document label mapping
  const getSourceLabel = () => {
    switch (linkedSourceType) {
      case 'salesOrder': return 'أمر البيع'
      case 'salesInvoice': return 'فاتورة البيع'
      case 'deliveryNote': return 'إذن الصرف'
      default: return ''
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-red-600" />
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* ── Page Header ── */}
      <DocumentPageHeader
        icon={Undo2}
        iconBg="bg-red-50"
        iconColor="text-red-600"
        newTitle="مرتجع مبيعات جديد"
        editTitlePrefix="مرتجع مبيعات"
        documentNumber={returnNumber || undefined}
        status={currentStatus}
        subtitle={returnId ? 'عرض أو تعديل مرتجع البيع' : 'إنشاء مرتجع مبيعات جديد'}
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
                  label: 'تأكيد المرتجع',
                  icon: Send,
                  onClick: handleConfirm,
                  disabled: submitting,
                  loading: submitting,
                  className: 'bg-red-600 hover:bg-red-700 text-white border-red-200 text-red-700',
                },
              ]
            : undefined
        }
      />

      {/* ── Workflow Stepper ── */}
      <div className="bg-white border rounded-xl px-5 py-3 shadow-sm">
        <WorkflowStepper steps={returnWorkflowSteps} />
        {/* Linked document badges */}
        <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t">
          {linkedSalesOrderNumber && (
            <LinkedDocumentBadge label="أمر البيع" value={linkedSalesOrderNumber} />
          )}
          {linkedDeliveryNoteNumber && (
            <LinkedDocumentBadge label="إذن الصرف" value={linkedDeliveryNoteNumber} />
          )}
          {linkedSalesInvoiceNumber && (
            <LinkedDocumentBadge label="فاتورة البيع" value={linkedSalesInvoiceNumber} />
          )}
        </div>
      </div>

      {/* ── Return Info Section ── */}
      <DocumentSection
        title="بيانات مرتجع البيع"
        icon={ClipboardList}
        iconColor="text-red-600"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="space-y-2">
            <Label>التاريخ</Label>
            <Input
              type="date"
              value={returnDate}
              onChange={(e) => setReturnDate(e.target.value)}
              disabled={!isEditable}
            />
          </div>
          <div className="space-y-2">
            <Label>العميل <span className="text-red-500">*</span></Label>
            <Select
              value={returnCustomerId}
              onValueChange={setReturnCustomerId}
              disabled={!isEditable}
            >
              <SelectTrigger>
                <SelectValue placeholder="اختر العميل" />
              </SelectTrigger>
              <SelectContent>
                {customers.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.nameAr} ({c.code})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>المخزن <span className="text-red-500">*</span></Label>
            <Select
              value={returnWarehouseId}
              onValueChange={setReturnWarehouseId}
              disabled={!isEditable}
            >
              <SelectTrigger>
                <SelectValue placeholder="اختر المخزن" />
              </SelectTrigger>
              <SelectContent>
                {warehouses.map((w) => (
                  <SelectItem key={w.id} value={w.id}>
                    {w.nameAr} ({w.code})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {linkedSourceNumber && (
            <div className="space-y-2">
              <Label>المستند المرجعي</Label>
              <Input
                value={`${getSourceLabel()}: ${linkedSourceNumber}`}
                disabled
                className="bg-slate-50 text-slate-600 font-mono"
              />
            </div>
          )}
        </div>
      </DocumentSection>

      {/* ── Lines Section ── */}
      <DocumentSection
        title="بنود المرتجع"
        icon={Package}
        iconColor="text-red-600"
        action={
          isEditable ? (
            <Button
              variant="outline"
              size="sm"
              onClick={addLine}
              className="gap-1.5 text-red-600 border-red-200 hover:bg-red-50"
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
                        onClick={() => handleAddItemById(item.id)}
                        className="w-full text-right px-3 py-2 text-sm hover:bg-red-50 border-b last:border-0 transition-colors"
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
            <div className="col-span-2 text-xs font-semibold text-slate-500">كود الصنف</div>
            <div className="col-span-2 text-xs font-semibold text-slate-500">اسم الصنف</div>
            <div className="col-span-2 text-xs font-semibold text-slate-500">الكمية</div>
            <div className="col-span-2 text-xs font-semibold text-slate-500">السعر</div>
            <div className="col-span-2 text-xs font-semibold text-slate-500">الإجمالي</div>
            <div className="col-span-1"></div>
            <div className="col-span-1"></div>
          </div>

          {/* Line items with alternating row backgrounds */}
          {returnLines.map((line, idx) => (
            <div
              key={idx}
              className={cn(
                'grid grid-cols-12 gap-2 items-center px-5 py-2.5 border-b last:border-b-0',
                idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/70'
              )}
            >
              <div className="col-span-2">
                {isEditable ? (
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
                          {it.code}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <span className="text-sm font-mono text-slate-600">{line.itemCode || items.find(i => i.id === line.itemId)?.code || '—'}</span>
                )}
              </div>
              <div className="col-span-2">
                {isEditable && !line.itemId ? (
                  <Select
                    value={line.itemId}
                    onValueChange={(val) => updateLine(idx, 'itemId', val)}
                  >
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue placeholder="اختر الصنف" />
                    </SelectTrigger>
                    <SelectContent>
                      {items.map((it) => (
                        <SelectItem key={it.id} value={it.id}>
                          {it.nameAr}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <span className="text-sm text-slate-700">{line.itemName || items.find(i => i.id === line.itemId)?.nameAr || '—'}</span>
                )}
              </div>
              <div className="col-span-2">
                <div className="relative">
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
                  {line.originalQty && (
                    <span className="absolute -top-4 right-0 text-[10px] text-slate-400">
                      من المستند: {line.originalQty}
                    </span>
                  )}
                </div>
              </div>
              <div className="col-span-2">
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={line.unitPrice}
                  onChange={(e) => updateLine(idx, 'unitPrice', e.target.value)}
                  className="h-9 text-sm"
                  dir="ltr"
                  disabled={!isEditable}
                />
              </div>
              <div className="col-span-2">
                <span className="text-sm font-mono font-semibold text-slate-700" dir="ltr">
                  {formatCurrency(calcLineTotal(line))}
                </span>
              </div>
              <div className="col-span-1"></div>
              <div className="col-span-1 flex items-center justify-center">
                {isEditable && returnLines.length > 1 && (
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
          {returnLines.length === 0 && (
            <div className="px-5 py-8 text-center text-sm text-slate-400">
              لم يتم إضافة بنود بعد
            </div>
          )}
        </div>
      </DocumentSection>

      {/* ── Totals & Notes ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <DocumentSection
          title="ملاحظات"
          icon={FileText}
          iconColor="text-red-600"
        >
          <Textarea
            value={returnNotes}
            onChange={(e) => setReturnNotes(e.target.value)}
            placeholder="ملاحظات إضافية..."
            rows={4}
            disabled={!isEditable}
            className="resize-none"
          />
        </DocumentSection>

        <DocumentSection
          title="ملخص الحساب"
          icon={Calculator}
          iconColor="text-red-600"
        >
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">عدد البنود</span>
              <span className="font-medium">
                {returnLines.filter((l) => l.itemId).length}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">إجمالي الكمية</span>
              <span className="font-mono font-medium" dir="ltr">
                {returnLines.reduce((sum, l) => sum + (parseFloat(l.quantity) || 0), 0).toFixed(0)}
              </span>
            </div>
            <Separator />
            <div className="flex justify-between items-center pt-2">
              <span className="text-base font-bold text-slate-900">إجمالي المرتجع</span>
              <span className="text-2xl font-bold font-mono text-red-600" dir="ltr">
                {formatCurrency(totalAmount)}
              </span>
            </div>
          </div>
        </DocumentSection>
      </div>
    </div>
  )
}
