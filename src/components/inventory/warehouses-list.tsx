'use client'

import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { Plus, Pencil, Trash2, Warehouse as WarehouseIcon, Loader2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
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

interface Warehouse {
  id: string
  code: string
  nameAr: string
  nameEn: string | null
  location: string | null
  manager: string | null
  isActive: boolean
}

interface WarehouseFormData {
  code: string
  nameAr: string
  nameEn: string
  location: string
  manager: string
  isActive: boolean
}

const initialFormData: WarehouseFormData = {
  code: '',
  nameAr: '',
  nameEn: '',
  location: '',
  manager: '',
  isActive: true,
}

export default function WarehousesList() {
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [formData, setFormData] = useState<WarehouseFormData>(initialFormData)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    fetchWarehouses()
  }, [])

  const fetchWarehouses = async () => {
    try {
      const res = await fetch('/api/inventory/warehouses')
      if (res.ok) {
        const data = await res.json()
        setWarehouses(data)
      }
    } catch {
      toast.error('فشل في تحميل المخازن')
    } finally {
      setLoading(false)
    }
  }

  const handleOpenAdd = () => {
    setEditingId(null)
    setFormData(initialFormData)
    setDialogOpen(true)
  }

  const handleOpenEdit = (wh: Warehouse) => {
    setEditingId(wh.id)
    setFormData({
      code: wh.code,
      nameAr: wh.nameAr,
      nameEn: wh.nameEn || '',
      location: wh.location || '',
      manager: wh.manager || '',
      isActive: wh.isActive,
    })
    setDialogOpen(true)
  }

  const handleOpenDelete = (id: string) => {
    setDeletingId(id)
    setDeleteDialogOpen(true)
  }

  const handleSubmit = async () => {
    if (!formData.code.trim() || !formData.nameAr.trim()) {
      toast.error('يرجى ملء الحقول المطلوبة')
      return
    }

    setSubmitting(true)
    try {
      const url = editingId
        ? `/api/inventory/warehouses/${editingId}`
        : '/api/inventory/warehouses'
      const method = editingId ? 'PUT' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      if (res.ok) {
        toast.success(editingId ? 'تم تحديث المخزن بنجاح' : 'تم إضافة المخزن بنجاح')
        setDialogOpen(false)
        fetchWarehouses()
      } else {
        const err = await res.json()
        toast.error(err.error || 'فشل في حفظ البيانات')
      }
    } catch {
      toast.error('حدث خطأ أثناء حفظ البيانات')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async () => {
    if (!deletingId) return
    try {
      const res = await fetch(`/api/inventory/warehouses/${deletingId}`, {
        method: 'DELETE',
      })
      if (res.ok) {
        toast.success('تم حذف المخزن بنجاح')
        fetchWarehouses()
      } else {
        const err = await res.json()
        toast.error(err.error || 'فشل في حذف المخزن')
      }
    } catch {
      toast.error('حدث خطأ أثناء الحذف')
    } finally {
      setDeleteDialogOpen(false)
      setDeletingId(null)
    }
  }

  if (loading) {
    return (
      <Card className="border shadow-sm">
        <CardHeader>
          <div className="flex items-center justify-between">
            <Skeleton className="h-7 w-40" />
            <Skeleton className="h-10 w-36" />
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

  return (
    <>
      <Card className="border shadow-sm">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-emerald-50 flex items-center justify-center">
                <WarehouseIcon className="h-5 w-5 text-emerald-600" />
              </div>
              <CardTitle className="text-lg">المخازن</CardTitle>
            </div>
            <Button
              onClick={handleOpenAdd}
              className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
            >
              <Plus className="h-4 w-4" />
              إضافة مخزن
            </Button>
          </div>
        </CardHeader>
        <CardContent className="px-0">
          <div className="max-h-[calc(100vh-280px)] overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50/80 hover:bg-slate-50/80">
                  <TableHead className="text-right font-semibold">الكود</TableHead>
                  <TableHead className="text-right font-semibold">الاسم عربي</TableHead>
                  <TableHead className="text-right font-semibold">الاسم إنجليزي</TableHead>
                  <TableHead className="text-right font-semibold">الموقع</TableHead>
                  <TableHead className="text-right font-semibold">المسؤول</TableHead>
                  <TableHead className="text-right font-semibold">الحالة</TableHead>
                  <TableHead className="text-right font-semibold">إجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {warehouses.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-12">
                      <div className="flex flex-col items-center text-slate-400">
                        <WarehouseIcon className="h-12 w-12 mb-3 text-slate-200" />
                        <p className="text-sm">لا توجد مخازن مسجلة</p>
                        <p className="text-xs mt-1 text-slate-300">
                          اضغط على &quot;إضافة مخزن&quot; لإضافة مخزن جديد
                        </p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  warehouses.map((wh) => (
                    <TableRow key={wh.id}>
                      <TableCell className="font-mono text-sm">{wh.code}</TableCell>
                      <TableCell className="font-medium">{wh.nameAr}</TableCell>
                      <TableCell className="text-slate-500" dir="ltr">
                        {wh.nameEn || '—'}
                      </TableCell>
                      <TableCell className="text-slate-500">{wh.location || '—'}</TableCell>
                      <TableCell className="text-slate-500">{wh.manager || '—'}</TableCell>
                      <TableCell>
                        {wh.isActive ? (
                          <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200">
                            نشط
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="bg-slate-100 text-slate-500">
                            غير نشط
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleOpenEdit(wh)}
                            className="h-8 w-8 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleOpenDelete(wh.id)}
                            className="h-8 w-8 text-slate-500 hover:text-red-600 hover:bg-red-50"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
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

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId ? 'تعديل المخزن' : 'إضافة مخزن جديد'}</DialogTitle>
            <DialogDescription>
              {editingId ? 'قم بتعديل بيانات المخزن' : 'أدخل بيانات المخزن الجديد'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="wh-code">
                الكود <span className="text-red-500">*</span>
              </Label>
              <Input
                id="wh-code"
                value={formData.code}
                onChange={(e) => setFormData((p) => ({ ...p, code: e.target.value }))}
                placeholder="WH-001"
                dir="ltr"
                className="text-left"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="wh-nameAr">
                الاسم عربي <span className="text-red-500">*</span>
              </Label>
              <Input
                id="wh-nameAr"
                value={formData.nameAr}
                onChange={(e) => setFormData((p) => ({ ...p, nameAr: e.target.value }))}
                placeholder="المخزن الرئيسي"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="wh-nameEn">الاسم إنجليزي</Label>
              <Input
                id="wh-nameEn"
                value={formData.nameEn}
                onChange={(e) => setFormData((p) => ({ ...p, nameEn: e.target.value }))}
                placeholder="Main Warehouse"
                dir="ltr"
                className="text-left"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="wh-location">الموقع</Label>
              <Input
                id="wh-location"
                value={formData.location}
                onChange={(e) => setFormData((p) => ({ ...p, location: e.target.value }))}
                placeholder="الرياض - المنطقة الصناعية"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="wh-manager">المسؤول</Label>
              <Input
                id="wh-manager"
                value={formData.manager}
                onChange={(e) => setFormData((p) => ({ ...p, manager: e.target.value }))}
                placeholder="أحمد محمد"
              />
            </div>
            <div className="flex items-center gap-2 pt-6">
              <Switch
                checked={formData.isActive}
                onCheckedChange={(checked) =>
                  setFormData((p) => ({ ...p, isActive: checked }))
                }
              />
              <Label className="text-sm">نشط</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              إلغاء
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={submitting}
              className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {editingId ? 'تحديث' : 'إضافة'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>تأكيد الحذف</AlertDialogTitle>
            <AlertDialogDescription>
              هل أنت متأكد من حذف هذا المخزن؟ لا يمكن التراجع عن هذا الإجراء.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              حذف
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
