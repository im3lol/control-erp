'use client'

import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { Plus, Pencil, Trash2, Package, Search, Loader2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
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
import { formatCurrency } from '@/lib/erp-utils'

interface Category {
  id: string
  code: string
  nameAr: string
  nameEn: string | null
  parentId: string | null
}

interface UOM {
  id: string
  code: string
  nameAr: string
  nameEn: string
}

interface Item {
  id: string
  code: string
  nameAr: string
  nameEn: string | null
  categoryId: string | null
  uomId: string | null
  costMethod: string
  sellPrice: number
  minStock: number
  maxStock: number | null
  description: string | null
  isActive: boolean
  category?: Category | null
  uom?: UOM | null
  _count?: { stockMovements: number }
}

interface ItemFormData {
  code: string
  nameAr: string
  nameEn: string
  categoryId: string
  uomId: string
  costMethod: string
  sellPrice: string
  minStock: string
  maxStock: string
  description: string
  isActive: boolean
}

const initialFormData: ItemFormData = {
  code: '',
  nameAr: '',
  nameEn: '',
  categoryId: '',
  uomId: '',
  costMethod: 'FIFO',
  sellPrice: '0',
  minStock: '0',
  maxStock: '',
  description: '',
  isActive: true,
}

export default function ItemsList() {
  const [items, setItems] = useState<Item[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [uoms, setUoms] = useState<UOM[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [formData, setFormData] = useState<ItemFormData>(initialFormData)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    fetchItems()
    fetchCategories()
    fetchUoms()
  }, [])

  const fetchItems = async () => {
    try {
      const res = await fetch('/api/inventory/items')
      if (res.ok) {
        const data = await res.json()
        setItems(data)
      }
    } catch {
      toast.error('فشل في تحميل الأصناف')
    } finally {
      setLoading(false)
    }
  }

  const fetchCategories = async () => {
    try {
      const res = await fetch('/api/inventory/categories')
      if (res.ok) {
        const data = await res.json()
        setCategories(data)
      }
    } catch {
      // silently fail - categories are for dropdown
    }
  }

  const fetchUoms = async () => {
    try {
      const res = await fetch('/api/settings/uom')
      if (res.ok) {
        const data = await res.json()
        setUoms(data)
      }
    } catch {
      // silently fail - uoms are for dropdown
    }
  }

  const getCategoryName = (categoryId: string | null) => {
    if (!categoryId) return '—'
    const cat = categories.find((c) => c.id === categoryId)
    return cat?.nameAr || '—'
  }

  const getUOMName = (uomId: string | null) => {
    if (!uomId) return '—'
    const uom = uoms.find((u) => u.id === uomId)
    return uom?.nameAr || '—'
  }

  // Filter items
  const filteredItems = items.filter((item) => {
    const matchesSearch =
      !searchTerm ||
      item.nameAr.includes(searchTerm) ||
      item.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.nameEn && item.nameEn.toLowerCase().includes(searchTerm.toLowerCase()))

    const matchesCategory =
      categoryFilter === 'all' || item.categoryId === categoryFilter

    return matchesSearch && matchesCategory
  })

  const handleOpenAdd = () => {
    setEditingId(null)
    setFormData(initialFormData)
    setDialogOpen(true)
  }

  const handleOpenEdit = (item: Item) => {
    setEditingId(item.id)
    setFormData({
      code: item.code,
      nameAr: item.nameAr,
      nameEn: item.nameEn || '',
      categoryId: item.categoryId || '',
      uomId: item.uomId || '',
      costMethod: item.costMethod,
      sellPrice: String(item.sellPrice),
      minStock: String(item.minStock),
      maxStock: item.maxStock !== null ? String(item.maxStock) : '',
      description: item.description || '',
      isActive: item.isActive,
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
        ? `/api/inventory/items/${editingId}`
        : '/api/inventory/items'
      const method = editingId ? 'PUT' : 'POST'

      const payload = {
        code: formData.code,
        nameAr: formData.nameAr,
        nameEn: formData.nameEn || null,
        categoryId: formData.categoryId || null,
        uomId: formData.uomId || null,
        costMethod: formData.costMethod,
        sellPrice: parseFloat(formData.sellPrice) || 0,
        minStock: parseFloat(formData.minStock) || 0,
        maxStock: formData.maxStock ? parseFloat(formData.maxStock) : null,
        description: formData.description || null,
        isActive: formData.isActive,
      }

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (res.ok) {
        toast.success(editingId ? 'تم تحديث الصنف بنجاح' : 'تم إضافة الصنف بنجاح')
        setDialogOpen(false)
        fetchItems()
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
      const res = await fetch(`/api/inventory/items/${deletingId}`, {
        method: 'DELETE',
      })
      if (res.ok) {
        toast.success('تم حذف الصنف بنجاح')
        fetchItems()
      } else {
        const err = await res.json()
        toast.error(err.error || 'فشل في حذف الصنف')
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
                <Package className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <CardTitle className="text-lg">الأصناف</CardTitle>
                <p className="text-xs text-slate-400 mt-0.5">
                  {items.length.toLocaleString('ar-EG')} صنف
                </p>
              </div>
            </div>
            <Button
              onClick={handleOpenAdd}
              className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
            >
              <Plus className="h-4 w-4" />
              إضافة صنف
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Search & Filter Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mb-4">
            <div className="relative flex-1">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="بحث بالاسم أو الكود..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pr-9"
              />
            </div>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="كل الفئات" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل الفئات</SelectItem>
                {categories.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id}>
                    {cat.nameAr}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Table */}
          <div className="max-h-[calc(100vh-340px)] overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50/80 hover:bg-slate-50/80">
                  <TableHead className="text-right font-semibold">الكود</TableHead>
                  <TableHead className="text-right font-semibold">الاسم عربي</TableHead>
                  <TableHead className="text-right font-semibold">الفئة</TableHead>
                  <TableHead className="text-right font-semibold">الوحدة</TableHead>
                  <TableHead className="text-right font-semibold">سعر البيع</TableHead>
                  <TableHead className="text-right font-semibold">الحد الأدنى</TableHead>
                  <TableHead className="text-right font-semibold">طريقة التكلفة</TableHead>
                  <TableHead className="text-right font-semibold">الحالة</TableHead>
                  <TableHead className="text-right font-semibold">إجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredItems.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-12">
                      <div className="flex flex-col items-center text-slate-400">
                        <Package className="h-12 w-12 mb-3 text-slate-200" />
                        <p className="text-sm">
                          {searchTerm || categoryFilter !== 'all'
                            ? 'لا توجد أصناف مطابقة للبحث'
                            : 'لا توجد أصناف مسجلة'}
                        </p>
                        <p className="text-xs mt-1 text-slate-300">
                          {searchTerm || categoryFilter !== 'all'
                            ? 'حاول تعديل معايير البحث'
                            : 'اضغط على "إضافة صنف" لإضافة صنف جديد'}
                        </p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredItems.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-mono text-sm">{item.code}</TableCell>
                      <TableCell className="font-medium">{item.nameAr}</TableCell>
                      <TableCell className="text-slate-500">
                        {getCategoryName(item.categoryId)}
                      </TableCell>
                      <TableCell className="text-slate-500">
                        {getUOMName(item.uomId)}
                      </TableCell>
                      <TableCell className="font-mono" dir="ltr">
                        {formatCurrency(item.sellPrice)}
                      </TableCell>
                      <TableCell className="font-mono" dir="ltr">
                        {item.minStock.toLocaleString('ar-EG')}
                      </TableCell>
                      <TableCell>
                        {item.costMethod === 'FIFO' ? (
                          <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200">
                            FIFO
                          </Badge>
                        ) : (
                          <Badge className="bg-teal-50 text-teal-700 border-teal-200">
                            WAC
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {item.isActive ? (
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
                            onClick={() => handleOpenEdit(item)}
                            className="h-8 w-8 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleOpenDelete(item.id)}
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
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingId ? 'تعديل الصنف' : 'إضافة صنف جديد'}</DialogTitle>
            <DialogDescription>
              {editingId ? 'قم بتعديل بيانات الصنف' : 'أدخل بيانات الصنف الجديد'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="item-code">
                الكود <span className="text-red-500">*</span>
              </Label>
              <Input
                id="item-code"
                value={formData.code}
                onChange={(e) => setFormData((p) => ({ ...p, code: e.target.value }))}
                placeholder="ITEM-001"
                dir="ltr"
                className="text-left"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="item-nameAr">
                الاسم عربي <span className="text-red-500">*</span>
              </Label>
              <Input
                id="item-nameAr"
                value={formData.nameAr}
                onChange={(e) => setFormData((p) => ({ ...p, nameAr: e.target.value }))}
                placeholder="لابتوب HP"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="item-nameEn">الاسم إنجليزي</Label>
              <Input
                id="item-nameEn"
                value={formData.nameEn}
                onChange={(e) => setFormData((p) => ({ ...p, nameEn: e.target.value }))}
                placeholder="HP Laptop"
                dir="ltr"
                className="text-left"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="item-category">الفئة</Label>
              <Select
                value={formData.categoryId}
                onValueChange={(val) =>
                  setFormData((p) => ({ ...p, categoryId: val === '_none_' ? '' : val }))
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="اختر الفئة" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none_">بدون فئة</SelectItem>
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.nameAr}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="item-uom">وحدة القياس</Label>
              <Select
                value={formData.uomId}
                onValueChange={(val) =>
                  setFormData((p) => ({ ...p, uomId: val === '_none_' ? '' : val }))
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="اختر الوحدة" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none_">بدون وحدة</SelectItem>
                  {uoms.map((uom) => (
                    <SelectItem key={uom.id} value={uom.id}>
                      {uom.nameAr} ({uom.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="item-costMethod">طريقة التكلفة</Label>
              <Select
                value={formData.costMethod}
                onValueChange={(val) => setFormData((p) => ({ ...p, costMethod: val }))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="FIFO">FIFO - الوارد أولاً يصرف أولاً</SelectItem>
                  <SelectItem value="WAC">WAC - متوسط التكلفة المرجح</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="item-sellPrice">سعر البيع</Label>
              <Input
                id="item-sellPrice"
                type="number"
                min="0"
                step="0.01"
                value={formData.sellPrice}
                onChange={(e) => setFormData((p) => ({ ...p, sellPrice: e.target.value }))}
                dir="ltr"
                className="text-left"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="item-minStock">الحد الأدنى</Label>
              <Input
                id="item-minStock"
                type="number"
                min="0"
                step="1"
                value={formData.minStock}
                onChange={(e) => setFormData((p) => ({ ...p, minStock: e.target.value }))}
                dir="ltr"
                className="text-left"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="item-maxStock">الحد الأقصى</Label>
              <Input
                id="item-maxStock"
                type="number"
                min="0"
                step="1"
                value={formData.maxStock}
                onChange={(e) => setFormData((p) => ({ ...p, maxStock: e.target.value }))}
                placeholder="غير محدد"
                dir="ltr"
                className="text-left"
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
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="item-description">الوصف</Label>
              <Textarea
                id="item-description"
                value={formData.description}
                onChange={(e) => setFormData((p) => ({ ...p, description: e.target.value }))}
                placeholder="وصف الصنف..."
                rows={3}
              />
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
              هل أنت متأكد من حذف هذا الصنف؟ لا يمكن التراجع عن هذا الإجراء.
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
