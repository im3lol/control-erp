import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth-guard'

// PUT /api/inventory/warehouses/[id] - Update warehouse
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requirePermission('inventory.edit', request)
    const { id } = await params
    const body = await request.json()
    const { companyId, code, nameAr, nameEn, type, parentId, location, manager, isActive } = body

    if (!companyId) {
      return NextResponse.json({ error: 'companyId is required' }, { status: 400 })
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

    // Validate parentId if provided - prevent circular reference
    if (parentId !== undefined) {
      if (parentId && parentId === id) {
        return NextResponse.json(
          { error: 'A location cannot be its own parent' },
          { status: 400 }
        )
      }
      if (parentId) {
        // Check that parent exists and belongs to same company
        const parent = await db.warehouse.findUnique({ where: { id: parentId } })
        if (!parent || parent.companyId !== companyId) {
          return NextResponse.json(
            { error: 'Invalid parent location' },
            { status: 400 }
          )
        }
        // Check for circular reference: ensure the new parent is not a descendant of this warehouse
        const checkCircular = async (currentId: string): Promise<boolean> => {
          const current = await db.warehouse.findUnique({ where: { id: currentId } })
          if (!current) return false
          if (current.parentId === id) return true
          if (current.parentId) return checkCircular(current.parentId)
          return false
        }
        const isCircular = await checkCircular(parentId)
        if (isCircular) {
          return NextResponse.json(
            { error: 'Circular reference detected: cannot set this parent' },
            { status: 400 }
          )
        }
      }
    }

    // Validate type hierarchy
    if (type !== undefined) {
      const validTypes = ['WAREHOUSE', 'ZONE', 'RACK', 'SHELF', 'BOX']
      if (!validTypes.includes(type)) {
        return NextResponse.json(
          { error: `Invalid type. Must be one of: ${validTypes.join(', ')}` },
          { status: 400 }
        )
      }
    }

    const warehouse = await db.warehouse.update({
      where: { id },
      data: {
        ...(code !== undefined && { code }),
        ...(nameAr !== undefined && { nameAr }),
        ...(nameEn !== undefined && { nameEn }),
        ...(type !== undefined && { type }),
        ...(parentId !== undefined && { parentId: parentId || null }),
        ...(location !== undefined && { location }),
        ...(manager !== undefined && { manager }),
        ...(isActive !== undefined && { isActive }),
      },
      include: {
        parent: {
          select: { id: true, code: true, nameAr: true, type: true },
        },
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

// DELETE /api/inventory/warehouses/[id] - Delete warehouse
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requirePermission('inventory.delete', request)
    const { id } = await params
    const { searchParams } = new URL(request.url)
    const companyId = searchParams.get('companyId')

    if (!companyId) {
      return NextResponse.json({ error: 'companyId is required' }, { status: 400 })
    }

    const existing = await db.warehouse.findUnique({
      where: { id },
      include: { children: true },
    })
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

    // Check if warehouse has children
    if (existing.children.length > 0) {
      return NextResponse.json(
        { error: `Cannot delete: location has ${existing.children.length} child location(s). Please move or delete them first.` },
        { status: 400 }
      )
    }

    // Check if warehouse has stock movements
    const movementsCount = await db.stockMovement.count({
      where: { warehouseId: id },
    })
    if (movementsCount > 0) {
      return NextResponse.json(
        { error: `Cannot delete: location has ${movementsCount} stock movement(s)` },
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
