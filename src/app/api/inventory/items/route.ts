import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

// GET /api/inventory/items - List all items with filters
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search')
    const categoryId = searchParams.get('categoryId')
    const activeOnly = searchParams.get('activeOnly')

    const where: Record<string, unknown> = {}

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
    const body = await request.json()
    const {
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
      isActive,
    } = body

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

    // Check if item code already exists
    const existing = await db.item.findUnique({ where: { code } })
    if (existing) {
      return NextResponse.json(
        { error: `Item with code "${code}" already exists` },
        { status: 409 }
      )
    }

    const item = await db.item.create({
      data: {
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
        isActive: isActive ?? true,
      },
      include: {
        category: true,
        uom: true,
      },
    })

    return NextResponse.json(item, { status: 201 })
  } catch (error) {
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
    const body = await request.json()
    const {
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
      isActive,
    } = body

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

    // If code is being changed, check for uniqueness
    if (code && code !== existing.code) {
      const codeExists = await db.item.findUnique({ where: { code } })
      if (codeExists) {
        return NextResponse.json(
          { error: `Item with code "${code}" already exists` },
          { status: 409 }
        )
      }
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
        ...(isActive !== undefined && { isActive }),
      },
      include: {
        category: true,
        uom: true,
      },
    })

    return NextResponse.json(item)
  } catch (error) {
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
    const body = await request.json()
    const { id } = body

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
    console.error('Delete item error:', error)
    return NextResponse.json(
      { error: 'Failed to delete item' },
      { status: 500 }
    )
  }
}
