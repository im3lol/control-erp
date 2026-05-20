'use client'

import { useState, useEffect, useRef } from 'react'
import { toast } from 'sonner'
import {
  Plus,
  Pencil,
  Trash2,
  Package,
  Search,
  Loader2,
  Upload,
  X,
  Star,
  Barcode,
} from 'lucide-react'
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
import { useAppStore } from '@/lib/store'
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

interface ItemCode {
  id?: string
  codeType: string
  code: string
  isPrimary: boolean
}

interface ItemStats {
  salesCount: number
  purchaseCount: number
  movementCount: number
  adjustmentCount: number
}

interface Item {
  id: string
  code: string
  nameAr: string | null
  nameEn: string | null
  categoryId: string | null
  uomId: string | null
  costMethod: string
  sellPrice: number
  minStock: number
  maxStock: number | null
  description: string | null
  image: string | null
  isActive: boolean
  category?: Category | null
  uom?: UOM | null
  codes?: ItemCode[]
  primaryCode?: string | null
  _count?: { stockMovements: number }
  _stats?: ItemStats
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

const CODE_TYPE_OPTIONS = [
  { value: 'UPC', label: 'باركود UPC' },
  { value: 'EAN', label: 'باركود EAN' },
  { value: 'SKU', label: 'رمز التخزين SKU' },
  { value: 'ASIN', label: 'أمازون ASIN' },
  { value: 'FNSKU', label: 'أمازون FNSKU' },
  { value: 'OTHER', label: 'أخرى' },
]

const CODE_TYPE_COLORS: Record<string, string> = {
  UPC: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  EAN: 'bg-teal-50 text-teal-700 border-teal-200',
  SKU: 'bg-amber-50 text-amber-700 border-amber-200',
  ASIN: 'bg-purple-50 text-purple-700 border-purple-200',
  FNSKU: 'bg-rose-50 text-rose-700 border-rose-200',
  OTHER: 'bg-slate-50 text-slate-700 border-slate-200',
}

const CODE_TYPE_SHORT: Record<string, string> = {
  UPC: 'UPC',
  EAN: 'EAN',
  SKU: 'SKU',
  ASIN: 'ASIN',
  FNSKU: 'FNSKU',
  OTHER: 'أخرى',
}

export default function ItemsList() {
  const companyId = useAppStore(state => state.currentCompanyId)
  const setModule = useAppStore(state => state.setModule)
  const setView = useAppStore(state => state.setView)
  const setItemFilter = useAppStore(state => state.setItemFilter)
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

  // Product codes
  const [itemCodes, setItemCodes] = useState<ItemCode[]>([])

  // Product image
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [uploadingImage, setUploadingImage] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Navigation to detail page
  const setSelectedItemId = useAppStore(state => state.setSelectedItemId)

  useEffect(() => {
    fetchItems()
    fetchCategories()
    fetchUoms()
  }, [])

  const fetchItems = async () => {
    try {
      const res = await fetch(`/api/inventory/items?companyId=${companyId}`)
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
      const res = await fetch(`/api/inventory/categories?companyId=${companyId}`)
      if (res.ok) {
        const data = await res.json()
        setCategories(data)
      }
    } catch {
      // silently fail
    }
  }

  const fetchUoms = async () => {
    try {
      const res = await fetch(`/api/settings/uom?companyId=${companyId}`)
      if (res.ok) {
        const data = await res.json()
        setUoms(data)
      }
    } catch {
      // silently fail
    }
  }

  const fetchItemCodes = async (itemId: string) => {
    try {
      const res = await fetch(`/api/inventory/item-codes?companyId=${companyId}&itemId=${itemId}`)
      if (res.ok) {
        const data = await res.json()
        return data
      }
    } catch {
      // silently fail
    }
    return []
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

  // Get primary code for an item (from codes loaded on items)
  const getPrimaryCode = (item: Item) => {
    if (item.codes && item.codes.length > 0) {
      const primary = item.codes.find((c) => c.isPrimary)
      return primary || item.codes[0]
    }
    return null
  }

  // Filter items
  const filteredItems = items.filter((item) => {
    const matchesSearch =
      !searchTerm ||
      (item.nameAr && item.nameAr.includes(searchTerm)) ||
      item.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.nameEn && item.nameEn.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (item.codes && item.codes.some((c) => c.code.toLowerCase().includes(searchTerm.toLowerCase())))

    const matchesCategory =
      categoryFilter === 'all' || item.categoryId === categoryFilter

    return matchesSearch && matchesCategory
  })

  const handleOpenAdd = () => {
    setEditingId(null)
    // Auto-select PCS (Piece) as default UOM if available
    const pcsUom = uoms.find((u) => u.code === 'PCS')
    const defaultFormData: ItemFormData = {
      ...initialFormData,
      uomId: pcsUom?.id || '',
    }
    setFormData(defaultFormData)
    setItemCodes([{ codeType: 'SKU', code: '', isPrimary: true }])
    setImagePreview(null)
    setImageFile(null)
    setDialogOpen(true)
  }

  const handleOpenEdit = async (item: Item) => {
    setEditingId(item.id)
    setFormData({
      code: item.code,
      nameAr: item.nameAr || '',
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
    setImagePreview(item.image || null)
    setImageFile(null)

    // Load existing codes
    const codes = await fetchItemCodes(item.id)
    if (codes.length > 0) {
      setItemCodes(codes)
    } else {
      setItemCodes([{ codeType: 'SKU', code: '', isPrimary: true }])
    }

    setDialogOpen(true)
  }

  const handleOpenDelete = (id: string) => {
    setDeletingId(id)
    setDeleteDialogOpen(true)
  }

  const handleOpenDetail = (item: Item) => {
    setSelectedItemId(item.id)
    setView('item-detail')
  }

  // ── Image handling ──
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      toast.error('نوع الملف غير مدعوم. يُسمح بـ JPEG, PNG, WebP فقط')
      return
    }

    setImageFile(file)
    const reader = new FileReader()
    reader.onload = (ev) => {
      setImagePreview(ev.target?.result as string)
    }
    reader.readAsDataURL(file)
  }

  const handleRemoveImage = () => {
    setImagePreview(null)
    setImageFile(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const file = e.dataTransfer.files?.[0]
    if (!file) return

    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      toast.error('نوع الملف غير مدعوم. يُسمح بـ JPEG, PNG, WebP فقط')
      return
    }

    setImageFile(file)
    const reader = new FileReader()
    reader.onload = (ev) => {
      setImagePreview(ev.target?.result as string)
    }
    reader.readAsDataURL(file)
  }

  // ── Code handling ──
  const addCodeEntry = () => {
    setItemCodes((prev) => [...prev, { codeType: 'SKU', code: '', isPrimary: false }])
  }

  const removeCodeEntry = (index: number) => {
    setItemCodes((prev) => prev.filter((_, i) => i !== index))
  }

  const updateCodeEntry = (index: number, field: keyof ItemCode, value: string | boolean) => {
    setItemCodes((prev) =>
      prev.map((c, i) => {
        if (i !== index) return c
        if (field === 'isPrimary' && value === true) {
          return { ...c, isPrimary: true }
        }
        return { ...c, [field]: value }
      })
    )
    // If isPrimary was set, unset others
    if (field === 'isPrimary' && value === true) {
      setItemCodes((prev) =>
        prev.map((c, i) => (i === index ? { ...c, isPrimary: true } : { ...c, isPrimary: false }))
      )
    }
  }

  // ── Submit ──
  const handleSubmit = async () => {
    if (!formData.code.trim()) {
      toast.error('يرجى إدخال كود الصنف')
      return
    }

    setSubmitting(true)
    try {
      // 1. Save item
      const url = '/api/inventory/items'
      const method = editingId ? 'PUT' : 'POST'

      const payload = {
        code: formData.code,
        nameAr: formData.nameAr || null,
        nameEn: formData.nameEn || null,
        categoryId: formData.categoryId || null,
        uomId: formData.uomId || null,
        costMethod: formData.costMethod,
        sellPrice: parseFloat(formData.sellPrice) || 0,
        minStock: parseFloat(formData.minStock) || 0,
        maxStock: formData.maxStock ? parseFloat(formData.maxStock) : null,
        description: formData.description || null,
        isActive: formData.isActive,
        ...(editingId ? { id: editingId } : {}),
      }

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payload, companyId }),
      })

