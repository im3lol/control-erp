import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth-guard'

// GET /api/inventory/categories - List all categories for a company
export async function GET(request: NextRequest) {
  try {
    const user = await requirePermission('inventory.view', request)
    const { searchParams } = new URL(request.url)
    const companyId = searchParams.get('companyId')
    if (!companyId) {
      return NextResponse.json({ error: 'companyId is required' }, { status: 400 })
    }

    const categories = await db.itemCategory.findMany({
      where: { companyId },
      include: {
        parent: true,
        _count: {
          select: {
            items: true,
          },
        },
      },
      orderBy: { code: 'asc' },
    })

    return NextResponse.json(categories)
  } catch (error) {
    if (error instanceof Error && (error.message.includes('غير مصرح') || error.message.includes('صلاحية'))) {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }
    console.error('Get categories error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch categories' },
      { status: 500 }
    )
  }
}

// POST /api/inventory/categories - Create category
export async function POST(request: NextRequest) {
  try {
    const user = await requirePermission('inventory.create', request)
    const body = await request.json()
    const { companyId, code, nameAr, nameEn, parentId, isActive } = body

    if (!companyId) {
      return NextResponse.json({ error: 'companyId is required' }, { status: 400 })
    }

    if (!code || !nameAr) {
      return NextResponse.json(
        { error: 'code and nameAr are required' },
        { status: 400 }
      )
    }

    // Check if category code already exists within the company
    const existing = await db.itemCategory.findUnique({
      where: { companyId_code: { companyId, code } },
    })
    if (existing) {
      return NextResponse.json(
        { error: `Category with code "${code}" already exists in this company` },
        { status: 409 }
      )
    }

    // If parentId provided, verify parent exists and belongs to same company
    if (parentId) {
      const parent = await db.itemCategory.findUnique({
        where: { id: parentId },
      })
      if (!parent) {
        return NextResponse.json(
          { error: 'Parent category not found' },
          { status: 404 }
        )
      }
      if (parent.companyId !== companyId) {
        return NextResponse.json(
          { error: 'Parent category does not belong to this company' },
          { status: 403 }
        )
      }
    }

    const category = await db.itemCategory.create({
      data: {
        companyId,
        code,
        nameAr,
        nameEn,
        parentId,
        isActive: isActive ?? true,
      },
      include: {
        parent: true,
      },
    })

    return NextResponse.json(category, { status: 201 })
  } catch (error) {
    if (error instanceof Error && (error.message.includes('غير مصرح') || error.message.includes('صلاحية'))) {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }
    console.error('Create category error:', error)
    return NextResponse.json(
      { error: 'Failed to create category' },
      { status: 500 }
    )
  }
}

// PUT /api/inventory/categories - Update category
export async function PUT(request: NextRequest) {
  try {
    const user = await requirePermission('inventory.edit', request)
    const body = await request.json()
    const { companyId, id, code, nameAr, nameEn, parentId, isActive } = body

    if (!companyId) {
      return NextResponse.json({ error: 'companyId is required' }, { status: 400 })
    }

    if (!id) {
      return NextResponse.json(
        { error: 'id is required' },
        { status: 400 }
      )
    }

    const existing = await db.itemCategory.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json(
        { error: 'Category not found' },
        { status: 404 }
      )
    }

    // Verify the category belongs to the company
    if (existing.companyId !== companyId) {
      return NextResponse.json(
        { error: 'Category does not belong to this company' },
        { status: 403 }
      )
    }

    // If code is being changed, check for uniqueness within company
    if (code && code !== existing.code) {
      const codeExists = await db.itemCategory.findUnique({
        where: { companyId_code: { companyId, code } },
      })
      if (codeExists) {
        return NextResponse.json(
          { error: `Category with code "${code}" already exists in this company` },
          { status: 409 }
        )
      }
    }

    // If parentId is being changed, verify parent exists and belongs to same company and prevent self-reference
    if (parentId !== undefined && parentId !== null) {
      if (parentId === id) {
        return NextResponse.json(
          { error: 'Category cannot be its own parent' },
          { status: 400 }
        )
      }
      const parent = await db.itemCategory.findUnique({
        where: { id: parentId },
      })
      if (!parent) {
        return NextResponse.json(
          { error: 'Parent category not found' },
          { status: 404 }
        )
      }
      if (parent.companyId !== companyId) {
        return NextResponse.json(
          { error: 'Parent category does not belong to this company' },
          { status: 403 }
        )
      }
    }

    const category = await db.itemCategory.update({
      where: { id },
      data: {
        ...(code !== undefined && { code }),
        ...(nameAr !== undefined && { nameAr }),
        ...(nameEn !== undefined && { nameEn }),
        ...(parentId !== undefined && { parentId }),
        ...(isActive !== undefined && { isActive }),
      },
      include: {
        parent: true,
      },
    })

    return NextResponse.json(category)
  } catch (error) {
    if (error instanceof Error && (error.message.includes('غير مصرح') || error.message.includes('صلاحية'))) {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }
    console.error('Update category error:', error)
    return NextResponse.json(
      { error: 'Failed to update category' },
      { status: 500 }
    )
  }
}

// DELETE /api/inventory/categories - Delete category
export async function DELETE(request: NextRequest) {
  try {
    const user = await requirePermission('inventory.delete', request)
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

    const existing = await db.itemCategory.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json(
        { error: 'Category not found' },
        { status: 404 }
      )
    }

    // Verify the category belongs to the company
    if (existing.companyId !== companyId) {
      return NextResponse.json(
        { error: 'Category does not belong to this company' },
        { status: 403 }
      )
    }

    // Check if category has items
    const itemsCount = await db.item.count({ where: { categoryId: id } })
    if (itemsCount > 0) {
      return NextResponse.json(
        { error: `Cannot delete: category has ${itemsCount} item(s)` },
        { status: 400 }
      )
    }

    // Check if category has children
    const childrenCount = await db.itemCategory.count({
      where: { parentId: id },
    })
    if (childrenCount > 0) {
      return NextResponse.json(
        { error: `Cannot delete: category has ${childrenCount} child category(ies)` },
        { status: 400 }
      )
    }

    await db.itemCategory.delete({ where: { id } })

    return NextResponse.json({ message: 'Category deleted successfully' })
  } catch (error) {
    if (error instanceof Error && (error.message.includes('غير مصرح') || error.message.includes('صلاحية'))) {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }
    console.error('Delete category error:', error)
    return NextResponse.json(
      { error: 'Failed to delete category' },
      { status: 500 }
    )
  }
}
