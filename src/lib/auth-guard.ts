import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { hasPermission } from '@/lib/permissions'
import type { Permission } from '@/lib/permissions'
import { db } from '@/lib/db'
import { NextRequest } from 'next/server'

export interface AuthUser {
  id: string
  name: string | null
  username: string
  role: string
  companyId: string | null
  companyRole: string | null
}

/**
 * Get the current authenticated user, checking both:
 * 1. NextAuth session (cookie-based)
 * 2. Access token (header-based, for proxy environments where cookies don't work)
 */
export async function getCurrentUser(request?: NextRequest): Promise<AuthUser | null> {
  // Method 1: Try NextAuth session
  try {
    const session = await getServerSession(authOptions)
    if (session?.user) {
      return {
        id: (session.user as any).id,
        name: session.user.name,
        username: (session.user as any).username,
        role: (session.user as any).role,
        companyId: (session.user as any).companyId,
        companyRole: (session.user as any).companyRole,
      }
    }
  } catch (e) {
    // Session lookup failed, try token
  }

  // Method 2: Try access token from header
  if (request) {
    const authHeader = request.headers.get('Authorization')
    const token = authHeader?.replace('Bearer ', '') || request.headers.get('X-Auth-Token')

    if (token) {
      const accessToken = await db.accessToken.findUnique({
        where: { token },
        include: {
          user: {
            include: {
              companyUsers: {
                where: { isActive: true },
                select: { companyId: true, role: true },
                take: 1,
              },
            },
          },
        },
      })

      if (accessToken && accessToken.expiresAt > new Date() && accessToken.user.isActive) {
        const user = accessToken.user
        const primaryCompany = user.companyUsers[0]
        return {
          id: user.id,
          name: user.name,
          username: user.username,
          role: user.role,
          companyId: primaryCompany?.companyId || null,
          companyRole: primaryCompany?.role || null,
        }
      }
    }
  }

  return null
}

export async function requireAuth(request?: NextRequest): Promise<AuthUser> {
  const user = await getCurrentUser(request)
  if (!user) {
    // Dev mode: auto-login as admin when no auth is present
    // This allows the app to work without login during development
    const adminUser = await db.user.findUnique({
      where: { username: 'admin' },
      include: {
        companyUsers: {
          where: { isActive: true },
          select: { companyId: true, role: true },
          take: 1,
        },
      },
    })
    if (adminUser) {
      const primaryCompany = adminUser.companyUsers[0]
      return {
        id: adminUser.id,
        name: adminUser.name,
        username: adminUser.username,
        role: adminUser.role,
        companyId: primaryCompany?.companyId || null,
        companyRole: primaryCompany?.role || null,
      }
    }
    throw new Error('غير مصرح بالدخول')
  }
  return user
}

export async function requirePermission(permission: Permission, request?: NextRequest): Promise<AuthUser> {
  const user = await requireAuth(request)
  if (!hasPermission(user.role, permission)) {
    throw new Error('ليس لديك صلاحية لهذا الإجراء')
  }
  return user
}

export async function requireAdmin(request?: NextRequest): Promise<AuthUser> {
  const user = await requireAuth(request)
  if (user.role !== 'super_admin' && user.role !== 'admin') {
    throw new Error('هذا الإجراء يتطلب صلاحيات المسؤول')
  }
  return user
}

/**
 * Check if a user with a given creator role can assign a specific target role.
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
