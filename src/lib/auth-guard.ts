import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { hasPermission, getRolePermissions } from '@/lib/permissions'
import type { Permission } from '@/lib/permissions'

export interface AuthUser {
  id: string
  name: string | null
  username: string
  role: string
  companyId: string | null
  companyRole: string | null
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  const session = await getServerSession(authOptions)
  if (!session?.user) return null
  return {
    id: (session.user as any).id,
    name: session.user.name,
    username: (session.user as any).username,
    role: (session.user as any).role,
    companyId: (session.user as any).companyId,
    companyRole: (session.user as any).companyRole,
  }
}

export async function requireAuth(): Promise<AuthUser> {
  const user = await getCurrentUser()
  if (!user) {
    throw new Error('غير مصرح بالدخول')
  }
  return user
}

export async function requirePermission(permission: Permission): Promise<AuthUser> {
  const user = await requireAuth()
  if (!hasPermission(user.role, permission)) {
    throw new Error('ليس لديك صلاحية لهذا الإجراء')
  }
  return user
}

export async function requireAdmin(): Promise<AuthUser> {
  const user = await requireAuth()
  if (user.role !== 'super_admin' && user.role !== 'admin') {
    throw new Error('هذا الإجراء يتطلب صلاحيات المسؤول')
  }
  return user
}

/**
 * Check if a user with a given creator role can assign a specific target role.
 * - super_admin can assign any role
 * - admin can assign: accountant, sales, purchase, inventory, viewer
 * - Other roles cannot create users at all
 */
export function canAssignRole(creatorRole: string, targetRole: string): boolean {
  if (creatorRole === 'super_admin') return true
  if (creatorRole === 'admin') {
    return ['accountant', 'sales', 'purchase', 'inventory', 'viewer'].includes(targetRole)
  }
  return false
}

/**
 * Get the list of roles that a creator can assign based on their role.
 */
export function getAssignableRoles(creatorRole: string): string[] {
  if (creatorRole === 'super_admin') {
    return ['super_admin', 'admin', 'accountant', 'sales', 'purchase', 'inventory', 'viewer']
  }
  if (creatorRole === 'admin') {
    return ['accountant', 'sales', 'purchase', 'inventory', 'viewer']
  }
  return []
}
