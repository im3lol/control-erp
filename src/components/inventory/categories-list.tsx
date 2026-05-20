'use client'

import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { Plus, Pencil, Trash2, Tags, Loader2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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
import { useAppStore } from '@/lib/store'

interface Category {
  id: string
  code: string
  nameAr: string
  nameEn: string | null
  parentId: string | null
  isActive: boolean
  parent?: Category | null
  children?: Category[]
  items?: { id: string }[]
  _count?: { items: number }
}

interface CategoryFormData {
  code: string
  nameAr: string
  nameEn: string
  parentId: string
  isActive: boolean
}

const initialFormData: CategoryFormData = {
  code: '',
  nameAr: '',
  nameEn: '',
  parentId: '',
  isActive: true,
}

// Flatten categories for the parent dropdown
function flattenCategories(categories: Category[], prefix = ''): { id: string; label: string }[] {
  const result: { id: string; label: string }[] = []
  for (const cat of categories) {
    result.push({ id: cat.id, label: `${prefix}${cat.nameAr}` })
    if (cat.children && cat.children.length > 0) {
      result.push(...flattenCategories(cat.children, `${prefix}${cat.nameAr} / `))
    }
  }
  return result
}

// Flatten with depth for tree display in table
function flattenWithDepth(categories: Category[], depth = 0): (Category & { depth: number })[] {
  const result: (Category & { depth: number })[] = []
  for (const cat of categories) {
    result.push({ ...cat, depth })
    if (cat.children && cat.children.length > 0) {
      result.push(...flattenWithDepth(cat.children, depth + 1))
    }
  }
  return result
}

// Build tree from flat list
function buildTree(categories: Category[]): Category[] {
  const map = new Map<string, Category>()
  const roots: Category[] = []

  for (const cat of categories) {
    map.set(cat.id, { ...cat, children: [] })
  }

  for (const cat of categories) {
    const node = map.get(cat.id)!
    if (cat.parentId && map.has(cat.parentId)) {
      map.get(cat.parentId)!.children!.push(node)
    } else {
      roots.push(node)
    }
  }

  return roots
}

export default function CategoriesList() {
  const companyId = useAppStore(state => state.currentCompanyId)
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [formData, setFormData] = useState<CategoryFormData>(initialFormData)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!companyId) return
    fetchCategories()
  }, [companyId])

  const fetchCategories = async () => {
    try {
      const res = await fetch(`/api/inventory/categories?companyId=${companyId}`)
      if (res.ok) {
        const data = await res.json()
        setCategories(data)
      }
    } catch {
      toast.error('فشل في تحميل الفئات')
    } finally {
      setLoading(false)
    }
  }

  const tree = buildTree(categories)
  const flatTree = flattenWithDepth(tree)
  const parentOptions = flattenCategories(tree)

  const handleOpenAdd = () => {
    setEditingId(null)
    setFormData(initialFormData)
    setDialogOpen(true)
  }

  const handleOpenEdit = (cat: Category) => {
    setEditingId(cat.id)
    setFormData({
      code: cat.code,
      nameAr: cat.nameAr,
      nameEn: cat.nameEn || '',
      parentId: cat.parentId || '',
      isActive: cat.isActive,
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
      const url = '/api/inventory/categories'
      const method = editingId ? 'PUT' : 'POST'

      const payload = {
        ...formData,
        ...(editingId ? { id: editingId } : {}),
        parentId: formData.parentId || null,
      }

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payload, companyId }),
      })

      if (res.ok) {
        toast.success(editingId ? 'تم تحديث الفئة بنجاح' : 'تم إضافة الفئة بنجاح')
        setDialogOpen(false)
        fetchCategories()
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
      const res = await fetch(`/api/inventory/categories?companyId=${companyId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: deletingId, companyId }),
      })
      if (res.ok) {
        toast.success('تم حذف الفئة بنجاح')
        fetchCategories()
      } else {
        const err = await res.json()
        toast.error(err.error || 'فشل في حذف الفئة')
      }
    } catch {
      toast.error('حدث خطأ أثناء الحذف')
    } finally {
      setDeleteDialogOpen(false)
      setDeletingId(null)
    }
  }

  // Find parent name for a category
  const getParentName = (parentId: string | null) => {
    if (!parentId) return '—'
    const parent = categories.find((c) => c.id === parentId)
    return parent?.nameAr || '—'
  }

  // Get item count for a category
  const getItemCount = (cat: Category) => {
    return cat._count?.items ?? cat.items?.length ?? 0
  }

  if (loading) {
    return (
      <Card className="border shadow-sm">
        <CardHeader>
          <div className="flex items-center justify-between">
            <Skeleton className="h-7 w-36" />
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
                <Tags className="h-5 w-5 text-emerald-600" />
              </div>
              <CardTitle className="text-lg">الفئات</CardTitle>
            </div>
            <Button
              onClick={handleOpenAdd}
              className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
            >
              <Plus className="h-4 w-4" />
              إضافة فئة
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
                  <TableHead className="text-right font-semibold">الفئة الأب</TableHead>
                  <TableHead className="text-right font-semibold">عدد الأصناف</TableHead>
                  <TableHead className="text-right font-semibold">الحالة</TableHead>
                  <TableHead className="text-right font-semibold">إجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {flatTree.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-12">
                      <div className="flex flex-col items-center text-slate-400">
                        <Tags className="h-12 w-12 mb-3 text-slate-200" />
                        <p className="text-sm">لا توجد فئات مسجلة</p>
                        <p className="text-xs mt-1 text-slate-300">
                          اضغط على &quot;إضافة فئة&quot; لإضافة فئة جديدة
                        </p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  flatTree.map((cat) => (
                    <TableRow key={cat.id}>
                      <TableCell className="font-mono text-sm">{cat.code}</TableCell>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          {cat.depth > 0 && (
                            <span
                              className="text-slate-300"
                              style={{ marginRight: `${cat.depth * 20}px` }}
                            >
                              └
                            </span>
                          )}
                          {cat.nameAr}
                        </div>
                      </TableCell>
                      <TableCell className="text-slate-500" dir="ltr">
                        {cat.nameEn || '—'}
                      </TableCell>
                      <TableCell className="text-slate-500">
                        {getParentName(cat.parentId)}
                      </TableCell>
                      <TableCell>
                        <span className="font-mono text-sm">
                          {getItemCount(cat).toLocaleString('ar-EG')}
                        </span>
                      </TableCell>
                      <TableCell>
                        {cat.isActive ? (
                          <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200">
                            نشطة
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="bg-slate-100 text-slate-500">
                            غير نشطة
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleOpenEdit(cat)}
                            className="h-8 w-8 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleOpenDelete(cat.id)}
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
            <DialogTitle>{editingId ? 'تعديل الفئة' : 'إضافة فئة جديدة'}</DialogTitle>
            <DialogDescription>
              {editingId ? 'قم بتعديل بيانات الفئة' : 'أدخل بيانات الفئة الجديدة'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="cat-code">
                الكود <span className="text-red-500">*</span>
              </Label>
              <Input
                id="cat-code"
                value={formData.code}
                onChange={(e) => setFormData((p) => ({ ...p, code: e.target.value }))}
                placeholder="CAT-001"
                dir="ltr"
                className="text-left"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cat-nameAr">
                الاسم عربي <span className="text-red-500">*</span>
              </Label>
              <Input
                id="cat-nameAr"
                value={formData.nameAr}
                onChange={(e) => setFormData((p) => ({ ...p, nameAr: e.target.value }))}
                placeholder="إلكترونيات"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cat-nameEn">الاسم إنجليزي</Label>
              <Input
                id="cat-nameEn"
                value={formData.nameEn}
                onChange={(e) => setFormData((p) => ({ ...p, nameEn: e.target.value }))}
                placeholder="Electronics"
                dir="ltr"
                className="text-left"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cat-parent">الفئة الأب</Label>
              <Select
                value={formData.parentId}
                onValueChange={(val) =>
                  setFormData((p) => ({ ...p, parentId: val === '_none_' ? '' : val }))
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="بدون فئة أب" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none_">بدون فئة أب</SelectItem>
                  {parentOptions
                    .filter((opt) => opt.id !== editingId)
                    .map((opt) => (
                      <SelectItem key={opt.id} value={opt.id}>
                        {opt.label}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2 pt-6">
              <Switch
                checked={formData.isActive}
                onCheckedChange={(checked) =>
                  setFormData((p) => ({ ...p, isActive: checked }))
                }
              />
              <Label className="text-sm">نشطة</Label>
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
              هل أنت متأكد من حذف هذه الفئة؟ لا يمكن التراجع عن هذا الإجراء.
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
