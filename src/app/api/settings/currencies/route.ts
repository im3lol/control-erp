import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

// GET /api/settings/currencies - List all currencies for a company
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const companyId = searchParams.get('companyId')
    if (!companyId) {
      return NextResponse.json({ error: 'companyId is required' }, { status: 400 })
    }

    const currencies = await db.currency.findMany({
      where: { companyId },
      orderBy: [{ isBase: 'desc' }, { code: 'asc' }],
    })

    return NextResponse.json(currencies)
  } catch (error) {
    console.error('Get currencies error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch currencies' },
      { status: 500 }
    )
  }
}

// POST /api/settings/currencies - Create new currency
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { companyId, code, nameAr, nameEn, symbol, isBase, exchangeRate, isActive } = body

    if (!companyId) {
      return NextResponse.json({ error: 'companyId is required' }, { status: 400 })
    }

    if (!code || !nameAr || !nameEn || !symbol) {
      return NextResponse.json(
        { error: 'code, nameAr, nameEn, and symbol are required' },
        { status: 400 }
      )
    }

    // Check if currency code already exists within the company
    const existing = await db.currency.findUnique({
      where: { companyId_code: { companyId, code } },
    })
    if (existing) {
      return NextResponse.json(
        { error: `Currency with code "${code}" already exists in this company` },
        { status: 409 }
      )
    }

    // If setting as base, unset any existing base currency in this company
    if (isBase) {
      await db.currency.updateMany({
        where: { companyId, isBase: true },
        data: { isBase: false },
      })
    }

    const currency = await db.currency.create({
      data: {
        companyId,
        code,
        nameAr,
        nameEn,
        symbol,
        isBase: isBase ?? false,
        exchangeRate: exchangeRate ?? 1.0,
        isActive: isActive ?? true,
      },
    })

    return NextResponse.json(currency, { status: 201 })
  } catch (error) {
    console.error('Create currency error:', error)
    return NextResponse.json(
      { error: 'Failed to create currency' },
      { status: 500 }
    )
  }
}

// PUT /api/settings/currencies - Update currency
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { companyId, id, code, nameAr, nameEn, symbol, isBase, exchangeRate, isActive } = body

    if (!companyId) {
      return NextResponse.json({ error: 'companyId is required' }, { status: 400 })
    }

    if (!id) {
      return NextResponse.json(
        { error: 'id is required' },
        { status: 400 }
      )
    }

    const existing = await db.currency.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json(
        { error: 'Currency not found' },
        { status: 404 }
      )
    }

    // Verify the currency belongs to the company
    if (existing.companyId !== companyId) {
      return NextResponse.json(
        { error: 'Currency does not belong to this company' },
        { status: 403 }
      )
    }

    // If code is being changed, check for uniqueness within company
    if (code && code !== existing.code) {
      const codeExists = await db.currency.findUnique({
        where: { companyId_code: { companyId, code } },
      })
      if (codeExists) {
        return NextResponse.json(
          { error: `Currency with code "${code}" already exists in this company` },
          { status: 409 }
        )
      }
    }

    // If setting as base, unset any existing base currency in this company
    if (isBase && !existing.isBase) {
      await db.currency.updateMany({
        where: { companyId, isBase: true },
        data: { isBase: false },
      })
    }

    const currency = await db.currency.update({
      where: { id },
      data: {
        ...(code !== undefined && { code }),
        ...(nameAr !== undefined && { nameAr }),
        ...(nameEn !== undefined && { nameEn }),
        ...(symbol !== undefined && { symbol }),
        ...(isBase !== undefined && { isBase }),
        ...(exchangeRate !== undefined && { exchangeRate }),
        ...(isActive !== undefined && { isActive }),
      },
    })

    return NextResponse.json(currency)
  } catch (error) {
    console.error('Update currency error:', error)
    return NextResponse.json(
      { error: 'Failed to update currency' },
      { status: 500 }
    )
  }
}

// DELETE /api/settings/currencies - Delete currency
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json()
    const { companyId, id } = body

    if (!companyId) {
      return NextResponse.json({ error: 'companyId is required' }, { status: 400 })
    }

    if (!id) {
      return NextResponse.json(
        { error: 'id is required' },
        { status: 400 }
      )
    }

    const existing = await db.currency.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json(
        { error: 'Currency not found' },
        { status: 404 }
      )
    }

    // Verify the currency belongs to the company
    if (existing.companyId !== companyId) {
      return NextResponse.json(
        { error: 'Currency does not belong to this company' },
        { status: 403 }
      )
    }

    if (existing.isBase) {
      return NextResponse.json(
        { error: 'Cannot delete the base currency' },
        { status: 400 }
      )
    }

    await db.currency.delete({ where: { id } })

    return NextResponse.json({ message: 'Currency deleted successfully' })
  } catch (error) {
    console.error('Delete currency error:', error)
    return NextResponse.json(
      { error: 'Failed to delete currency' },
      { status: 500 }
    )
  }
}
