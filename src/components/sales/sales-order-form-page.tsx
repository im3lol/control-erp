'use client'

import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import {
  Save, Send, Loader2, FileText, Plus, XCircle,
  ScanLine, Search, Truck, ClipboardList, Package, Calculator, Undo2,
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
import DocumentPageHeader, { getDocumentStatusBadge } from '@/components/shared/document-page-header'
import { DocumentSection } from '@/components/shared/document-section'
import WorkflowStepper, { getSalesWorkflow } from '@/components/shared/workflow-stepper'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Customer {
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

interface OrderLine {
  id?: string
  itemId: string
  quantity: string
  unitPrice: string
  discountAmount: string
  taxAmount: string
  totalAmount: number
}

interface SalesOrderDetail {
  id: string
  number: string
  customerId: string
  date: string
  dueDate: string | null
  status: string
  subtotal: number
  discountAmount: number
  taxAmount: number
  totalAmount: number
  notes: string | null
  customer: { id: string; code: string; nameAr: string }
  lines: Array<{
    id: string
    itemId: string
    quantity: number
    deliveredQty: number
    unitPrice: number
    discountAmount: number
    taxAmount: number
    totalAmount: number
    item: { id: string; code: string; nameAr: string; uom?: { nameAr: string } | null }
  }>
}

const emptyLine: OrderLine = {
  itemId: '',
  quantity: '1',
  unitPrice: '0',
  discountAmount: '0',
  taxAmount: '0',
  totalAmount: 0,
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function SalesOrderFormPage() {
  const companyId = useAppStore(state => state.currentCompanyId)
  const setModule = useAppStore(state => state.setModule)
  const setView = useAppStore(state => state.setView)
  const editingDocId = useAppStore(state => state.editingDocId)
  const setEditingDocId = useAppStore(state => state.setEditingDocId)

  const [customers, setCustomers] = useState<Customer[]>([])
  const [items, setItems] = useState<Item[]>([])
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // Form state
  const [orderCustomerId, setOrderCustomerId] = useState('')
  const [orderDate, setOrderDate] = useState(new Date().toISOString().split('T')[0])
  const [orderDueDate, setOrderDueDate] = useState('')
  const [orderNotes, setOrderNotes] = useState('')
  const [orderLines, setOrderLines] = useState<OrderLine[]>([{ ...emptyLine }])
  const [orderDiscountAmount, setOrderDiscountAmount] = useState('0')
  const [orderTaxPercent, setOrderTaxPercent] = useState('0')
  const [currentStatus, setCurrentStatus] = useState<string>('DRAFT')
  const [orderNumber, setOrderNumber] = useState<string>('')
  const [orderId, setOrderId] = useState<string>('')
  const [barcodeInput, setBarcodeInput] = useState('')
  const [searchQuery, setSearchQuery] = useState('')

  // Load editing order
  useEffect(() => {
    fetchCustomers()
    fetchItems()
    if (editingDocId && editingDocId !== 'new') {
      loadOrder(editingDocId)
    }
  }, [])

  const loadOrder = async (id: string) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/sales/orders/${id}?companyId=${companyId}`)
      if (res.ok) {
        const order: SalesOrderDetail = await res.json()
        setOrderId(order.id)
        setOrderNumber(order.number)
        setCurrentStatus(order.status)
        setOrderCustomerId(order.customerId)
        setOrderDate(order.date.split('T')[0])
        setOrderDueDate(order.dueDate ? order.dueDate.split('T')[0] : '')
        setOrderNotes(order.notes || '')
        setOrderDiscountAmount(String(order.discountAmount))
        setOrderTaxPercent(String(order.taxPercent || 0))
        setOrderLines(order.lines.map(l => ({
          id: l.id,
          itemId: l.itemId,
          quantity: String(l.quantity),
          unitPrice: String(l.unitPrice),
          discountAmount: String(l.discountAmount),
          taxAmount: String(l.taxAmount),
          totalAmount: l.totalAmount,
        })))
      }
    } catch {
      toast.error('فشل في تحميل بيانات أمر البيع')
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

  const fetchItems = async () => {
    try {
      const res = await fetch(`/api/inventory/items?activeOnly=true&companyId=${companyId}`)
      if (res.ok) setItems(await res.json())
    } catch { /* silent */ }
  }

  const handleGoBack = () => {
    setModule('sales')
    setView('sales-orders')
  }

  // ── Line calculations ──

  const calcLineTotal = useCallback((line: OrderLine) => {
    const qty = parseFloat(line.quantity) || 0
    const price = parseFloat(line.unitPrice) || 0
    const disc = parseFloat(line.discountAmount) || 0
    const tax = parseFloat(line.taxAmount) || 0
    return qty * price - disc + tax
  }, [])

  const calcOrderTotals = useCallback(() => {
    const rawSubtotal = orderLines.reduce((sum, l) => {
      const qty = parseFloat(l.quantity) || 0
      const price = parseFloat(l.unitPrice) || 0
      return sum + qty * price
    }, 0)
    const totalLineDiscounts = orderLines.reduce((sum, l) => sum + (parseFloat(l.discountAmount) || 0), 0)
    const totalLineTaxes = orderLines.reduce((sum, l) => sum + (parseFloat(l.taxAmount) || 0), 0)

    const invDiscount = parseFloat(orderDiscountAmount) || 0
    const invTaxPercent = parseFloat(orderTaxPercent) || 0
    const afterDiscount = rawSubtotal - totalLineDiscounts - invDiscount
    const invTax = invTaxPercent > 0 ? afterDiscount * (invTaxPercent / 100) : 0
    const totalTax = totalLineTaxes + invTax
    const total = afterDiscount + totalTax

    return {
      subtotal: rawSubtotal - totalLineDiscounts,
      totalDiscount: totalLineDiscounts + invDiscount,
      totalTax,
      total,
    }
  }, [orderLines, orderDiscountAmount, orderTaxPercent])

  const updateLine = (index: number, field: keyof OrderLine, value: string) => {
    setOrderLines((prev) => {
      const updated = [...prev]
      updated[index] = { ...updated[index], [field]: value }
      if (field === 'itemId') {
        const item = items.find((i) => i.id === value)
        if (item) {
          updated[index].unitPrice = String(item.sellPrice)
        }
      }
      updated[index].totalAmount = calcLineTotal(updated[index])
      return updated
    })
  }

  const addLine = () => {
    setOrderLines((prev) => [...prev, { ...emptyLine }])
  }

  const removeLine = (index: number) => {
    if (orderLines.length <= 1) return
    setOrderLines((prev) => prev.filter((_, i) => i !== index))
  }

  // ── Save Draft ──

  const handleSaveDraft = async () => {
    if (!orderCustomerId) {
      toast.error('يرجى اختيار العميل')
      return
    }
    const validLines = orderLines.filter((l) => l.itemId && parseFloat(l.quantity) > 0)
    if (validLines.length === 0) {
      toast.error('يجب إضافة سطر واحد على الأقل')
      return
    }

    setSubmitting(true)
    try {
      const payload = {
        customerId: orderCustomerId,
        date: orderDate,
        dueDate: orderDueDate || null,
        notes: orderNotes,
        discountAmount: parseFloat(orderDiscountAmount) || 0,
        taxPercent: parseFloat(orderTaxPercent) || 0,
        status: 'DRAFT',
        lines: validLines.map((l) => ({
          itemId: l.itemId,
          quantity: parseFloat(l.quantity),
          unitPrice: parseFloat(l.unitPrice),
          discountAmount: parseFloat(l.discountAmount) || 0,
          taxAmount: parseFloat(l.taxAmount) || 0,
        })),
        companyId,
      }

      let res
      if (orderId) {
        // Update existing
        res = await fetch(`/api/sales/orders/${orderId}?companyId=${companyId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...payload, action: 'update' }),
        })
      } else {
        // Create new
        res = await fetch(`/api/sales/orders?companyId=${companyId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
      }

      if (res.ok) {
        const data = await res.json()
        setOrderId(data.id)
        setOrderNumber(data.number)
        setCurrentStatus('DRAFT')
        toast.success('تم حفظ أمر البيع كمسودة')
      } else {
        const err = await res.json()
        toast.error(err.error || 'فشل في حفظ أمر البيع')
      }
    } catch {
      toast.error('حدث خطأ أثناء حفظ أمر البيع')
    } finally {
      setSubmitting(false)
    }
  }

  // ── Submit (Confirm) ──

  const handleSubmit = async () => {
    // If not yet saved, save first then confirm
    if (!orderId) {
      if (!orderCustomerId) {
        toast.error('يرجى اختيار العميل')
        return
      }
      const validLines = orderLines.filter((l) => l.itemId && parseFloat(l.quantity) > 0)
      if (validLines.length === 0) {
        toast.error('يجب إضافة سطر واحد على الأقل')
        return
      }

      setSubmitting(true)
      try {
        const payload = {
          customerId: orderCustomerId,
          date: orderDate,
          dueDate: orderDueDate || null,
          notes: orderNotes,
          discountAmount: parseFloat(orderDiscountAmount) || 0,
          taxPercent: parseFloat(orderTaxPercent) || 0,
          status: 'DRAFT',
          lines: validLines.map((l) => ({
            itemId: l.itemId,
            quantity: parseFloat(l.quantity),
            unitPrice: parseFloat(l.unitPrice),
            discountAmount: parseFloat(l.discountAmount) || 0,
            taxAmount: parseFloat(l.taxAmount) || 0,
          })),
          companyId,
        }

        const res = await fetch(`/api/sales/orders?companyId=${companyId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })

        if (res.ok) {
          const data = await res.json()
          setOrderId(data.id)
          setOrderNumber(data.number)
          // Now confirm
          await confirmOrder(data.id)
        } else {
          const err = await res.json()
          toast.error(err.error || 'فشل في حفظ أمر البيع')
        }
      } catch {
        toast.error('حدث خطأ أثناء حفظ أمر البيع')
      } finally {
        setSubmitting(false)
      }
    } else {
      // Already saved, just confirm
      setSubmitting(true)
      await confirmOrder(orderId)
      setSubmitting(false)
    }
  }

  const confirmOrder = async (id: string) => {
    try {
      const res = await fetch(`/api/sales/orders/${id}?companyId=${companyId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'confirm', companyId }),
      })
      if (res.ok) {
        setCurrentStatus('CONFIRMED')
        toast.success('تم تأكيد أمر البيع بنجاح')
      } else {
        const err = await res.json()
        toast.error(err.error || 'فشل في تأكيد أمر البيع')
      }
    } catch {
      toast.error('حدث خطأ أثناء تأكيد أمر البيع')
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
          const newLines = [...orderLines, { ...emptyLine }]
          const lastIdx = newLines.length - 1
          newLines[lastIdx] = { ...newLines[lastIdx], itemId: data.itemId, unitPrice: String(item?.sellPrice || 0) }
          newLines[lastIdx].totalAmount = calcLineTotal(newLines[lastIdx])
          setOrderLines(newLines)
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
    const newLines = [...orderLines, { ...emptyLine }]
    const lastIdx = newLines.length - 1
    newLines[lastIdx] = { ...newLines[lastIdx], itemId, unitPrice: String(item?.sellPrice || 0) }
    newLines[lastIdx].totalAmount = calcLineTotal(newLines[lastIdx])
    setOrderLines(newLines)
    setSearchQuery('')
  }

  // ── Create Sales Return shortcut ──

  const handleCreateReturn = () => {
    const returnData = {
      sourceType: 'salesOrder' as const,
      sourceId: orderId,
      sourceNumber: orderNumber,
      customerId: orderCustomerId,
      customerName: customers.find(c => c.id === orderCustomerId)?.nameAr || '',
      warehouseId: '',
      lines: orderLines.filter(l => l.itemId && parseFloat(l.quantity) > 0).map(l => ({
        itemId: l.itemId,
        itemCode: items.find(i => i.id === l.itemId)?.code || '',
        itemName: items.find(i => i.id === l.itemId)?.nameAr || '',
        quantity: parseFloat(l.quantity),
        unitPrice: parseFloat(l.unitPrice) || 0,
      })),
    }
    localStorage.setItem('pendingSalesReturn', JSON.stringify(returnData))
    setEditingDocId('new')
    setModule('sales')
    setView('sales-return-form')
  }

  // ── Convert to Delivery Note ──

  const handleConvertToDeliveryNote = () => {
    const validLines = orderLines.filter(l => l.itemId)
    localStorage.setItem('pendingDeliveryNote', JSON.stringify({
      salesOrderId: orderId,
      customerId: orderCustomerId,
      lines: validLines.map(l => ({
        itemId: l.itemId,
        quantity: parseFloat(l.quantity) - (0),
      })),
    }))
    setEditingDocId('new')
    setModule('inventory')
    setView('delivery-note-form')
  }

  const totals = calcOrderTotals()
  const isEditable = currentStatus === 'DRAFT' || currentStatus === 'NEW'

  // Determine workflow status
  const soStepStatus = currentStatus === 'CONFIRMED' || currentStatus === 'CLOSED' ? 'completed' : 'current'
  const workflowSteps = getSalesWorkflow('SO', {
    soNumber: orderNumber || undefined,
  })
  // Override the first step status based on actual order status
  if (workflowSteps[0]) {
    workflowSteps[0].status = soStepStatus
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* ── Page Header ── */}
      <DocumentPageHeader
        icon={FileText}
        iconBg="bg-emerald-50"
        iconColor="text-emerald-600"
        newTitle="أمر بيع جديد"
        editTitlePrefix="أمر بيع"
        documentNumber={orderNumber || undefined}
        status={currentStatus}
        subtitle={orderId ? 'تعديل أو تأكيد أمر البيع' : 'إنشاء أمر بيع جديد للعميل'}
        onGoBack={handleGoBack}
        shortcutActions={
          currentStatus === 'CONFIRMED'
            ? [
                {
                  label: 'تحويل لإذن صرف',
                  icon: Truck,
                  onClick: handleConvertToDeliveryNote,
                  className: 'border-amber-200 text-amber-700 hover:bg-amber-50',
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

      {/* ── Order Info Section ── */}
      <DocumentSection
        title="بيانات أمر البيع"
        icon={ClipboardList}
        iconColor="text-emerald-600"
      >
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label>العميل <span className="text-red-500">*</span></Label>
            <Select
              value={orderCustomerId}
              onValueChange={setOrderCustomerId}
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
            <Label>التاريخ</Label>
            <Input
              type="date"
              value={orderDate}
              onChange={(e) => setOrderDate(e.target.value)}
              disabled={!isEditable}
            />
          </div>
          <div className="space-y-2">
            <Label>تاريخ الاستحقاق</Label>
            <Input
              type="date"
              value={orderDueDate}
              onChange={(e) => setOrderDueDate(e.target.value)}
              disabled={!isEditable}
            />
          </div>
        </div>
      </DocumentSection>

      {/* ── Lines Section ── */}
      <DocumentSection
        title="بنود أمر البيع"
        icon={Package}
        iconColor="text-emerald-600"
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
                        onClick={() => handleAddItemById(item.id)}
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
            <div className="col-span-3 text-xs font-semibold text-slate-500">الصنف</div>
            <div className="col-span-2 text-xs font-semibold text-slate-500">الكمية</div>
            <div className="col-span-2 text-xs font-semibold text-slate-500">سعر الوحدة</div>
            <div className="col-span-1 text-xs font-semibold text-slate-500">الخصم</div>
            <div className="col-span-1 text-xs font-semibold text-slate-500">الضريبة</div>
            <div className="col-span-2 text-xs font-semibold text-slate-500">الإجمالي</div>
            <div className="col-span-1"></div>
          </div>

          {/* Line items with alternating row backgrounds */}
          {orderLines.map((line, idx) => (
            <div
              key={idx}
              className={`grid grid-cols-12 gap-2 items-center px-5 py-2.5 border-b last:border-b-0 ${
                idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/70'
              }`}
            >
              <div className="col-span-3">
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
              <div className="col-span-1">
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={line.discountAmount}
                  onChange={(e) => updateLine(idx, 'discountAmount', e.target.value)}
                  className="h-9 text-sm"
                  dir="ltr"
                  disabled={!isEditable}
                />
              </div>
              <div className="col-span-1">
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={line.taxAmount}
                  onChange={(e) => updateLine(idx, 'taxAmount', e.target.value)}
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
              <div className="col-span-1 flex items-center justify-center">
                {isEditable && orderLines.length > 1 && (
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
          {orderLines.length === 0 && (
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
          iconColor="text-emerald-600"
        >
          <Textarea
            value={orderNotes}
            onChange={(e) => setOrderNotes(e.target.value)}
            placeholder="ملاحظات إضافية..."
            rows={4}
            disabled={!isEditable}
            className="resize-none"
          />
        </DocumentSection>

        <DocumentSection
          title="ملخص الحساب"
          icon={Calculator}
          iconColor="text-emerald-600"
        >
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">المجموع الفرعي</span>
              <span className="font-mono font-medium" dir="ltr">{formatCurrency(totals.subtotal)}</span>
            </div>
            <div className="flex items-center justify-between gap-2 text-sm">
              <span className="text-slate-500">خصم الأمر</span>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={orderDiscountAmount}
                onChange={(e) => setOrderDiscountAmount(e.target.value)}
                className="h-8 w-28 text-sm text-left"
                dir="ltr"
                disabled={!isEditable}
              />
            </div>
            <div className="flex items-center justify-between gap-2 text-sm">
              <span className="text-slate-500">نسبة الضريبة %</span>
              <Input
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={orderTaxPercent}
                onChange={(e) => setOrderTaxPercent(e.target.value)}
                className="h-8 w-28 text-sm text-left"
                dir="ltr"
                disabled={!isEditable}
              />
            </div>
            <Separator />
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">إجمالي الخصم</span>
              <span className="font-mono text-red-600" dir="ltr">-{formatCurrency(totals.totalDiscount)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">إجمالي الضريبة</span>
              <span className="font-mono" dir="ltr">{formatCurrency(totals.totalTax)}</span>
            </div>
            <Separator />
            <div className="flex justify-between items-center pt-2">
              <span className="text-base font-bold text-slate-900">الإجمالي</span>
              <span className="text-2xl font-bold font-mono text-emerald-700" dir="ltr">
                {formatCurrency(totals.total)}
              </span>
            </div>
          </div>
        </DocumentSection>
      </div>
    </div>
  )
}
