import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

// GET /api/inventory/warehouses - List all warehouses
export async function GET() {
  try {
    const warehouses = await db.warehouse.findMany({
      include: {
        _count: {
          select: {
            itemBalances: true,
            stockMovements: true,
          },
        },
      },
      orderBy: { code: 'asc' },
    })

    return NextResponse.json(warehouses)
  } catch (error) {
    console.error('Get warehouses error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch warehouses' },
      { status: 500 }
    )
  }
}

// POST /api/inventory/warehouses - Create warehouse
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { code, nameAr, nameEn, location, manager, isActive } = body

    if (!code || !nameAr) {
      return NextResponse.json(
        { error: 'code and nameAr are required' },
        { status: 400 }
      )
    }

    // Check if warehouse code already exists
    const existing = await db.warehouse.findUnique({ where: { code } })
    if (existing) {
      return NextResponse.json(
        { error: `Warehouse with code "${code}" already exists` },
        { status: 409 }
      )
    }

    const warehouse = await db.warehouse.create({
      data: {
        code,
        nameAr,
        nameEn,
        location,
        manager,
        isActive: isActive ?? true,
      },
    })

    return NextResponse.json(warehouse, { status: 201 })
  } catch (error) {
    console.error('Create warehouse error:', error)
    return NextResponse.json(
      { error: 'Failed to create warehouse' },
      { status: 500 }
    )
  }
}

// PUT /api/inventory/warehouses - Update warehouse
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, code, nameAr, nameEn, location, manager, isActive } = body

    if (!id) {
      return NextResponse.json(
        { error: 'id is required' },
        { status: 400 }
      )
    }

    const existing = await db.warehouse.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json(
        { error: 'Warehouse not found' },
        { status: 404 }
      )
    }

    // If code is being changed, check for uniqueness
    if (code && code !== existing.code) {
      const codeExists = await db.warehouse.findUnique({ where: { code } })
      if (codeExists) {
        return NextResponse.json(
          { error: `Warehouse with code "${code}" already exists` },
          { status: 409 }
        )
      }
    }

    const warehouse = await db.warehouse.update({
      where: { id },
      data: {
        ...(code !== undefined && { code }),
        ...(nameAr !== undefined && { nameAr }),
        ...(nameEn !== undefined && { nameEn }),
        ...(location !== undefined && { location }),
        ...(manager !== undefined && { manager }),
        ...(isActive !== undefined && { isActive }),
      },
    })

    return NextResponse.json(warehouse)
  } catch (error) {
    console.error('Update warehouse error:', error)
    return NextResponse.json(
      { error: 'Failed to update warehouse' },
      { status: 500 }
    )
  }
}

// DELETE /api/inventory/warehouses - Delete warehouse
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

    const existing = await db.warehouse.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json(
        { error: 'Warehouse not found' },
        { status: 404 }
      )
    }

    // Check if warehouse has stock movements
    const movementsCount = await db.stockMovement.count({
      where: { warehouseId: id },
    })
    if (movementsCount > 0) {
      return NextResponse.json(
        { error: `Cannot delete: warehouse has ${movementsCount} stock movement(s)` },
        { status: 400 }
      )
    }

    await db.warehouse.delete({ where: { id } })

    return NextResponse.json({ message: 'Warehouse deleted successfully' })
  } catch (error) {
    console.error('Delete warehouse error:', error)
    return NextResponse.json(
      { error: 'Failed to delete warehouse' },
      { status: 500 }
    )
  }
}
