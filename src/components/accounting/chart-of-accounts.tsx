'use client'

import { useState, useEffect, useMemo } from 'react'
import { toast } from 'sonner'
import {
  GitBranch,
  Plus,
  Pencil,
  ChevronDown,
  ChevronLeft,
  Leaf,
  FolderOpen,
  Folder,
  Loader2,
  Search,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Skeleton } from '@/components/ui/skeleton'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useAppStore } from '@/lib/store'
import { getAccountTypeLabel } from '@/lib/erp-utils'
import { cn } from '@/lib/utils'

// ─── Types ──────────────────────────────────────────────────────────────────

interface Account {
  id: string
  code: string
  nameAr: string
  nameEn: string | null
  type: string
  parentId: string | null
  isLeaf: boolean
  isActive: boolean
  createdAt: string
  updatedAt: string
  parent?: {
    id: string
    code: string
    nameAr: string
    nameEn: string | null
  } | null
  children?: Account[]
}

interface AccountFormData {
  code: string
  nameAr: string
  nameEn: string
  type: string
  parentId: string
  isLeaf: boolean
  isActive: boolean
}

const initialFormData: AccountFormData = {
  code: '',
  nameAr: '',
  nameEn: '',
  type: 'ASSET',
  parentId: '',
  isLeaf: true,
  isActive: true,
}

// ─── Account type color mapping ────────────────────────────────────────────

const accountTypeColors: Record<string, string> = {
  ASSET: 'bg-cyan-50 text-cyan-700 border-cyan-200',
  LIABILITY: 'bg-red-50 text-red-700 border-red-200',
  EQUITY: 'bg-purple-50 text-purple-700 border-purple-200',
  REVENUE: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  EXPENSE: 'bg-orange-50 text-orange-700 border-orange-200',
}

const accountTypeDotColors: Record<string, string> = {
  ASSET: 'bg-cyan-500',
  LIABILITY: 'bg-red-500',
  EQUITY: 'bg-purple-500',
  REVENUE: 'bg-emerald-500',
  EXPENSE: 'bg-orange-500',
}

// ─── Tree Node Component ───────────────────────────────────────────────────

interface TreeNodeProps {
  account: Account
  level: number
  expandedIds: Set<string>
  onToggle: (id: string) => void
  onEdit: (account: Account) => void
}

