'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAppStore } from '@/lib/store'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Building2, Plus, Check, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

interface CompanySwitcherProps {
  onOpenSetup: () => void
}

export default function CompanySwitcher({ onOpenSetup }: CompanySwitcherProps) {
  const { user, currentCompanyId, companies, setCurrentCompany, setCompanies } =
    useAppStore()
  const [loading, setLoading] = useState(false)

  const currentCompany = companies.find((c) => c.id === currentCompanyId)

  // Fetch user's companies from the auth endpoint
  const fetchCompanies = useCallback(async () => {
    if (!user?.id) return
    setLoading(true)
    try {
      const res = await fetch('/api/auth/companies')
      if (res.ok) {
        const data = await res.json()
        const companyList: { id: string; nameAr: string; nameEn?: string; logo?: string | null; vatRate?: number; role?: string }[] = data
        setCompanies(companyList)
        // Set first company as current if none selected
        if (!currentCompanyId && companyList.length > 0) {
          setCurrentCompany(companyList[0].id)
        }
      }
    } catch (err) {
      console.error('Failed to fetch companies:', err)
    } finally {
      setLoading(false)
    }
  }, [user?.id, currentCompanyId, setCompanies, setCurrentCompany])

  useEffect(() => {
    if (companies.length === 0 && user?.id) {
      fetchCompanies()
    }
  }, [user?.id])

  const handleSwitch = (companyId: string) => {
    setCurrentCompany(companyId)
  }

  return (
    <DropdownMenu dir="rtl">
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="gap-2 px-3 h-9 hover:bg-emerald-50 transition-colors"
        >
          <Building2 className="h-4 w-4 text-emerald-600" />
          <span className="text-sm font-medium text-slate-700 max-w-[120px] truncate">
            {currentCompany?.nameAr || 'اختر شركة'}
          </span>
          <ChevronDown className="h-3 w-3 text-slate-400" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        className="w-64 p-2"
      >
        <DropdownMenuLabel className="text-xs text-slate-400 px-2 py-1.5">
          الشركات المتاحة
        </DropdownMenuLabel>

        {companies.length === 0 && !loading && (
          <div className="px-2 py-4 text-center text-sm text-slate-400">
            لا توجد شركات
          </div>
        )}

        {companies.map((company) => (
          <DropdownMenuItem
            key={company.id}
            onClick={() => handleSwitch(company.id)}
            className={cn(
              'flex items-center gap-3 px-2 py-2.5 rounded-lg cursor-pointer',
              company.id === currentCompanyId &&
                'bg-emerald-50'
            )}
          >
            <div
              className={cn(
                'h-8 w-8 rounded-lg flex items-center justify-center shrink-0',
                company.id === currentCompanyId
                  ? 'bg-emerald-500'
                  : 'bg-slate-100'
              )}
            >
              <Building2
                className={cn(
                  'h-4 w-4',
                  company.id === currentCompanyId
                    ? 'text-white'
                    : 'text-slate-500'
                )}
              />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-900 truncate">
                {company.nameAr}
              </p>
              <p className="text-xs text-slate-400 truncate" dir="ltr">
                {company.nameEn}
              </p>
            </div>
            {company.id === currentCompanyId && (
              <Check className="h-4 w-4 text-emerald-600 shrink-0" />
            )}
          </DropdownMenuItem>
        ))}

        <DropdownMenuSeparator className="my-1" />

        <DropdownMenuItem
          onClick={onOpenSetup}
          className="flex items-center gap-3 px-2 py-2.5 rounded-lg cursor-pointer text-emerald-700 hover:text-emerald-800 hover:bg-emerald-50"
        >
          <div className="h-8 w-8 rounded-lg bg-emerald-100 flex items-center justify-center shrink-0">
            <Plus className="h-4 w-4 text-emerald-600" />
          </div>
          <span className="text-sm font-medium">إنشاء شركة جديدة</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
