'use client'

import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import {
  ClipboardList,
  Plus,
  Loader2,
  Eye,
  CheckCircle2,
  XCircle,
  Send,
  PackageCheck,
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

interface MaterialRequest {
  id: string
  number: string
  date: string
  status: string
  requestedBy: string | null
  approvedBy: string | null
  notes: string | null
  createdAt: string
  _count?: { lines: number }
}

// ─── Constants ────────────────────────────────────────────────────────────────

const statusLabels: Record<string, string> = {
  DRAFT: 'مسودة',
  PENDING: 'قيد المراجعة',
  APPROVED: 'معتمد',
  FULFILLED: 'مكتمل',
  CANCELLED: 'ملغى',
}

const statusBadgeStyles: Record<string, string> = {
  DRAFT: 'bg-slate-50 text-slate-700 border-slate-200',
  PENDING: 'bg-amber-50 text-amber-700 border-amber-200',
  APPROVED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  FULFILLED: 'bg-teal-50 text-teal-700 border-teal-200',
  CANCELLED: 'bg-red-50 text-red-700 border-red-200',
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function MaterialRequestsList() {
  const companyId = useAppStore((state) => state.currentCompanyId)
  const setModule = useAppStore((state) => state.setModule)
  const setView = useAppStore((state) => state.setView)
  const setEditingDocId = useAppStore((state) => state.setEditingDocId)
  const [requests, setRequests] = useState<MaterialRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  // ── Data Fetching ─────────────────────────────────────────────────────────

  const fetchRequests = useCallback(async () => {
    try {
      const res = await fetch(`/api/inventory/material-requests?companyId=${companyId}`)
      if (res.ok) {
        const data = await res.json()
        setRequests(data)
      }
    } catch {
      toast.error('فشل في تحميل طلبات المواد')
    } finally {
      setLoading(false)
    }
  }, [companyId])

  useEffect(() => {
    if (companyId) {
      fetchRequests()
    }
  }, [companyId, fetchRequests])

  // ── Navigation handlers ──

  const handleNew = () => {
    setModule('inventory')
    setView('material-request-form')
    setEditingDocId('new')
  }

  const handleView = (id: string) => {
    setModule('inventory')
    setView('material-request-form')
    setEditingDocId(id)
  }

  // Inline status action for table row buttons
  const handleInlineStatusAction = async (requestId: string, action: 'submit' | 'approve' | 'fulfill' | 'cancel') => {
    setSubmitting(true)
    try {
      const res = await fetch(`/api/inventory/material-requests/${requestId}?companyId=${companyId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId, action }),
      })
      if (res.ok) {
        const actionLabels: Record<string, string> = {
          submit: 'إرسال الطلب للمراجعة',
          approve: 'اعتماد الطلب',
          fulfill: 'تلبية الطلب',
          cancel: 'إلغاء الطلب',
        }
        toast.success(`تم ${actionLabels[action]} بنجاح`)
        fetchRequests()
      } else {
        const err = await res.json()
        toast.error(err.error || 'فشل في تنفيذ الإجراء')
      }
    } catch {
      toast.error('حدث خطأ أثناء تنفيذ الإجراء')
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
              <ClipboardList className="h-5 w-5 text-emerald-600" />
            </div>
            <CardTitle className="text-lg">طلبات المواد</CardTitle>
          </div>
          <Button
            onClick={handleNew}
            className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
          >
            <Plus className="h-4 w-4" />
            طلب جديد
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {/* Table */}
        <div className="max-h-[calc(100vh-300px)] overflow-y-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50/80 hover:bg-slate-50/80">
                <TableHead className="text-right font-semibold">رقم الطلب</TableHead>
                <TableHead className="text-right font-semibold">التاريخ</TableHead>
                <TableHead className="text-right font-semibold">الطالب</TableHead>
                <TableHead className="text-right font-semibold">الحالة</TableHead>
                <TableHead className="text-right font-semibold">عدد الأصناف</TableHead>
                <TableHead className="text-right font-semibold">إجراءات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {requests.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-12">
                    <div className="flex flex-col items-center text-slate-400">
                      <ClipboardList className="h-12 w-12 mb-3 text-slate-200" />
                      <p className="text-sm">لا توجد طلبات مواد</p>
                      <p className="text-xs mt-1 text-slate-300">
                        اضغط على &quot;طلب جديد&quot; لإنشاء طلب
                      </p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                requests.map((request) => (
                  <TableRow key={request.id} className="hover:bg-slate-50/50">
                    <TableCell className="font-mono text-sm font-medium">
                      {request.number}
                    </TableCell>
                    <TableCell className="text-slate-500 text-sm whitespace-nowrap">
                      {formatDate(request.date)}
                    </TableCell>
                    <TableCell className="text-sm text-slate-700">
                      {request.requestedBy || '—'}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={statusBadgeStyles[request.status] || 'bg-slate-50 text-slate-700'}
                      >
                        {statusLabels[request.status] || request.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center font-mono text-sm">
                      {request._count?.lines ?? 0}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-slate-500 hover:text-emerald-600"
                          onClick={() => handleView(request.id)}
                          title="عرض التفاصيل"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        {request.status === 'DRAFT' && (
                          <>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-slate-500 hover:text-amber-600"
                              onClick={() => handleInlineStatusAction(request.id, 'submit')}
                              title="إرسال للمراجعة"
                              disabled={submitting}
                            >
                              <Send className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-slate-500 hover:text-red-600"
                              onClick={() => handleInlineStatusAction(request.id, 'cancel')}
                              title="إلغاء"
                              disabled={submitting}
                            >
                              <XCircle className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                        {request.status === 'PENDING' && (
                          <>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-slate-500 hover:text-emerald-600"
                              onClick={() => handleInlineStatusAction(request.id, 'approve')}
                              title="اعتماد"
                              disabled={submitting}
                            >
                              <CheckCircle2 className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-slate-500 hover:text-red-600"
                              onClick={() => handleInlineStatusAction(request.id, 'cancel')}
                              title="إلغاء"
                              disabled={submitting}
                            >
                              <XCircle className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                        {request.status === 'APPROVED' && (
                          <>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-slate-500 hover:text-teal-600"
                              onClick={() => handleInlineStatusAction(request.id, 'fulfill')}
                              title="تلبية الطلب"
                              disabled={submitting}
                            >
                              <PackageCheck className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-slate-500 hover:text-red-600"
                              onClick={() => handleInlineStatusAction(request.id, 'cancel')}
                              title="إلغاء"
                              disabled={submitting}
                            >
                              <XCircle className="h-4 w-4" />
                            </Button>
                          </>
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
