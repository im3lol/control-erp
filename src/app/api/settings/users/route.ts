import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

// Simple base64 hash for password (placeholder for real hashing)
function hashPassword(password: string): string {
  return Buffer.from(password).toString('base64')
}

// GET /api/settings/users - List all users (exclude password)
export async function GET() {
  try {
    const users = await db.user.findMany({
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        username: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    return NextResponse.json(users)
  } catch (error) {
    console.error('Get users error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch users' },
      { status: 500 }
    )
  }
}

// POST /api/settings/users - Create new user
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { username, name, email, password, role, isActive } = body

    if (!username || !name || !password) {
      return NextResponse.json(
        { error: 'username, name, and password are required' },
        { status: 400 }
      )
    }

    // Check if username already exists
    const existing = await db.user.findUnique({ where: { username } })
    if (existing) {
      return NextResponse.json(
        { error: `User with username "${username}" already exists` },
        { status: 409 }
      )
    }

    const user = await db.user.create({
      data: {
        username,
        name,
        email: email ?? null,
        password: hashPassword(password),
        role: role ?? 'viewer',
        isActive: isActive ?? true,
      },
      select: {
        id: true,
        username: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    return NextResponse.json(user, { status: 201 })
  } catch (error) {
    console.error('Create user error:', error)
    return NextResponse.json(
      { error: 'Failed to create user' },
      { status: 500 }
    )
  }
}

// PUT /api/settings/users - Update user
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, username, name, email, password, role, isActive } = body

    if (!id) {
      return NextResponse.json(
        { error: 'id is required' },
        { status: 400 }
      )
    }

    const existing = await db.user.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    // If username is being changed, check for duplicates
    if (username && username !== existing.username) {
      const duplicate = await db.user.findUnique({ where: { username } })
      if (duplicate) {
        return NextResponse.json(
          { error: `User with username "${username}" already exists` },
          { status: 409 }
        )
      }
    }

    const user = await db.user.update({
      where: { id },
      data: {
        ...(username !== undefined && { username }),
        ...(name !== undefined && { name }),
        ...(email !== undefined && { email }),
        ...(password !== undefined && { password: hashPassword(password) }),
        ...(role !== undefined && { role }),
        ...(isActive !== undefined && { isActive }),
      },
      select: {
        id: true,
        username: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    return NextResponse.json(user)
  } catch (error) {
    console.error('Update user error:', error)
    return NextResponse.json(
      { error: 'Failed to update user' },
      { status: 500 }
    )
  }
}

// DELETE /api/settings/users - Delete user
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json()
    const { id } = body

    if (!id) {
      return NextResponse.json(
        { error: 'id is required' },
        { status: 400 }
      )
    }

    const existing = await db.user.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    if (existing.role === 'admin') {
      // Check if this is the last admin
      const adminCount = await db.user.count({ where: { role: 'admin' } })
      if (adminCount <= 1) {
        return NextResponse.json(
          { error: 'Cannot delete the last admin user' },
          { status: 400 }
        )
      }
    }

    await db.user.delete({ where: { id } })

    return NextResponse.json({ message: 'User deleted successfully' })
  } catch (error) {
    console.error('Delete user error:', error)
    return NextResponse.json(
      { error: 'Failed to delete user' },
      { status: 500 }
    )
  }
}
