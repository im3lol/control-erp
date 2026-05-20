'use client'

import { useState } from 'react'
import { useAppStore } from '@/lib/store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import {
  Building2,
  GitBranch,
  Warehouse,
  Landmark,
  Ruler,
  Receipt,
  CheckCircle2,
  ArrowLeft,
  ArrowRight,
  Plus,
  Trash2,
  Package,
  Factory,
  Briefcase,
  Check,
  Loader2,
  AlertCircle,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

// ─── Types ────────────────────────────────────────────────────────────────────

interface CompanyForm {
  nameAr: string
  nameEn: string
  legalName: string
  taxNumber: string
  address: string
  phone: string
  email: string
  vatRate: number
  fiscalYearStart: string
}

interface WarehouseItem {
  nameAr: string
  location: string
  manager: string
}

interface BankItem {
  name: string
  accountNo: string
  branch: string
}

interface CashBoxItem {
  name: string
}

interface UOMItem {
  code: string
  nameAr: string
  nameEn: string
  isDefault: boolean
}

type TemplateType = 'trading' | 'manufacturing' | 'services'

const STEPS = [
  { id: 1, label: 'بيانات الشركة', icon: Building2 },
  { id: 2, label: 'شجرة الحسابات', icon: GitBranch },
  { id: 3, label: 'المخازن', icon: Warehouse },
  { id: 4, label: 'البنوك والصندوق', icon: Landmark },
  { id: 5, label: 'وحدات القياس', icon: Ruler },
  { id: 6, label: 'إعدادات الضرائب', icon: Receipt },
  { id: 7, label: 'مراجعة وتأكيد', icon: CheckCircle2 },
]

// ─── Template preview data ────────────────────────────────────────────────────

const templateData: Record<TemplateType, {
  label: string
  description: string
  icon: ElementType
  accounts: string[]
}> = {
  trading: {
    label: 'تجارة',
    description: 'شركات التجارة والتوزيع - تشمل حسابات المخزون وتكلفة البضاعة المباعة',
    icon: Package,
    accounts: [
      'الأصول المتداولة + المخزون',
      'تكلفة البضاعة المباعة',
      'إيراد تسوية المخزون',
      'مصروف تسوية المخزون',
    ],
  },
  manufacturing: {
    label: 'تصنيع',
    description: 'شركات التصنيع والإنتاج - تشمل المواد الخام وتحت التشغيل وتكلفة الإنتاج',
    icon: Factory,
    accounts: [
      'المواد الخام',
      'تحت التشغيل',
      'البضاعة التامة',
      'مستلزمات التصنيع',
      'تكلفة الإنتاج (مواد + أجور مباشرة + مصاريف)',
      'تكلفة البضاعة المباعة',
    ],
  },
  services: {
    label: 'خدمات',
    description: 'شركات الخدمات - بدون حسابات مخزون، تشمل تكلفة الخدمات',
    icon: Briefcase,
    accounts: [
      'إيرادات الخدمات',
      'تكلفة الخدمات',
      'لا توجد حسابات مخزون',
    ],
  },
}

type ElementType = React.ElementType

// ─── Component ────────────────────────────────────────────────────────────────

interface SetupWizardProps {
  open: boolean
  onClose: () => void
}

