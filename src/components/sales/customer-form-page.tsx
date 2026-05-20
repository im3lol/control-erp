'use client'

import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { Save, ArrowRight, Loader2, Users } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { useAppStore } from '@/lib/store'

interface CustomerFormData {
  code: string
  nameAr: string
  nameEn: string
  phone: string
  email: string
  address: string
  creditLimit: string
  paymentTerms: string
  isActive: boolean
}

const initialFormData: CustomerFormData = {
  code: '',
  nameAr: '',
  nameEn: '',
  phone: '',
  email: '',
  address: '',
  creditLimit: '0',
  paymentTerms: '30',
  isActive: true,
}

export default function CustomerFormPage() {
  const companyId = useAppStore(state => state.currentCompanyId)
  const setModule = useAppStore(state => state.setModule)
  const setView = useAppStore(state => state.setView)
  const editingDocId = useAppStore(state => state.editingDocId)
  const [formData, setFormData] = useState<CustomerFormData>(initialFormData)
  const [submitting, setSubmitting] = useState(false)
  const [loading, setLoading] = useState(false)

  // Check if editing
  useEffect(() => {
    if (editingDocId && editingDocId !== 'new') {
      loadCustomer(editingDocId)
    }
  }, [editingDocId, companyId])

  const loadCustomer = async (id: string) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/sales/customers?companyId=${companyId}`)
      if (res.ok) {
        const customers = await res.json()
        const customer = customers.find((c: { id: string }) => c.id === id)
        if (customer) {
          setFormData({
            code: customer.code,
            nameAr: customer.nameAr,
            nameEn: customer.nameEn || '',
            phone: customer.phone || '',
            email: customer.email || '',
            address: customer.address || '',
            creditLimit: String(customer.creditLimit),
            paymentTerms: String(customer.paymentTerms),
            isActive: customer.isActive,
          })
        }
      }
    } catch {
      toast.error('فشل في تحميل بيانات العميل')
    } finally {
      setLoading(false)
    }
  }

  const handleGoBack = () => {
    setModule('sales')
    setView('customers')
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
        creditLimit: parseFloat(formData.creditLimit) || 0,
        paymentTerms: parseInt(formData.paymentTerms) || 30,
        isActive: formData.isActive,
        companyId,
      }

      const url = '/api/sales/customers'
      const method = editingDocId && editingDocId !== 'new' ? 'PUT' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (res.ok) {
        toast.success(editingDocId && editingDocId !== 'new' ? 'تم تحديث العميل بنجاح' : 'تم إضافة العميل بنجاح')
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
              <Users className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                {editingDocId && editingDocId !== 'new' ? 'تعديل عميل' : 'إضافة عميل جديد'}
              </h2>
              <p className="text-xs text-slate-400">
                {editingDocId && editingDocId !== 'new' ? 'تعديل بيانات العميل' : 'أدخل بيانات العميل الجديد'}
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
          <CardTitle className="text-base">بيانات العميل</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="customer-code">الكود</Label>
              <Input
                id="customer-code"
                value={formData.code}
                onChange={(e) => setFormData((p) => ({ ...p, code: e.target.value }))}
                placeholder="تلقائي C-0001"
                dir="ltr"
                className="text-left"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="customer-nameAr">
                الاسم بالعربية <span className="text-red-500">*</span>
              </Label>
              <Input
                id="customer-nameAr"
                value={formData.nameAr}
                onChange={(e) => setFormData((p) => ({ ...p, nameAr: e.target.value }))}
                placeholder="اسم العميل بالعربية"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="customer-nameEn">الاسم بالإنجليزية</Label>
              <Input
                id="customer-nameEn"
                value={formData.nameEn}
                onChange={(e) => setFormData((p) => ({ ...p, nameEn: e.target.value }))}
                placeholder="Customer Name"
                dir="ltr"
                className="text-left"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="customer-phone">الهاتف</Label>
              <Input
                id="customer-phone"
                value={formData.phone}
                onChange={(e) => setFormData((p) => ({ ...p, phone: e.target.value }))}
                placeholder="05XXXXXXXX"
                dir="ltr"
                className="text-left"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="customer-email">البريد الإلكتروني</Label>
              <Input
                id="customer-email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData((p) => ({ ...p, email: e.target.value }))}
                placeholder="email@example.com"
                dir="ltr"
                className="text-left"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="customer-creditLimit">حد الائتمان</Label>
              <Input
                id="customer-creditLimit"
                type="number"
                min="0"
                step="0.01"
                value={formData.creditLimit}
                onChange={(e) => setFormData((p) => ({ ...p, creditLimit: e.target.value }))}
                dir="ltr"
                className="text-left"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="customer-paymentTerms">شروط الدفع (أيام)</Label>
              <Input
                id="customer-paymentTerms"
                type="number"
                min="0"
                value={formData.paymentTerms}
                onChange={(e) => setFormData((p) => ({ ...p, paymentTerms: e.target.value }))}
                dir="ltr"
                className="text-left"
              />
            </div>
            <div className="space-y-2 sm:col-span-2 lg:col-span-3">
              <Label htmlFor="customer-address">العنوان</Label>
              <Textarea
                id="customer-address"
                value={formData.address}
                onChange={(e) => setFormData((p) => ({ ...p, address: e.target.value }))}
                placeholder="عنوان العميل..."
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
