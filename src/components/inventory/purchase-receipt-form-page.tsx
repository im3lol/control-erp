'use client'

import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import {
  Save, Send, Loader2, PackageCheck, Plus, XCircle,
  ScanLine, Search, FileText, Package, ClipboardList, Undo2,
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
import { DocumentSection, LinkedDocumentBadge } from '@/components/shared/document-section'
import WorkflowStepper, { getPurchaseWorkflow } from '@/components/shared/workflow-stepper'

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

interface Supplier {
  id: string
  code: string
  nameAr: string
  nameEn?: string
}

interface PurchaseOrder {
  id: string
  number: string
  supplierId: string
  warehouseId: string
  status: string
  supplier?: { id: string; code: string; nameAr: string; nameEn?: string }
  _count?: { lines: number }
}

interface PurchaseReceiptLine {
  id: string
  itemId: string
  quantity: number
  notes: string | null
  item?: { id: string; code: string; nameAr?: string; nameEn?: string; uom?: { nameAr: string } | null }
}

interface PurchaseReceiptDetail {
  id: string
  number: string
  date: string
  status: string
  purchaseInvoiceId: string | null
  purchaseOrderId: string | null
  supplierId: string | null
  warehouseId: string
  notes: string | null
  supplier?: { id: string; code: string; nameAr: string; nameEn?: string }
  warehouse?: { id: string; code: string; nameAr: string; nameEn?: string }
  purchaseInvoice?: { id: string; number: string }
  purchaseOrder?: { id: string; number: string }
  lines: PurchaseReceiptLine[]
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

export default function PurchaseReceiptFormPage() {
  const companyId = useAppStore(state => state.currentCompanyId)
  const setModule = useAppStore(state => state.setModule)
  const setView = useAppStore(state => state.setView)
  const editingDocId = useAppStore(state => state.editingDocId)

  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [items, setItems] = useState<Item[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([])
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [orderLoading, setOrderLoading] = useState(false)

  // Form state
  const [receiptWarehouseId, setReceiptWarehouseId] = useState('')
  const [receiptPurchaseOrderId, setReceiptPurchaseOrderId] = useState('')
  const [receiptSupplierId, setReceiptSupplierId] = useState('')
  const [receiptDate, setReceiptDate] = useState(new Date().toISOString().split('T')[0])
  const [receiptNotes, setReceiptNotes] = useState('')
  const [receiptLines, setReceiptLines] = useState<LineInput[]>([{ ...emptyLine }])
  const [currentStatus, setCurrentStatus] = useState<string>('DRAFT')
  const [receiptNumber, setReceiptNumber] = useState<string>('')
  const [receiptId, setReceiptId] = useState<string>('')

  // Linked document numbers for workflow stepper & badges
  const [linkedPurchaseOrderNumber, setLinkedPurchaseOrderNumber] = useState<string>('')
  const [linkedPurchaseInvoiceNumber, setLinkedPurchaseInvoiceNumber] = useState<string>('')

  // Barcode & search
  const [barcodeInput, setBarcodeInput] = useState('')
  const [searchQuery, setSearchQuery] = useState('')

  // Check localStorage for pending purchase receipt from Purchase Order
  useEffect(() => {
    try {
      const pending = localStorage.getItem('pendingPurchaseReceipt')
      if (pending) {
        localStorage.removeItem('pendingPurchaseReceipt')
        const data = JSON.parse(pending)
        if (data.warehouseId) setReceiptWarehouseId(data.warehouseId)
        if (data.purchaseOrderId) setReceiptPurchaseOrderId(data.purchaseOrderId)
        if (data.supplierId) setReceiptSupplierId(data.supplierId)
        if (data.lines && data.lines.length > 0) {
          const orderLines: LineInput[] = data.lines
            .filter((l: { remainingQty: number }) => l.remainingQty > 0)
            .map((l: { itemId: string; remainingQty: number }) => ({
              itemId: l.itemId,
              quantity: String(l.remainingQty),
              notes: '',
            }))
          if (orderLines.length > 0) setReceiptLines(orderLines)
        }
      }
    } catch { /* silent */ }
  }, [])

  // Load data
  useEffect(() => {
    fetchWarehouses()
    fetchItems()
    fetchSuppliers()
    fetchPurchaseOrders()
    if (editingDocId && editingDocId !== 'new') {
      loadReceipt(editingDocId)
    }
  }, [])

  const loadReceipt = async (id: string) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/inventory/purchase-receipts/${id}?companyId=${companyId}`)
      if (res.ok) {
        const receipt: PurchaseReceiptDetail = await res.json()
        setReceiptId(receipt.id)
        setReceiptNumber(receipt.number)
        setCurrentStatus(receipt.status)
        setReceiptWarehouseId(receipt.warehouseId)
        setReceiptPurchaseOrderId(receipt.purchaseOrderId || '')
        setReceiptSupplierId(receipt.supplierId || '')
        setReceiptDate(receipt.date.split('T')[0])
        setReceiptNotes(receipt.notes || '')
        setReceiptLines(receipt.lines.map(l => ({
          itemId: l.itemId,
          quantity: String(l.quantity),
          notes: l.notes || '',
        })))
        // Store linked document numbers
        setLinkedPurchaseOrderNumber(receipt.purchaseOrder?.number || '')
        setLinkedPurchaseInvoiceNumber(receipt.purchaseInvoice?.number || '')
      }
    } catch {
      toast.error('فشل في تحميل بيانات إذن الاستلام')
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

  const fetchSuppliers = async () => {
    try {
      const res = await fetch(`/api/purchases/suppliers?companyId=${companyId}`)
      if (res.ok) setSuppliers(await res.json())
    } catch { /* silent */ }
  }

  const fetchPurchaseOrders = async () => {
    try {
      const res = await fetch(`/api/purchases/orders?companyId=${companyId}&status=CONFIRMED`)
      if (res.ok) setPurchaseOrders(await res.json())
    } catch { /* silent */ }
  }

  const handleGoBack = () => {
    setModule('inventory')
    setView('purchase-receipts')
  }

  // ── Purchase Order auto-fill ──

  const handlePurchaseOrderChange = async (orderId: string) => {
    if (!orderId || orderId === '__none__') {
      setReceiptPurchaseOrderId('')
      setLinkedPurchaseOrderNumber('')
      setReceiptSupplierId('')
      setReceiptWarehouseId('')
      setReceiptLines([{ ...emptyLine }])
      return
    }

    setReceiptPurchaseOrderId(orderId)
    setOrderLoading(true)

    try {
      const res = await fetch(`/api/purchases/orders/${orderId}?companyId=${companyId}`)
      if (res.ok) {
        const order = await res.json()
        setReceiptSupplierId(order.supplierId)
        setReceiptWarehouseId(order.warehouseId)
        setLinkedPurchaseOrderNumber(order.number)
        if (order.lines && order.lines.length > 0) {
          const orderLines = order.lines
            .filter((l: { quantity: number; receivedQty: number }) => (l.quantity - l.receivedQty) > 0)
            .map((l: { itemId: string; quantity: number; receivedQty: number }) => ({
              itemId: l.itemId,
              quantity: String(l.quantity - l.receivedQty),
              notes: '',
            }))
          if (orderLines.length > 0) {
            setReceiptLines(orderLines)
          } else {
            toast.info('جميع أصناف أمر الشراء تم استلامها بالكامل')
            setReceiptLines([{ ...emptyLine }])
          }
        }
      } else {
        toast.error('فشل في تحميل تفاصيل أمر الشراء')
      }
    } catch {
      toast.error('حدث خطأ أثناء تحميل أمر الشراء')
    } finally {
      setOrderLoading(false)
    }
  }

  // ── Line handlers ──

  const updateLine = (index: number, field: keyof LineInput, value: string) => {
    setReceiptLines((prev) => {
      const updated = [...prev]
      updated[index] = { ...updated[index], [field]: value }
      return updated
    })
  }

  const addLine = () => {
    setReceiptLines((prev) => [...prev, { ...emptyLine }])
  }

  const removeLine = (index: number) => {
    if (receiptLines.length <= 1) return
    setReceiptLines((prev) => prev.filter((_, i) => i !== index))
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
    const existing = receiptLines.findIndex(l => l.itemId === itemId)
    if (existing >= 0) {
      updateLine(existing, 'quantity', String(parseFloat(receiptLines[existing].quantity) + 1))
    } else {
      setReceiptLines(prev => [...prev, { itemId, quantity: '1', notes: '' }])
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
    if (!receiptWarehouseId) {
      toast.error('يرجى اختيار المخزن')
      return
    }
    if (!receiptDate) {
      toast.error('يرجى تحديد التاريخ')
      return
    }
    const validLines = receiptLines.filter(l => l.itemId && parseFloat(l.quantity) > 0)
    if (validLines.length === 0) {
      toast.error('يجب إضافة سطر واحد على الأقل')
      return
    }

    setSubmitting(true)
    try {
      const payload = {
        warehouseId: receiptWarehouseId,
        purchaseOrderId: receiptPurchaseOrderId || undefined,
        supplierId: receiptSupplierId || undefined,
        date: receiptDate,
        notes: receiptNotes || undefined,
        lines: validLines.map(l => ({
          itemId: l.itemId,
          quantity: parseFloat(l.quantity),
          notes: l.notes || undefined,
        })),
        companyId,
      }

      let res
      if (receiptId) {
        res = await fetch(`/api/inventory/purchase-receipts/${receiptId}?companyId=${companyId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...payload, action: 'update' }),
        })
      } else {
        res = await fetch(`/api/inventory/purchase-receipts?companyId=${companyId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
      }

      if (res.ok) {
        const data = await res.json()
        setReceiptId(data.id)
        setReceiptNumber(data.number)
        setCurrentStatus('DRAFT')
        toast.success('تم حفظ إذن الاستلام كمسودة')
      } else {
        const err = await res.json()
        toast.error(err.error || 'فشل في حفظ إذن الاستلام')
      }
    } catch {
      toast.error('حدث خطأ أثناء حفظ إذن الاستلام')
    } finally {
      setSubmitting(false)
    }
  }

  // ── Submit (Confirm) ──

  const handleSubmit = async () => {
    if (!receiptWarehouseId) {
      toast.error('يرجى اختيار المخزن')
      return
    }
    if (!receiptDate) {
      toast.error('يرجى تحديد التاريخ')
      return
    }
    const validLines = receiptLines.filter(l => l.itemId && parseFloat(l.quantity) > 0)
    if (validLines.length === 0) {
      toast.error('يجب إضافة سطر واحد على الأقل')
      return
    }

    setSubmitting(true)
    try {
      if (!receiptId) {
        const payload = {
          warehouseId: receiptWarehouseId,
          purchaseOrderId: receiptPurchaseOrderId || undefined,
          supplierId: receiptSupplierId || undefined,
          date: receiptDate,
          notes: receiptNotes || undefined,
          lines: validLines.map(l => ({
            itemId: l.itemId,
            quantity: parseFloat(l.quantity),
            notes: l.notes || undefined,
          })),
          companyId,
        }
        const res = await fetch(`/api/inventory/purchase-receipts?companyId=${companyId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        if (res.ok) {
          const data = await res.json()
          setReceiptId(data.id)
          setReceiptNumber(data.number)
          await confirmReceipt(data.id)
        } else {
          const err = await res.json()
          toast.error(err.error || 'فشل في حفظ إذن الاستلام')
        }
      } else {
        await confirmReceipt(receiptId)
      }
    } catch {
      toast.error('حدث خطأ أثناء تأكيد إذن الاستلام')
    } finally {
      setSubmitting(false)
    }
  }

  const confirmReceipt = async (id: string) => {
    try {
      const res = await fetch(`/api/inventory/purchase-receipts/${id}?companyId=${companyId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'confirm', companyId }),
      })
      if (res.ok) {
        setCurrentStatus('CONFIRMED')
        toast.success('تم تأكيد إذن الاستلام بنجاح')
      } else {
        const err = await res.json()
        toast.error(err.error || 'فشل في تأكيد إذن الاستلام')
      }
    } catch {
      toast.error('حدث خطأ أثناء تأكيد إذن الاستلام')
    }
  }

  // ── Create Purchase Return shortcut ──

  const handleCreateReturn = () => {
    const returnData = {
      sourceType: 'purchaseReceipt' as const,
      sourceId: receiptId,
      sourceNumber: receiptNumber,
      supplierId: receiptSupplierId,
      supplierName: suppliers.find(s => s.id === receiptSupplierId)?.nameAr || '',
      warehouseId: receiptWarehouseId,
      lines: receiptLines.filter(l => l.itemId && parseFloat(l.quantity) > 0).map(l => ({
        itemId: l.itemId,
        itemCode: items.find(i => i.id === l.itemId)?.code || '',
        itemName: items.find(i => i.id === l.itemId)?.nameAr || '',
        quantity: parseFloat(l.quantity),
        unitPrice: 0,
      })),
    }
    localStorage.setItem('pendingPurchaseReturn', JSON.stringify(returnData))
    useAppStore.getState().setEditingDocId('new')
    useAppStore.getState().setModule('purchases')
    useAppStore.getState().setView('purchase-return-form')
  }

  // ── Create Purchase Invoice shortcut ──

  const handleCreatePurchaseInvoice = () => {
    const pendingData = {
      supplierId: receiptSupplierId,
      warehouseId: receiptWarehouseId,
      notes: `من إذن استلام ${receiptNumber}`,
      lines: receiptLines.filter(l => l.itemId && parseFloat(l.quantity) > 0).map(l => ({
        itemId: l.itemId,
        quantity: parseFloat(l.quantity),
      })),
    }
    localStorage.setItem('pendingPurchaseInvoice', JSON.stringify(pendingData))
    useAppStore.getState().setModule('purchases')
    useAppStore.getState().setView('purchase-invoice-form')
    useAppStore.getState().setEditingDocId('new')
  }

  const isEditable = currentStatus === 'DRAFT' || currentStatus === 'NEW'
  const linesLocked = !!receiptPurchaseOrderId

  // ── Workflow stepper ──

  const workflowSteps = getPurchaseWorkflow('PR', {
    poNumber: linkedPurchaseOrderNumber || undefined,
    prNumber: receiptNumber || undefined,
    piNumber: linkedPurchaseInvoiceNumber || undefined,
  })
  // Override step statuses based on actual document state
  // أمر الشراء: completed if linked, upcoming otherwise
  if (workflowSteps[0]) {
    workflowSteps[0].status = receiptPurchaseOrderId ? 'completed' : 'upcoming'
  }
  // إذن الاستلام: always current (this IS the purchase receipt)
  if (workflowSteps[1]) {
    workflowSteps[1].status = currentStatus === 'CONFIRMED' ? 'completed' : 'current'
  }
  // فاتورة الشراء: completed if linked, upcoming otherwise
  if (workflowSteps[2]) {
    workflowSteps[2].status = linkedPurchaseInvoiceNumber ? 'completed' : 'upcoming'
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-sky-600" />
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* ── Page Header ── */}
      <DocumentPageHeader
        icon={PackageCheck}
        iconBg="bg-sky-50"
        iconColor="text-sky-600"
        newTitle="إذن استلام جديد"
        editTitlePrefix="إذن استلام"
        documentNumber={receiptNumber || undefined}
        status={currentStatus}
        subtitle={receiptId ? 'تعديل أو تأكيد إذن الاستلام' : 'إنشاء إذن استلام مشتريات جديد'}
        onGoBack={handleGoBack}
        shortcutActions={
          currentStatus === 'CONFIRMED'
            ? [
                {
                  label: 'إنشاء فاتورة شراء',
                  icon: FileText,
                  onClick: handleCreatePurchaseInvoice,
                  className: 'bg-sky-600 hover:bg-sky-700 text-white border-sky-600',
                },
                {
                  label: 'إنشاء مرتجع',
                  icon: Undo2,
                  onClick: handleCreateReturn,
                  className: 'border-red-200 text-red-700 hover:bg-red-50',
                },
              ]
            : undefined
        }
        primaryActions={
          isEditable
            ? [
                {
                  label: 'حفظ كمسودة',
                  icon: Save,
                  onClick: handleSaveDraft,
                  disabled: submitting || orderLoading,
                  loading: submitting,
                },
                {
                  label: 'تأكيد',
                  icon: Send,
                  onClick: handleSubmit,
                  disabled: submitting || orderLoading,
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

      {/* ── Linked Documents ── */}
      {receiptPurchaseOrderId && linkedPurchaseOrderNumber && (
        <div className="flex items-center gap-2 flex-wrap">
          <LinkedDocumentBadge
            label="أمر الشراء"
            value={linkedPurchaseOrderNumber}
          />
        </div>
      )}

      {/* ── Receipt Info Section ── */}
      <DocumentSection
        title="بيانات إذن الاستلام"
        icon={PackageCheck}
        iconColor="text-sky-600"
      >
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label>المخزن <span className="text-red-500">*</span></Label>
            <Select
              value={receiptWarehouseId}
              onValueChange={setReceiptWarehouseId}
              disabled={!isEditable || !!receiptPurchaseOrderId}
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
            <Label>أمر الشراء (اختياري)</Label>
            <Select
              value={receiptPurchaseOrderId || '__none__'}
              onValueChange={handlePurchaseOrderChange}
              disabled={!isEditable || orderLoading}
            >
              <SelectTrigger>
                <SelectValue placeholder="اختر أمر الشراء" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">بدون أمر شراء</SelectItem>
                {purchaseOrders
                  .filter(po => po.status === 'CONFIRMED')
                  .map(po => (
                    <SelectItem key={po.id} value={po.id}>
                      {po.number} - {po.supplier?.nameAr || '—'}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>المورد</Label>
            <Select
              value={receiptSupplierId}
              onValueChange={setReceiptSupplierId}
              disabled={!isEditable || !!receiptPurchaseOrderId}
            >
              <SelectTrigger>
                <SelectValue placeholder="اختر المورد" />
              </SelectTrigger>
              <SelectContent>
                {suppliers.map(supp => (
                  <SelectItem key={supp.id} value={supp.id}>
                    {supp.nameAr} ({supp.code})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {receiptPurchaseOrderId && (
              <p className="text-xs text-slate-400">يتم تعبئته تلقائياً من أمر الشراء</p>
            )}
          </div>

          <div className="space-y-2">
            <Label>التاريخ</Label>
            <Input
              type="date"
              value={receiptDate}
              onChange={(e) => setReceiptDate(e.target.value)}
              disabled={!isEditable}
              dir="ltr"
            />
          </div>
        </div>
      </DocumentSection>

      {/* ── Lines Section ── */}
      <DocumentSection
        title="بنود إذن الاستلام"
        icon={Package}
        iconColor="text-sky-600"
        action={
          isEditable && !linesLocked ? (
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
          {linesLocked && (
            <div className="px-5 pt-4 pb-2">
              <p className="text-xs text-slate-400">الأصناف معبأة تلقائياً من أمر الشراء المحدد</p>
            </div>
          )}

          {/* Barcode & Search Area */}
          {isEditable && !linesLocked && (
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
          {receiptLines.map((line, idx) => (
            <div
              key={idx}
              className={`grid grid-cols-12 gap-2 items-center px-5 py-2.5 border-b last:border-b-0 ${
                idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/70'
              }`}
            >
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
                {isEditable && !linesLocked && receiptLines.length > 1 && (
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
          {receiptLines.length === 0 && (
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
        iconColor="text-sky-600"
      >
        <Textarea
          value={receiptNotes}
          onChange={(e) => setReceiptNotes(e.target.value)}
          placeholder="ملاحظات إضافية..."
          rows={4}
          disabled={!isEditable}
          className="resize-none"
        />
      </DocumentSection>
    </div>
  )
}
