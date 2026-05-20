'use client'

import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { Plus, Pencil, Trash2, UserCog, Loader2, Shield, ShieldCheck, ShieldAlert, Lock, Info } from 'lucide-react'
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { useAppStore } from '@/lib/store'
import { getRoleLabel } from '@/lib/erp-utils'
import { rolePermissions, roleLabels, type Permission, hasPermission, canCreateUsers } from '@/lib/permissions'

interface User {
  id: string
  username: string
  name: string
  email: string
  role: string
  isActive: boolean
  companyRole?: string
}

interface UserFormData {
  username: string
  name: string
  email: string
  password: string
  role: string
  companyRole: string
  isActive: boolean
}

const initialFormData: UserFormData = {
  username: '',
  name: '',
  email: '',
  password: '',
  role: 'viewer',
  companyRole: 'viewer',
  isActive: true,
}

const allRoles = ['super_admin', 'admin', 'accountant', 'sales', 'purchase', 'inventory', 'viewer']

function getRoleBadgeColor(role: string): string {
  const colors: Record<string, string> = {
    super_admin: 'bg-amber-50 text-amber-700 border-amber-200',
    admin: 'bg-red-50 text-red-700 border-red-200',
    accountant: 'bg-teal-50 text-teal-700 border-teal-200',
    sales: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    purchase: 'bg-orange-50 text-orange-700 border-orange-200',
    inventory: 'bg-purple-50 text-purple-700 border-purple-200',
    viewer: 'bg-slate-100 text-slate-600 border-slate-200',
  }
  return colors[role] || 'bg-slate-100 text-slate-600 border-slate-200'
}

function getRoleIcon(role: string) {
  if (role === 'super_admin') return ShieldAlert
  if (role === 'admin') return ShieldCheck
  return Shield
}

// Permission group labels for display
const permissionGroups: { key: string; label: string; permissions: Permission[] }[] = [
  { key: 'settings', label: 'الإعدادات', permissions: ['settings.view', 'settings.edit'] },
  { key: 'inventory', label: 'المخازن', permissions: ['inventory.view', 'inventory.create', 'inventory.edit', 'inventory.delete'] },
  { key: 'accounting', label: 'الحسابات', permissions: ['accounting.view', 'accounting.create', 'accounting.post', 'accounting.reverse'] },
  { key: 'sales', label: 'المبيعات', permissions: ['sales.view', 'sales.create', 'sales.edit', 'sales.confirm', 'sales.collect'] },
  { key: 'purchases', label: 'المشتريات', permissions: ['purchases.view', 'purchases.create', 'purchases.edit', 'purchases.confirm', 'purchases.pay'] },
  { key: 'reports', label: 'التقارير', permissions: ['reports.view'] },
  { key: 'investors', label: 'المستثمرون', permissions: ['investors.view', 'investors.create', 'investors.manage'] },
  { key: 'users', label: 'المستخدمين', permissions: ['users.view', 'users.create', 'users.edit', 'users.delete'] },
  { key: 'companies', label: 'الشركات', permissions: ['companies.manage'] },
]

// Role description tooltips
const roleDescriptions: Record<string, string> = {
  super_admin: 'مدير أعلى - صلاحيات كاملة على جميع الوحدات وإدارة الشركات',
  admin: 'مدير - صلاحيات كاملة بدون إدارة الشركات، يمكنه إنشاء مستخدمين بأدوار محدودة',
  accountant: 'محاسب - عرض وإنشاء قيود يومية، عرض المبيعات والمشتريات، إدارة المستثمرين',
  sales: 'بائع - عرض وإنشاء فواتير البيع والعملاء',
  purchase: 'مسؤول مشتريات - عرض وإنشاء فواتير الشراء والموردين',
  inventory: 'أمين مخزن - إدارة كاملة للأصناف والمخازن والفئات',
  viewer: 'مشاهد - عرض فقط لجميع الوحدات بدون إنشاء أو تعديل',
}

/**
 * Get the list of roles a creator can assign based on their role.
 * - super_admin can assign any role
 * - admin can assign: accountant, sales, purchase, inventory, viewer
 * - Other roles cannot create users at all
 */
