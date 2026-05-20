'use client'

import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { Building2, Save, Loader2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useAppStore } from '@/lib/store'

interface CompanyData {
  nameAr: string
  nameEn: string
  address: string
  phone: string
  email: string
  taxNumber: string
  fiscalYearStart: string
}

const initialData: CompanyData = {
  nameAr: '',
  nameEn: '',
  address: '',
  phone: '',
  email: '',
  taxNumber: '',
  fiscalYearStart: '01-01',
}

export default function CompanyForm() {
  const companyId = useAppStore(state => state.currentCompanyId)
  const updateCompany = useAppStore(state => state.updateCompany)
  const [data, setData] = useState<CompanyData>(initialData)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!companyId) return
    const fetchCompany = async () => {
      try {
        const res = await fetch(`/api/settings/company?companyId=${companyId}`)
        if (res.ok) {
          const result = await res.json()
          if (result) {
            setData({
              nameAr: result.nameAr || '',
              nameEn: result.nameEn || '',
              address: result.address || '',
              phone: result.phone || '',
              email: result.email || '',
              taxNumber: result.taxNumber || '',
              fiscalYearStart: result.fiscalYearStart || '01-01',
            })
          }
        }
      } catch {
        toast.error('فشل في تحميل بيانات الشركة')
      } finally {
        setLoading(false)
      }
    }
    fetchCompany()
  }, [])

  const handleChange = (field: keyof CompanyData, value: string) => {
    setData((prev) => ({ ...prev, [field]: value }))
  }

  const handleSave = async () => {
    if (!data.nameAr.trim()) {
      toast.error('يرجى إدخال اسم الشركة بالعربية')
      return
    }
    setSaving(true)
    try {
      const res = await fetch(`/api/settings/company?companyId=${companyId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, companyId }),
      })
      if (res.ok) {
        const updated = await res.json()
        // Update store so header/switcher reflect the new name immediately
        updateCompany(companyId!, { nameAr: updated.nameAr, nameEn: updated.nameEn, vatRate: updated.vatRate })
        toast.success('تم حفظ بيانات الشركة بنجاح')
      } else {
        const err = await res.json()
        toast.error(err.error || 'فشل في حفظ البيانات')
      }
    } catch {
      toast.error('حدث خطأ أثناء حفظ البيانات')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <Card className="border shadow-sm">
        <CardHeader>
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-4 w-64" />
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-10 w-full" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border shadow-sm">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-emerald-50 flex items-center justify-center">
            <Building2 className="h-5 w-5 text-emerald-600" />
          </div>
          <div>
            <CardTitle className="text-lg">بيانات الشركة</CardTitle>
            <CardDescription>إعداد المعلومات الأساسية للشركة</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* اسم الشركة بالعربية */}
          <div className="space-y-2">
            <Label htmlFor="nameAr" className="text-sm font-medium">
              اسم الشركة بالعربية <span className="text-red-500">*</span>
            </Label>
            <Input
              id="nameAr"
              value={data.nameAr}
              onChange={(e) => handleChange('nameAr', e.target.value)}
              placeholder="أدخل اسم الشركة بالعربية"
              className="h-10"
            />
          </div>

          {/* اسم الشركة بالإنجليزية */}
          <div className="space-y-2">
            <Label htmlFor="nameEn" className="text-sm font-medium">
              اسم الشركة بالإنجليزية
            </Label>
            <Input
              id="nameEn"
              value={data.nameEn}
              onChange={(e) => handleChange('nameEn', e.target.value)}
              placeholder="Company Name in English"
              dir="ltr"
              className="h-10 text-left"
            />
          </div>

          {/* العنوان */}
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="address" className="text-sm font-medium">
              العنوان
            </Label>
            <Input
              id="address"
              value={data.address}
              onChange={(e) => handleChange('address', e.target.value)}
              placeholder="أدخل عنوان الشركة"
              className="h-10"
            />
          </div>

          {/* الهاتف */}
          <div className="space-y-2">
            <Label htmlFor="phone" className="text-sm font-medium">
              رقم الهاتف
            </Label>
            <Input
              id="phone"
              value={data.phone}
              onChange={(e) => handleChange('phone', e.target.value)}
              placeholder="أدخل رقم الهاتف"
              dir="ltr"
              className="h-10 text-left"
            />
          </div>

          {/* البريد الإلكتروني */}
          <div className="space-y-2">
            <Label htmlFor="email" className="text-sm font-medium">
              البريد الإلكتروني
            </Label>
            <Input
              id="email"
              type="email"
              value={data.email}
              onChange={(e) => handleChange('email', e.target.value)}
              placeholder="example@company.com"
              dir="ltr"
              className="h-10 text-left"
            />
          </div>

          {/* الرقم الضريبي */}
          <div className="space-y-2">
            <Label htmlFor="taxNumber" className="text-sm font-medium">
              الرقم الضريبي
            </Label>
            <Input
              id="taxNumber"
              value={data.taxNumber}
              onChange={(e) => handleChange('taxNumber', e.target.value)}
              placeholder="أدخل الرقم الضريبي"
              dir="ltr"
              className="h-10 text-left"
            />
          </div>

          {/* بداية السنة المالية */}
          <div className="space-y-2">
            <Label htmlFor="fiscalYearStart" className="text-sm font-medium">
              بداية السنة المالية
            </Label>
            <Input
              id="fiscalYearStart"
              value={data.fiscalYearStart}
              onChange={(e) => handleChange('fiscalYearStart', e.target.value)}
              placeholder="MM-DD"
              dir="ltr"
              className="h-10 text-left"
            />
            <p className="text-xs text-slate-400">الصيغة: شهر-يوم (مثال: 01-01)</p>
          </div>
        </div>

        {/* Save Button */}
        <div className="mt-8 flex justify-end">
          <Button
            onClick={handleSave}
            disabled={saving}
            className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2 px-8 h-10"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            {saving ? 'جاري الحفظ...' : 'حفظ البيانات'}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