function TreeNode({ account, level, expandedIds, onToggle, onEdit }: TreeNodeProps) {
  const hasChildren = account.children && account.children.length > 0
  const isExpanded = expandedIds.has(account.id)

  return (
    <div>
      <div
        className={cn(
          'flex items-center gap-2 py-2 px-3 hover:bg-slate-50 transition-colors duration-100 group',
          level > 0 && 'border-e-2 border-slate-100'
        )}
        style={{ paddingRight: `${level * 24 + 12}px` }}
      >
        {/* Expand/Collapse button */}
        {hasChildren ? (
          <button
            onClick={() => onToggle(account.id)}
            className="h-6 w-6 flex items-center justify-center rounded-md hover:bg-slate-200 transition-colors shrink-0"
          >
            {isExpanded ? (
              <ChevronDown className="h-4 w-4 text-slate-500" />
            ) : (
              <ChevronLeft className="h-4 w-4 text-slate-500" />
            )}
          </button>
        ) : (
          <div className="h-6 w-6 flex items-center justify-center shrink-0">
            {account.isLeaf ? (
              <Leaf className="h-3.5 w-3.5 text-emerald-400" />
            ) : (
              <div className="h-1.5 w-1.5 rounded-full bg-slate-300" />
            )}
          </div>
        )}

        {/* Account icon */}
        <div className="flex items-center justify-center shrink-0">
          {hasChildren ? (
            isExpanded ? (
              <FolderOpen className={cn('h-4 w-4', accountTypeDotColors[account.type] || 'bg-slate-400')} style={{ color: 'currentColor' }} />
            ) : (
              <Folder className={cn('h-4 w-4', accountTypeDotColors[account.type] || 'bg-slate-400')} style={{ color: 'currentColor' }} />
            )
          ) : null}
        </div>

        {/* Code */}
        <span className="font-mono text-sm text-slate-600 shrink-0 min-w-[3rem]" dir="ltr">
          {account.code}
        </span>

        {/* Name */}
        <span className="text-sm font-medium text-slate-900 flex-1 min-w-0 truncate">
          {account.nameAr}
        </span>

        {/* Type badge */}
        <Badge
          variant="outline"
          className={cn('text-xs shrink-0', accountTypeColors[account.type])}
        >
          {getAccountTypeLabel(account.type)}
        </Badge>

        {/* Leaf indicator */}
        {account.isLeaf && (
          <Badge variant="outline" className="text-xs bg-emerald-50 text-emerald-600 border-emerald-200 shrink-0">
            فرعي
          </Badge>
        )}

        {/* Active status */}
        {!account.isActive && (
          <Badge variant="secondary" className="text-xs bg-slate-100 text-slate-400 shrink-0">
            غير نشط
          </Badge>
        )}

        {/* Edit button */}
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 shrink-0"
          onClick={(e) => {
            e.stopPropagation()
            onEdit(account)
          }}
        >
          <Pencil className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Children */}
      {hasChildren && isExpanded && (
        <div>
          {account.children!.map((child) => (
            <TreeNode
              key={child.id}
              account={child}
              level={level + 1}
              expandedIds={expandedIds}
              onToggle={onToggle}
              onEdit={onEdit}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Main Component ─────────────────────────────────────────────────────────

export default function ChartOfAccounts() {
  const companyId = useAppStore(state => state.currentCompanyId)
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formData, setFormData] = useState<AccountFormData>(initialFormData)
  const [submitting, setSubmitting] = useState(false)
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    if (!companyId) return
    fetchAccounts()
  }, [companyId])

  const fetchAccounts = async () => {
    try {
      const res = await fetch(`/api/accounting/accounts?companyId=${companyId}`)
      if (res.ok) {
        const data = await res.json()
        setAccounts(data)
      }
    } catch {
      toast.error('فشل في تحميل الحسابات')
    } finally {
      setLoading(false)
    }
  }

  // Build tree structure from flat list
  const treeData = useMemo(() => {
    const accountMap = new Map<string, Account>()
    const rootAccounts: Account[] = []

    // First pass: create map
    accounts.forEach((acc) => {
      accountMap.set(acc.id, { ...acc, children: [] })
    })

    // Second pass: build tree
    accounts.forEach((acc) => {
      const node = accountMap.get(acc.id)!
      if (acc.parentId && accountMap.has(acc.parentId)) {
        const parent = accountMap.get(acc.parentId)!
        parent.children!.push(node)
      } else {
        rootAccounts.push(node)
      }
    })

    // Sort children by code
    const sortChildren = (nodes: Account[]) => {
      nodes.sort((a, b) => a.code.localeCompare(b.code))
      nodes.forEach((n) => {
        if (n.children && n.children.length > 0) sortChildren(n.children)
      })
    }
    sortChildren(rootAccounts)

    return rootAccounts
  }, [accounts])

  // Filter tree by search
  const filteredTree = useMemo(() => {
    if (!searchQuery.trim()) return treeData

    const query = searchQuery.toLowerCase()

    const matchesSearch = (acc: Account): boolean => {
      const codeMatch = acc.code.toLowerCase().includes(query)
      const nameMatch = acc.nameAr.toLowerCase().includes(query)
      const nameEnMatch = acc.nameEn?.toLowerCase().includes(query) || false
      return codeMatch || nameMatch || nameEnMatch
    }

    const filterTree = (nodes: Account[]): Account[] => {
      return nodes
        .map((node) => {
          const filteredChildren = node.children ? filterTree(node.children) : []
          if (matchesSearch(node) || filteredChildren.length > 0) {
            return { ...node, children: filteredChildren }
          }
          return null
        })
        .filter(Boolean) as Account[]
    }

    return filterTree(treeData)
  }, [treeData, searchQuery])

  const handleToggle = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const handleExpandAll = () => {
    const allIds = new Set<string>()
    const collectIds = (nodes: Account[]) => {
      nodes.forEach((n) => {
        if (n.children && n.children.length > 0) {
          allIds.add(n.id)
          collectIds(n.children)
        }
      })
    }
    collectIds(treeData)
    setExpandedIds(allIds)
  }

  const handleCollapseAll = () => {
    setExpandedIds(new Set())
  }

  const handleOpenAdd = () => {
    setEditingId(null)
    setFormData(initialFormData)
    setDialogOpen(true)
  }

  const handleOpenEdit = (account: Account) => {
    setEditingId(account.id)
    setFormData({
      code: account.code,
      nameAr: account.nameAr,
      nameEn: account.nameEn || '',
      type: account.type,
      parentId: account.parentId || '',
      isLeaf: account.isLeaf,
      isActive: account.isActive,
    })
    setDialogOpen(true)
  }

  const handleSubmit = async () => {
    if (!formData.code.trim() || !formData.nameAr.trim() || !formData.type) {
      toast.error('يرجى ملء الحقول المطلوبة')
      return
    }

    setSubmitting(true)
    try {
      const payload = {
        ...formData,
        parentId: formData.parentId || null,
        nameEn: formData.nameEn || null,
      }

      if (editingId) {
        payload.id = editingId
      }

      const res = await fetch(`/api/accounting/accounts?companyId=${companyId}`, {
        method: editingId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payload, companyId }),
      })

      if (res.ok) {
        toast.success(editingId ? 'تم تحديث الحساب بنجاح' : 'تم إضافة الحساب بنجاح')
        setDialogOpen(false)
        fetchAccounts()
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

  // Flatten accounts for parent select dropdown
  const parentOptions = useMemo(() => {
    const nonLeafAccounts = accounts.filter((a) => !a.isLeaf)
    return nonLeafAccounts.sort((a, b) => a.code.localeCompare(b.code))
  }, [accounts])

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
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
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
                <GitBranch className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <CardTitle className="text-lg">شجرة الحسابات</CardTitle>
                <p className="text-xs text-slate-400 mt-0.5">{accounts.length} حساب</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleExpandAll}
                className="text-xs gap-1"
              >
                <ChevronDown className="h-3.5 w-3.5" />
                توسيع الكل
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleCollapseAll}
                className="text-xs gap-1"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                طي الكل
              </Button>
              <Button
                onClick={handleOpenAdd}
                className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
              >
                <Plus className="h-4 w-4" />
                إضافة حساب
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Search */}
          <div className="relative mb-4">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="البحث في الحسابات..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pr-9"
            />
          </div>

          {/* Tree */}
          <ScrollArea className="max-h-[calc(100vh-340px)]">
            {filteredTree.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-60 text-slate-400">
                <GitBranch className="h-12 w-12 mb-3 text-slate-200" />
                <p className="text-sm">لا توجد حسابات</p>
                <p className="text-xs mt-1 text-slate-300">
                  اضغط على &quot;إضافة حساب&quot; لإنشاء حساب جديد
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-50">
                {filteredTree.map((account) => (
                  <TreeNode
                    key={account.id}
                    account={account}
                    level={0}
                    expandedIds={expandedIds}
                    onToggle={handleToggle}
                    onEdit={handleOpenEdit}
                  />
                ))}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId ? 'تعديل الحساب' : 'إضافة حساب جديد'}</DialogTitle>
            <DialogDescription>
              {editingId ? 'قم بتعديل بيانات الحساب' : 'أدخل بيانات الحساب الجديد'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="acc-code">
                الكود <span className="text-red-500">*</span>
              </Label>
              <Input
                id="acc-code"
                value={formData.code}
                onChange={(e) => setFormData((p) => ({ ...p, code: e.target.value }))}
                placeholder="1101"
                dir="ltr"
                className="text-left"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="acc-type">
                النوع <span className="text-red-500">*</span>
              </Label>
              <Select
                value={formData.type}
                onValueChange={(val) => setFormData((p) => ({ ...p, type: val }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="اختر النوع" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ASSET">أصول</SelectItem>
                  <SelectItem value="LIABILITY">خصوم</SelectItem>
                  <SelectItem value="EQUITY">حقوق ملكية</SelectItem>
                  <SelectItem value="REVENUE">إيرادات</SelectItem>
                  <SelectItem value="EXPENSE">مصروفات</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="acc-nameAr">
                الاسم عربي <span className="text-red-500">*</span>
              </Label>
              <Input
                id="acc-nameAr"
                value={formData.nameAr}
                onChange={(e) => setFormData((p) => ({ ...p, nameAr: e.target.value }))}
                placeholder="النقدية"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="acc-nameEn">الاسم إنجليزي</Label>
              <Input
                id="acc-nameEn"
                value={formData.nameEn}
                onChange={(e) => setFormData((p) => ({ ...p, nameEn: e.target.value }))}
                placeholder="Cash"
                dir="ltr"
                className="text-left"
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="acc-parent">الحساب الأب</Label>
              <Select
                value={formData.parentId}
                onValueChange={(val) => setFormData((p) => ({ ...p, parentId: val }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="حساب رئيسي (بدون أب)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ROOT">حساب رئيسي (بدون أب)</SelectItem>
                  {parentOptions.map((acc) => (
                    <SelectItem key={acc.id} value={acc.id}>
                      {acc.code} - {acc.nameAr}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-6 sm:col-span-2 pt-2">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="acc-isLeaf"
                  checked={formData.isLeaf}
                  onCheckedChange={(checked) =>
                    setFormData((p) => ({ ...p, isLeaf: checked as boolean }))
                  }
                />
                <Label htmlFor="acc-isLeaf" className="text-sm cursor-pointer">حساب فرعي (يمكن الترحيل عليه)</Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="acc-isActive"
                  checked={formData.isActive}
                  onCheckedChange={(checked) =>
                    setFormData((p) => ({ ...p, isActive: checked as boolean }))
                  }
                />
                <Label htmlFor="acc-isActive" className="text-sm cursor-pointer">نشط</Label>
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
    </>
  )
}
