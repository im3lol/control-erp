import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { requirePermission, requireAuth } from '@/lib/auth-guard'

// GET /api/inventory/items - List all items with filters, include codes and image
export async function GET(request: NextRequest) {
  try {
    const user = await requirePermission('inventory.view')
    const { searchParams } = new URL(request.url)
    const companyId = searchParams.get('companyId') || user.companyId
    if (!companyId) {
      return NextResponse.json({ error: 'companyId is required' }, { status: 400 })
    }

    const search = searchParams.get('search')
    const categoryId = searchParams.get('categoryId')
    const activeOnly = searchParams.get('activeOnly')

    const where: Record<string, unknown> = { companyId }

    if (search) {
      where.OR = [
        { nameAr: { contains: search } },
        { nameEn: { contains: search } },
        { code: { contains: search } },
      ]
    }

    if (categoryId) {
      where.categoryId = categoryId
    }

    if (activeOnly === 'true') {
      where.isActive = true
    }

    const items = await db.item.findMany({
      where,
      include: {
        category: true,
        uom: true,
        codes: true,
        _count: {
          select: {
            balances: true,
          },
        },
      },
      orderBy: { code: 'asc' },
    })

    return NextResponse.json(items)
  } catch (error) {
    if (error instanceof Error && (error.message.includes('غير مصرح') || error.message.includes('صلاحية'))) {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }
    console.error('Get items error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch items' },
      { status: 500 }
    )
  }
}

// POST /api/inventory/items - Create item
export async function POST(request: NextRequest) {
  try {
    const user = await requirePermission('inventory.create')
    const body = await request.json()
    const {
      companyId,
      code,
      nameAr,
      nameEn,
      categoryId,
      uomId,
      costMethod,
      sellPrice,
      minStock,
      maxStock,
      description,
      image,
      isActive,
      codes,
    } = body

    if (!companyId) {
      return NextResponse.json({ error: 'companyId is required' }, { status: 400 })
    }

    if (!code || !nameAr) {
      return NextResponse.json(
        { error: 'code and nameAr are required' },
        { status: 400 }
      )
    }

    if (sellPrice !== undefined && sellPrice < 0) {
      return NextResponse.json(
        { error: 'sellPrice must be >= 0' },
        { status: 400 }
      )
    }

    if (minStock !== undefined && minStock < 0) {
      return NextResponse.json(
        { error: 'minStock must be >= 0' },
        { status: 400 }
      )
    }

    // Check if item code already exists within the company
    const existing = await db.item.findUnique({
      where: { companyId_code: { companyId, code } },
    })
    if (existing) {
      return NextResponse.json(
        { error: `Item with code "${code}" already exists in this company` },
        { status: 409 }
      )
    }

    const item = await db.item.create({
      data: {
        companyId,
        code,
        nameAr,
        nameEn,
        categoryId,
        uomId,
        costMethod: costMethod ?? 'FIFO',
        sellPrice: sellPrice ?? 0,
        minStock: minStock ?? 0,
        maxStock,
        description,
        image,
        isActive: isActive ?? true,
        codes: codes && codes.length > 0
          ? {
              create: codes.map((c: { codeType: string; code: string; isPrimary?: boolean }) => ({
                codeType: c.codeType,
                code: c.code,
                isPrimary: c.isPrimary ?? false,
              })),
            }
          : undefined,
      },
      include: {
        category: true,
        uom: true,
        codes: true,
      },
    })

    return NextResponse.json(item, { status: 201 })
  } catch (error) {
    if (error instanceof Error && (error.message.includes('غير مصرح') || error.message.includes('صلاحية'))) {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }
    console.error('Create item error:', error)
    return NextResponse.json(
      { error: 'Failed to create item' },
      { status: 500 }
    )
  }
}

