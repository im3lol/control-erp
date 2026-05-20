'use client'

import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { Plus, Pencil, Trash2, DollarSign, Loader2, Star } from 'lucide-react'
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
import { useAppStore } from '@/lib/store'

interface Currency {
  id: string
  code: string
  nameAr: string
  nameEn: string
  symbol: string
  isBase: boolean
  exchangeRate: number
  isActive: boolean
}

interface CurrencyFormData {
  code: string
  nameAr: string
  nameEn: string
  symbol: string
  isBase: boolean
  exchangeRate: number
  isActive: boolean
}

const initialFormData: CurrencyFormData = {
  code: '',
  nameAr: '',
  nameEn: '',
  symbol: '',
  isBase: false,
  exchangeRate: 1,
  isActive: true,
}

export default function CurrenciesList() {
  const companyId = useAppStore(state => state.currentCompanyId)
  const [currencies, setCurrencies] = useState<Currency[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [formData, setFormData] = useState<CurrencyFormData>(initialFormData)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!companyId) return
    fetchCurrencies()
  }, [companyId])

  const fetchCurrencies = async () => {
    try {
      const res = await fetch(`/api/settings/currencies?companyId=${companyId}`)
      if (res.ok) {
        const data = await res.json()
        setCurrencies(data)
      }
    } catch {
      toast.error('فشل في تحميل العملات')
    } finally {
      setLoading(false)
    }
  }

  const handleOpenAdd = () => {
    setEditingId(null)
    setFormData(initialFormData)
    setDialogOpen(true)
  }

  const handleOpenEdit = (currency: Currency) => {
    setEditingId(currency.id)
    setFormData({
      code: currency.code,
      nameAr: currency.nameAr,
      nameEn: currency.nameEn,
      symbol: currency.symbol,
      isBase: currency.isBase,
      exchangeRate: currency.exchangeRate,
      isActive: currency.isActive,
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
        ? `/api/settings/currencies/${editingId}`
        : '/api/settings/currencies'
      const method = editingId ? 'PUT' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, companyId }),
      })

      if (res.ok) {
        toast.success(editingId ? 'تم تحديث العملة بنجاح' : 'تم إضافة العملة بنجاح')
        setDialogOpen(false)
        fetchCurrencies()
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
      const res = await fetch(`/api/settings/currencies/${deletingId}?companyId=${companyId}`, { method: 'DELETE' })
      if (res.ok) {
        toast.success('تم حذف العملة بنجاح')
        fetchCurrencies()
      } else {
        const err = await res.json()
        toast.error(err.error || 'فشل في حذف العملة')
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
            <Skeleton className="h-7 w-36" />
            <Skeleton className="h-10 w-32" />
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
                <DollarSign className="h-5 w-5 text-emerald-600" />
              </div>
              <CardTitle className="text-lg">العملات</CardTitle>
            </div>
            <Button
              onClick={handleOpenAdd}
              className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
            >
              <Plus className="h-4 w-4" />
              إضافة عملة
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
                  <TableHead className="text-right font-semibold">الرمز</TableHead>
                  <TableHead className="text-right font-semibold">العملة الأساسية</TableHead>
                  <TableHead className="text-right font-semibold">سعر الصرف</TableHead>
                  <TableHead className="text-right font-semibold">الحالة</TableHead>
                  <TableHead className="text-right font-semibold">إجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {currencies.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-12">
                      <div className="flex flex-col items-center text-slate-400">
                        <DollarSign className="h-12 w-12 mb-3 text-slate-200" />
                        <p className="text-sm">لا توجد عملات مسجلة</p>
                        <p className="text-xs mt-1 text-slate-300">
                          اضغط على &quot;إضافة عملة&quot; لإضافة عملة جديدة
                        </p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  currencies.map((currency) => (
                    <TableRow key={currency.id}>
                      <TableCell className="font-mono text-sm">{currency.code}</TableCell>
                      <TableCell className="font-medium">{currency.nameAr}</TableCell>
                      <TableCell className="text-slate-500" dir="ltr">{currency.nameEn}</TableCell>
                      <TableCell className="font-mono">{currency.symbol}</TableCell>
                      <TableCell>
                        {currency.isBase ? (
                          <Badge className="bg-amber-50 text-amber-700 border-amber-200 gap-1">
                            <Star className="h-3 w-3" />
                            أساسية
                          </Badge>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </TableCell>
                      <TableCell className="font-mono" dir="ltr">
                        {currency.exchangeRate.toFixed(4)}
                      </TableCell>
                      <TableCell>
                        {currency.isActive ? (
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
                            onClick={() => handleOpenEdit(currency)}
                            className="h-8 w-8 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleOpenDelete(currency.id)}
                            className="h-8 w-8 text-slate-500 hover:text-red-600 hover:bg-red-50"
                            disabled={currency.isBase}
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
            <DialogTitle>{editingId ? 'تعديل العملة' : 'إضافة عملة جديدة'}</DialogTitle>
            <DialogDescription>
              {editingId ? 'قم بتعديل بيانات العملة' : 'أدخل بيانات العملة الجديدة'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="curr-code">
                الكود <span className="text-red-500">*</span>
              </Label>
              <Input
                id="curr-code"
                value={formData.code}
                onChange={(e) => setFormData((p) => ({ ...p, code: e.target.value }))}
                placeholder="SAR"
                dir="ltr"
                className="text-left"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="curr-symbol">الرمز</Label>
              <Input
                id="curr-symbol"
                value={formData.symbol}
                onChange={(e) => setFormData((p) => ({ ...p, symbol: e.target.value }))}
                placeholder="ر.س"
                dir="ltr"
                className="text-left"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="curr-nameAr">
                الاسم عربي <span className="text-red-500">*</span>
              </Label>
              <Input
                id="curr-nameAr"
                value={formData.nameAr}
                onChange={(e) => setFormData((p) => ({ ...p, nameAr: e.target.value }))}
                placeholder="ريال سعودي"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="curr-nameEn">الاسم إنجليزي</Label>
              <Input
                id="curr-nameEn"
                value={formData.nameEn}
                onChange={(e) => setFormData((p) => ({ ...p, nameEn: e.target.value }))}
                placeholder="Saudi Riyal"
                dir="ltr"
                className="text-left"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="curr-rate">سعر الصرف</Label>
              <Input
                id="curr-rate"
                type="number"
                step="0.0001"
                min="0"
                value={formData.exchangeRate}
                onChange={(e) =>
                  setFormData((p) => ({ ...p, exchangeRate: parseFloat(e.target.value) || 0 }))
                }
                dir="ltr"
                className="text-left"
              />
            </div>
            <div className="flex items-center gap-6 pt-6">
              <div className="flex items-center gap-2">
                <Switch
                  checked={formData.isBase}
                  onCheckedChange={(checked) =>
                    setFormData((p) => ({ ...p, isBase: checked }))
                  }
                />
                <Label className="text-sm">عملة أساسية</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={formData.isActive}
                  onCheckedChange={(checked) =>
                    setFormData((p) => ({ ...p, isActive: checked }))
                  }
                />
                <Label className="text-sm">نشطة</Label>
              </div>
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
              هل أنت متأكد من حذف هذه العملة؟ لا يمكن التراجع عن هذا الإجراء.
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
