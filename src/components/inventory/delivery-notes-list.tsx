'use client'

import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import {
  Truck,
  Plus,
  Loader2,
  Eye,
  CheckCircle2,
  XCircle,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
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

interface Customer {
  id: string
  code: string
  nameAr: string
  nameEn?: string
}

interface DeliveryNote {
  id: string
  number: string
  date: string
  status: string
  salesInvoiceId: string | null
  salesOrderId: string | null
  customerId: string | null
  warehouseId: string
  notes: string | null
  createdAt: string
  customer?: { id: string; code: string; nameAr: string; nameEn?: string }
  warehouse?: { id: string; code: string; nameAr: string; nameEn?: string }
  salesInvoice?: { id: string; number: string }
  salesOrder?: { id: string; number: string }
  _count?: { lines: number }
}

// ─── Constants ────────────────────────────────────────────────────────────────

const statusLabels: Record<string, string> = {
  DRAFT: 'مسودة',
  CONFIRMED: 'مؤكد',
  CANCELLED: 'ملغى',
}

const statusBadgeStyles: Record<string, string> = {
  DRAFT: 'bg-slate-50 text-slate-700 border-slate-200',
  CONFIRMED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  CANCELLED: 'bg-red-50 text-red-700 border-red-200',
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

export default function DeliveryNotesList() {
  const companyId = useAppStore((state) => state.currentCompanyId)
  const setModule = useAppStore((state) => state.setModule)
  const setView = useAppStore((state) => state.setView)
  const setEditingDocId = useAppStore((state) => state.setEditingDocId)
  const [deliveryNotes, setDeliveryNotes] = useState<DeliveryNote[]>([])
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  // ── Data Fetching ─────────────────────────────────────────────────────────

  const fetchDeliveryNotes = useCallback(async () => {
    try {
      const res = await fetch(`/api/inventory/delivery-notes?companyId=${companyId}`)
      if (res.ok) {
        const data = await res.json()
        setDeliveryNotes(data)
      }
    } catch {
      toast.error('فشل في تحميل أذون الصرف')
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

  const fetchCustomers = useCallback(async () => {
    try {
      const res = await fetch(`/api/sales/customers?companyId=${companyId}`)
      if (res.ok) {
        const data = await res.json()
        setCustomers(data)
      }
    } catch {
      // silently fail
    }
  }, [companyId])

  useEffect(() => {
    if (companyId) {
      fetchDeliveryNotes()
      fetchWarehouses()
      fetchCustomers()
    }
  }, [companyId, fetchDeliveryNotes, fetchWarehouses, fetchCustomers])

  // ── Navigation handlers ──

  const handleNew = () => {
    setModule('inventory')
    setView('delivery-note-form')
    setEditingDocId('new')
  }

  const handleView = (id: string) => {
    setModule('inventory')
    setView('delivery-note-form')
    setEditingDocId(id)
  }

  // ── Warehouse Display Name ────────────────────────────────────────────────

  const getWarehouseDisplayName = (warehouseId: string, whData?: { nameAr: string; nameEn?: string }) => {
    const wh = warehouses.find((w) => w.id === warehouseId)
    if (wh) {
      return buildWarehouseDisplayName(wh)
    }
    return whData?.nameAr || warehouseId
  }

  const getCustomerDisplayName = (customerId: string | null, custData?: { nameAr: string; nameEn?: string } | null) => {
    if (!customerId) return '—'
    const customer = customers.find((c) => c.id === customerId)
    if (customer) return customer.nameAr
    return custData?.nameAr || customerId
  }

  // ── Inline status action for table row buttons ──

  const handleInlineConfirm = async (noteId: string) => {
    setSubmitting(true)
    try {
      const res = await fetch(`/api/inventory/delivery-notes/${noteId}?companyId=${companyId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId, action: 'confirm' }),
      })
      if (res.ok) {
        toast.success('تم تأكيد إذن الصرف بنجاح')
        fetchDeliveryNotes()
      } else {
        const err = await res.json()
        toast.error(err.error || 'فشل في تأكيد إذن الصرف')
      }
    } catch {
      toast.error('حدث خطأ أثناء تأكيد إذن الصرف')
    } finally {
      setSubmitting(false)
    }
  }

  const handleInlineCancel = async (noteId: string) => {
    setSubmitting(true)
    try {
      const res = await fetch(`/api/inventory/delivery-notes/${noteId}?companyId=${companyId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId, action: 'cancel' }),
      })
      if (res.ok) {
        toast.success('تم إلغاء إذن الصرف بنجاح')
        fetchDeliveryNotes()
      } else {
        const err = await res.json()
        toast.error(err.error || 'فشل في إلغاء إذن الصرف')
      }
    } catch {
      toast.error('حدث خطأ أثناء إلغاء إذن الصرف')
    } finally {
      setSubmitting(false)
    }
  }

  // ─── Loading State ──────────────────────────────────────────────────────

  if (loading) {
    return (
      <Card className="border shadow-sm">
        <CardHeader>
          <div className="flex items-center justify-between">
            <Skeleton className="h-7 w-52" />
            <Skeleton className="h-10 w-44" />
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
    <Card className="border shadow-sm">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-emerald-50 flex items-center justify-center">
              <Truck className="h-5 w-5 text-emerald-600" />
            </div>
            <CardTitle className="text-lg">أذون الصرف</CardTitle>
          </div>
          <Button
            onClick={handleNew}
            className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
          >
            <Plus className="h-4 w-4" />
            إذن صرف جديد
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {/* Table */}
        <div className="max-h-[calc(100vh-300px)] overflow-y-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50/80 hover:bg-slate-50/80">
                <TableHead className="text-right font-semibold">رقم الإذن</TableHead>
                <TableHead className="text-right font-semibold">التاريخ</TableHead>
                <TableHead className="text-right font-semibold">العميل</TableHead>
                <TableHead className="text-right font-semibold">المخزن</TableHead>
                <TableHead className="text-right font-semibold">فاتورة البيع</TableHead>
                <TableHead className="text-right font-semibold">أمر البيع</TableHead>
                <TableHead className="text-right font-semibold">عدد الأصناف</TableHead>
                <TableHead className="text-right font-semibold">الحالة</TableHead>
                <TableHead className="text-right font-semibold">إجراءات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {deliveryNotes.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-12">
                    <div className="flex flex-col items-center text-slate-400">
                      <Truck className="h-12 w-12 mb-3 text-slate-200" />
                      <p className="text-sm">لا توجد أذون صرف</p>
                      <p className="text-xs mt-1 text-slate-300">
                        اضغط على &quot;إذن صرف جديد&quot; لإنشاء إذن
                      </p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                deliveryNotes.map((note) => (
                  <TableRow key={note.id} className="hover:bg-slate-50/50">
                    <TableCell className="font-mono text-sm font-medium">
                      {note.number}
                    </TableCell>
                    <TableCell className="text-slate-500 text-sm whitespace-nowrap">
                      {formatDate(note.date)}
                    </TableCell>
                    <TableCell className="text-sm text-slate-700">
                      {getCustomerDisplayName(note.customerId, note.customer)}
                    </TableCell>
                    <TableCell className="text-sm">
                      <span className="text-slate-700">
                        {getWarehouseDisplayName(note.warehouseId, note.warehouse)}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm text-slate-500">
                      {note.salesInvoice ? note.salesInvoice.number : '—'}
                    </TableCell>
                    <TableCell className="text-sm text-slate-500">
                      {note.salesOrder ? note.salesOrder.number : '—'}
                    </TableCell>
                    <TableCell className="text-center font-mono text-sm">
                      {note._count?.lines ?? 0}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={statusBadgeStyles[note.status] || 'bg-slate-50 text-slate-700'}
                      >
                        {statusLabels[note.status] || note.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-slate-500 hover:text-emerald-600"
                          onClick={() => handleView(note.id)}
                          title="عرض التفاصيل"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        {note.status === 'DRAFT' && (
                          <>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-slate-500 hover:text-emerald-600"
                              onClick={() => handleInlineConfirm(note.id)}
                              title="تأكيد"
                              disabled={submitting}
                            >
                              <CheckCircle2 className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-slate-500 hover:text-red-600"
                              onClick={() => handleInlineCancel(note.id)}
                              title="إلغاء"
                              disabled={submitting}
                            >
                              <XCircle className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                        {note.status === 'CONFIRMED' && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-slate-500 hover:text-red-600"
                            onClick={() => handleInlineCancel(note.id)}
                            title="إلغاء إذن الصرف"
                            disabled={submitting}
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
  )
}