function getAssignableRoles(creatorRole: string): string[] {
  if (creatorRole === 'super_admin') {
    return allRoles
  }
  if (creatorRole === 'admin') {
    return ['accountant', 'sales', 'purchase', 'inventory', 'viewer']
  }
  return []
}

export default function UsersList() {
  const companyId = useAppStore(state => state.currentCompanyId)
  const currentUser = useAppStore(state => state.user)
  const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'super_admin'
  const canCreate = canCreateUsers(currentUser?.role || 'viewer')
  const assignableRoles = getAssignableRoles(currentUser?.role || 'viewer')
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [permissionsDialogOpen, setPermissionsDialogOpen] = useState(false)
  const [selectedRole, setSelectedRole] = useState('viewer')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [formData, setFormData] = useState<UserFormData>(initialFormData)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!companyId) return
    fetchUsers()
  }, [companyId])

  const fetchUsers = async () => {
    try {
      const res = await fetch(`/api/settings/users?companyId=${companyId}`)
      if (res.ok) {
        const data = await res.json()
        setUsers(data)
      } else if (res.status === 403) {
        // User doesn't have permission to view users
        setUsers([])
      }
    } catch {
      toast.error('فشل في تحميل المستخدمين')
    } finally {
      setLoading(false)
    }
  }

  const handleOpenAdd = () => {
    if (!canCreate) {
      toast.error('ليس لديك صلاحية لإضافة مستخدمين')
      return
    }
    setEditingId(null)
    setFormData({ ...initialFormData, role: assignableRoles[0] || 'viewer', companyRole: assignableRoles[0] || 'viewer' })
    setDialogOpen(true)
  }

  const handleOpenEdit = (user: User) => {
    setEditingId(user.id)
    setFormData({
      username: user.username,
      name: user.name,
      email: user.email,
      password: '',
      role: user.role,
      companyRole: user.companyRole || user.role,
      isActive: user.isActive,
    })
    setDialogOpen(true)
  }

  const handleOpenDelete = (id: string) => {
    setDeletingId(id)
    setDeleteDialogOpen(true)
  }

  const handleShowPermissions = (role: string) => {
    setSelectedRole(role)
    setPermissionsDialogOpen(true)
  }

  const handleSubmit = async () => {
    if (!formData.username.trim() || !formData.name.trim() || !formData.role) {
      toast.error('يرجى ملء الحقول المطلوبة')
      return
    }
    if (!editingId && !formData.password.trim()) {
      toast.error('يرجى إدخال كلمة المرور للمستخدم الجديد')
      return
    }

    // Client-side role assignment check
    if (!editingId && !assignableRoles.includes(formData.role)) {
      toast.error('ليس لديك صلاحية لتعيين هذا الدور')
      return
    }

    setSubmitting(true)
    try {
      const payload = { ...formData, id: editingId }
      if (editingId && !payload.password) {
        delete (payload as Partial<typeof payload>).password
      }

      const url = '/api/settings/users'
      const method = editingId ? 'PUT' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payload, companyId }),
      })

      if (res.ok) {
        toast.success(editingId ? 'تم تحديث المستخدم بنجاح' : 'تم إضافة المستخدم بنجاح')
        setDialogOpen(false)
        fetchUsers()
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
      const res = await fetch('/api/settings/users', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: deletingId, companyId }),
      })
      if (res.ok) {
        toast.success('تم حذف المستخدم بنجاح')
        fetchUsers()
      } else {
        const err = await res.json()
        toast.error(err.error || 'فشل في حذف المستخدم')
      }
    } catch {
      toast.error('حدث خطأ أثناء الحذف')
    } finally {
      setDeleteDialogOpen(false)
      setDeletingId(null)
    }
  }

  if (loading) {
    return (
      <Card className="border shadow-sm">
        <CardHeader>
          <div className="flex items-center justify-between">
            <Skeleton className="h-7 w-36" />
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

  // Non-admin: show restricted message
  if (!isAdmin) {
    return (
      <TooltipProvider>
        <Card className="border shadow-sm">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-emerald-50 flex items-center justify-center">
                <UserCog className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <CardTitle className="text-lg">المستخدمين والصلاحيات</CardTitle>
                <p className="text-xs text-slate-400 mt-0.5">
                  عرض بيانات المستخدمين
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center justify-center py-12 text-slate-400">
              <Lock className="h-16 w-16 mb-4 text-slate-200" />
              <p className="text-base font-medium text-slate-500">صلاحيات محدودة</p>
              <p className="text-sm mt-1 text-slate-400 max-w-md text-center">
                دورك الحالي ({roleLabels[currentUser?.role || 'viewer']}) يسمح لك بعرض بيانات المستخدمين فقط.
                لإضافة أو تعديل أو حذف المستخدمين، تحتاج إلى صلاحيات المدير.
              </p>
            </div>
            {/* Show users list in read-only mode */}
            {users.length > 0 && (
              <div className="max-h-[calc(100vh-500px)] overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50/80 hover:bg-slate-50/80">
                      <TableHead className="text-right font-semibold">اسم المستخدم</TableHead>
                      <TableHead className="text-right font-semibold">الاسم</TableHead>
                      <TableHead className="text-right font-semibold">الدور</TableHead>
                      <TableHead className="text-right font-semibold">الصلاحيات</TableHead>
                      <TableHead className="text-right font-semibold">الحالة</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map((user) => {
                      const RoleIcon = getRoleIcon(user.role)
                      return (
                        <TableRow key={user.id}>
                          <TableCell className="font-mono text-sm">{user.username}</TableCell>
                          <TableCell className="font-medium">{user.name}</TableCell>
                          <TableCell>
                            <Badge className={getRoleBadgeColor(user.role)}>
                              <RoleIcon className="h-3 w-3 ml-1" />
                              {getRoleLabel(user.role)}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="gap-1 text-xs text-slate-500 hover:text-emerald-600"
                                  onClick={() => handleShowPermissions(user.role)}
                                >
                                  <Lock className="h-3 w-3" />
                                  {(rolePermissions[user.role] || []).length} صلاحية
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>اضغط لعرض الصلاحيات</p>
                              </TooltipContent>
                            </Tooltip>
                          </TableCell>
                          <TableCell>
                            {user.isActive ? (
                              <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200">
                                نشط
                              </Badge>
                            ) : (
                              <Badge variant="secondary" className="bg-slate-100 text-slate-500">
                                غير نشط
                              </Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Permissions Viewer Dialog */}
        <Dialog open={permissionsDialogOpen} onOpenChange={setPermissionsDialogOpen}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-emerald-600" />
                صلاحيات: {getRoleLabel(selectedRole)}
              </DialogTitle>
              <DialogDescription>
                الصلاحيات الممنوحة لهذا الدور في النظام
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-2 max-h-[60vh] overflow-y-auto">
              {permissionGroups.map((group) => {
                const rolePerms = rolePermissions[selectedRole] || []
                const hasAny = group.permissions.some(p => rolePerms.includes(p))
                return (
                  <div key={group.key} className="border rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-semibold text-slate-700">{group.label}</span>
                      {hasAny ? (
                        <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-xs">
                          مسموح
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="text-xs">
                          ممنوع
                        </Badge>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {group.permissions.map((perm) => {
                        const allowed = rolePerms.includes(perm)
                        return (
                          <Badge
                            key={perm}
                            variant="outline"
                            className={`text-[10px] py-0.5 px-1.5 ${
                              allowed
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : 'bg-slate-50 text-slate-400 border-slate-200 line-through'
                            }`}
                          >
                            {perm.split('.').pop()}
                          </Badge>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setPermissionsDialogOpen(false)}>
                إغلاق
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </TooltipProvider>
    )
  }

  return (
    <TooltipProvider>
      <Card className="border shadow-sm">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-emerald-50 flex items-center justify-center">
                <UserCog className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <CardTitle className="text-lg">المستخدمين والصلاحيات</CardTitle>
                <p className="text-xs text-slate-400 mt-0.5">
                  إدارة المستخدمين وصلاحيات الوصول
                </p>
              </div>
            </div>
            {canCreate && (
              <Button
                onClick={handleOpenAdd}
                className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
              >
                <Plus className="h-4 w-4" />
                إضافة مستخدم
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="px-0">
          <div className="max-h-[calc(100vh-320px)] overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50/80 hover:bg-slate-50/80">
                  <TableHead className="text-right font-semibold">اسم المستخدم</TableHead>
                  <TableHead className="text-right font-semibold">الاسم</TableHead>
                  <TableHead className="text-right font-semibold">البريد</TableHead>
                  <TableHead className="text-right font-semibold">الدور</TableHead>
                  <TableHead className="text-right font-semibold">الصلاحيات</TableHead>
                  <TableHead className="text-right font-semibold">الحالة</TableHead>
                  {isAdmin && <TableHead className="text-right font-semibold">إجراءات</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={isAdmin ? 7 : 6} className="text-center py-12">
                      <div className="flex flex-col items-center text-slate-400">
                        <UserCog className="h-12 w-12 mb-3 text-slate-200" />
                        <p className="text-sm">لا يوجد مستخدمين مسجلين</p>
                        <p className="text-xs mt-1 text-slate-300">
                          اضغط على &quot;إضافة مستخدم&quot; لإضافة مستخدم جديد
                        </p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  users.map((user) => {
                    const RoleIcon = getRoleIcon(user.role)
                    return (
                      <TableRow key={user.id}>
                        <TableCell className="font-mono text-sm">{user.username}</TableCell>
                        <TableCell className="font-medium">{user.name}</TableCell>
                        <TableCell className="text-slate-500" dir="ltr">{user.email || '—'}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Badge className={getRoleBadgeColor(user.role)}>
                              <RoleIcon className="h-3 w-3 ml-1" />
                              {getRoleLabel(user.role)}
                            </Badge>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button
                                  className="text-slate-400 hover:text-emerald-600 transition-colors"
                                  onClick={() => handleShowPermissions(user.role)}
                                >
                                  <Info className="h-3.5 w-3.5" />
                                </button>
                              </TooltipTrigger>
                              <TooltipContent side="bottom" className="max-w-xs">
                                <p className="text-xs font-medium mb-1">{getRoleLabel(user.role)}</p>
                                <p className="text-xs text-slate-400">{roleDescriptions[user.role]}</p>
                                <p className="text-xs text-slate-400 mt-1">{(rolePermissions[user.role] || []).length} صلاحية - اضغط لعرض التفاصيل</p>
                              </TooltipContent>
                            </Tooltip>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="gap-1 text-xs text-slate-500 hover:text-emerald-600"
                                onClick={() => handleShowPermissions(user.role)}
                              >
                                <Lock className="h-3 w-3" />
                                {(rolePermissions[user.role] || []).length} صلاحية
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>اضغط لعرض الصلاحيات</p>
                            </TooltipContent>
                          </Tooltip>
                        </TableCell>
                        <TableCell>
                          {user.isActive ? (
                            <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200">
                              نشط
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="bg-slate-100 text-slate-500">
                              غير نشط
                            </Badge>
                          )}
                        </TableCell>
                        {isAdmin && (
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleOpenEdit(user)}
                                className="h-8 w-8 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50"
                                disabled={user.role === 'super_admin' && currentUser?.role !== 'super_admin'}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleOpenDelete(user.id)}
                                className="h-8 w-8 text-slate-500 hover:text-red-600 hover:bg-red-50"
                                disabled={user.role === 'super_admin' || user.id === currentUser?.id}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        )}
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId ? 'تعديل المستخدم' : 'إضافة مستخدم جديد'}</DialogTitle>
            <DialogDescription>
              {editingId ? 'قم بتعديل بيانات المستخدم' : 'أدخل بيانات المستخدم الجديد'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="user-username">
                اسم المستخدم <span className="text-red-500">*</span>
              </Label>
              <Input
                id="user-username"
                value={formData.username}
                onChange={(e) => setFormData((p) => ({ ...p, username: e.target.value }))}
                placeholder="admin"
                dir="ltr"
                className="text-left"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="user-name">
                الاسم <span className="text-red-500">*</span>
              </Label>
              <Input
                id="user-name"
                value={formData.name}
                onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
                placeholder="مدير النظام"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="user-email">البريد الإلكتروني</Label>
              <Input
                id="user-email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData((p) => ({ ...p, email: e.target.value }))}
                placeholder="user@ctrlerp.cloud"
                dir="ltr"
                className="text-left"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="user-role">
                الدور <span className="text-red-500">*</span>
              </Label>
              <Select
                value={formData.role}
                onValueChange={(value) => setFormData((p) => ({ ...p, role: value, companyRole: value }))}
              >
                <SelectTrigger id="user-role" className="w-full">
                  <SelectValue placeholder="اختر الدور" />
                </SelectTrigger>
                <SelectContent>
                  {assignableRoles
                    .map((role) => (
                      <SelectItem key={role} value={role}>
                        <div className="flex items-center gap-2">
                          {getRoleLabel(role)}
                          <span className="text-xs text-slate-400">({(rolePermissions[role] || []).length} صلاحية)</span>
                        </div>
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              {formData.role && (
                <p className="text-[10px] text-slate-400 leading-relaxed">
                  {roleDescriptions[formData.role]}
                </p>
              )}
            </div>
            {/* Password field - only shown when creating new user */}
            {!editingId && (
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="user-password">
                  كلمة المرور <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="user-password"
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData((p) => ({ ...p, password: e.target.value }))}
                  placeholder="أدخل كلمة المرور"
                  dir="ltr"
                  className="text-left"
                />
              </div>
            )}
            {editingId && (
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="user-password-edit">كلمة المرور الجديدة (اختياري)</Label>
                <Input
                  id="user-password-edit"
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData((p) => ({ ...p, password: e.target.value }))}
                  placeholder="اتركه فارغاً إذا لم تريد التغيير"
                  dir="ltr"
                  className="text-left"
                />
              </div>
            )}

            {/* Role permissions preview */}
            <div className="sm:col-span-2 border rounded-lg p-3 bg-slate-50/50">
              <p className="text-xs font-semibold text-slate-600 mb-2">صلاحيات الدور المختار:</p>
              <div className="flex flex-wrap gap-1.5">
                {(rolePermissions[formData.role] || []).map((perm) => (
                  <Badge key={perm} variant="outline" className="text-[10px] py-0 px-1.5 bg-white">
                    {perm}
                  </Badge>
                ))}
                {(!rolePermissions[formData.role] || rolePermissions[formData.role].length === 0) && (
                  <span className="text-xs text-slate-400">لا توجد صلاحيات</span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 sm:col-span-2 pt-2">
              <Switch
                checked={formData.isActive}
                onCheckedChange={(checked) =>
                  setFormData((p) => ({ ...p, isActive: checked }))
                }
              />
              <Label className="text-sm">مستخدم نشط</Label>
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

      {/* Permissions Viewer Dialog */}
      <Dialog open={permissionsDialogOpen} onOpenChange={setPermissionsDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-emerald-600" />
              صلاحيات: {getRoleLabel(selectedRole)}
            </DialogTitle>
            <DialogDescription>
              {roleDescriptions[selectedRole] || 'الصلاحيات الممنوحة لهذا الدور في النظام'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2 max-h-[60vh] overflow-y-auto">
            {permissionGroups.map((group) => {
              const rolePerms = rolePermissions[selectedRole] || []
              const hasAny = group.permissions.some(p => rolePerms.includes(p))
              return (
                <div key={group.key} className="border rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-semibold text-slate-700">{group.label}</span>
                    {hasAny ? (
                      <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-xs">
                        مسموح
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="text-xs">
                        ممنوع
                      </Badge>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {group.permissions.map((perm) => {
                      const allowed = rolePerms.includes(perm)
                      return (
                        <Badge
                          key={perm}
                          variant="outline"
                          className={`text-[10px] py-0.5 px-1.5 ${
                            allowed
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : 'bg-slate-50 text-slate-400 border-slate-200 line-through'
                          }`}
                        >
                          {perm.split('.').pop()}
                        </Badge>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPermissionsDialogOpen(false)}>
              إغلاق
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>تأكيد الحذف</AlertDialogTitle>
            <AlertDialogDescription>
              هل أنت متأكد من حذف هذا المستخدم؟ لا يمكن التراجع عن هذا الإجراء.
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
    </TooltipProvider>
  )
}