// PUT /api/inventory/items - Update item
export async function PUT(request: NextRequest) {
  try {
    const user = await requirePermission('inventory.edit')
    const body = await request.json()
    const {
      companyId,
      id,
      code,
      nameAr,
      nameEn,
      categoryId,
      uomId,
      costMethod,
      sellPrice,
      minStock,
      maxStock,
      description,
      image,
      isActive,
      codes,
    } = body

    if (!companyId) {
      return NextResponse.json({ error: 'companyId is required' }, { status: 400 })
    }

    if (!id) {
      return NextResponse.json(
        { error: 'id is required' },
        { status: 400 }
      )
    }

    const existing = await db.item.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json(
        { error: 'Item not found' },
        { status: 404 }
      )
    }

    // Verify the item belongs to the company
    if (existing.companyId !== companyId) {
      return NextResponse.json(
        { error: 'Item does not belong to this company' },
        { status: 403 }
      )
    }

    if (sellPrice !== undefined && sellPrice < 0) {
      return NextResponse.json(
        { error: 'sellPrice must be >= 0' },
        { status: 400 }
      )
    }

    if (minStock !== undefined && minStock < 0) {
      return NextResponse.json(
        { error: 'minStock must be >= 0' },
        { status: 400 }
      )
    }

    // If code is being changed, check for uniqueness within company
    if (code && code !== existing.code) {
      const codeExists = await db.item.findUnique({
        where: { companyId_code: { companyId, code } },
      })
      if (codeExists) {
        return NextResponse.json(
          { error: `Item with code "${code}" already exists in this company` },
          { status: 409 }
        )
      }
    }

    // If codes are provided, delete old and create new
    if (codes !== undefined) {
      await db.itemCode.deleteMany({
        where: { itemId: id },
      })
    }

    const item = await db.item.update({
      where: { id },
      data: {
        ...(code !== undefined && { code }),
        ...(nameAr !== undefined && { nameAr }),
        ...(nameEn !== undefined && { nameEn }),
        ...(categoryId !== undefined && { categoryId }),
        ...(uomId !== undefined && { uomId }),
        ...(costMethod !== undefined && { costMethod }),
        ...(sellPrice !== undefined && { sellPrice }),
        ...(minStock !== undefined && { minStock }),
        ...(maxStock !== undefined && { maxStock }),
        ...(description !== undefined && { description }),
        ...(image !== undefined && { image }),
        ...(isActive !== undefined && { isActive }),
        ...(codes !== undefined && codes.length > 0
          ? {
              codes: {
                create: codes.map((c: { codeType: string; code: string; isPrimary?: boolean }) => ({
                  codeType: c.codeType,
                  code: c.code,
                  isPrimary: c.isPrimary ?? false,
                })),
              },
            }
          : {}),
      },
      include: {
        category: true,
        uom: true,
        codes: true,
      },
    })

    return NextResponse.json(item)
  } catch (error) {
    if (error instanceof Error && (error.message.includes('غير مصرح') || error.message.includes('صلاحية'))) {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }
    console.error('Update item error:', error)
    return NextResponse.json(
      { error: 'Failed to update item' },
      { status: 500 }
    )
  }
}

// DELETE /api/inventory/items - Delete item
export async function DELETE(request: NextRequest) {
  try {
    const user = await requirePermission('inventory.delete')
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

    const existing = await db.item.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json(
        { error: 'Item not found' },
        { status: 404 }
      )
    }

    // Verify the item belongs to the company
    if (existing.companyId !== companyId) {
      return NextResponse.json(
        { error: 'Item does not belong to this company' },
        { status: 403 }
      )
    }

    // Check if item has stock movements
    const movementsCount = await db.stockMovement.count({
      where: { itemId: id },
    })
    if (movementsCount > 0) {
      return NextResponse.json(
        { error: `Cannot delete: item has ${movementsCount} stock movement(s)` },
        { status: 400 }
      )
    }

    // Check if item has sales lines
    const salesLinesCount = await db.salesInvoiceLine.count({
      where: { itemId: id },
    })
    if (salesLinesCount > 0) {
      return NextResponse.json(
        { error: `Cannot delete: item has ${salesLinesCount} sales invoice line(s)` },
        { status: 400 }
      )
    }

    // Check if item has purchase lines
    const purchaseLinesCount = await db.purchaseInvoiceLine.count({
      where: { itemId: id },
    })
    if (purchaseLinesCount > 0) {
      return NextResponse.json(
        { error: `Cannot delete: item has ${purchaseLinesCount} purchase invoice line(s)` },
        { status: 400 }
      )
    }

    await db.item.delete({ where: { id } })

    return NextResponse.json({ message: 'Item deleted successfully' })
  } catch (error) {
    if (error instanceof Error && (error.message.includes('غير مصرح') || error.message.includes('صلاحية'))) {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }
    console.error('Delete item error:', error)
    return NextResponse.json(
      { error: 'Failed to delete item' },
      { status: 500 }
    )
  }
}
