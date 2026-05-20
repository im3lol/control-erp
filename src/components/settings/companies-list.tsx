'use client'

import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import {
  Building2,
  Plus,
  Loader2,
  Trash2,
  Pencil,
  Eye,
  AlertTriangle,
  CheckCircle2,
  MapPin,
  Phone,
  Mail,
  FileText,
  XCircle,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
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

// ── Interfaces ──

interface CompanyRow {
  id: string
  nameAr: string
  nameEn: string
  logo?: string | null
  taxNumber?: string | null
  status: string
  vatRate: number
  address?: string | null
  phone?: string | null
  email?: string | null
  fiscalYearStart?: string | null
  createdAt: string
  _count?: {
    items: number
    customers: number
    suppliers: number
    salesInvoices: number
    purchaseInvoices: number
    warehouses: number
    journalEntries: number
  }
}

interface RelatedCounts {
  items: number
  customers: number
  suppliers: number
  salesOrders: number
  purchaseOrders: number
  salesInvoices: number
  purchaseInvoices: number
  deliveryNotes: number
  materialRequests: number
  purchaseReceipts: number
  pickLists: number
  journalEntries: number
  warehouses: number
  accounts: number
}

const countLabels: Record<string, string> = {
  items: 'أصناف',
  customers: 'عملاء',
  suppliers: 'موردين',
  salesOrders: 'أوامر بيع',
  purchaseOrders: 'أوامر شراء',
  salesInvoices: 'فواتير بيع',
  purchaseInvoices: 'فواتير شراء',
  deliveryNotes: 'أذون صرف',
  materialRequests: 'طلبات مواد',
  purchaseReceipts: 'أذون استلام',
  pickLists: 'قوائم تحضير',
  journalEntries: 'قيود يومية',
  warehouses: 'مخازن',
  accounts: 'حسابات',
}

export default function CompaniesList() {
  const currentCompanyId = useAppStore((s) => s.currentCompanyId)
  const setCurrentCompany = useAppStore((s) => s.setCurrentCompany)
  const removeCompany = useAppStore((s) => s.removeCompany)
  const setCompanies = useAppStore((s) => s.setCompanies)
  const setView = useAppStore((s) => s.setView)

  const [companies, setLocalCompanies] = useState<CompanyRow[]>([])
  const [loading, setLoading] = useState(true)

  // Edit dialog
  const [editOpen, setEditOpen] = useState(false)
  const [editingCompany, setEditingCompany] = useState<CompanyRow | null>(null)
  const [editForm, setEditForm] = useState({ nameAr: '', nameEn: '', address: '', phone: '', email: '', taxNumber: '', vatRate: 14 })
  const [editSaving, setEditSaving] = useState(false)

  // Delete dialog
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deletingCompany, setDeletingCompany] = useState<CompanyRow | null>(null)
  const [relatedCounts, setRelatedCounts] = useState<RelatedCounts | null>(null)
  const [deleteConfirmName, setDeleteConfirmName] = useState('')
  const [deleting, setDeleting] = useState(false)

  // Detail dialog
  const [detailOpen, setDetailOpen] = useState(false)
  const [detailCompany, setDetailCompany] = useState<CompanyRow | null>(null)

  const fetchCompanies = useCallback(async () => {
    try {
      const res = await fetch('/api/companies')
      if (res.ok) {
        const data = await res.json()
        setLocalCompanies(data)
      }
    } catch {
      toast.error('فشل في تحميل الشركات')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchCompanies()
  }, [fetchCompanies])

  // ── Edit ──
  const handleOpenEdit = (company: CompanyRow) => {
    setEditingCompany(company)
    setEditForm({
      nameAr: company.nameAr,
      nameEn: company.nameEn,
      address: company.address || '',
      phone: company.phone || '',
      email: company.email || '',
      taxNumber: company.taxNumber || '',
      vatRate: company.vatRate,
    })
    setEditOpen(true)
  }

  const handleSaveEdit = async () => {
    if (!editingCompany) return
    if (!editForm.nameAr.trim()) {
      toast.error('يرجى إدخال اسم الشركة بالعربية')
      return
    }
    setEditSaving(true)
    try {
      const res = await fetch(`/api/companies/${editingCompany.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      })
      if (res.ok) {
        const updated = await res.json()
        // Update local store
        const storeUpdate = useAppStore.getState()
        const newCompanies = storeUpdate.companies.map((c) =>
          c.id === editingCompany.id
            ? { ...c, nameAr: updated.nameAr, nameEn: updated.nameEn, vatRate: updated.vatRate }
            : c
        )
        setCompanies(newCompanies)
        toast.success('تم تحديث بيانات الشركة بنجاح')
        fetchCompanies()
        setEditOpen(false)
      } else {
        const err = await res.json()
        toast.error(err.error || 'فشل في تحديث البيانات')
      }
    } catch {
      toast.error('حدث خطأ أثناء التحديث')
    } finally {
      setEditSaving(false)
    }
  }

  // ── Delete ──
  const handleOpenDelete = async (company: CompanyRow) => {
    setDeletingCompany(company)
    setDeleteConfirmName('')
    setRelatedCounts(null)

    // Try deleting to see if there's related data
    try {
      const res = await fetch(`/api/companies/${company.id}`, { method: 'DELETE' })
      const data = await res.json()

      if (res.status === 409 && data.hasRelatedData) {
        setRelatedCounts(data.counts)
      }
      // If 200, it means no related data - company was deleted
      if (res.ok && data.deleted) {
        removeCompany(company.id)
        toast.success('تم حذف الشركة بنجاح')
        fetchCompanies()
        return
      }
    } catch {
      // Will show dialog anyway
    }

    setDeleteOpen(true)
  }

  const handleConfirmDelete = async () => {
    if (!deletingCompany) return

    // If there's related data, require name confirmation
    if (relatedCounts) {
      if (deleteConfirmName.trim() !== deletingCompany.nameAr.trim()) {
        toast.error('اسم الشركة غير مطابق')
        return
      }
    }

    setDeleting(true)
    try {
      const res = await fetch(`/api/companies/${deletingCompany.id}/force-delete`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmedName: deleteConfirmName || deletingCompany.nameAr }),
      })
      if (res.ok) {
        removeCompany(deletingCompany.id)
        toast.success('تم حذف الشركة وجميع البيانات المرتبطة')
        fetchCompanies()
        setDeleteOpen(false)
      } else {
        const err = await res.json()
        toast.error(err.error || 'فشل في حذف الشركة')
      }
    } catch {
      toast.error('حدث خطأ أثناء الحذف')
    } finally {
      setDeleting(false)
    }
  }

  // ── Detail ──
  const handleOpenDetail = (company: CompanyRow) => {
    setDetailCompany(company)
    setDetailOpen(true)
  }

  // ── Switch to company ──
  const handleSwitchToCompany = (id: string) => {
    setCurrentCompany(id)
    toast.success('تم切换 إلى الشركة')
  }

  if (loading) {
    return (
      <Card className="border shadow-sm">
        <CardHeader>
          <div className="flex items-center justify-between">
            <Skeleton className="h-7 w-40" />
            <Skeleton className="h-10 w-44" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <Card className="border shadow-sm">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-emerald-50 flex items-center justify-center">
                <Building2 className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <CardTitle className="text-lg">إدارة الشركات</CardTitle>
                <p className="text-xs text-slate-400 mt-0.5">
                  {companies.length} شركة مسجلة
                </p>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {companies.length === 0 ? (
            <div className="flex flex-col items-center py-16 text-slate-400">
              <Building2 className="h-16 w-16 mb-4 text-slate-200" />
              <p className="text-sm">لا توجد شركات مسجلة</p>
              <p className="text-xs mt-1">قم بإنشاء شركة جديدة من معالج الإعداد</p>
            </div>
          ) : (
            <div className="max-h-[calc(100vh-320px)] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50/80 hover:bg-slate-50/80">
                    <TableHead className="text-right font-semibold">الشركة</TableHead>
                    <TableHead className="text-right font-semibold">البيانات</TableHead>
                    <TableHead className="text-right font-semibold">الحالة</TableHead>
                    <TableHead className="text-right font-semibold">تاريخ الإنشاء</TableHead>
                    <TableHead className="text-right font-semibold">إجراءات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {companies.map((company) => {
                    const isCurrent = company.id === currentCompanyId
                    const totalData = company._count
                      ? Object.values(company._count).reduce((s, c) => s + c, 0)
                      : 0
                    return (
                      <TableRow
                        key={company.id}
                        className={isCurrent ? 'bg-emerald-50/50' : ''}
                      >
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div
                              className={`h-10 w-10 rounded-lg flex items-center justify-center shrink-0 ${
                                isCurrent ? 'bg-emerald-500' : 'bg-slate-100'
                              }`}
                            >
                              <Building2
                                className={`h-5 w-5 ${
                                  isCurrent ? 'text-white' : 'text-slate-500'
                                }`}
                              />
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <p className="font-semibold text-sm">{company.nameAr}</p>
                                {isCurrent && (
                                  <Badge className="bg-emerald-100 text-emerald-700 text-[10px] px-1.5 py-0">
                                    الحالية
                                  </Badge>
                                )}
                              </div>
                              <p className="text-xs text-slate-400" dir="ltr">
                                {company.nameEn}
                              </p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {company._count && company._count.items > 0 && (
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-slate-200">
                                {company._count.items} صنف
                              </Badge>
                            )}
                            {company._count && company._count.customers > 0 && (
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-slate-200">
                                {company._count.customers} عميل
                              </Badge>
                            )}
                            {company._count && company._count.suppliers > 0 && (
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-slate-200">
                                {company._count.suppliers} مورد
                              </Badge>
                            )}
                            {totalData === 0 && (
                              <span className="text-xs text-slate-300">فارغة</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge
                            className={`text-xs ${
                              company.status === 'active'
                                ? 'bg-emerald-100 text-emerald-700'
                                : 'bg-red-100 text-red-700'
                            }`}
                          >
                            {company.status === 'active' ? 'نشطة' : 'غير نشطة'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-slate-500">
                          {formatDate(company.createdAt)}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            {!isCurrent && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleSwitchToCompany(company.id)}
                                className="h-8 w-8 text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50"
                                title="التبديل إلى هذه الشركة"
                              >
                                <CheckCircle2 className="h-4 w-4" />
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleOpenDetail(company)}
                              className="h-8 w-8 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50"
                              title="عرض التفاصيل"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleOpenEdit(company)}
                              className="h-8 w-8 text-slate-500 hover:text-orange-600 hover:bg-orange-50"
                              title="تعديل"
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleOpenDelete(company)}
                              className="h-8 w-8 text-slate-500 hover:text-red-600 hover:bg-red-50"
                              title="حذف"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Edit Dialog ── */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-xl" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="h-5 w-5 text-orange-500" />
              تعديل بيانات الشركة
            </DialogTitle>
            <DialogDescription>
              {editingCompany?.nameAr}
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium">
                اسم الشركة بالعربية <span className="text-red-500">*</span>
              </Label>
              <Input
                value={editForm.nameAr}
                onChange={(e) => setEditForm({ ...editForm, nameAr: e.target.value })}
                placeholder="اسم الشركة بالعربية"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">اسم الشركة بالإنجليزية</Label>
              <Input
                value={editForm.nameEn}
                onChange={(e) => setEditForm({ ...editForm, nameEn: e.target.value })}
                placeholder="Company Name"
                dir="ltr"
                className="text-left"
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label className="text-sm font-medium">العنوان</Label>
              <Input
                value={editForm.address}
                onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                placeholder="عنوان الشركة"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">رقم الهاتف</Label>
              <Input
                value={editForm.phone}
                onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                placeholder="01XXXXXXXXX"
                dir="ltr"
                className="text-left"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">البريد الإلكتروني</Label>
              <Input
                value={editForm.email}
                onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                placeholder="info@company.com"
                dir="ltr"
                className="text-left"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">الرقم الضريبي</Label>
              <Input
                value={editForm.taxNumber}
                onChange={(e) => setEditForm({ ...editForm, taxNumber: e.target.value })}
                placeholder="الرقم الضريبي"
                dir="ltr"
                className="text-left"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">نسبة الضريبة (%)</Label>
              <Input
                type="number"
                min="0"
                max="100"
                step="0.1"
                value={editForm.vatRate}
                onChange={(e) =>
                  setEditForm({ ...editForm, vatRate: parseFloat(e.target.value) || 0 })
                }
                dir="ltr"
                className="text-left"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)} disabled={editSaving}>
              إلغاء
            </Button>
            <Button
              onClick={handleSaveEdit}
              disabled={editSaving}
              className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
            >
              {editSaving && <Loader2 className="h-4 w-4 animate-spin" />}
              حفظ التعديلات
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Dialog ── */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="sm:max-w-lg" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-700">
              <AlertTriangle className="h-5 w-5" />
              حذف الشركة
            </DialogTitle>
            <DialogDescription>
              هل أنت متأكد من حذف &quot;{deletingCompany?.nameAr}&quot;؟
            </DialogDescription>
          </DialogHeader>

          {relatedCounts && (
            <div className="space-y-3">
              {/* Warning box */}
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-red-500 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-bold text-red-800">
                      هذه الشركة مرتبطة ببيانات! حذفها سيؤدي لحذف جميع البيانات المرتبطة نهائياً.
                    </p>
                    <p className="text-xs text-red-600 mt-1">
                      لا يمكن التراجع عن هذا الإجراء.
                    </p>
                  </div>
                </div>
              </div>

              {/* Related data list */}
              <div className="bg-slate-50 rounded-lg p-3">
                <p className="text-xs font-semibold text-slate-600 mb-2">البيانات المرتبطة:</p>
                <div className="grid grid-cols-2 gap-1.5">
                  {Object.entries(relatedCounts).map(([key, count]) => {
                    if (count === 0) return null
                    return (
                      <div key={key} className="flex items-center justify-between text-xs bg-white rounded px-2 py-1.5">
                        <span className="text-slate-600">{countLabels[key] || key}</span>
                        <span className="font-mono font-bold text-red-600" dir="ltr">{count}</span>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Name confirmation */}
              <div className="space-y-2">
                <Label className="text-sm font-medium text-red-700">
                  اكتب &quot;{deletingCompany?.nameAr}&quot; لتأكيد الحذف
                </Label>
                <Input
                  value={deleteConfirmName}
                  onChange={(e) => setDeleteConfirmName(e.target.value)}
                  placeholder={`اكتب "${deletingCompany?.nameAr}" هنا`}
                  className="border-red-200 focus:border-red-400 focus:ring-red-200"
                />
              </div>
            </div>
          )}

          {!relatedCounts && (
            <p className="text-sm text-slate-600">
              لا توجد بيانات مرتبطة بهذه الشركة. سيتم حذفها نهائياً.
            </p>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)} disabled={deleting}>
              تراجع
            </Button>
            <Button
              onClick={handleConfirmDelete}
              disabled={
                deleting ||
                (relatedCounts !== null && deleteConfirmName.trim() !== deletingCompany?.nameAr?.trim())
              }
              className="bg-red-600 hover:bg-red-700 text-white gap-2"
            >
              {deleting && <Loader2 className="h-4 w-4 animate-spin" />}
              <Trash2 className="h-4 w-4" />
              حذف نهائي
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Detail Dialog ── */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="sm:max-w-xl" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-emerald-600" />
              تفاصيل الشركة
            </DialogTitle>
          </DialogHeader>

          {detailCompany && (
            <div className="space-y-4">
              {/* Company header */}
              <div className="flex items-center gap-4 bg-slate-50 rounded-lg p-4">
                <div
                  className={`h-14 w-14 rounded-xl flex items-center justify-center ${
                    detailCompany.id === currentCompanyId ? 'bg-emerald-500' : 'bg-slate-200'
                  }`}
                >
                  <Building2
                    className={`h-7 w-7 ${
                      detailCompany.id === currentCompanyId ? 'text-white' : 'text-slate-500'
                    }`}
                  />
                </div>
                <div>
                  <h3 className="text-lg font-bold">{detailCompany.nameAr}</h3>
                  <p className="text-sm text-slate-400" dir="ltr">{detailCompany.nameEn}</p>
                </div>
                <div className="ms-auto">
                  <Badge
                    className={`${
                      detailCompany.status === 'active'
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-red-100 text-red-700'
                    }`}
                  >
                    {detailCompany.status === 'active' ? 'نشطة' : 'غير نشطة'}
                  </Badge>
                </div>
              </div>

              {/* Contact info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {detailCompany.address && (
                  <div className="flex items-center gap-2 text-sm">
                    <MapPin className="h-4 w-4 text-slate-400 shrink-0" />
                    <span>{detailCompany.address}</span>
                  </div>
                )}
                {detailCompany.phone && (
                  <div className="flex items-center gap-2 text-sm" dir="ltr">
                    <Phone className="h-4 w-4 text-slate-400 shrink-0" />
                    <span>{detailCompany.phone}</span>
                  </div>
                )}
                {detailCompany.email && (
                  <div className="flex items-center gap-2 text-sm" dir="ltr">
                    <Mail className="h-4 w-4 text-slate-400 shrink-0" />
                    <span>{detailCompany.email}</span>
                  </div>
                )}
                {detailCompany.taxNumber && (
                  <div className="flex items-center gap-2 text-sm" dir="ltr">
                    <FileText className="h-4 w-4 text-slate-400 shrink-0" />
                    <span>ض: {detailCompany.taxNumber}</span>
                  </div>
                )}
              </div>

              <Separator />

              {/* Data summary */}
              {detailCompany._count && (
                <div>
                  <p className="text-xs font-semibold text-slate-500 mb-2">ملخص البيانات</p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {Object.entries(detailCompany._count).map(([key, count]) => {
                      const labelMap: Record<string, string> = {
                        items: 'أصناف',
                        customers: 'عملاء',
                        suppliers: 'موردين',
                        salesInvoices: 'فواتير بيع',
                        purchaseInvoices: 'فواتير شراء',
                        warehouses: 'مخازن',
                        journalEntries: 'قيود',
                      }
                      return (
                        <div key={key} className="bg-slate-50 rounded-lg p-2.5 text-center">
                          <p className="font-mono font-bold text-emerald-700 text-lg" dir="ltr">{count}</p>
                          <p className="text-[10px] text-slate-500">{labelMap[key] || key}</p>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex justify-end gap-3 pt-2">
                {detailCompany.id !== currentCompanyId && (
                  <Button
                    onClick={() => {
                      handleSwitchToCompany(detailCompany.id)
                      setDetailOpen(false)
                    }}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    التبديل إليها
                  </Button>
                )}
                <Button
                  variant="outline"
                  onClick={() => {
                    handleOpenEdit(detailCompany)
                    setDetailOpen(false)
                  }}
                  className="gap-2"
                >
                  <Pencil className="h-4 w-4" />
                  تعديل
                </Button>
                <Button variant="outline" onClick={() => setDetailOpen(false)}>
                  إغلاق
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
