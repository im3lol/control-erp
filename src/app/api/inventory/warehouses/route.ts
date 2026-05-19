import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth-guard'

// GET /api/inventory/warehouses - List all warehouses for a company
export async function GET(request: NextRequest) {
  try {
    const user = await requirePermission('inventory.view')
    const { searchParams } = new URL(request.url)
    const companyId = searchParams.get('companyId')
    if (!companyId) {
      return NextResponse.json({ error: 'companyId is required' }, { status: 400 })
    }

    const warehouses = await db.warehouse.findMany({
      where: { companyId },
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
    if (error instanceof Error && (error.message.includes('غير مصرح') || error.message.includes('صلاحية'))) {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }
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
    const user = await requirePermission('inventory.create')
    const body = await request.json()
    const { companyId, code, nameAr, nameEn, location, manager, isActive } = body

    if (!companyId) {
      return NextResponse.json({ error: 'companyId is required' }, { status: 400 })
    }

    if (!code || !nameAr) {
      return NextResponse.json(
        { error: 'code and nameAr are required' },
        { status: 400 }
      )
    }

    // Check if warehouse code already exists within the company
    const existing = await db.warehouse.findUnique({
      where: { companyId_code: { companyId, code } },
    })
    if (existing) {
      return NextResponse.json(
        { error: `Warehouse with code "${code}" already exists in this company` },
        { status: 409 }
      )
    }

    const warehouse = await db.warehouse.create({
      data: {
        companyId,
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
    if (error instanceof Error && (error.message.includes('غير مصرح') || error.message.includes('صلاحية'))) {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }
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
    const user = await requirePermission('inventory.edit')
    const body = await request.json()
    const { companyId, id, code, nameAr, nameEn, location, manager, isActive } = body

    if (!companyId) {
      return NextResponse.json({ error: 'companyId is required' }, { status: 400 })
    }

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

    // Verify the warehouse belongs to the company
    if (existing.companyId !== companyId) {
      return NextResponse.json(
        { error: 'Warehouse does not belong to this company' },
        { status: 403 }
      )
    }

    // If code is being changed, check for uniqueness within company
    if (code && code !== existing.code) {
      const codeExists = await db.warehouse.findUnique({
        where: { companyId_code: { companyId, code } },
      })
      if (codeExists) {
        return NextResponse.json(
          { error: `Warehouse with code "${code}" already exists in this company` },
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
    if (error instanceof Error && (error.message.includes('غير مصرح') || error.message.includes('صلاحية'))) {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }
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

    const existing = await db.warehouse.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json(
        { error: 'Warehouse not found' },
        { status: 404 }
      )
    }

    // Verify the warehouse belongs to the company
    if (existing.companyId !== companyId) {
      return NextResponse.json(
        { error: 'Warehouse does not belong to this company' },
        { status: 403 }
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
    if (error instanceof Error && (error.message.includes('غير مصرح') || error.message.includes('صلاحية'))) {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }
    console.error('Delete warehouse error:', error)
    return NextResponse.json(
      { error: 'Failed to delete warehouse' },
      { status: 500 }
    )
  }
}
