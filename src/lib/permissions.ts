// ─── Permission Types ──────────────────────────────────────────────────────────

export type Permission =
  // Settings
  | 'settings.view' | 'settings.edit'
  // Inventory
  | 'inventory.view' | 'inventory.create' | 'inventory.edit' | 'inventory.delete'
  // Accounting
  | 'accounting.view' | 'accounting.create' | 'accounting.post' | 'accounting.reverse'
  // Sales
  | 'sales.view' | 'sales.create' | 'sales.edit' | 'sales.confirm' | 'sales.collect'
  // Purchases
  | 'purchases.view' | 'purchases.create' | 'purchases.edit' | 'purchases.confirm' | 'purchases.pay'
  // Reports
  | 'reports.view'
  // Investors
  | 'investors.view' | 'investors.create' | 'investors.manage'
  // Users
  | 'users.view' | 'users.create' | 'users.edit' | 'users.delete'
  // Companies
  | 'companies.manage'

// ─── All Permissions List ─────────────────────────────────────────────────────

export const allPermissions: Permission[] = [
  'settings.view', 'settings.edit',
  'inventory.view', 'inventory.create', 'inventory.edit', 'inventory.delete',
  'accounting.view', 'accounting.create', 'accounting.post', 'accounting.reverse',
  'sales.view', 'sales.create', 'sales.edit', 'sales.confirm', 'sales.collect',
  'purchases.view', 'purchases.create', 'purchases.edit', 'purchases.confirm', 'purchases.pay',
  'reports.view',
  'investors.view', 'investors.create', 'investors.manage',
  'users.view', 'users.create', 'users.edit', 'users.delete',
  'companies.manage',
]

// ─── Role-Permission Mapping ──────────────────────────────────────────────────

export const rolePermissions: Record<string, Permission[]> = {
  super_admin: [...allPermissions],

  admin: allPermissions.filter(p => p !== 'companies.manage'),

  accountant: [
    'settings.view',
    'inventory.view',
    'accounting.view', 'accounting.create', 'accounting.post', 'accounting.reverse',
    'sales.view',
    'purchases.view',
    'reports.view',
    'investors.view', 'investors.create', 'investors.manage',
    'users.view',
  ],

  sales: [
    'settings.view',
    'inventory.view',
    'sales.view', 'sales.create', 'sales.edit', 'sales.confirm', 'sales.collect',
    'reports.view',
  ],

  purchase: [
    'settings.view',
    'inventory.view',
    'purchases.view', 'purchases.create', 'purchases.edit', 'purchases.confirm', 'purchases.pay',
    'reports.view',
  ],

  inventory: [
    'settings.view',
    'inventory.view', 'inventory.create', 'inventory.edit', 'inventory.delete',
    'reports.view',
  ],

  viewer: [
    'settings.view',
    'inventory.view',
    'accounting.view',
    'sales.view',
    'purchases.view',
    'reports.view',
    'investors.view',
    'users.view',
  ],
}

// ─── Role Arabic Labels ───────────────────────────────────────────────────────

export const roleLabels: Record<string, string> = {
  super_admin: 'مدير أعلى',
  admin: 'مدير',
  accountant: 'محاسب',
  sales: 'بائع',
  purchase: 'مسؤول مشتريات',
  inventory: 'أمين مخزن',
  viewer: 'مشاهد',
}

// ─── Helper Functions ─────────────────────────────────────────────────────────

export function hasPermission(role: string, permission: Permission): boolean {
  const permissions = rolePermissions[role]
  if (!permissions) return false
  return permissions.includes(permission)
}

export function canCreateUsers(role: string): boolean {
  return role === 'admin' || role === 'super_admin'
}

export function canManageCompany(role: string): boolean {
  return role === 'super_admin'
}

export function getRolePermissions(role: string): Permission[] {
  return rolePermissions[role] || []
}

export function isValidRole(role: string): boolean {
  return role in rolePermissions
}