      if (!res.ok) {
        const err = await res.json()
        toast.error(err.error || 'فشل في حفظ البيانات')
        setSubmitting(false)
        return
      }

      const savedItem = await res.json()
      const itemId = savedItem.id

      // 2. Upload image if new
      if (imageFile && itemId) {
        setUploadingImage(true)
        try {
          const imgFormData = new FormData()
          imgFormData.append('file', imageFile)
          imgFormData.append('itemId', itemId)
          imgFormData.append('companyId', companyId || '')
          const imgRes = await fetch(`/api/inventory/items/image?companyId=${companyId}`, {
            method: 'POST',
            body: imgFormData,
          })
          if (!imgRes.ok) {
            toast.error('فشل في رفع الصورة')
          }
        } catch {
          toast.error('فشل في رفع الصورة')
        }
        setUploadingImage(false)
      }

      // 3. Save codes
      const validCodes = itemCodes.filter((c) => c.code.trim())
      if (validCodes.length > 0 && itemId) {
        // If editing, delete existing codes first then recreate
        if (editingId) {
          const existingCodes = await fetchItemCodes(itemId)
          for (const ec of existingCodes) {
            if (ec.id) {
              await fetch(`/api/inventory/item-codes?companyId=${companyId}`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: ec.id, companyId }),
              })
            }
          }
        }

        for (const code of validCodes) {
          await fetch(`/api/inventory/item-codes?companyId=${companyId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              itemId,
              codeType: code.codeType,
              code: code.code,
              isPrimary: code.isPrimary,
              companyId,
            }),
          })
        }
      }

      toast.success(editingId ? 'تم تحديث الصنف بنجاح' : 'تم إضافة الصنف بنجاح')
      setDialogOpen(false)
      fetchItems()
    } catch {
      toast.error('حدث خطأ أثناء حفظ البيانات')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async () => {
    if (!deletingId) return
    try {
      const res = await fetch(`/api/inventory/items?companyId=${companyId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: deletingId, companyId }),
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
                placeholder="بحث بالاسم أو الكود أو الباركود..."
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
                  <TableHead className="text-right font-semibold w-12"></TableHead>
                  <TableHead className="text-right font-semibold">الكود</TableHead>
                  <TableHead className="text-right font-semibold">الاسم عربي</TableHead>
                  <TableHead className="text-right font-semibold">الفئة</TableHead>
                  <TableHead className="text-right font-semibold">الوحدة</TableHead>
                  <TableHead className="text-right font-semibold">سعر البيع</TableHead>
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
                  filteredItems.map((item) => {
                    const primaryCode = getPrimaryCode(item)
                    return (
                      <TableRow
                        key={item.id}
                        className="cursor-pointer group"
                        onClick={() => handleOpenDetail(item)}
                      >
                        <TableCell>
                          {item.image ? (
                            <img
                              src={item.image}
                              alt={item.nameAr || item.code}
                              className="h-8 w-8 rounded-md object-cover border border-slate-100"
                            />
                          ) : (
                            <div className="h-8 w-8 rounded-md bg-slate-50 flex items-center justify-center border border-slate-100">
                              <Package className="h-4 w-4 text-slate-300" />
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <div>
                            <span className="font-mono text-sm">{item.code}</span>
                            {primaryCode && (
                              <div className="flex items-center gap-1 mt-0.5">
                                <Badge
                                  variant="outline"
                                  className={`text-[10px] px-1 py-0 h-4 ${CODE_TYPE_COLORS[primaryCode.codeType] || ''}`}
                                >
                                  {CODE_TYPE_SHORT[primaryCode.codeType] || primaryCode.codeType}
                                </Badge>
                                <span className="text-xs text-slate-400 font-mono" dir="ltr">
                                  {primaryCode.code}
                                </span>
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="font-medium">{item.nameAr || item.nameEn || item.code}</TableCell>
                        <TableCell className="text-slate-500">
                          {getCategoryName(item.categoryId)}
                        </TableCell>
                        <TableCell className="text-slate-500">
                          {getUOMName(item.uomId)}
                        </TableCell>
                        <TableCell className="font-mono" dir="ltr">
                          {formatCurrency(item.sellPrice)}
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
                          <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
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
                    )
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? 'تعديل الصنف' : 'إضافة صنف جديد'}</DialogTitle>
            <DialogDescription>
              {editingId ? 'قم بتعديل بيانات الصنف' : 'أدخل بيانات الصنف الجديد'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6 py-2">
            {/* Image Upload Area */}
            <div className="space-y-2">
              <Label>صورة المنتج</Label>
              <div
                className="border-2 border-dashed border-slate-200 rounded-xl p-4 text-center hover:border-emerald-300 hover:bg-emerald-50/30 transition-colors cursor-pointer"
                onClick={() => fileInputRef.current?.click()}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
              >
                {imagePreview ? (
                  <div className="relative inline-block">
                    <img
                      src={imagePreview}
                      alt="Preview"
                      className="h-32 w-32 rounded-lg object-cover mx-auto"
                    />
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleRemoveImage()
                      }}
                      className="absolute -top-2 -left-2 h-6 w-6 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ) : (
                  <div className="py-4">
                    <Upload className="h-8 w-8 mx-auto text-slate-300 mb-2" />
                    <p className="text-sm text-slate-500">اضغط لرفع الصورة أو اسحبها هنا</p>
                    <p className="text-xs text-slate-300 mt-1">JPEG, PNG, WebP</p>
                  </div>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={handleImageChange}
                />
              </div>
            </div>

            {/* Main Fields */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                  الاسم عربي
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

            {/* Product Codes Section */}
            <div className="border-t pt-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Barcode className="h-4 w-4 text-slate-500" />
                  <Label className="text-sm font-semibold">أكواد المنتج</Label>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addCodeEntry}
                  className="gap-1"
                >
                  <Plus className="h-3.5 w-3.5" />
                  إضافة كود
                </Button>
              </div>
              <div className="space-y-2">
                {itemCodes.map((codeEntry, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <Select
                      value={codeEntry.codeType}
                      onValueChange={(val) => updateCodeEntry(index, 'codeType', val)}
                    >
                      <SelectTrigger className="w-36 shrink-0">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CODE_TYPE_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      value={codeEntry.code}
                      onChange={(e) => updateCodeEntry(index, 'code', e.target.value)}
                      placeholder="قيمة الكود"
                      dir="ltr"
                      className="text-left flex-1"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => updateCodeEntry(index, 'isPrimary', !codeEntry.isPrimary)}
                      className={`h-9 w-9 shrink-0 ${
                        codeEntry.isPrimary
                          ? 'text-amber-500 hover:bg-amber-50'
                          : 'text-slate-300 hover:text-amber-400'
                      }`}
                      title="رئيسي"
                    >
                      <Star className={`h-4 w-4 ${codeEntry.isPrimary ? 'fill-current' : ''}`} />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeCodeEntry(index)}
                      className="h-9 w-9 shrink-0 text-slate-400 hover:text-red-500 hover:bg-red-50"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              إلغاء
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={submitting || uploadingImage}
              className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
            >
              {(submitting || uploadingImage) && <Loader2 className="h-4 w-4 animate-spin" />}
              {uploadingImage ? 'جاري رفع الصورة...' : editingId ? 'تحديث' : 'إضافة'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
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
