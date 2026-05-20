'use client'

import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import {
  ClipboardCheck,
  Plus,
  Loader2,
  Eye,
  XCircle,
  Play,
  Zap,
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

interface PickList {
  id: string
  number: string
  date: string
  status: string
  warehouseId: string
  notes: string | null
  createdAt: string
  warehouse?: { id: string; code: string; nameAr: string; nameEn?: string }
  _count?: { lines: number }
}

// ─── Constants ────────────────────────────────────────────────────────────────

const statusLabels: Record<string, string> = {
  DRAFT: 'مسودة',
  IN_PROGRESS: 'قيد التحضير',
  COMPLETED: 'مكتمل',
  CANCELLED: 'ملغى',
}

const statusBadgeStyles: Record<string, string> = {
  DRAFT: 'bg-slate-50 text-slate-700 border-slate-200',
  IN_PROGRESS: 'bg-amber-50 text-amber-700 border-amber-200',
  COMPLETED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
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

export default function PickListsList() {
  const companyId = useAppStore((state) => state.currentCompanyId)
  const setModule = useAppStore((state) => state.setModule)
  const setView = useAppStore((state) => state.setView)
  const setEditingDocId = useAppStore((state) => state.setEditingDocId)
  const [pickLists, setPickLists] = useState<PickList[]>([])
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  // ── Data Fetching ─────────────────────────────────────────────────────────

  const fetchPickLists = useCallback(async () => {
    try {
      const res = await fetch(`/api/inventory/pick-lists?companyId=${companyId}`)
      if (res.ok) {
        const data = await res.json()
        setPickLists(data)
      }
    } catch {
      toast.error('فشل في تحميل قوائم التحضير')
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

  useEffect(() => {
    if (companyId) {
      fetchPickLists()
      fetchWarehouses()
    }
  }, [companyId, fetchPickLists, fetchWarehouses])

  // ── Warehouse Display Name ────────────────────────────────────────────────

  const getWarehouseDisplayName = (warehouseId: string, whData?: { nameAr: string; nameEn?: string }) => {
    const wh = warehouses.find((w) => w.id === warehouseId)
    if (wh) {
      return buildWarehouseDisplayName(wh)
    }
    return whData?.nameAr || warehouseId
  }

  // ── Navigation handlers ──

  const handleNew = () => {
    setModule('inventory')
    setView('pick-list-form')
    setEditingDocId('new')
  }

  const handleView = (id: string) => {
    setModule('inventory')
    setView('pick-list-form')
    setEditingDocId(id)
  }

  // ── Generate from Pending Sales ──────────────────────────────────────────

  const handleGenerateFromPendingSales = async () => {
    if (!companyId) return
    setSubmitting(true)
    try {
      const res = await fetch(`/api/inventory/pick-lists?companyId=${companyId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          fromPendingSales: true,
        }),
      })

      if (res.ok) {
        toast.success('تم توليد قائمة التحضير من المبيعات المعلقة بنجاح')
        fetchPickLists()
      } else {
        const err = await res.json()
        toast.error(err.error || 'فشل في توليد قائمة التحضير')
      }
    } catch {
      toast.error('حدث خطأ أثناء توليد قائمة التحضير')
    } finally {
      setSubmitting(false)
    }
  }

  // ── Inline Status Actions (in table) ────────────────────────────────────

  const handleInlineStart = async (pickListId: string) => {
    setSubmitting(true)
    try {
      const res = await fetch(`/api/inventory/pick-lists/${pickListId}?companyId=${companyId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId, action: 'start' }),
      })
      if (res.ok) {
        toast.success('تم بدء التحضير بنجاح')
        fetchPickLists()
      } else {
        const err = await res.json()
        toast.error(err.error || 'فشل في بدء التحضير')
      }
    } catch {
      toast.error('حدث خطأ أثناء بدء التحضير')
    } finally {
      setSubmitting(false)
    }
  }

  const handleInlineCancel = async (pickListId: string) => {
    setSubmitting(true)
    try {
      const res = await fetch(`/api/inventory/pick-lists/${pickListId}?companyId=${companyId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId, action: 'cancel' }),
      })
      if (res.ok) {
        toast.success('تم إلغاء قائمة التحضير بنجاح')
        fetchPickLists()
      } else {
        const err = await res.json()
        toast.error(err.error || 'فشل في إلغاء قائمة التحضير')
      }
    } catch {
      toast.error('حدث خطأ أثناء إلغاء قائمة التحضير')
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
            <div className="flex gap-2">
              <Skeleton className="h-10 w-44" />
              <Skeleton className="h-10 w-52" />
            </div>
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
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-teal-50 flex items-center justify-center">
              <ClipboardCheck className="h-5 w-5 text-teal-600" />
            </div>
            <CardTitle className="text-lg">قوائم التحضير</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={handleNew}
              className="bg-teal-600 hover:bg-teal-700 text-white gap-2"
            >
              <Plus className="h-4 w-4" />
              قائمة تحضير جديدة
            </Button>
            <Button
              onClick={handleGenerateFromPendingSales}
              disabled={submitting}
              variant="outline"
              className="gap-2 text-amber-700 border-amber-200 hover:bg-amber-50"
            >
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Zap className="h-4 w-4" />
              )}
              توليد من المبيعات المعلقة
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Table */}
        <div className="max-h-[calc(100vh-300px)] overflow-y-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50/80 hover:bg-slate-50/80">
                <TableHead className="text-right font-semibold">رقم القائمة</TableHead>
                <TableHead className="text-right font-semibold">التاريخ</TableHead>
                <TableHead className="text-right font-semibold">المخزن</TableHead>
                <TableHead className="text-right font-semibold">عدد الأصناف</TableHead>
                <TableHead className="text-right font-semibold">الحالة</TableHead>
                <TableHead className="text-right font-semibold">إجراءات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pickLists.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-12">
                    <div className="flex flex-col items-center text-slate-400">
                      <ClipboardCheck className="h-12 w-12 mb-3 text-slate-200" />
                      <p className="text-sm">لا توجد قوائم تحضير</p>
                      <p className="text-xs mt-1 text-slate-300">
                        اضغط على &quot;قائمة تحضير جديدة&quot; لإنشاء قائمة
                      </p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                pickLists.map((pl) => (
                  <TableRow key={pl.id} className="hover:bg-slate-50/50">
                    <TableCell className="font-mono text-sm font-medium">
                      {pl.number}
                    </TableCell>
                    <TableCell className="text-slate-500 text-sm whitespace-nowrap">
                      {formatDate(pl.date)}
                    </TableCell>
                    <TableCell className="text-sm">
                      <span className="text-slate-700">
                        {getWarehouseDisplayName(pl.warehouseId, pl.warehouse)}
                      </span>
                    </TableCell>
                    <TableCell className="text-center font-mono text-sm">
                      {pl._count?.lines ?? 0}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={statusBadgeStyles[pl.status] || 'bg-slate-50 text-slate-700'}
                      >
                        {statusLabels[pl.status] || pl.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-slate-500 hover:text-teal-600"
                          onClick={() => handleView(pl.id)}
                          title="عرض التفاصيل"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        {pl.status === 'DRAFT' && (
                          <>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-slate-500 hover:text-amber-600"
                              onClick={() => handleInlineStart(pl.id)}
                              title="بدء التحضير"
                              disabled={submitting}
                            >
                              <Play className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-slate-500 hover:text-red-600"
                              onClick={() => handleInlineCancel(pl.id)}
                              title="إلغاء"
                              disabled={submitting}
                            >
                              <XCircle className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                        {pl.status === 'IN_PROGRESS' && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-slate-500 hover:text-red-600"
                            onClick={() => handleInlineCancel(pl.id)}
                            title="إلغاء"
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
