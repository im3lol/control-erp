'use client'

import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import {
  Save, Send, Loader2, FileText, Plus, XCircle,
  ScanLine, Search, Undo2, Package, Calculator,
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
import WorkflowStepper, { getPurchaseWorkflow } from '@/components/shared/workflow-stepper'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Supplier {
  id: string
  code: string
  nameAr: string
  nameEn: string | null
}

interface Warehouse {
  id: string
  code: string
  nameAr: string
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
  quantity: string
  originalQuantity?: number
  unitPrice: string
  totalAmount: number
}

interface PurchaseReturnDetail {
  id: string
  number: string
  supplierId: string
  warehouseId: string
  date: string
  status: string
  totalAmount: number
  notes: string | null
  purchaseOrderId: string | null
  purchaseInvoiceId: string | null
  purchaseReceiptId: string | null
  supplier: { id: string; code: string; nameAr: string }
  warehouse: { id: string; code: string; nameAr: string }
  purchaseOrder: { id: string; number: string } | null
  purchaseInvoice: { id: string; number: string } | null
  purchaseReceipt: { id: string; number: string } | null
  lines: Array<{
    id: string
    itemId: string
    quantity: number
    unitPrice: number
    totalAmount: number
    item: { id: string; code: string; nameAr: string; uom?: { nameAr: string } | null }
  }>
}

// localStorage pre-fill type
interface PendingPurchaseReturn {
  sourceType: 'purchaseOrder' | 'purchaseInvoice' | 'purchaseReceipt'
  sourceId: string
  sourceNumber: string
  supplierId: string
  supplierName: string
  warehouseId: string
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

export default function PurchaseReturnFormPage() {
  const companyId = useAppStore(state => state.currentCompanyId)
  const setModule = useAppStore(state => state.setModule)
  const setView = useAppStore(state => state.setView)
  const editingDocId = useAppStore(state => state.editingDocId)
  const setEditingDocId = useAppStore(state => state.setEditingDocId)

  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [items, setItems] = useState<Item[]>([])
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // Form state
  const [returnSupplierId, setReturnSupplierId] = useState('')
  const [returnWarehouseId, setReturnWarehouseId] = useState('')
  const [returnDate, setReturnDate] = useState(new Date().toISOString().split('T')[0])
  const [returnNotes, setReturnNotes] = useState('')
  const [returnLines, setReturnLines] = useState<ReturnLine[]>([{ ...emptyLine }])
  const [currentStatus, setCurrentStatus] = useState<string>('DRAFT')
  const [returnNumber, setReturnNumber] = useState<string>('')
  const [returnId, setReturnId] = useState<string>('')
  const [barcodeInput, setBarcodeInput] = useState('')
  const [searchQuery, setSearchQuery] = useState('')

  // Linked document tracking
  const [linkedSourceNumber, setLinkedSourceNumber] = useState<string>('')
  const [linkedSourceType, setLinkedSourceType] = useState<string>('')
  const [linkedPurchaseOrderId, setLinkedPurchaseOrderId] = useState<string | null>(null)
  const [linkedPurchaseInvoiceId, setLinkedPurchaseInvoiceId] = useState<string | null>(null)
  const [linkedPurchaseReceiptId, setLinkedPurchaseReceiptId] = useState<string | null>(null)
  const [linkedPurchaseOrderNumber, setLinkedPurchaseOrderNumber] = useState<string>('')
  const [linkedPurchaseReceiptNumber, setLinkedPurchaseReceiptNumber] = useState<string>('')
  const [linkedPurchaseInvoiceNumber, setLinkedPurchaseInvoiceNumber] = useState<string>('')

  // Check localStorage for pre-fill from source document
  useEffect(() => {
    try {
      const pending = localStorage.getItem('pendingPurchaseReturn')
      if (pending) {
        localStorage.removeItem('pendingPurchaseReturn')
        const data: PendingPurchaseReturn = JSON.parse(pending)
        if (data.supplierId) setReturnSupplierId(data.supplierId)
        if (data.warehouseId) setReturnWarehouseId(data.warehouseId)
        if (data.sourceNumber) setLinkedSourceNumber(data.sourceNumber)
        if (data.sourceType) setLinkedSourceType(data.sourceType)

        // Set linked document IDs based on source type
        if (data.sourceType === 'purchaseOrder') {
          setLinkedPurchaseOrderId(data.sourceId)
          setLinkedPurchaseOrderNumber(data.sourceNumber)
        } else if (data.sourceType === 'purchaseInvoice') {
          setLinkedPurchaseInvoiceId(data.sourceId)
          setLinkedPurchaseInvoiceNumber(data.sourceNumber)
        } else if (data.sourceType === 'purchaseReceipt') {
          setLinkedPurchaseReceiptId(data.sourceId)
          setLinkedPurchaseReceiptNumber(data.sourceNumber)
        }

        // Pre-fill lines from source document
        if (data.lines && data.lines.length > 0) {
          const prefillLines: ReturnLine[] = data.lines.map(l => ({
            itemId: l.itemId,
            itemCode: l.itemCode,
            itemName: l.itemName,
            quantity: String(l.quantity),
            originalQuantity: l.quantity,
            unitPrice: String(l.unitPrice),
            totalAmount: l.quantity * l.unitPrice,
          }))
          setReturnLines(prefillLines)
        }
      }
    } catch { /* silent */ }
  }, [])

  // Load editing return
  useEffect(() => {
    fetchSuppliers()
    fetchWarehouses()
    fetchItems()
    if (editingDocId && editingDocId !== 'new') {
      loadReturn(editingDocId)
    }
  }, [])

  const loadReturn = async (id: string) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/purchases/returns/${id}?companyId=${companyId}`)
      if (res.ok) {
        const ret: PurchaseReturnDetail = await res.json()
        setReturnId(ret.id)
        setReturnNumber(ret.number)
        setCurrentStatus(ret.status)
        setReturnSupplierId(ret.supplierId)
        setReturnWarehouseId(ret.warehouseId)
        setReturnDate(ret.date.split('T')[0])
        setReturnNotes(ret.notes || '')
        setLinkedPurchaseOrderId(ret.purchaseOrderId)
        setLinkedPurchaseInvoiceId(ret.purchaseInvoiceId)
        setLinkedPurchaseReceiptId(ret.purchaseReceiptId)
        if (ret.purchaseOrder) setLinkedPurchaseOrderNumber(ret.purchaseOrder.number)
        if (ret.purchaseInvoice) setLinkedPurchaseInvoiceNumber(ret.purchaseInvoice.number)
        if (ret.purchaseReceipt) setLinkedPurchaseReceiptNumber(ret.purchaseReceipt.number)
        // Determine the primary linked source number for display
        if (ret.purchaseReceipt) {
          setLinkedSourceNumber(ret.purchaseReceipt.number)
          setLinkedSourceType('purchaseReceipt')
        } else if (ret.purchaseInvoice) {
          setLinkedSourceNumber(ret.purchaseInvoice.number)
          setLinkedSourceType('purchaseInvoice')
        } else if (ret.purchaseOrder) {
          setLinkedSourceNumber(ret.purchaseOrder.number)
          setLinkedSourceType('purchaseOrder')
        }
        setReturnLines(ret.lines.map(l => ({
          id: l.id,
          itemId: l.itemId,
          itemCode: l.item?.code,
          itemName: l.item?.nameAr,
          quantity: String(l.quantity),
          unitPrice: String(l.unitPrice),
          totalAmount: l.totalAmount,
        })))
      }
    } catch {
      toast.error('فشل في تحميل بيانات مرتجع المشتريات')
    } finally {
      setLoading(false)
    }
  }

  const fetchSuppliers = async () => {
    try {
      const res = await fetch(`/api/purchases/suppliers?activeOnly=true&companyId=${companyId}`)
      if (res.ok) setSuppliers(await res.json())
    } catch { /* silent */ }
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
    setEditingDocId(null)
    setModule('purchases')
    setView('purchase-returns')
  }

  // ── Line calculations ──

  const calcLineTotal = useCallback((line: ReturnLine) => {
    const qty = parseFloat(line.quantity) || 0
    const price = parseFloat(line.unitPrice) || 0
    return qty * price
  }, [])

  const calcReturnTotal = useCallback(() => {
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
    if (!returnSupplierId) {
      toast.error('يرجى اختيار المورد')
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
        supplierId: returnSupplierId,
        warehouseId: returnWarehouseId,
        date: returnDate,
        notes: returnNotes,
        purchaseOrderId: linkedPurchaseOrderId || null,
        purchaseInvoiceId: linkedPurchaseInvoiceId || null,
        purchaseReceiptId: linkedPurchaseReceiptId || null,
        lines: validLines.map((l) => ({
          itemId: l.itemId,
          quantity: parseFloat(l.quantity),
          unitPrice: parseFloat(l.unitPrice),
        })),
        companyId,
      }

      let res
      if (returnId) {
        res = await fetch(`/api/purchases/returns/${returnId}?companyId=${companyId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...payload, action: 'update' }),
        })
      } else {
        res = await fetch(`/api/purchases/returns?companyId=${companyId}`, {
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
        toast.success('تم حفظ مرتجع المشتريات كمسودة')
      } else {
        const err = await res.json()
        toast.error(err.error || 'فشل في حفظ مرتجع المشتريات')
      }
    } catch {
      toast.error('حدث خطأ أثناء حفظ مرتجع المشتريات')
    } finally {
      setSubmitting(false)
    }
  }

  // ── Confirm Return ──

  const handleConfirm = async () => {
    if (!returnId) {
      // Save first then confirm
      if (!returnSupplierId) {
        toast.error('يرجى اختيار المورد')
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
          supplierId: returnSupplierId,
          warehouseId: returnWarehouseId,
          date: returnDate,
          notes: returnNotes,
          purchaseOrderId: linkedPurchaseOrderId || null,
          purchaseInvoiceId: linkedPurchaseInvoiceId || null,
          purchaseReceiptId: linkedPurchaseReceiptId || null,
          lines: validLines.map((l) => ({
            itemId: l.itemId,
            quantity: parseFloat(l.quantity),
            unitPrice: parseFloat(l.unitPrice),
          })),
          companyId,
        }

        const res = await fetch(`/api/purchases/returns?companyId=${companyId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })

        if (res.ok) {
          const data = await res.json()
          setReturnId(data.id)
          setReturnNumber(data.number)
          await confirmReturn(data.id)
        } else {
          const err = await res.json()
          toast.error(err.error || 'فشل في حفظ مرتجع المشتريات')
        }
      } catch {
        toast.error('حدث خطأ أثناء حفظ مرتجع المشتريات')
      } finally {
        setSubmitting(false)
      }
    } else {
      setSubmitting(true)
      await confirmReturn(returnId)
      setSubmitting(false)
    }
  }

  const confirmReturn = async (id: string) => {
    try {
      const res = await fetch(`/api/purchases/returns/${id}?companyId=${companyId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'confirm', companyId }),
      })
      if (res.ok) {
        setCurrentStatus('CONFIRMED')
        toast.success('تم تأكيد مرتجع المشتريات بنجاح')
      } else {
        const err = await res.json()
        toast.error(err.error || 'فشل في تأكيد مرتجع المشتريات')
      }
    } catch {
      toast.error('حدث خطأ أثناء تأكيد مرتجع المشتريات')
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
          const newLine: ReturnLine = {
            itemId: data.itemId,
            itemCode: item?.code,
            itemName: item?.nameAr,
            quantity: '1',
            unitPrice: String(item?.sellPrice || 0),
            totalAmount: item?.sellPrice || 0,
          }
          setReturnLines(prev => [...prev, newLine])
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
    const newLine: ReturnLine = {
      itemId,
      itemCode: item?.code,
      itemName: item?.nameAr,
      quantity: '1',
      unitPrice: String(item?.sellPrice || 0),
      totalAmount: item?.sellPrice || 0,
    }
    setReturnLines(prev => [...prev, newLine])
    setSearchQuery('')
  }

  const totalAmount = calcReturnTotal()
  const isEditable = currentStatus === 'DRAFT' || currentStatus === 'NEW'

  // Determine workflow step statuses for purchase return
  const prStepStatus = currentStatus === 'CONFIRMED' ? 'completed' : 'current'
  const workflowSteps = getPurchaseWorkflow('PR', {
    poNumber: linkedPurchaseOrderNumber || undefined,
    prNumber: linkedPurchaseReceiptNumber || undefined,
    piNumber: linkedPurchaseInvoiceNumber || undefined,
  })

  // Override the receipt step status based on return status
  // For returns, the "current" step is the return itself — which is after the purchase receipt
  // We'll show the purchase workflow plus a "return" step
  // Actually, let's keep it simpler: show the purchase workflow as reference and mark the return status
  if (workflowSteps[1] && linkedPurchaseReceiptNumber) {
    workflowSteps[1].status = 'completed'
  }
  if (workflowSteps[0] && linkedPurchaseOrderNumber) {
    workflowSteps[0].status = 'completed'
  }

  // Get source document type label in Arabic
  const getSourceTypeLabel = (type: string) => {
    switch (type) {
      case 'purchaseOrder': return 'أمر الشراء'
      case 'purchaseInvoice': return 'فاتورة الشراء'
      case 'purchaseReceipt': return 'إذن الاستلام'
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
        newTitle="مرتجع مشتريات جديد"
        editTitlePrefix="مرتجع مشتريات"
        documentNumber={returnNumber || undefined}
        status={currentStatus}
        subtitle={returnId ? 'عرض أو تأكيد مرتجع المشتريات' : 'إنشاء مرتجع مشتريات جديد'}
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
                  className: 'border-red-200 text-red-700 hover:bg-red-50',
                },
                {
                  label: 'تأكيد المرتجع',
                  icon: Send,
                  onClick: handleConfirm,
                  disabled: submitting,
                  loading: submitting,
                  className: 'bg-red-600 hover:bg-red-700 text-white',
                },
              ]
            : undefined
        }
      />

      {/* ── Workflow Stepper ── */}
      <div className="bg-white border rounded-xl px-5 py-3 shadow-sm">
        <WorkflowStepper steps={workflowSteps} />
        {/* Linked document badges */}
        {(linkedPurchaseOrderNumber || linkedPurchaseReceiptNumber || linkedPurchaseInvoiceNumber) && (
          <div className="flex items-center gap-2 mt-2 pt-2 border-t">
            {linkedPurchaseOrderNumber && (
              <LinkedDocumentBadge label="أمر الشراء" value={linkedPurchaseOrderNumber} />
            )}
            {linkedPurchaseReceiptNumber && (
              <LinkedDocumentBadge label="إذن الاستلام" value={linkedPurchaseReceiptNumber} />
            )}
            {linkedPurchaseInvoiceNumber && (
              <LinkedDocumentBadge label="فاتورة الشراء" value={linkedPurchaseInvoiceNumber} />
            )}
          </div>
        )}
      </div>

      {/* ── Return Info Section ── */}
      <DocumentSection
        title="بيانات مرتجع المشتريات"
        icon={Undo2}
        iconColor="text-red-600"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="space-y-2">
            <Label>المورد <span className="text-red-500">*</span></Label>
            <Select
              value={returnSupplierId}
              onValueChange={setReturnSupplierId}
              disabled={!isEditable}
            >
              <SelectTrigger>
                <SelectValue placeholder="اختر المورد" />
              </SelectTrigger>
              <SelectContent>
                {suppliers.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.nameAr} ({s.code})
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
          <div className="space-y-2">
            <Label>التاريخ</Label>
            <Input
              type="date"
              value={returnDate}
              onChange={(e) => setReturnDate(e.target.value)}
              disabled={!isEditable}
            />
          </div>
          {linkedSourceNumber && (
            <div className="space-y-2">
              <Label>المستند المرتبط</Label>
              <div className="flex items-center h-9 px-3 rounded-md border bg-slate-50 text-sm">
                <span className="text-slate-400 ml-1">{getSourceTypeLabel(linkedSourceType)}:</span>
                <span className="font-mono font-medium text-slate-700">{linkedSourceNumber}</span>
              </div>
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
            <div className="col-span-1 text-xs font-semibold text-slate-500">كود الصنف</div>
            <div className="col-span-3 text-xs font-semibold text-slate-500">اسم الصنف</div>
            <div className="col-span-2 text-xs font-semibold text-slate-500">الكمية</div>
            <div className="col-span-2 text-xs font-semibold text-slate-500">السعر</div>
            <div className="col-span-2 text-xs font-semibold text-slate-500">الإجمالي</div>
            <div className="col-span-2"></div>
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
              <div className="col-span-1">
                <span className="text-xs font-mono text-slate-500">
                  {line.itemCode || (line.itemId ? items.find(i => i.id === line.itemId)?.code : '')}
                </span>
              </div>
              <div className="col-span-3">
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
                          {it.nameAr} ({it.code})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <span className="text-sm text-slate-700">
                    {line.itemName || items.find(i => i.id === line.itemId)?.nameAr || '—'}
                  </span>
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
                  {line.originalQuantity && (
                    <span className="absolute -top-4 right-0 text-[10px] text-slate-400" dir="ltr">
                      الأصل: {line.originalQuantity}
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
              <div className="col-span-2 flex items-center justify-center">
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
          title="ملخص المرتجع"
          icon={Calculator}
          iconColor="text-red-600"
        >
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">عدد البنود</span>
              <span className="font-medium">
                {returnLines.filter(l => l.itemId).length} بند
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
              <span className="text-2xl font-bold font-mono text-red-700" dir="ltr">
                {formatCurrency(totalAmount)}
              </span>
            </div>
            {currentStatus !== 'DRAFT' && (
              <div className={cn(
                'flex items-center gap-2 px-3 py-2 rounded-lg text-sm',
                currentStatus === 'CONFIRMED' ? 'bg-emerald-50 text-emerald-700' :
                currentStatus === 'CANCELLED' ? 'bg-slate-50 text-slate-500' : 'bg-slate-50 text-slate-500'
              )}>
                <span>حالة المرتجع: {getDocumentStatusBadge(currentStatus)}</span>
              </div>
            )}
          </div>
        </DocumentSection>
      </div>
    </div>
  )
}
