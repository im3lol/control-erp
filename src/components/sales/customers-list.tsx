'use client'

import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { Plus, Trash2, Users, Search } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Progress } from '@/components/ui/progress'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
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

interface Customer {
  id: string
  code: string
  nameAr: string
  nameEn: string | null
  phone: string | null
  email: string | null
  address: string | null
  balance: number
  creditLimit: number
  paymentTerms: number
  isActive: boolean
}

export default function CustomersList() {
  const companyId = useAppStore(state => state.currentCompanyId)
  const setView = useAppStore(state => state.setView)
  const setEditingDocId = useAppStore(state => state.setEditingDocId)
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  useEffect(() => {
    if (!companyId) return
    fetchCustomers()
  }, [companyId])

  const fetchCustomers = async () => {
    try {
      const res = await fetch(`/api/sales/customers?companyId=${companyId}`)
      if (res.ok) {
        const data = await res.json()
        setCustomers(data)
      }
    } catch {
      toast.error('فشل في تحميل العملاء')
    } finally {
      setLoading(false)
    }
  }

  const filteredCustomers = customers.filter((c) => {
    if (!searchTerm) return true
    const term = searchTerm.toLowerCase()
    return (
      c.nameAr.includes(searchTerm) ||
      (c.nameEn && c.nameEn.toLowerCase().includes(term)) ||
      c.code.toLowerCase().includes(term) ||
      (c.phone && c.phone.includes(searchTerm))
    )
  })

  const handleOpenAdd = () => {
    setEditingDocId(null)
    setView('customer-form')
  }

  const handleOpenEdit = (id: string) => {
    setEditingDocId(id)
    setView('customer-form')
  }

  const handleOpenDelete = (id: string) => {
    setDeletingId(id)
    setDeleteDialogOpen(true)
  }

  const handleDelete = async () => {
    if (!deletingId) return
    try {
      const res = await fetch(`/api/sales/customers?companyId=${companyId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: deletingId, companyId }),
      })
      if (res.ok) {
        toast.success('تم حذف العميل بنجاح')
        fetchCustomers()
      } else {
        const err = await res.json()
        toast.error(err.error || 'فشل في حذف العميل')
      }
    } catch {
      toast.error('حدث خطأ أثناء الحذف')
    } finally {
      setDeleteDialogOpen(false)
      setDeletingId(null)
    }
  }

  const getBalanceColor = (balance: number) => {
    if (balance > 0) return 'text-red-600'
    if (balance < 0) return 'text-emerald-600'
    return 'text-slate-400'
  }

  const getCreditUsage = (balance: number, creditLimit: number) => {
    if (!creditLimit || creditLimit <= 0) return 0
    return Math.min(Math.round((Math.abs(balance) / creditLimit) * 100), 100)
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
                <Users className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <CardTitle className="text-lg">العملاء</CardTitle>
                <p className="text-xs text-slate-400 mt-0.5">
                  {customers.length.toLocaleString('ar-EG')} عميل
                </p>
              </div>
            </div>
            <Button
              onClick={handleOpenAdd}
              className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
            >
              <Plus className="h-4 w-4" />
              إضافة عميل
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Search Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mb-4">
            <div className="relative flex-1">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="بحث بالاسم أو الكود أو الهاتف..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pr-9"
              />
            </div>
          </div>

          {/* Table */}
          <div className="max-h-[calc(100vh-340px)] overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50/80 hover:bg-slate-50/80">
                  <TableHead className="text-right font-semibold">الكود</TableHead>
                  <TableHead className="text-right font-semibold">الاسم</TableHead>
                  <TableHead className="text-right font-semibold">الهاتف</TableHead>
                  <TableHead className="text-right font-semibold">البريد</TableHead>
                  <TableHead className="text-right font-semibold">الرصيد</TableHead>
                  <TableHead className="text-right font-semibold">حد الائتمان</TableHead>
                  <TableHead className="text-right font-semibold">شروط الدفع</TableHead>
                  <TableHead className="text-right font-semibold">الحالة</TableHead>
                  <TableHead className="text-right font-semibold">إجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCustomers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-12">
                      <div className="flex flex-col items-center text-slate-400">
                        <Users className="h-12 w-12 mb-3 text-slate-200" />
                        <p className="text-sm">
                          {searchTerm ? 'لا يوجد عملاء مطابقون للبحث' : 'لا يوجد عملاء مسجلون'}
                        </p>
                        <p className="text-xs mt-1 text-slate-300">
                          {searchTerm ? 'حاول تعديل معايير البحث' : 'اضغط على "إضافة عميل" لإضافة عميل جديد'}
                        </p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredCustomers.map((customer) => (
                    <TableRow key={customer.id} className="cursor-pointer hover:bg-slate-50/50" onClick={() => handleOpenEdit(customer.id)}>
                      <TableCell className="font-mono text-sm">{customer.code}</TableCell>
                      <TableCell>
                        <div>
                          <span className="font-medium">{customer.nameAr}</span>
                          {customer.nameEn && (
                            <span className="text-xs text-slate-400 block" dir="ltr">
                              {customer.nameEn}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-slate-500" dir="ltr">
                        {customer.phone || '—'}
                      </TableCell>
                      <TableCell className="text-slate-500 text-xs">
                        {customer.email || '—'}
                      </TableCell>
                      <TableCell>
                        <span className={`font-mono font-semibold ${getBalanceColor(customer.balance)}`} dir="ltr">
                          {formatCurrency(customer.balance)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="min-w-[80px]">
                          <span className="text-xs text-slate-500 block" dir="ltr">
                            {formatCurrency(customer.creditLimit)}
                          </span>
                          {customer.creditLimit > 0 && (
                            <Progress
                              value={getCreditUsage(customer.balance, customer.creditLimit)}
                              className="h-1.5 mt-1"
                            />
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-slate-500 text-sm">
                        {customer.paymentTerms} يوم
                      </TableCell>
                      <TableCell>
                        {customer.isActive ? (
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
                            onClick={(e) => { e.stopPropagation(); handleOpenEdit(customer.id) }}
                            className="h-8 w-8 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50"
                          >
                            <Users className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => { e.stopPropagation(); handleOpenDelete(customer.id) }}
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

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>تأكيد الحذف</AlertDialogTitle>
            <AlertDialogDescription>
              هل أنت متأكد من حذف هذا العميل؟ لا يمكن التراجع عن هذا الإجراء.
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
