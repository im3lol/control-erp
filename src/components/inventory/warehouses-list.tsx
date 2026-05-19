'use client'

import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import {
  Plus, Pencil, Trash2, Warehouse as WarehouseIcon, Loader2,
  Building2, MapPin, LayoutGrid, Layers, Box, ChevronDown, ChevronLeft,
  List, GitBranch, Upload, Download, FileSpreadsheet, ArrowRightLeft,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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
import { cn } from '@/lib/utils'

// ── Types ──────────────────────────────────────────────────────────────────────

interface Warehouse {
  id: string
  code: string
  nameAr: string
  nameEn: string | null
  type: string
  parentId: string | null
  location: string | null
  manager: string | null
  isActive: boolean
  parent?: { id: string; code: string; nameAr: string; type: string } | null
  children?: Warehouse[]
  _count?: { itemBalances: number; stockMovements: number; children: number }
}

interface WarehouseFormData {
  code: string
  nameAr: string
  nameEn: string
  type: string
  parentId: string
  location: string
  manager: string
  isActive: boolean
}

// ── Constants ──────────────────────────────────────────────────────────────────

const WAREHOUSE_TYPES = [
  { value: 'WAREHOUSE', label: 'مخزن' },
  { value: 'ZONE', label: 'منطقة' },
  { value: 'RACK', label: 'راك' },
  { value: 'SHELF', label: 'رف' },
  { value: 'BOX', label: 'بوكس' },
] as const

const TYPE_ICON_MAP: Record<string, React.ElementType> = {
  WAREHOUSE: Building2,
  ZONE: MapPin,
  RACK: LayoutGrid,
  SHELF: Layers,
  BOX: Box,
}

const TYPE_COLOR_MAP: Record<string, { bg: string; text: string; border: string }> = {
  WAREHOUSE: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
  ZONE: { bg: 'bg-teal-50', text: 'text-teal-700', border: 'border-teal-200' },
  RACK: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
  SHELF: { bg: 'bg-violet-50', text: 'text-violet-700', border: 'border-violet-200' },
  BOX: { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200' },
}

// Type hierarchy: what types can be children of what
const TYPE_HIERARCHY: Record<string, string[]> = {
  WAREHOUSE: ['ZONE'],
  ZONE: ['RACK'],
  RACK: ['SHELF'],
  SHELF: ['BOX'],
  BOX: [],
}

const initialFormData: WarehouseFormData = {
  code: '',
  nameAr: '',
  nameEn: '',
  type: 'WAREHOUSE',
  parentId: '',
  location: '',
  manager: '',
  isActive: true,
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function WarehousesList() {
  const companyId = useAppStore(state => state.currentCompanyId)
  const setModule = useAppStore(state => state.setModule)
  const setView = useAppStore(state => state.setView)
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [treeData, setTreeData] = useState<Warehouse[]>([])
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState<'tree' | 'list'>('tree')
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set())

  // Dialog states
  const [dialogOpen, setDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [importDialogOpen, setImportDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [formData, setFormData] = useState<WarehouseFormData>(initialFormData)
  const [submitting, setSubmitting] = useState(false)

  // Import states
  const [importFile, setImportFile] = useState<File | null>(null)
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<{
    successCount: number
    errorCount: number
    errors: string[]
    totalRows: number
  } | null>(null)

  useEffect(() => {
    if (!companyId) return
    fetchWarehouses()
  }, [companyId])

  const fetchWarehouses = useCallback(async () => {
    try {
      setLoading(true)
      const res = await fetch(`/api/inventory/warehouses?companyId=${companyId}`)
      if (res.ok) {
        const data = await res.json()
        setWarehouses(data)
      }
      const treeRes = await fetch(`/api/inventory/warehouses?companyId=${companyId}&view=tree`)
      if (treeRes.ok) {
        const treeData = await treeRes.json()
        setTreeData(treeData)
        // Auto-expand all first level
        const firstLevel = new Set<string>()
        for (const wh of treeData) {
          firstLevel.add(wh.id)
        }
        setExpandedNodes(firstLevel)
      }
    } catch {
      toast.error('فشل في تحميل المخازن')
    } finally {
      setLoading(false)
    }
  }, [companyId])

  // ── Handlers ────────────────────────────────────────────────────────────────

  const handleOpenAdd = () => {
    setEditingId(null)
    setFormData(initialFormData)
    setDialogOpen(true)
  }

  const handleOpenEdit = (wh: Warehouse) => {
    setEditingId(wh.id)
    setFormData({
      code: wh.code,
      nameAr: wh.nameAr,
      nameEn: wh.nameEn || '',
      type: wh.type,
      parentId: wh.parentId || '',
      location: wh.location || '',
      manager: wh.manager || '',
      isActive: wh.isActive,
    })
    setDialogOpen(true)
  }

  const handleOpenDelete = (id: string) => {
    setDeletingId(id)
    setDeleteDialogOpen(true)
  }

  const handleSubmit = async () => {
    if (!formData.code.trim()) {
      toast.error('يرجى إدخال الكود')
      return
    }

    setSubmitting(true)
    try {
      const url = editingId
        ? `/api/inventory/warehouses/${editingId}`
        : '/api/inventory/warehouses'
      const method = editingId ? 'PUT' : 'POST'

      const submitData = {
        ...formData,
        companyId,
        nameAr: formData.nameAr || formData.code,
        parentId: formData.parentId === '__none__' || !formData.parentId ? null : formData.parentId,
      }

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(submitData),
      })

      if (res.ok) {
        toast.success(editingId ? 'تم تحديث الموقع بنجاح' : 'تم إضافة الموقع بنجاح')
        setDialogOpen(false)
        fetchWarehouses()
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
      const res = await fetch(`/api/inventory/warehouses/${deletingId}?companyId=${companyId}`, { method: 'DELETE' })
      if (res.ok) {
        toast.success('تم حذف الموقع بنجاح')
        fetchWarehouses()
      } else {
        const err = await res.json()
        toast.error(err.error || 'فشل في حذف الموقع')
      }
    } catch {
      toast.error('حدث خطأ أثناء الحذف')
    } finally {
      setDeleteDialogOpen(false)
      setDeletingId(null)
    }
  }

  const handleImport = async () => {
    if (!importFile) {
      toast.error('يرجى اختيار ملف Excel')
      return
    }

    setImporting(true)
    setImportResult(null)
    try {
      const form = new FormData()
      form.append('file', importFile)
      form.append('companyId', companyId!)

      const res = await fetch('/api/inventory/warehouses/import', {
        method: 'POST',
        body: form,
      })

      const data = await res.json()
      if (res.ok) {
        setImportResult(data)
        if (data.successCount > 0) {
          toast.success(`تم استيراد ${data.successCount} موقع بنجاح`)
          fetchWarehouses()
        }
        if (data.errorCount > 0) {
          toast.warning(`${data.errorCount} صف به أخطاء`)
        }
      } else {
        toast.error(data.error || 'فشل في استيراد الملف')
      }
    } catch {
      toast.error('حدث خطأ أثناء الاستيراد')
    } finally {
      setImporting(false)
    }
  }

  const toggleNode = (id: string) => {
    setExpandedNodes(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  // Get allowed parent types for the current form type
  const getAllowedParentTypes = (childType: string): string[] => {
    // Find all types that can have this type as child
    const allowed: string[] = []
    for (const [parentType, childTypes] of Object.entries(TYPE_HIERARCHY)) {
      if (childTypes.includes(childType)) {
        allowed.push(parentType)
        // Also allow grandparents (recursive)
        const grandparentTypes = getAllowedParentTypes(parentType)
        allowed.push(...grandparentTypes)
      }
    }
    return [...new Set(allowed)]
  }

  // Filter potential parents based on the selected type
  const potentialParents = warehouses.filter(wh => {
    if (!formData.type) return true
    const allowed = getAllowedParentTypes(formData.type)
    return allowed.includes(wh.type)
  })

  const getTypeLabel = (type: string) => {
    return WAREHOUSE_TYPES.find(t => t.value === type)?.label || type
  }

  // ── Render Tree Node ────────────────────────────────────────────────────────

  const renderTreeNode = (node: Warehouse, depth: number = 0): React.ReactNode => {
    const hasChildren = node.children && node.children.length > 0
    const isExpanded = expandedNodes.has(node.id)
    const IconComponent = TYPE_ICON_MAP[node.type] || Building2
    const colors = TYPE_COLOR_MAP[node.type] || TYPE_COLOR_MAP.WAREHOUSE

    return (
      <div key={node.id}>
        <div
          className={cn(
            'flex items-center gap-2 py-2 px-3 hover:bg-slate-50 transition-colors group',
            depth > 0 && 'border-r-2 border-slate-100'
          )}
          style={{ paddingRight: `${depth * 28 + 12}px` }}
        >
          {/* Expand/Collapse button */}
          <button
            onClick={() => hasChildren && toggleNode(node.id)}
            className={cn(
              'h-6 w-6 rounded flex items-center justify-center shrink-0 transition-colors',
              hasChildren
                ? 'hover:bg-slate-100 cursor-pointer'
                : 'opacity-0'
            )}
          >
            {hasChildren ? (
              <ChevronDown
                className={cn(
                  'h-4 w-4 text-slate-400 transition-transform duration-200',
                  !isExpanded && '-rotate-90'
                )}
              />
            ) : (
              <div className="h-4 w-4" />
            )}
          </button>

          {/* Type Icon */}
          <div className={cn('h-7 w-7 rounded-md flex items-center justify-center shrink-0', colors.bg)}>
            <IconComponent className={cn('h-4 w-4', colors.text)} />
          </div>

          {/* Code & Name */}
          <span className="font-mono text-sm text-slate-700 min-w-[80px]">{node.code}</span>
          <span className="text-sm font-medium text-slate-900 truncate flex-1">
            {node.nameAr}
          </span>
          {node.nameEn && (
            <span className="text-xs text-slate-400 truncate hidden sm:inline" dir="ltr">
              {node.nameEn}
            </span>
          )}

          {/* Type Badge */}
          <Badge className={cn('text-[10px] px-1.5 py-0 h-5 border shrink-0', colors.bg, colors.text, colors.border)}>
            {getTypeLabel(node.type)}
          </Badge>

          {/* Status */}
          {node.isActive ? (
            <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px] px-1.5 py-0 h-5 shrink-0">
              نشط
            </Badge>
          ) : (
            <Badge variant="secondary" className="bg-slate-100 text-slate-500 text-[10px] px-1.5 py-0 h-5 shrink-0">
              غير نشط
            </Badge>
          )}

          {/* Location & Manager info */}
          {node.location && (
            <span className="text-xs text-slate-400 hidden lg:inline max-w-[100px] truncate shrink-0">
              📍 {node.location}
            </span>
          )}

          {/* Children count */}
          {hasChildren && (
            <span className="text-[10px] text-slate-400 shrink-0">
              ({node.children!.length})
            </span>
          )}

          {/* Actions */}
          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
            <Button
              variant="ghost"
              size="icon"
              onClick={(e) => { e.stopPropagation(); handleOpenEdit(node) }}
              className="h-7 w-7 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50"
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={(e) => { e.stopPropagation(); handleOpenDelete(node.id) }}
              className="h-7 w-7 text-slate-500 hover:text-red-600 hover:bg-red-50"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        {/* Children */}
        {hasChildren && isExpanded && (
          <div>
            {node.children!.map(child => renderTreeNode(child, depth + 1))}
          </div>
        )}
      </div>
    )
  }

  // ── Loading ─────────────────────────────────────────────────────────────────

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

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <>
      <Card className="border shadow-sm">
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-emerald-50 flex items-center justify-center">
                <WarehouseIcon className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <CardTitle className="text-lg">المخازن والمواقع</CardTitle>
                <p className="text-xs text-slate-400 mt-0.5">
                  {warehouses.length} موقع مسجل
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {/* View Toggle */}
              <div className="flex items-center bg-slate-100 rounded-lg p-0.5">
                <Button
                  variant={viewMode === 'tree' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('tree')}
                  className={cn(
                    'h-8 gap-1.5 text-xs',
                    viewMode === 'tree' && 'bg-white shadow-sm text-emerald-700 hover:bg-white'
                  )}
                >
                  <GitBranch className="h-3.5 w-3.5" />
                  شجرة
                </Button>
                <Button
                  variant={viewMode === 'list' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('list')}
                  className={cn(
                    'h-8 gap-1.5 text-xs',
                    viewMode === 'list' && 'bg-white shadow-sm text-emerald-700 hover:bg-white'
                  )}
                >
                  <List className="h-3.5 w-3.5" />
                  قائمة
                </Button>
              </div>

              {/* Stock Transfers Link */}
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 text-xs h-8"
                onClick={() => { setModule('inventory'); setView('stock-movements') }}
              >
                <ArrowRightLeft className="h-3.5 w-3.5" />
                حركات المخزن
              </Button>

              {/* Import Button */}
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 text-xs h-8"
                onClick={() => {
                  setImportFile(null)
                  setImportResult(null)
                  setImportDialogOpen(true)
                }}
              >
                <Upload className="h-3.5 w-3.5" />
                استيراد Excel
              </Button>

              {/* Add Button */}
              <Button
                onClick={handleOpenAdd}
                size="sm"
                className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 h-8"
              >
                <Plus className="h-3.5 w-3.5" />
                إضافة موقع
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="px-0">
          {viewMode === 'tree' ? (
            /* ── Tree View ── */
            <div className="max-h-[calc(100vh-280px)] overflow-y-auto">
              {treeData.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                  <Building2 className="h-12 w-12 mb-3 text-slate-200" />
                  <p className="text-sm">لا توجد مواقع مسجلة</p>
                  <p className="text-xs mt-1 text-slate-300">
                    اضغط على &quot;إضافة موقع&quot; لإضافة مخزن جديد
                  </p>
                </div>
              ) : (
                <div>
                  {treeData.map(node => renderTreeNode(node, 0))}
                </div>
              )}
            </div>
          ) : (
            /* ── List View ── */
            <div className="max-h-[calc(100vh-280px)] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50/80 hover:bg-slate-50/80">
                    <TableHead className="text-right font-semibold">الكود</TableHead>
                    <TableHead className="text-right font-semibold">الاسم عربي</TableHead>
                    <TableHead className="text-right font-semibold">الاسم إنجليزي</TableHead>
                    <TableHead className="text-right font-semibold">النوع</TableHead>
                    <TableHead className="text-right font-semibold">الموقع الأب</TableHead>
                    <TableHead className="text-right font-semibold">الموقع</TableHead>
                    <TableHead className="text-right font-semibold">المسؤول</TableHead>
                    <TableHead className="text-right font-semibold">الحالة</TableHead>
                    <TableHead className="text-right font-semibold">إجراءات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {warehouses.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-12">
                        <div className="flex flex-col items-center text-slate-400">
                          <Building2 className="h-12 w-12 mb-3 text-slate-200" />
                          <p className="text-sm">لا توجد مواقع مسجلة</p>
                          <p className="text-xs mt-1 text-slate-300">
                            اضغط على &quot;إضافة موقع&quot; لإضافة مخزن جديد
                          </p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    warehouses.map((wh) => {
                      const colors = TYPE_COLOR_MAP[wh.type] || TYPE_COLOR_MAP.WAREHOUSE
                      return (
                        <TableRow key={wh.id}>
                          <TableCell className="font-mono text-sm">{wh.code}</TableCell>
                          <TableCell className="font-medium">{wh.nameAr}</TableCell>
                          <TableCell className="text-slate-500" dir="ltr">
                            {wh.nameEn || '—'}
                          </TableCell>
                          <TableCell>
                            <Badge className={cn('text-[10px] px-1.5 py-0 h-5 border', colors.bg, colors.text, colors.border)}>
                              {getTypeLabel(wh.type)}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-slate-500 text-xs">
                            {wh.parent ? `${wh.parent.code} - ${wh.parent.nameAr}` : '—'}
                          </TableCell>
                          <TableCell className="text-slate-500">{wh.location || '—'}</TableCell>
                          <TableCell className="text-slate-500">{wh.manager || '—'}</TableCell>
                          <TableCell>
                            {wh.isActive ? (
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
                                onClick={() => handleOpenEdit(wh)}
                                className="h-8 w-8 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50"
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleOpenDelete(wh.id)}
                                className="h-8 w-8 text-slate-500 hover:text-red-600 hover:bg-red-50"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      )
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Add/Edit Dialog ── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId ? 'تعديل الموقع' : 'إضافة موقع جديد'}</DialogTitle>
            <DialogDescription>
              {editingId ? 'قم بتعديل بيانات الموقع' : 'أدخل بيانات الموقع الجديد'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="wh-code">
                الكود <span className="text-red-500">*</span>
              </Label>
              <Input
                id="wh-code"
                value={formData.code}
                onChange={(e) => setFormData((p) => ({ ...p, code: e.target.value }))}
                placeholder="WH-001"
                dir="ltr"
                className="text-left"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="wh-type">
                النوع <span className="text-red-500">*</span>
              </Label>
              <Select
                value={formData.type}
                onValueChange={(value) => setFormData((p) => ({ ...p, type: value, parentId: '' }))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="اختر النوع" />
                </SelectTrigger>
                <SelectContent>
                  {WAREHOUSE_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      <div className="flex items-center gap-2">
                        {(() => {
                          const Icon = TYPE_ICON_MAP[t.value]
                          return Icon ? <Icon className="h-3.5 w-3.5" /> : null
                        })()}
                        {t.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="wh-nameAr">الاسم عربي</Label>
              <Input
                id="wh-nameAr"
                value={formData.nameAr}
                onChange={(e) => setFormData((p) => ({ ...p, nameAr: e.target.value }))}
                placeholder="المخزن الرئيسي"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="wh-nameEn">الاسم إنجليزي</Label>
              <Input
                id="wh-nameEn"
                value={formData.nameEn}
                onChange={(e) => setFormData((p) => ({ ...p, nameEn: e.target.value }))}
                placeholder="Main Warehouse"
                dir="ltr"
                className="text-left"
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="wh-parent">الموقع الأب</Label>
              <Select
                value={formData.parentId}
                onValueChange={(value) => setFormData((p) => ({ ...p, parentId: value }))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="— بدون أب (مخزن رئيسي) —" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— بدون أب (مخزن رئيسي) —</SelectItem>
                  {potentialParents.map((wh) => {
                    const Icon = TYPE_ICON_MAP[wh.type] || Building2
                    return (
                      <SelectItem key={wh.id} value={wh.id}>
                        <div className="flex items-center gap-2">
                          <Icon className="h-3.5 w-3.5" />
                          <span className="font-mono text-xs">{wh.code}</span>
                          <span>{wh.nameAr}</span>
                          <span className="text-xs text-slate-400">({getTypeLabel(wh.type)})</span>
                        </div>
                      </SelectItem>
                    )
                  })}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="wh-location">الموقع</Label>
              <Input
                id="wh-location"
                value={formData.location}
                onChange={(e) => setFormData((p) => ({ ...p, location: e.target.value }))}
                placeholder="الرياض - المنطقة الصناعية"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="wh-manager">المسؤول</Label>
              <Input
                id="wh-manager"
                value={formData.manager}
                onChange={(e) => setFormData((p) => ({ ...p, manager: e.target.value }))}
                placeholder="أحمد محمد"
              />
            </div>
            <div className="flex items-center gap-2 pt-4 sm:col-span-2">
              <Switch
                checked={formData.isActive}
                onCheckedChange={(checked) =>
                  setFormData((p) => ({ ...p, isActive: checked }))
                }
              />
              <Label className="text-sm">نشط</Label>
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

      {/* ── Delete Confirmation ── */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>تأكيد الحذف</AlertDialogTitle>
            <AlertDialogDescription>
              هل أنت متأكد من حذف هذا الموقع؟ لا يمكن التراجع عن هذا الإجراء.
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

      {/* ── Import Dialog ── */}
      <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>استيراد المخازن من Excel</DialogTitle>
            <DialogDescription>
              قم برفع ملف Excel يحتوي على بيانات المخازن والمواقع
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* Template Download */}
            <div className="flex items-center gap-3 p-3 bg-emerald-50 rounded-lg border border-emerald-200">
              <FileSpreadsheet className="h-8 w-8 text-emerald-600 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-emerald-800">تحميل قالب Excel</p>
                <p className="text-xs text-emerald-600">حمّل القالب واملأ البيانات ثم ارفعه</p>
              </div>
              <a href="/api/inventory/warehouses/template" download>
                <Button variant="outline" size="sm" className="gap-1.5 text-xs h-7 border-emerald-300 text-emerald-700 hover:bg-emerald-100">
                  <Download className="h-3.5 w-3.5" />
                  تحميل
                </Button>
              </a>
            </div>

            {/* File Upload */}
            <div className="space-y-2">
              <Label>ملف Excel</Label>
              <div className="border-2 border-dashed border-slate-200 rounded-lg p-6 text-center">
                {importFile ? (
                  <div className="flex items-center justify-center gap-3">
                    <FileSpreadsheet className="h-8 w-8 text-emerald-500" />
                    <div className="text-right">
                      <p className="text-sm font-medium">{importFile.name}</p>
                      <p className="text-xs text-slate-400">
                        {(importFile.size / 1024).toFixed(1)} KB
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-red-500 hover:text-red-700 hover:bg-red-50 h-8"
                      onClick={() => setImportFile(null)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <label className="cursor-pointer">
                    <Upload className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                    <p className="text-sm text-slate-500">اضغط لاختيار ملف Excel</p>
                    <p className="text-xs text-slate-400 mt-1">.xlsx, .xls</p>
                    <input
                      type="file"
                      accept=".xlsx,.xls"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (file) setImportFile(file)
                      }}
                    />
                  </label>
                )}
              </div>
            </div>

            {/* Import Result */}
            {importResult && (
              <div className={cn(
                'p-3 rounded-lg border text-sm',
                importResult.errorCount === 0
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  : 'bg-amber-50 border-amber-200 text-amber-800'
              )}>
                <div className="flex items-center gap-4 mb-1">
                  <span>✅ نجاح: {importResult.successCount}</span>
                  <span>❌ أخطاء: {importResult.errorCount}</span>
                  <span>إجمالي: {importResult.totalRows}</span>
                </div>
                {importResult.errors.length > 0 && (
                  <div className="mt-2 max-h-32 overflow-y-auto text-xs space-y-0.5">
                    {importResult.errors.map((err, i) => (
                      <p key={i} className="text-amber-700">{err}</p>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Template columns info */}
            <div className="text-xs text-slate-400 border-t pt-3">
              <p className="font-medium text-slate-500 mb-1">أعمدة القالب:</p>
              <p dir="ltr" className="font-mono">
                code, nameAr, nameEn, type, parentCode, location, manager
              </p>
              <p className="mt-1">الأنواع: WAREHOUSE, ZONE, RACK, SHELF, BOX</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setImportDialogOpen(false)}>
              إغلاق
            </Button>
            <Button
              onClick={handleImport}
              disabled={importing || !importFile}
              className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
            >
              {importing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  جاري الاستيراد...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4" />
                  استيراد
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
