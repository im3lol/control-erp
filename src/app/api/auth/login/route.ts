import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { randomUUID } from 'crypto'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { username, password } = body

    if (!username || !password) {
      return NextResponse.json(
        { error: 'يرجى إدخال اسم المستخدم وكلمة المرور' },
        { status: 400 }
      )
    }

    const user = await db.user.findUnique({
      where: { username },
    })

    if (!user) {
      return NextResponse.json(
        { error: 'اسم المستخدم أو كلمة المرور غير صحيحة' },
        { status: 401 }
      )
    }

    if (!user.isActive) {
      return NextResponse.json(
        { error: 'هذا الحساب معطل. تواصل مع المسؤول' },
        { status: 403 }
      )
    }

    // Verify password (base64 encoded)
    const encodedPassword = Buffer.from(password).toString('base64')
    if (user.password !== encodedPassword) {
      return NextResponse.json(
        { error: 'اسم المستخدم أو كلمة المرور غير صحيحة' },
        { status: 401 }
      )
    }

    // Get user's companies
    const companyUsers = await db.companyUser.findMany({
      where: { userId: user.id, isActive: true },
      select: {
        companyId: true,
        role: true,
        company: {
          select: { id: true, nameAr: true, nameEn: true },
        },
      },
    })

    const companies = companyUsers.map((cu) => ({
      id: cu.company.id,
      nameAr: cu.company.nameAr,
      nameEn: cu.company.nameEn,
      role: cu.role,
    }))

    const primaryCompany = companyUsers[0]

    // Clean up expired tokens for this user
    await db.accessToken.deleteMany({
      where: {
        userId: user.id,
        expiresAt: { lt: new Date() },
      },
    })

    // Generate a new access token (valid for 24 hours)
    const token = randomUUID()
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000)
    await db.accessToken.create({
      data: {
        userId: user.id,
        token,
        expiresAt,
      },
    })

    return NextResponse.json({
      user: {
        id: user.id,
        name: user.name,
        username: user.username,
        email: user.email,
        role: user.role,
        companyId: primaryCompany?.companyId || null,
        companyRole: primaryCompany?.role || null,
      },
      companies,
      token,
    })
  } catch (error) {
    console.error('Login error:', error)
    const message = error instanceof Error ? error.message : 'حدث خطأ غير متوقع'
    return NextResponse.json(
      { error: message },
      { status: 500 }
    )
  }
}
