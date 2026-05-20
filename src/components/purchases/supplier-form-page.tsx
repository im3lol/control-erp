'use client'

import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { Save, Send, ArrowRight, Loader2, Building2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { useAppStore } from '@/lib/store'

interface SupplierFormData {
  code: string
  nameAr: string
  nameEn: string
  phone: string
  email: string
  address: string
  paymentTerms: string
  isActive: boolean
}

const initialFormData: SupplierFormData = {
  code: '',
  nameAr: '',
  nameEn: '',
  phone: '',
  email: '',
  address: '',
  paymentTerms: '30',
  isActive: true,
}

export default function SupplierFormPage() {
  const companyId = useAppStore(state => state.currentCompanyId)
  const setModule = useAppStore(state => state.setModule)
  const setView = useAppStore(state => state.setView)
  const editingDocId = useAppStore(state => state.editingDocId)
  const [formData, setFormData] = useState<SupplierFormData>(initialFormData)
  const [submitting, setSubmitting] = useState(false)
  const [loading, setLoading] = useState(false)
  const [currentStatus, setCurrentStatus] = useState<string>('NEW')

  // Check if editing
  useEffect(() => {
    if (editingDocId && editingDocId !== 'new') {
      loadSupplier(editingDocId)
    }
  }, [editingDocId, companyId])

  const loadSupplier = async (id: string) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/purchases/suppliers?companyId=${companyId}`)
      if (res.ok) {
        const suppliers = await res.json()
        const supplier = suppliers.find((s: { id: string }) => s.id === id)
        if (supplier) {
          setFormData({
            code: supplier.code,
            nameAr: supplier.nameAr,
            nameEn: supplier.nameEn || '',
            phone: supplier.phone || '',
            email: supplier.email || '',
            address: supplier.address || '',
            paymentTerms: String(supplier.paymentTerms),
            isActive: supplier.isActive,
          })
          setCurrentStatus('ACTIVE') // Suppliers don't have draft/confirmed
        }
      }
    } catch {
      toast.error('فشل في تحميل بيانات المورد')
    } finally {
      setLoading(false)
    }
  }

  const handleGoBack = () => {
    setModule('purchases')
    setView('suppliers')
  }

  const handleSave = async () => {
    if (!formData.nameAr.trim()) {
      toast.error('الاسم بالعربية مطلوب')
      return
    }

    setSubmitting(true)
    try {
      const payload = {
        ...(editingDocId && editingDocId !== 'new' && { id: editingDocId }),
        code: formData.code || undefined,
        nameAr: formData.nameAr,
        nameEn: formData.nameEn || null,
        phone: formData.phone || null,
        email: formData.email || null,
        address: formData.address || null,
        paymentTerms: parseInt(formData.paymentTerms) || 30,
        isActive: formData.isActive,
        companyId,
      }

      const url = '/api/purchases/suppliers'
      const method = editingDocId && editingDocId !== 'new' ? 'PUT' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (res.ok) {
        toast.success(editingDocId && editingDocId !== 'new' ? 'تم تحديث المورد بنجاح' : 'تم إضافة المورد بنجاح')
        handleGoBack()
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={handleGoBack} className="hover:bg-slate-100">
            <ArrowRight className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-emerald-50 flex items-center justify-center">
              <Building2 className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                {editingDocId && editingDocId !== 'new' ? 'تعديل مورد' : 'إضافة مورد جديد'}
              </h2>
              <p className="text-xs text-slate-400">
                {editingDocId && editingDocId !== 'new' ? 'تعديل بيانات المورد' : 'أدخل بيانات المورد الجديد'}
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleGoBack}>
            إلغاء
          </Button>
          <Button
            onClick={handleSave}
            disabled={submitting}
            className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            حفظ
          </Button>
        </div>
      </div>

      {/* Form */}
      <Card className="border shadow-sm">
        <CardHeader className="pb-4">
          <CardTitle className="text-base">بيانات المورد</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="supplier-code">الكود</Label>
              <Input
                id="supplier-code"
                value={formData.code}
                onChange={(e) => setFormData((p) => ({ ...p, code: e.target.value }))}
                placeholder="تلقائي S-0001"
                dir="ltr"
                className="text-left"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="supplier-nameAr">
                الاسم بالعربية <span className="text-red-500">*</span>
              </Label>
              <Input
                id="supplier-nameAr"
                value={formData.nameAr}
                onChange={(e) => setFormData((p) => ({ ...p, nameAr: e.target.value }))}
                placeholder="شركة الأمل للتوريدات"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="supplier-nameEn">الاسم بالإنجليزية</Label>
              <Input
                id="supplier-nameEn"
                value={formData.nameEn}
                onChange={(e) => setFormData((p) => ({ ...p, nameEn: e.target.value }))}
                placeholder="Al-Amal Supplies Co."
                dir="ltr"
                className="text-left"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="supplier-phone">الهاتف</Label>
              <Input
                id="supplier-phone"
                value={formData.phone}
                onChange={(e) => setFormData((p) => ({ ...p, phone: e.target.value }))}
                placeholder="0551234567"
                dir="ltr"
                className="text-left"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="supplier-email">البريد الإلكتروني</Label>
              <Input
                id="supplier-email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData((p) => ({ ...p, email: e.target.value }))}
                placeholder="info@supplier.com"
                dir="ltr"
                className="text-left"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="supplier-paymentTerms">شروط الدفع (أيام)</Label>
              <Input
                id="supplier-paymentTerms"
                type="number"
                min="0"
                value={formData.paymentTerms}
                onChange={(e) => setFormData((p) => ({ ...p, paymentTerms: e.target.value }))}
                dir="ltr"
                className="text-left"
              />
            </div>
            <div className="space-y-2 sm:col-span-2 lg:col-span-3">
              <Label htmlFor="supplier-address">العنوان</Label>
              <Textarea
                id="supplier-address"
                value={formData.address}
                onChange={(e) => setFormData((p) => ({ ...p, address: e.target.value }))}
                placeholder="عنوان المورد..."
                rows={2}
              />
            </div>
            <div className="flex items-center gap-3">
              <Switch
                checked={formData.isActive}
                onCheckedChange={(checked) => setFormData((p) => ({ ...p, isActive: checked }))}
              />
              <Label>نشط</Label>
              {formData.isActive ? (
                <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200">نشط</Badge>
              ) : (
                <Badge variant="secondary" className="bg-slate-100 text-slate-500">غير نشط</Badge>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
