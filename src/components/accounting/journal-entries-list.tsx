'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { toast } from 'sonner'
import {
  BookOpen,
  Plus,
  Pencil,
  ArrowRightLeft,
  Eye,
  Trash2,
  Loader2,
  Search,
  Calendar,
  FileText,
  CheckCircle2,
  XCircle,
  AlertCircle,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { useAppStore } from '@/lib/store'
import { getStatusColor, getStatusLabel, formatCurrency, formatDate } from '@/lib/erp-utils'
import { cn } from '@/lib/utils'

// ─── Types ──────────────────────────────────────────────────────────────────

interface AccountOption {
  id: string
  code: string
  nameAr: string
  type: string
  isLeaf: boolean
}

interface JournalEntryLine {
  id?: string
  accountId: string
  account?: {
    id: string
    code: string
    nameAr: string
    nameEn: string | null
    type: string
  }
  debit: number
  credit: number
  description: string
}

interface JournalEntry {
  id: string
  number: string
  date: string
  description: string | null
  status: string
  sourceType: string | null
  sourceId: string | null
  reversedById: string | null
  createdAt: string
  updatedAt: string
  lines: JournalEntryLine[]
  reversedBy?: {
    id: string
    number: string
  } | null
}

interface EntryLineFormData {
  accountId: string
  debit: string
  credit: string
  description: string
}

// ─── Main Component ─────────────────────────────────────────────────────────

export default function JournalEntriesList() {
  const companyId = useAppStore(state => state.currentCompanyId)
  const [entries, setEntries] = useState<JournalEntry[]>([])
  const [accounts, setAccounts] = useState<AccountOption[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<string>('ALL')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')

  // Sheet for creating/editing
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [entryDate, setEntryDate] = useState('')
  const [entryDescription, setEntryDescription] = useState('')
  const [entryLines, setEntryLines] = useState<EntryLineFormData[]>([
    { accountId: '', debit: '', credit: '', description: '' },
    { accountId: '', debit: '', credit: '', description: '' },
  ])

  // Detail dialog
  const [detailOpen, setDetailOpen] = useState(false)
  const [detailEntry, setDetailEntry] = useState<JournalEntry | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  // Post confirmation
  const [postConfirmOpen, setPostConfirmOpen] = useState(false)
  const [postTargetId, setPostTargetId] = useState<string | null>(null)

  // Reverse confirmation
  const [reverseConfirmOpen, setReverseConfirmOpen] = useState(false)
  const [reverseTargetId, setReverseTargetId] = useState<string | null>(null)

  // Account search
  const [accountSearches, setAccountSearches] = useState<Record<number, string>>({})

  useEffect(() => {
    fetchEntries()
    fetchAccounts()
  }, [])

  const fetchAccounts = async () => {
    try {
      const res = await fetch(`/api/accounting/accounts?companyId=${companyId}`)
      if (res.ok) {
        const data = await res.json()
        setAccounts(data.filter((a: AccountOption) => a.isLeaf))
      }
    } catch {
      // silent
    }
  }

  const fetchEntries = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (statusFilter && statusFilter !== 'ALL') params.set('status', statusFilter)
      if (fromDate) params.set('fromDate', fromDate)
      if (toDate) params.set('toDate', toDate)

      const res = await fetch(`/api/accounting/journal-entries?companyId=${companyId}&${params.toString()}`)
      if (res.ok) {
        const data = await res.json()
        setEntries(data)
      }
    } catch {
      toast.error('فشل في تحميل القيود')
    } finally {
      setLoading(false)
    }
  }, [statusFilter, fromDate, toDate])

  useEffect(() => {
    if (!loading) {
      fetchEntries()
    }
  }, [statusFilter, fromDate, toDate, fetchEntries, loading])

  // ── Entry totals ──
  const totalDebit = useMemo(
    () => entryLines.reduce((sum, l) => sum + (parseFloat(l.debit) || 0), 0),
    [entryLines]
  )
  const totalCredit = useMemo(
    () => entryLines.reduce((sum, l) => sum + (parseFloat(l.credit) || 0), 0),
    [entryLines]
  )
  const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01 && totalDebit > 0

  // ── Line management ──
  const addLine = () => {
    setEntryLines((prev) => [...prev, { accountId: '', debit: '', credit: '', description: '' }])
  }

  const removeLine = (index: number) => {
    if (entryLines.length <= 2) {
      toast.error('يجب أن يحتوي القيد على سطرين على الأقل')
      return
    }
    setEntryLines((prev) => prev.filter((_, i) => i !== index))
  }

  const updateLine = (index: number, field: keyof EntryLineFormData, value: string) => {
    setEntryLines((prev) => {
      const updated = [...prev]
      updated[index] = { ...updated[index], [field]: value }
      // Auto-clear the other field if debit or credit is entered
      if (field === 'debit' && parseFloat(value) > 0) {
        updated[index].credit = ''
      } else if (field === 'credit' && parseFloat(value) > 0) {
        updated[index].debit = ''
      }
      return updated
    })
  }

  // ── Open create sheet ──
  const handleOpenCreate = () => {
    setEditingId(null)
    setEntryDate(new Date().toISOString().split('T')[0])
    setEntryDescription('')
    setEntryLines([
      { accountId: '', debit: '', credit: '', description: '' },
      { accountId: '', debit: '', credit: '', description: '' },
    ])
    setAccountSearches({})
    setSheetOpen(true)
  }

  // ── Open edit ──
  const handleOpenEdit = async (entry: JournalEntry) => {
    setEditingId(entry.id)
    setEntryDate(new Date(entry.date).toISOString().split('T')[0])
    setEntryDescription(entry.description || '')
    setEntryLines(
      entry.lines.map((l) => ({
        accountId: l.accountId,
        debit: l.debit ? String(l.debit) : '',
        credit: l.credit ? String(l.credit) : '',
        description: l.description || '',
      }))
    )
    setAccountSearches({})
    setSheetOpen(true)
  }

  // ── Save draft ──
  const handleSaveDraft = async () => {
    // Validation
    if (!entryDate) {
      toast.error('يرجى إدخال التاريخ')
      return
    }

    const validLines = entryLines.filter((l) => l.accountId)
    if (validLines.length < 2) {
      toast.error('يجب أن يحتوي القيد على سطرين على الأقل')
      return
    }

    const hasValues = validLines.some((l) => parseFloat(l.debit) > 0 || parseFloat(l.credit) > 0)
    if (!hasValues) {
      toast.error('يجب إدخال قيم مدين أو دائن')
      return
    }

    setSubmitting(true)
    try {
      const payload = {
        date: entryDate,
        description: entryDescription || null,
        lines: entryLines
          .filter((l) => l.accountId)
          .map((l) => ({
            accountId: l.accountId,
            debit: parseFloat(l.debit) || 0,
            credit: parseFloat(l.credit) || 0,
            description: l.description || null,
          })),
      }

      let res: Response
      if (editingId) {
        res = await fetch(`/api/accounting/journal-entries/${editingId}?companyId=${companyId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'update', ...payload, companyId }),
        })
      } else {
        res = await fetch(`/api/accounting/journal-entries?companyId=${companyId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...payload, companyId }),
        })
      }

      if (res.ok) {
        toast.success(editingId ? 'تم تحديث القيد بنجاح' : 'تم حفظ القيد كمسودة')
        setSheetOpen(false)
        fetchEntries()
      } else {
        const err = await res.json()
        toast.error(err.error || 'فشل في حفظ القيد')
      }
    } catch {
      toast.error('حدث خطأ أثناء حفظ القيد')
    } finally {
      setSubmitting(false)
    }
  }

  // ── Post entry ──
  const handlePost = async () => {
    if (!postTargetId) return
    try {
      const res = await fetch(`/api/accounting/journal-entries/${postTargetId}?companyId=${companyId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'post', companyId }),
      })
      if (res.ok) {
        toast.success('تم ترحيل القيد بنجاح')
        fetchEntries()
      } else {
        const err = await res.json()
        toast.error(err.error || 'فشل في ترحيل القيد')
      }
    } catch {
      toast.error('حدث خطأ أثناء ترحيل القيد')
    } finally {
      setPostConfirmOpen(false)
      setPostTargetId(null)
    }
  }

  // ── Reverse entry ──
  const handleReverse = async () => {
    if (!reverseTargetId) return
    try {
      const res = await fetch(`/api/accounting/journal-entries/${reverseTargetId}?companyId=${companyId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reverse', companyId }),
      })
      if (res.ok) {
        toast.success('تم عكس القيد بنجاح')
        fetchEntries()
      } else {
        const err = await res.json()
        toast.error(err.error || 'فشل في عكس القيد')
      }
    } catch {
      toast.error('حدث خطأ أثناء عكس القيد')
    } finally {
      setReverseConfirmOpen(false)
      setReverseTargetId(null)
    }
  }

  // ── View detail ──
  const handleViewDetail = async (entryId: string) => {
    setDetailLoading(true)
    setDetailOpen(true)
    try {
      const res = await fetch(`/api/accounting/journal-entries/${entryId}?companyId=${companyId}`)
      if (res.ok) {
        const data = await res.json()
        setDetailEntry(data)
      }
    } catch {
      toast.error('فشل في تحميل تفاصيل القيد')
    } finally {
      setDetailLoading(false)
    }
  }

  // ── Get account name by id ──
  const getAccountName = (accountId: string) => {
    const acc = accounts.find((a) => a.id === accountId)
    return acc ? `${acc.code} - ${acc.nameAr}` : ''
  }

  // ── Filter accounts by search ──
  const getFilteredAccounts = (index: number) => {
    const search = accountSearches[index] || ''
    if (!search.trim()) return accounts
    const query = search.toLowerCase()
    return accounts.filter(
      (a) =>
        a.code.toLowerCase().includes(query) ||
        a.nameAr.toLowerCase().includes(query)
    )
  }

  // ── Compute row totals ──
  const getRowTotals = (entry: JournalEntry) => {
    const debit = entry.lines.reduce((sum, l) => sum + l.debit, 0)
    const credit = entry.lines.reduce((sum, l) => sum + l.credit, 0)
    return { debit, credit }
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
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-emerald-50 flex items-center justify-center">
                <BookOpen className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <CardTitle className="text-lg">القيود اليومية</CardTitle>
                <p className="text-xs text-slate-400 mt-0.5">{entries.length} قيد</p>
              </div>
            </div>
            <Button
              onClick={handleOpenCreate}
              className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
            >
              <Plus className="h-4 w-4" />
              إضافة قيد
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="flex flex-wrap items-end gap-3 mb-4">
            <div className="space-y-1.5">
              <Label className="text-xs">الحالة</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">الكل</SelectItem>
                  <SelectItem value="DRAFT">مسودة</SelectItem>
                  <SelectItem value="POSTED">مرحل</SelectItem>
                  <SelectItem value="REVERSED">معكوس</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">من تاريخ</Label>
              <Input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="w-[160px]"
                dir="ltr"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">إلى تاريخ</Label>
              <Input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="w-[160px]"
                dir="ltr"
              />
            </div>
          </div>

          {/* Table */}
          <div className="max-h-[calc(100vh-360px)] overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50/80 hover:bg-slate-50/80">
                  <TableHead className="text-right font-semibold">الرقم</TableHead>
                  <TableHead className="text-right font-semibold">التاريخ</TableHead>
                  <TableHead className="text-right font-semibold">البيان</TableHead>
                  <TableHead className="text-right font-semibold">الحالة</TableHead>
                  <TableHead className="text-right font-semibold">المصدر</TableHead>
                  <TableHead className="text-right font-semibold">إجمالي المدين</TableHead>
                  <TableHead className="text-right font-semibold">إجمالي الدائن</TableHead>
                  <TableHead className="text-right font-semibold">إجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-12">
                      <div className="flex flex-col items-center text-slate-400">
                        <BookOpen className="h-12 w-12 mb-3 text-slate-200" />
                        <p className="text-sm">لا توجد قيود</p>
                        <p className="text-xs mt-1 text-slate-300">
                          اضغط على &quot;إضافة قيد&quot; لإنشاء قيد جديد
                        </p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  entries.map((entry) => {
                    const totals = getRowTotals(entry)
                    return (
                      <TableRow key={entry.id} className="group">
                        <TableCell>
                          <button
                            onClick={() => handleViewDetail(entry.id)}
                            className="font-mono text-sm text-emerald-700 hover:text-emerald-900 hover:underline font-medium"
                          >
                            {entry.number}
                          </button>
                        </TableCell>
                        <TableCell className="text-sm" dir="ltr">
                          {formatDate(entry.date)}
                        </TableCell>
                        <TableCell className="text-sm max-w-[200px] truncate">
                          {entry.description || '—'}
                        </TableCell>
                        <TableCell>
                          <Badge className={cn('text-xs', getStatusColor(entry.status))}>
                            {getStatusLabel(entry.status)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-slate-500">
                          {entry.sourceType || 'يدوي'}
                        </TableCell>
                        <TableCell className="font-mono text-sm" dir="ltr">
                          {formatCurrency(totals.debit)}
                        </TableCell>
                        <TableCell className="font-mono text-sm" dir="ltr">
                          {formatCurrency(totals.credit)}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50"
                              onClick={() => handleViewDetail(entry.id)}
                              title="عرض التفاصيل"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            {entry.status === 'DRAFT' && (
                              <>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-slate-500 hover:text-green-600 hover:bg-green-50"
                                  onClick={() => {
                                    setPostTargetId(entry.id)
                                    setPostConfirmOpen(true)
                                  }}
                                  title="ترحيل"
                                >
                                  <CheckCircle2 className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50"
                                  onClick={() => handleOpenEdit(entry)}
                                  title="تعديل"
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                              </>
                            )}
                            {entry.status === 'POSTED' && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-slate-500 hover:text-orange-600 hover:bg-orange-50"
                                onClick={() => {
                                  setReverseTargetId(entry.id)
                                  setReverseConfirmOpen(true)
                                }}
                                title="عكس"
                              >
                                <ArrowRightLeft className="h-4 w-4" />
                              </Button>
                            )}
                            {entry.status === 'REVERSED' && (
                              <Badge variant="secondary" className="text-xs bg-slate-100 text-slate-400">
                                معكوس
                              </Badge>
                            )}
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

      {/* ── Create/Edit Sheet ── */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="left" className="w-full sm:max-w-2xl p-0">
          <SheetHeader className="p-6 pb-4 border-b">
            <SheetTitle>{editingId ? 'تعديل القيد' : 'إضافة قيد جديد'}</SheetTitle>
            <SheetDescription>
              {editingId ? 'قم بتعديل بيانات القيد' : 'أدخل بيانات القيد اليومي الجديد'}
            </SheetDescription>
          </SheetHeader>

          <ScrollArea className="flex-1 h-[calc(100vh-180px)]">
            <div className="p-6 space-y-5">
              {/* Header fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>
                    التاريخ <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    type="date"
                    value={entryDate}
                    onChange={(e) => setEntryDate(e.target.value)}
                    dir="ltr"
                  />
                </div>
                <div className="space-y-2">
                  <Label>البيان</Label>
                  <Input
                    value={entryDescription}
                    onChange={(e) => setEntryDescription(e.target.value)}
                    placeholder="وصف القيد..."
                  />
                </div>
              </div>

              <Separator />

              {/* Lines section */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-base font-semibold">بنود القيد</Label>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={addLine}
                    className="gap-1 text-xs"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    إضافة سطر
                  </Button>
                </div>

                {entryLines.map((line, index) => (
                  <div
                    key={index}
                    className="border rounded-lg p-3 space-y-2 bg-slate-50/50"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-slate-500">
                        السطر {index + 1}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-slate-400 hover:text-red-500"
                        onClick={() => removeLine(index)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>

                    {/* Account select with search */}
                    <div className="space-y-1">
                      <Label className="text-xs">الحساب</Label>
                      <div className="space-y-1">
                        <Input
                          placeholder="بحث عن حساب..."
                          value={accountSearches[index] || ''}
                          onChange={(e) =>
                            setAccountSearches((prev) => ({
                              ...prev,
                              [index]: e.target.value,
                            }))
                          }
                          className="h-8 text-xs"
                        />
                        <Select
                          value={line.accountId}
                          onValueChange={(val) => {
                            updateLine(index, 'accountId', val)
                            setAccountSearches((prev) => ({
                              ...prev,
                              [index]: '',
                            }))
                          }}
                        >
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue placeholder="اختر الحساب">
                              {line.accountId ? getAccountName(line.accountId) : 'اختر الحساب'}
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            {getFilteredAccounts(index).map((acc) => (
                              <SelectItem key={acc.id} value={acc.id}>
                                <span dir="ltr" className="inline-block">{acc.code}</span>
                                {' - '}
                                {acc.nameAr}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <Label className="text-xs">مدين</Label>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          value={line.debit}
                          onChange={(e) => updateLine(index, 'debit', e.target.value)}
                          placeholder="0.00"
                          dir="ltr"
                          className="h-8 text-xs text-left"
                          disabled={parseFloat(line.credit) > 0}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">دائن</Label>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          value={line.credit}
                          onChange={(e) => updateLine(index, 'credit', e.target.value)}
                          placeholder="0.00"
                          dir="ltr"
                          className="h-8 text-xs text-left"
                          disabled={parseFloat(line.debit) > 0}
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs">الوصف</Label>
                      <Input
                        value={line.description}
                        onChange={(e) => updateLine(index, 'description', e.target.value)}
                        placeholder="وصف السطر..."
                        className="h-8 text-xs"
                      />
                    </div>
                  </div>
                ))}
              </div>

              <Separator />

              {/* Totals and balance indicator */}
              <div className="bg-slate-50 rounded-lg p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">إجمالي المدين</span>
                  <span className="font-mono font-medium" dir="ltr">
                    {formatCurrency(totalDebit)}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">إجمالي الدائن</span>
                  <span className="font-mono font-medium" dir="ltr">
                    {formatCurrency(totalCredit)}
                  </span>
                </div>
                <Separator />
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-slate-700">الفرق</span>
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        'font-mono text-sm font-bold',
                        isBalanced ? 'text-emerald-600' : 'text-red-600'
                      )}
                      dir="ltr"
                    >
                      {formatCurrency(Math.abs(totalDebit - totalCredit))}
                    </span>
                    {isBalanced ? (
                      <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 gap-1">
                        <CheckCircle2 className="h-3 w-3" />
                        متوازن
                      </Badge>
                    ) : (
                      <Badge className="bg-red-50 text-red-700 border-red-200 gap-1">
                        <AlertCircle className="h-3 w-3" />
                        غير متوازن
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </ScrollArea>

          <SheetFooter className="p-4 border-t bg-white">
            <div className="flex items-center gap-2 w-full">
              <Button
                variant="outline"
                onClick={() => setSheetOpen(false)}
                className="flex-1"
              >
                إلغاء
              </Button>
              <Button
                onClick={handleSaveDraft}
                disabled={submitting}
                className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2 flex-1"
              >
                {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                {editingId ? 'تحديث المسودة' : 'حفظ كمسودة'}
              </Button>
            </div>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* ── Detail Dialog ── */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-emerald-600" />
              تفاصيل القيد
            </DialogTitle>
            <DialogDescription>
              {detailEntry && (
                <span>
                  {detailEntry.number} — {formatDate(detailEntry.date)}
                </span>
              )}
            </DialogDescription>
          </DialogHeader>

          {detailLoading ? (
            <div className="space-y-3 py-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-8 w-full" />
              ))}
            </div>
          ) : detailEntry ? (
            <div className="space-y-4">
              {/* Entry header info */}
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-slate-500">الرقم: </span>
                  <span className="font-mono font-medium">{detailEntry.number}</span>
                </div>
                <div>
                  <span className="text-slate-500">التاريخ: </span>
                  <span dir="ltr">{formatDate(detailEntry.date)}</span>
                </div>
                <div>
                  <span className="text-slate-500">الحالة: </span>
                  <Badge className={cn('text-xs', getStatusColor(detailEntry.status))}>
                    {getStatusLabel(detailEntry.status)}
                  </Badge>
                </div>
                <div>
                  <span className="text-slate-500">المصدر: </span>
                  <span>{detailEntry.sourceType || 'يدوي'}</span>
                </div>
                {detailEntry.description && (
                  <div className="col-span-2">
                    <span className="text-slate-500">البيان: </span>
                    <span>{detailEntry.description}</span>
                  </div>
                )}
              </div>

              <Separator />

              {/* Lines table */}
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50/80 hover:bg-slate-50/80">
                    <TableHead className="text-right text-xs">كود الحساب</TableHead>
                    <TableHead className="text-right text-xs">اسم الحساب</TableHead>
                    <TableHead className="text-right text-xs">مدين</TableHead>
                    <TableHead className="text-right text-xs">دائن</TableHead>
                    <TableHead className="text-right text-xs">الوصف</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {detailEntry.lines.map((line) => (
                    <TableRow key={line.id}>
                      <TableCell className="font-mono text-sm" dir="ltr">
                        {line.account?.code}
                      </TableCell>
                      <TableCell className="text-sm">{line.account?.nameAr}</TableCell>
                      <TableCell className="font-mono text-sm" dir="ltr">
                        {line.debit > 0 ? formatCurrency(line.debit) : ''}
                      </TableCell>
                      <TableCell className="font-mono text-sm" dir="ltr">
                        {line.credit > 0 ? formatCurrency(line.credit) : ''}
                      </TableCell>
                      <TableCell className="text-sm text-slate-500">
                        {line.description || '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                  {/* Totals row */}
                  <TableRow className="bg-slate-50 font-bold">
                    <TableCell colSpan={2} className="text-sm">
                      الإجمالي
                    </TableCell>
                    <TableCell className="font-mono text-sm" dir="ltr">
                      {formatCurrency(
                        detailEntry.lines.reduce((s, l) => s + l.debit, 0)
                      )}
                    </TableCell>
                    <TableCell className="font-mono text-sm" dir="ltr">
                      {formatCurrency(
                        detailEntry.lines.reduce((s, l) => s + l.credit, 0)
                      )}
                    </TableCell>
                    <TableCell />
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* ── Post Confirmation ── */}
      <AlertDialog open={postConfirmOpen} onOpenChange={setPostConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              تأكيد الترحيل
            </AlertDialogTitle>
            <AlertDialogDescription>
              هل أنت متأكد من ترحيل هذا القيد؟ بعد الترحيل لا يمكن تعديله، فقط عكسه.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              onClick={handlePost}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              ترحيل
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Reverse Confirmation ── */}
      <AlertDialog open={reverseConfirmOpen} onOpenChange={setReverseConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <ArrowRightLeft className="h-5 w-5 text-orange-600" />
              تأكيد العكس
            </AlertDialogTitle>
            <AlertDialogDescription>
              هل أنت متأكد من عكس هذا القيد؟ سيتم إنشاء قيد عكسي بتبديل المدين والدائن، ولا يمكن التراجع عن هذا الإجراء.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleReverse}
              className="bg-orange-600 hover:bg-orange-700 text-white"
            >
              عكس القيد
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