export default function SetupWizard({ open, onClose }: SetupWizardProps) {
  const [currentStep, setCurrentStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const addCompany = useAppStore((s) => s.addCompany)

  // Form state
  const [company, setCompany] = useState<CompanyForm>({
    nameAr: '',
    nameEn: '',
    legalName: '',
    taxNumber: '',
    address: '',
    phone: '',
    email: '',
    vatRate: 14,
    fiscalYearStart: '01-01',
  })
  const [template, setTemplate] = useState<TemplateType>('trading')
  const [warehouses, setWarehouses] = useState<WarehouseItem[]>([])
  const [banks, setBanks] = useState<BankItem[]>([])
  const [cashBoxes, setCashBoxes] = useState<CashBoxItem[]>([])
  const [uoms, setUoms] = useState<UOMItem[]>([
    { code: 'PCS', nameAr: 'قطعة', nameEn: 'Piece', isDefault: true },
    { code: 'KG', nameAr: 'كيلو', nameEn: 'Kilogram', isDefault: true },
    { code: 'LTR', nameAr: 'لتر', nameEn: 'Liter', isDefault: true },
    { code: 'BOX', nameAr: 'صندوق', nameEn: 'Box', isDefault: true },
    { code: 'MTR', nameAr: 'متر', nameEn: 'Meter', isDefault: true },
  ])

  // ── Step validation ──
  const canProceed = (): boolean => {
    switch (currentStep) {
      case 1:
        return !!company.nameAr.trim()
      case 2:
        return !!template
      case 3:
        return true // warehouses are optional (main warehouse is auto-created)
      case 4:
        return true // banks and cash boxes are optional
      case 5:
        return uoms.length > 0
      case 6:
        return company.vatRate >= 0
      case 7:
        return true
      default:
        return false
    }
  }

  // ── Navigation ──
  const handleNext = () => {
    if (currentStep < 7) setCurrentStep(currentStep + 1)
  }

  const handleBack = () => {
    if (currentStep > 1) setCurrentStep(currentStep - 1)
  }

  // ── Submit ──
  const handleSubmit = async () => {
    setLoading(true)
    try {
      const payload = {
        company: {
          nameAr: company.nameAr,
          nameEn: company.nameEn || company.nameAr,
          legalName: company.legalName || undefined,
          taxNumber: company.taxNumber || undefined,
          address: company.address || undefined,
          phone: company.phone || undefined,
          email: company.email || undefined,
          vatRate: company.vatRate,
          fiscalYearStart: company.fiscalYearStart || undefined,
        },
        template,
        warehouses: warehouses.filter((w) => w.nameAr.trim()),
        banks: banks.filter((b) => b.name.trim()),
        cashBoxes: cashBoxes.filter((c) => c.name.trim()),
        userId: 'admin', // TODO: use actual user id from auth
      }

      const res = await fetch('/api/companies/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'فشل في إنشاء الشركة')
      }

      const result = await res.json()

      // Add company to store and set as current
      addCompany({
        id: result.id,
        nameAr: result.nameAr,
        nameEn: result.nameEn,
        logo: result.logo,
        vatRate: result.vatRate,
      })

      toast.success('تم إنشاء الشركة بنجاح', {
        description: `تم إنشاء "${result.nameAr}" وإعداد جميع البيانات الافتراضية`,
      })

      // Reset and close
      handleReset()
      onClose()
    } catch (err) {
      toast.error('خطأ في إنشاء الشركة', {
        description: err instanceof Error ? err.message : 'حدث خطأ غير متوقع',
      })
    } finally {
      setLoading(false)
    }
  }

  const handleReset = () => {
    setCurrentStep(1)
    setCompany({
      nameAr: '',
      nameEn: '',
      legalName: '',
      taxNumber: '',
      address: '',
      phone: '',
      email: '',
      vatRate: 14,
      fiscalYearStart: '01-01',
    })
    setTemplate('trading')
    setWarehouses([])
    setBanks([])
    setCashBoxes([])
    setUoms([
      { code: 'PCS', nameAr: 'قطعة', nameEn: 'Piece', isDefault: true },
      { code: 'KG', nameAr: 'كيلو', nameEn: 'Kilogram', isDefault: true },
      { code: 'LTR', nameAr: 'لتر', nameEn: 'Liter', isDefault: true },
      { code: 'BOX', nameAr: 'صندوق', nameEn: 'Box', isDefault: true },
      { code: 'MTR', nameAr: 'متر', nameEn: 'Meter', isDefault: true },
    ])
  }

  // ── Render step content ──
  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return renderCompanyInfo()
      case 2:
        return renderTemplateSelection()
      case 3:
        return renderWarehouses()
      case 4:
        return renderBanksAndCash()
      case 5:
        return renderUOMs()
      case 6:
        return renderTaxSettings()
      case 7:
        return renderReview()
      default:
        return null
    }
  }

  // ── Step 1: Company Info ──
  const renderCompanyInfo = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-slate-900 mb-1">بيانات الشركة</h3>
        <p className="text-sm text-slate-500">أدخل المعلومات الأساسية للشركة</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="nameAr" className="text-sm font-medium">
            اسم الشركة بالعربية <span className="text-red-500">*</span>
          </Label>
          <Input
            id="nameAr"
            value={company.nameAr}
            onChange={(e) => setCompany({ ...company, nameAr: e.target.value })}
            placeholder="مثال: شركة الأمل للتجارة"
            className="text-right"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="nameEn" className="text-sm font-medium">
            اسم الشركة بالإنجليزية
          </Label>
          <Input
            id="nameEn"
            value={company.nameEn}
            onChange={(e) => setCompany({ ...company, nameEn: e.target.value })}
            placeholder="e.g. Al-Amal Trading Co."
            dir="ltr"
            className="text-left"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="legalName" className="text-sm font-medium">
            الاسم القانوني
          </Label>
          <Input
            id="legalName"
            value={company.legalName}
            onChange={(e) => setCompany({ ...company, legalName: e.target.value })}
            placeholder="الاسم المسجل رسمياً"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="taxNumber" className="text-sm font-medium">
            الرقم الضريبي
          </Label>
          <Input
            id="taxNumber"
            value={company.taxNumber}
            onChange={(e) => setCompany({ ...company, taxNumber: e.target.value })}
            placeholder="الرقم الضريبي للشركة"
            dir="ltr"
            className="text-left"
          />
        </div>

        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="address" className="text-sm font-medium">
            العنوان
          </Label>
          <Input
            id="address"
            value={company.address}
            onChange={(e) => setCompany({ ...company, address: e.target.value })}
            placeholder="عنوان الشركة"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="phone" className="text-sm font-medium">
            رقم الهاتف
          </Label>
          <Input
            id="phone"
            value={company.phone}
            onChange={(e) => setCompany({ ...company, phone: e.target.value })}
            placeholder="01XXXXXXXXX"
            dir="ltr"
            className="text-left"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="email" className="text-sm font-medium">
            البريد الإلكتروني
          </Label>
          <Input
            id="email"
            type="email"
            value={company.email}
            onChange={(e) => setCompany({ ...company, email: e.target.value })}
            placeholder="info@company.com"
            dir="ltr"
            className="text-left"
          />
        </div>
      </div>
    </div>
  )

  // ── Step 2: Template Selection ──
  const renderTemplateSelection = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-slate-900 mb-1">شجرة الحسابات</h3>
        <p className="text-sm text-slate-500">اختر نوع النشاط لإنشاء شجرة الحسابات المناسبة</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {(Object.entries(templateData) as [TemplateType, typeof templateData.trading][]).map(
          ([key, data]) => {
            const isSelected = template === key
            return (
              <Card
                key={key}
                className={cn(
                  'cursor-pointer transition-all duration-200 hover:shadow-md',
                  isSelected
                    ? 'border-emerald-500 bg-emerald-50/50 ring-2 ring-emerald-500/20'
                    : 'border-slate-200 hover:border-emerald-300'
                )}
                onClick={() => setTemplate(key)}
              >
                <CardContent className="p-5">
                  <div className="flex items-start gap-3 mb-3">
                    <div
                      className={cn(
                        'p-2.5 rounded-xl',
                        isSelected ? 'bg-emerald-500' : 'bg-slate-100'
                      )}
                    >
                      <data.icon
                        className={cn(
                          'h-5 w-5',
                          isSelected ? 'text-white' : 'text-slate-500'
                        )}
                      />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h4 className="font-semibold text-slate-900">{data.label}</h4>
                        {isSelected && (
                          <Check className="h-4 w-4 text-emerald-600" />
                        )}
                      </div>
                    </div>
                  </div>
                  <p className="text-sm text-slate-500 mb-3">{data.description}</p>
                  <div className="space-y-1.5">
                    {data.accounts.map((acc, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs">
                        <div
                          className={cn(
                            'h-1.5 w-1.5 rounded-full',
                            isSelected ? 'bg-emerald-500' : 'bg-slate-300'
                          )}
                        />
                        <span className="text-slate-600">{acc}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )
          }
        )}
      </div>

      {/* Common accounts preview */}
      <Card className="border-slate-200">
        <CardContent className="p-4">
          <h4 className="text-sm font-semibold text-slate-700 mb-2">حسابات مشتركة لجميع الأنواع:</h4>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {[
              'النقدية والبنوك',
              'العملاء والموردين',
              'رأس المال',
              'الأرباح المحتجزة',
              'مصروفات تشغيل (إيجار، مرتبات، مرافق)',
              'خصم مسموح / مكتسب',
            ].map((acc, i) => (
              <div key={i} className="flex items-center gap-2 text-xs text-slate-500">
                <div className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                <span>{acc}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )

  // ── Step 3: Warehouses ──
  const renderWarehouses = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-slate-900 mb-1">المخازن</h3>
        <p className="text-sm text-slate-500">
          أضف المخازن الإضافية. يتم إنشاء المخزن الرئيسي تلقائياً.
        </p>
      </div>

      {/* Default warehouse indicator */}
      <div className="flex items-center gap-3 p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
        <Warehouse className="h-5 w-5 text-emerald-600" />
        <div>
          <p className="text-sm font-medium text-emerald-800">المخزن الرئيسي</p>
          <p className="text-xs text-emerald-600">سيتم إنشاؤه تلقائياً</p>
        </div>
        <Badge className="bg-emerald-100 text-emerald-700 me-auto">تلقائي</Badge>
      </div>

      {/* Additional warehouses */}
      <div className="space-y-3">
        {warehouses.map((wh, idx) => (
          <div
            key={idx}
            className="flex items-start gap-3 p-3 border border-slate-200 rounded-lg bg-white"
          >
            <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs text-slate-500">اسم المخزن</Label>
                <Input
                  value={wh.nameAr}
                  onChange={(e) => {
                    const updated = [...warehouses]
                    updated[idx] = { ...updated[idx], nameAr: e.target.value }
                    setWarehouses(updated)
                  }}
                  placeholder="اسم المخزن"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-slate-500">الموقع</Label>
                <Input
                  value={wh.location}
                  onChange={(e) => {
                    const updated = [...warehouses]
                    updated[idx] = { ...updated[idx], location: e.target.value }
                    setWarehouses(updated)
                  }}
                  placeholder="موقع المخزن"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-slate-500">المسؤول</Label>
                <Input
                  value={wh.manager}
                  onChange={(e) => {
                    const updated = [...warehouses]
                    updated[idx] = { ...updated[idx], manager: e.target.value }
                    setWarehouses(updated)
                  }}
                  placeholder="اسم المسؤول"
                />
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="shrink-0 text-red-400 hover:text-red-600 hover:bg-red-50 mt-5"
              onClick={() => setWarehouses(warehouses.filter((_, i) => i !== idx))}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>

      <Button
        variant="outline"
        onClick={() =>
          setWarehouses([...warehouses, { nameAr: '', location: '', manager: '' }])
        }
        className="gap-2 border-dashed"
      >
        <Plus className="h-4 w-4" />
        إضافة مخزن
      </Button>
    </div>
  )

  // ── Step 4: Banks and Cash ──
  const renderBanksAndCash = () => (
    <div className="space-y-8">
      {/* Banks */}
      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold text-slate-900 mb-1">الحسابات البنكية</h3>
          <p className="text-sm text-slate-500">
            أضف حسابات البنك. سيتم إنشاء حساب لكل بنك تحت &quot;البنوك&quot;.
          </p>
        </div>

        <div className="space-y-3">
          {banks.map((bank, idx) => (
            <div
              key={idx}
              className="flex items-start gap-3 p-3 border border-slate-200 rounded-lg bg-white"
            >
              <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs text-slate-500">اسم البنك</Label>
                  <Input
                    value={bank.name}
                    onChange={(e) => {
                      const updated = [...banks]
                      updated[idx] = { ...updated[idx], name: e.target.value }
                      setBanks(updated)
                    }}
                    placeholder="مثال: البنك الأهلي"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-slate-500">رقم الحساب</Label>
                  <Input
                    value={bank.accountNo}
                    onChange={(e) => {
                      const updated = [...banks]
                      updated[idx] = { ...updated[idx], accountNo: e.target.value }
                      setBanks(updated)
                    }}
                    placeholder="رقم الحساب البنكي"
                    dir="ltr"
                    className="text-left"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-slate-500">الفرع</Label>
                  <Input
                    value={bank.branch}
                    onChange={(e) => {
                      const updated = [...banks]
                      updated[idx] = { ...updated[idx], branch: e.target.value }
                      setBanks(updated)
                    }}
                    placeholder="اسم الفرع"
                  />
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="shrink-0 text-red-400 hover:text-red-600 hover:bg-red-50 mt-5"
                onClick={() => setBanks(banks.filter((_, i) => i !== idx))}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>

        <Button
          variant="outline"
          onClick={() =>
            setBanks([...banks, { name: '', accountNo: '', branch: '' }])
          }
          className="gap-2 border-dashed"
        >
          <Plus className="h-4 w-4" />
          إضافة بنك
        </Button>
      </div>

      <Separator />

      {/* Cash boxes */}
      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold text-slate-900 mb-1">الصناديق النقدية</h3>
          <p className="text-sm text-slate-500">
            أضف صناديق النقدية. سيتم إنشاء حساب لكل صندوق تحت &quot;النقدية&quot;.
          </p>
        </div>

        <div className="space-y-3">
          {cashBoxes.map((box, idx) => (
            <div
              key={idx}
              className="flex items-center gap-3 p-3 border border-slate-200 rounded-lg bg-white"
            >
              <div className="flex-1 space-y-1">
                <Label className="text-xs text-slate-500">اسم الصندوق</Label>
                <Input
                  value={box.name}
                  onChange={(e) => {
                    const updated = [...cashBoxes]
                    updated[idx] = { ...updated[idx], name: e.target.value }
                    setCashBoxes(updated)
                  }}
                  placeholder="مثال: الصندوق الرئيسي"
                />
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="shrink-0 text-red-400 hover:text-red-600 hover:bg-red-50 mt-5"
                onClick={() => setCashBoxes(cashBoxes.filter((_, i) => i !== idx))}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>

        <Button
          variant="outline"
          onClick={() => setCashBoxes([...cashBoxes, { name: '' }])}
          className="gap-2 border-dashed"
        >
          <Plus className="h-4 w-4" />
          إضافة صندوق
        </Button>
      </div>
    </div>
  )

  // ── Step 5: UOMs ──
  const renderUOMs = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-slate-900 mb-1">وحدات القياس</h3>
        <p className="text-sm text-slate-500">
          وحدات القياس الافتراضية. يمكنك إضافة وحدات مخصصة أو تعديل الموجودة.
        </p>
      </div>

      <div className="space-y-3">
        {uoms.map((uom, idx) => (
          <div
            key={idx}
            className="flex items-center gap-3 p-3 border border-slate-200 rounded-lg bg-white"
          >
            <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs text-slate-500">الكود</Label>
                <Input
                  value={uom.code}
                  onChange={(e) => {
                    const updated = [...uoms]
                    updated[idx] = { ...updated[idx], code: e.target.value }
                    setUoms(updated)
                  }}
                  placeholder="PCS"
                  dir="ltr"
                  className="text-left"
                  disabled={uom.isDefault}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-slate-500">الاسم بالعربية</Label>
                <Input
                  value={uom.nameAr}
                  onChange={(e) => {
                    const updated = [...uoms]
                    updated[idx] = { ...updated[idx], nameAr: e.target.value }
                    setUoms(updated)
                  }}
                  placeholder="قطعة"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-slate-500">الاسم بالإنجليزية</Label>
                <Input
                  value={uom.nameEn}
                  onChange={(e) => {
                    const updated = [...uoms]
                    updated[idx] = { ...updated[idx], nameEn: e.target.value }
                    setUoms(updated)
                  }}
                  placeholder="Piece"
                  dir="ltr"
                  className="text-left"
                />
              </div>
            </div>
            {!uom.isDefault && (
              <Button
                variant="ghost"
                size="icon"
                className="shrink-0 text-red-400 hover:text-red-600 hover:bg-red-50 mt-5"
                onClick={() => setUoms(uoms.filter((_, i) => i !== idx))}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
            {uom.isDefault && <div className="w-9 mt-5" />}
          </div>
        ))}
      </div>

      <Button
        variant="outline"
        onClick={() =>
          setUoms([...uoms, { code: '', nameAr: '', nameEn: '', isDefault: false }])
        }
        className="gap-2 border-dashed"
      >
        <Plus className="h-4 w-4" />
        إضافة وحدة قياس
      </Button>
    </div>
  )

  // ── Step 6: Tax Settings ──
  const renderTaxSettings = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-slate-900 mb-1">إعدادات الضرائب</h3>
        <p className="text-sm text-slate-500">إعدادات ضريبة القيمة المضافة والضرائب الأخرى</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="vatRate" className="text-sm font-medium">
            نسبة ضريبة القيمة المضافة (%)
          </Label>
          <Input
            id="vatRate"
            type="number"
            min="0"
            max="100"
            step="0.1"
            value={company.vatRate}
            onChange={(e) =>
              setCompany({ ...company, vatRate: parseFloat(e.target.value) || 0 })
            }
            dir="ltr"
            className="text-left"
          />
          <p className="text-xs text-slate-400">
            النسبة الافتراضية في مصر: 14%
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="taxNumber2" className="text-sm font-medium">
            الرقم الضريبي
          </Label>
          <Input
            id="taxNumber2"
            value={company.taxNumber}
            onChange={(e) => setCompany({ ...company, taxNumber: e.target.value })}
            placeholder="الرقم الضريبي للشركة"
            dir="ltr"
            className="text-left"
          />
        </div>
      </div>

      <Card className="border-amber-200 bg-amber-50/50">
        <CardContent className="p-4 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-amber-500 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-medium text-amber-800">ملاحظة هامة</p>
            <p className="text-xs text-amber-700 mt-1">
              سيتم إنشاء حساب &quot;الضريبة المستحقة&quot; تلقائياً في شجرة الحسابات.
              يمكنك تعديل نسبة الضريبة لاحقاً من إعدادات الشركة.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )

  // ── Step 7: Review ──
  const renderReview = () => {
    const validWarehouses = warehouses.filter((w) => w.nameAr.trim())
    const validBanks = banks.filter((b) => b.name.trim())
    const validCashBoxes = cashBoxes.filter((c) => c.name.trim())

    return (
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-semibold text-slate-900 mb-1">مراجعة وتأكيد</h3>
          <p className="text-sm text-slate-500">راجع جميع الإعدادات قبل إنشاء الشركة</p>
        </div>

        <div className="space-y-4">
          {/* Company Info Summary */}
          <Card className="border-slate-200">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <Building2 className="h-4 w-4 text-emerald-600" />
                <h4 className="font-semibold text-slate-900">بيانات الشركة</h4>
              </div>
              <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                <div>
                  <span className="text-slate-500">الاسم بالعربية:</span>{' '}
                  <span className="font-medium text-slate-900">{company.nameAr}</span>
                </div>
                {company.nameEn && (
                  <div>
                    <span className="text-slate-500">الاسم بالإنجليزية:</span>{' '}
                    <span className="font-medium text-slate-900">{company.nameEn}</span>
                  </div>
                )}
                {company.legalName && (
                  <div>
                    <span className="text-slate-500">الاسم القانوني:</span>{' '}
                    <span className="font-medium text-slate-900">{company.legalName}</span>
                  </div>
                )}
                {company.taxNumber && (
                  <div>
                    <span className="text-slate-500">الرقم الضريبي:</span>{' '}
                    <span className="font-medium text-slate-900" dir="ltr">{company.taxNumber}</span>
                  </div>
                )}
                {company.address && (
                  <div className="col-span-2">
                    <span className="text-slate-500">العنوان:</span>{' '}
                    <span className="font-medium text-slate-900">{company.address}</span>
                  </div>
                )}
                {company.phone && (
                  <div>
                    <span className="text-slate-500">الهاتف:</span>{' '}
                    <span className="font-medium text-slate-900" dir="ltr">{company.phone}</span>
                  </div>
                )}
                {company.email && (
                  <div>
                    <span className="text-slate-500">البريد:</span>{' '}
                    <span className="font-medium text-slate-900" dir="ltr">{company.email}</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Template Summary */}
          <Card className="border-slate-200">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <GitBranch className="h-4 w-4 text-emerald-600" />
                <h4 className="font-semibold text-slate-900">شجرة الحسابات</h4>
              </div>
              <div className="flex items-center gap-2">
                <Badge className="bg-emerald-100 text-emerald-700">
                  {templateData[template].label}
                </Badge>
                <span className="text-sm text-slate-600">
                  {templateData[template].description}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Warehouses Summary */}
          <Card className="border-slate-200">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <Warehouse className="h-4 w-4 text-emerald-600" />
                <h4 className="font-semibold text-slate-900">المخازن</h4>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge className="bg-emerald-100 text-emerald-700">المخزن الرئيسي (تلقائي)</Badge>
                {validWarehouses.map((wh, i) => (
                  <Badge key={i} variant="outline" className="border-slate-300">
                    {wh.nameAr}
                  </Badge>
                ))}
                {validWarehouses.length === 0 && (
                  <span className="text-sm text-slate-400">لا توجد مخازن إضافية</span>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Banks and Cash Summary */}
          <Card className="border-slate-200">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <Landmark className="h-4 w-4 text-emerald-600" />
                <h4 className="font-semibold text-slate-900">البنوك والصناديق</h4>
              </div>
              <div className="space-y-2">
                <div>
                  <span className="text-xs text-slate-500">البنوك:</span>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {validBanks.length > 0 ? (
                      validBanks.map((b, i) => (
                        <Badge key={i} variant="outline" className="border-slate-300">
                          {b.name}
                        </Badge>
                      ))
                    ) : (
                      <span className="text-sm text-slate-400">لا توجد بنوك</span>
                    )}
                  </div>
                </div>
                <div>
                  <span className="text-xs text-slate-500">الصناديق النقدية:</span>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {validCashBoxes.length > 0 ? (
                      validCashBoxes.map((c, i) => (
                        <Badge key={i} variant="outline" className="border-slate-300">
                          {c.name}
                        </Badge>
                      ))
                    ) : (
                      <span className="text-sm text-slate-400">لا توجد صناديق نقدية</span>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* UOMs Summary */}
          <Card className="border-slate-200">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <Ruler className="h-4 w-4 text-emerald-600" />
                <h4 className="font-semibold text-slate-900">وحدات القياس</h4>
              </div>
              <div className="flex flex-wrap gap-2">
                {uoms.map((u, i) => (
                  <Badge key={i} variant="outline" className="border-slate-300">
                    {u.nameAr} ({u.code})
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Tax Summary */}
          <Card className="border-slate-200">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <Receipt className="h-4 w-4 text-emerald-600" />
                <h4 className="font-semibold text-slate-900">الضرائب</h4>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-slate-500">ضريبة القيمة المضافة:</span>{' '}
                  <span className="font-medium text-slate-900">{company.vatRate}%</span>
                </div>
                {company.taxNumber && (
                  <div>
                    <span className="text-slate-500">الرقم الضريبي:</span>{' '}
                    <span className="font-medium text-slate-900" dir="ltr">{company.taxNumber}</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  // ── Main render ──
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 bg-white flex flex-col" dir="rtl">
      {/* ── Header with progress indicator ── */}
      <div className="border-b bg-white shrink-0">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 bg-emerald-600 rounded-xl flex items-center justify-center">
                <Building2 className="h-5 w-5 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900">إنشاء شركة جديدة</h2>
                <p className="text-sm text-slate-500">
                  الخطوة {currentStep} من {STEPS.length}
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              onClick={() => {
                handleReset()
                onClose()
              }}
              className="text-slate-500"
            >
              إلغاء
            </Button>
          </div>

          {/* Step indicator */}
          <div className="flex items-center gap-1">
            {STEPS.map((step, idx) => {
              const isCompleted = currentStep > step.id
              const isCurrent = currentStep === step.id
              return (
                <div key={step.id} className="flex items-center flex-1">
                  <button
                    onClick={() => {
                      if (isCompleted) setCurrentStep(step.id)
                    }}
                    className={cn(
                      'flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors w-full',
                      isCompleted && 'cursor-pointer hover:bg-emerald-50',
                      isCurrent && 'bg-emerald-50',
                      !isCompleted && !isCurrent && 'cursor-default'
                    )}
                  >
                    <div
                      className={cn(
                        'h-7 w-7 rounded-full flex items-center justify-center shrink-0 text-xs font-bold transition-colors',
                        isCompleted
                          ? 'bg-emerald-500 text-white'
                          : isCurrent
                          ? 'bg-emerald-100 text-emerald-700 ring-2 ring-emerald-500'
                          : 'bg-slate-100 text-slate-400'
                      )}
                    >
                      {isCompleted ? (
                        <Check className="h-4 w-4" />
                      ) : (
                        step.id
                      )}
                    </div>
                    <span
                      className={cn(
                        'hidden sm:inline text-xs font-medium truncate',
                        isCompleted
                          ? 'text-emerald-700'
                          : isCurrent
                          ? 'text-emerald-700'
                          : 'text-slate-400'
                      )}
                    >
                      {step.label}
                    </span>
                  </button>
                  {idx < STEPS.length - 1 && (
                    <div
                      className={cn(
                        'h-0.5 flex-1 min-w-[16px] rounded-full mx-1',
                        isCompleted ? 'bg-emerald-500' : 'bg-slate-200'
                      )}
                    />
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* ── Content ── */}
      <ScrollArea className="flex-1">
        <div className="max-w-4xl mx-auto px-4 py-6">
          {renderStepContent()}
        </div>
      </ScrollArea>

      {/* ── Footer with navigation buttons ── */}
      <div className="border-t bg-white shrink-0">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <Button
            variant="outline"
            onClick={handleBack}
            disabled={currentStep === 1}
            className="gap-2"
          >
            <ArrowRight className="h-4 w-4" />
            السابق
          </Button>

          {currentStep < 7 ? (
            <Button
              onClick={handleNext}
              disabled={!canProceed()}
              className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              التالي
              <ArrowLeft className="h-4 w-4" />
            </Button>
          ) : (
            <Button
              onClick={handleSubmit}
              disabled={loading || !canProceed()}
              className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white min-w-[160px]"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  جاري الإنشاء...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  إنشاء الشركة
                </>
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
