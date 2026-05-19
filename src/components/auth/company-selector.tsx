'use client'

import { useAppStore, type CompanyInfo } from '@/lib/store'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Building2, Plus, ArrowLeft } from 'lucide-react'
import { canManageCompany } from '@/lib/permissions'
import { roleLabels } from '@/lib/permissions'
import { signOut } from 'next-auth/react'

interface CompanySelectorProps {
  onSelect: (companyId: string) => void
}

export default function CompanySelector({ onSelect }: CompanySelectorProps) {
  const { user, companies } = useAppStore()

  const handleSelect = (companyId: string) => {
    onSelect(companyId)
  }

  return (
    <div className="min-h-screen bg-gradient-to-bl from-emerald-700 via-emerald-800 to-emerald-900 flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Background decorative elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-emerald-600/20 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-teal-500/15 rounded-full blur-3xl" />
        <div className="absolute top-1/3 right-1/4 w-64 h-64 bg-emerald-400/10 rounded-full blur-2xl" />
      </div>

      <div className="relative z-10 w-full max-w-2xl">
        {/* Header */}
        <div className="text-center mb-8">
          <Avatar className="h-16 w-16 mx-auto mb-4 border-2 border-white/20 shadow-lg">
            <AvatarFallback className="bg-emerald-600 text-white text-xl font-bold">
              {user?.name?.charAt(0) || 'م'}
            </AvatarFallback>
          </Avatar>
          <h2 className="text-2xl font-bold text-white">مرحباً، {user?.name || 'المستخدم'}</h2>
          <p className="text-emerald-200 mt-1">اختر الشركة للدخول إليها</p>
        </div>

        {/* Company Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {companies.map((company) => (
            <CompanyCard
              key={company.id}
              company={company}
              onSelect={handleSelect}
            />
          ))}

          {/* Add Company Card - only for super_admin */}
          {user && canManageCompany(user.role) && (
            <Card className="border-2 border-dashed border-white/20 bg-white/5 hover:bg-white/10 transition-all duration-200 cursor-pointer group backdrop-blur-sm">
              <CardContent className="p-6 flex flex-col items-center justify-center h-full min-h-[160px] gap-3">
                <div className="h-12 w-12 rounded-2xl bg-white/10 flex items-center justify-center group-hover:bg-white/20 transition-colors">
                  <Plus className="h-6 w-6 text-white/70 group-hover:text-white transition-colors" />
                </div>
                <span className="text-white/70 group-hover:text-white font-medium transition-colors">
                  إنشاء شركة جديدة
                </span>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Logout link */}
        <div className="text-center mt-8">
          <Button
            variant="ghost"
            className="text-emerald-200 hover:text-white hover:bg-white/10 gap-2"
            onClick={async () => {
              useAppStore.getState().logout()
              await signOut({ redirect: false })
            }}
          >
            <ArrowLeft className="h-4 w-4" />
            تسجيل خروج
          </Button>
        </div>
      </div>
    </div>
  )
}

function CompanyCard({
  company,
  onSelect,
}: {
  company: CompanyInfo
  onSelect: (id: string) => void
}) {
  return (
    <Card className="border-0 bg-white shadow-xl shadow-black/10 hover:shadow-2xl hover:shadow-black/15 transition-all duration-300 hover:-translate-y-0.5 cursor-pointer group overflow-hidden">
      <CardContent className="p-0">
        {/* Top accent bar */}
        <div className="h-1.5 bg-gradient-to-l from-emerald-500 to-teal-500" />
        <div className="p-5">
          <div className="flex items-start gap-4">
            {/* Company Icon */}
            <div className="h-12 w-12 rounded-xl bg-emerald-50 flex items-center justify-center shrink-0 group-hover:bg-emerald-100 transition-colors">
              <Building2 className="h-6 w-6 text-emerald-600" />
            </div>

            {/* Company Info */}
            <div className="flex-1 min-w-0">
              <h3 className="font-bold text-slate-900 text-base truncate">
                {company.nameAr}
              </h3>
              <p className="text-sm text-slate-500 truncate mt-0.5">
                {company.nameEn}
              </p>
              <div className="mt-2">
                <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-emerald-50 text-emerald-700">
                  {roleLabels[company.role] || company.role}
                </span>
              </div>
            </div>
          </div>

          {/* Enter Button */}
          <Button
            className="w-full mt-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg gap-2 shadow-sm"
            onClick={(e) => {
              e.stopPropagation()
              onSelect(company.id)
            }}
          >
            دخول
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
