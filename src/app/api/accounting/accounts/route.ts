import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

// GET /api/accounting/accounts - List all accounts for a company
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const companyId = searchParams.get('companyId')
    if (!companyId) {
      return NextResponse.json({ error: 'companyId is required' }, { status: 400 })
    }

    const accounts = await db.account.findMany({
      where: { companyId },
      orderBy: { code: 'asc' },
      include: {
        parent: {
          select: {
            id: true,
            code: true,
            nameAr: true,
            nameEn: true,
          },
        },
      },
    })

    return NextResponse.json(accounts)
  } catch (error) {
    console.error('Get accounts error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch accounts' },
      { status: 500 }
    )
  }
}

// POST /api/accounting/accounts - Create new account
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { companyId, code, nameAr, nameEn, type, parentId, isLeaf, isActive } = body

    if (!companyId) {
      return NextResponse.json({ error: 'companyId is required' }, { status: 400 })
    }

    if (!code || !nameAr || !type) {
      return NextResponse.json(
        { error: 'code, nameAr, and type are required' },
        { status: 400 }
      )
    }

    // Validate account type
    const validTypes = ['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE']
    if (!validTypes.includes(type)) {
      return NextResponse.json(
        { error: `Invalid account type. Must be one of: ${validTypes.join(', ')}` },
        { status: 400 }
      )
    }

    // Check if account code already exists within the company
    const existing = await db.account.findUnique({
      where: { companyId_code: { companyId, code } },
    })
    if (existing) {
      return NextResponse.json(
        { error: `Account with code "${code}" already exists in this company` },
        { status: 409 }
      )
    }

    // If parentId is provided, verify it exists and belongs to the same company
    if (parentId) {
      const parent = await db.account.findUnique({ where: { id: parentId } })
      if (!parent) {
        return NextResponse.json(
          { error: 'Parent account not found' },
          { status: 404 }
        )
      }
      if (parent.companyId !== companyId) {
        return NextResponse.json(
          { error: 'Parent account does not belong to this company' },
          { status: 403 }
        )
      }
      // If parent was a leaf, update it to non-leaf
      if (parent.isLeaf) {
        await db.account.update({
          where: { id: parentId },
          data: { isLeaf: false },
        })
      }
    }

    const account = await db.account.create({
      data: {
        companyId,
        code,
        nameAr,
        nameEn: nameEn ?? null,
        type,
        parentId: parentId ?? null,
        isLeaf: isLeaf ?? true,
        isActive: isActive ?? true,
      },
      include: {
        parent: {
          select: {
            id: true,
            code: true,
            nameAr: true,
            nameEn: true,
          },
        },
      },
    })

    return NextResponse.json(account, { status: 201 })
  } catch (error) {
    console.error('Create account error:', error)
    return NextResponse.json(
      { error: 'Failed to create account' },
      { status: 500 }
    )
  }
}

// PUT /api/accounting/accounts - Update account
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { companyId, id, code, nameAr, nameEn, type, parentId, isLeaf, isActive } = body

    if (!companyId) {
      return NextResponse.json({ error: 'companyId is required' }, { status: 400 })
    }

    if (!id) {
      return NextResponse.json(
        { error: 'id is required' },
        { status: 400 }
      )
    }

    const existing = await db.account.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json(
        { error: 'Account not found' },
        { status: 404 }
      )
    }

    // Verify the account belongs to the company
    if (existing.companyId !== companyId) {
      return NextResponse.json(
        { error: 'Account does not belong to this company' },
        { status: 403 }
      )
    }

    // Validate account type if provided
    if (type) {
      const validTypes = ['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE']
      if (!validTypes.includes(type)) {
        return NextResponse.json(
          { error: `Invalid account type. Must be one of: ${validTypes.join(', ')}` },
          { status: 400 }
        )
      }
    }

    // If code is being changed, check for duplicates within company
    if (code && code !== existing.code) {
      const duplicate = await db.account.findUnique({
        where: { companyId_code: { companyId, code } },
      })
      if (duplicate) {
        return NextResponse.json(
          { error: `Account with code "${code}" already exists in this company` },
          { status: 409 }
        )
      }
    }

    // If parentId is being changed, verify it exists and no circular reference
    if (parentId !== undefined && parentId !== existing.parentId) {
      if (parentId) {
        const parent = await db.account.findUnique({ where: { id: parentId } })
        if (!parent) {
          return NextResponse.json(
            { error: 'Parent account not found' },
            { status: 404 }
          )
        }
        if (parent.companyId !== companyId) {
          return NextResponse.json(
            { error: 'Parent account does not belong to this company' },
            { status: 403 }
          )
        }
        // Prevent circular reference (account can't be its own parent)
        if (parentId === id) {
          return NextResponse.json(
            { error: 'Account cannot be its own parent' },
            { status: 400 }
          )
        }
        // If parent was a leaf, update it to non-leaf
        if (parent.isLeaf) {
          await db.account.update({
            where: { id: parentId },
            data: { isLeaf: false },
          })
        }
      }
    }

    const account = await db.account.update({
      where: { id },
      data: {
        ...(code !== undefined && { code }),
        ...(nameAr !== undefined && { nameAr }),
        ...(nameEn !== undefined && { nameEn }),
        ...(type !== undefined && { type }),
        ...(parentId !== undefined && { parentId }),
        ...(isLeaf !== undefined && { isLeaf }),
        ...(isActive !== undefined && { isActive }),
      },
      include: {
        parent: {
          select: {
            id: true,
            code: true,
            nameAr: true,
            nameEn: true,
          },
        },
      },
    })

    return NextResponse.json(account)
  } catch (error) {
    console.error('Update account error:', error)
    return NextResponse.json(
      { error: 'Failed to update account' },
      { status: 500 }
    )
  }
}
