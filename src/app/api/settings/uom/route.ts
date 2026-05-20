import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

// GET /api/settings/uom - List all units of measure for a company
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const companyId = searchParams.get('companyId')
    if (!companyId) {
      return NextResponse.json({ error: 'companyId is required' }, { status: 400 })
    }

    const uoms = await db.unitOfMeasure.findMany({
      where: { companyId },
      orderBy: { code: 'asc' },
    })

    return NextResponse.json(uoms)
  } catch (error) {
    console.error('Get UOMs error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch units of measure' },
      { status: 500 }
    )
  }
}

// POST /api/settings/uom - Create new unit of measure
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { companyId, code, nameAr, nameEn, isActive } = body

    if (!companyId) {
      return NextResponse.json({ error: 'companyId is required' }, { status: 400 })
    }

    if (!code || !nameAr || !nameEn) {
      return NextResponse.json(
        { error: 'code, nameAr, and nameEn are required' },
        { status: 400 }
      )
    }

    // Check if UOM code already exists within the company
    const existing = await db.unitOfMeasure.findUnique({
      where: { companyId_code: { companyId, code } },
    })
    if (existing) {
      return NextResponse.json(
        { error: `Unit of measure with code "${code}" already exists in this company` },
        { status: 409 }
      )
    }

    const uom = await db.unitOfMeasure.create({
      data: {
        companyId,
        code,
        nameAr,
        nameEn,
        isActive: isActive ?? true,
      },
    })

    return NextResponse.json(uom, { status: 201 })
  } catch (error) {
    console.error('Create UOM error:', error)
    return NextResponse.json(
      { error: 'Failed to create unit of measure' },
      { status: 500 }
    )
  }
}

// PUT /api/settings/uom - Update unit of measure
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { companyId, id, code, nameAr, nameEn, isActive } = body

    if (!companyId) {
      return NextResponse.json({ error: 'companyId is required' }, { status: 400 })
    }

    if (!id) {
      return NextResponse.json(
        { error: 'id is required' },
        { status: 400 }
      )
    }

    const existing = await db.unitOfMeasure.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json(
        { error: 'Unit of measure not found' },
        { status: 404 }
      )
    }

    // Verify the UOM belongs to the company
    if (existing.companyId !== companyId) {
      return NextResponse.json(
        { error: 'Unit of measure does not belong to this company' },
        { status: 403 }
      )
    }

    // If code is being changed, check for uniqueness within company
    if (code && code !== existing.code) {
      const codeExists = await db.unitOfMeasure.findUnique({
        where: { companyId_code: { companyId, code } },
      })
      if (codeExists) {
        return NextResponse.json(
          { error: `Unit of measure with code "${code}" already exists in this company` },
          { status: 409 }
        )
      }
    }

    const uom = await db.unitOfMeasure.update({
      where: { id },
      data: {
        ...(code !== undefined && { code }),
        ...(nameAr !== undefined && { nameAr }),
        ...(nameEn !== undefined && { nameEn }),
        ...(isActive !== undefined && { isActive }),
      },
    })

    return NextResponse.json(uom)
  } catch (error) {
    console.error('Update UOM error:', error)
    return NextResponse.json(
      { error: 'Failed to update unit of measure' },
      { status: 500 }
    )
  }
}

// DELETE /api/settings/uom - Delete unit of measure
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

    const existing = await db.unitOfMeasure.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json(
        { error: 'Unit of measure not found' },
        { status: 404 }
      )
    }

    // Verify the UOM belongs to the company
    if (existing.companyId !== companyId) {
      return NextResponse.json(
        { error: 'Unit of measure does not belong to this company' },
        { status: 403 }
      )
    }

    // Check if any items reference this UOM
    const itemsCount = await db.item.count({ where: { uomId: id } })
    if (itemsCount > 0) {
      return NextResponse.json(
        { error: `Cannot delete: ${itemsCount} item(s) are using this unit of measure` },
        { status: 400 }
      )
    }

    await db.unitOfMeasure.delete({ where: { id } })

    return NextResponse.json({ message: 'Unit of measure deleted successfully' })
  } catch (error) {
    console.error('Delete UOM error:', error)
    return NextResponse.json(
      { error: 'Failed to delete unit of measure' },
      { status: 500 }
    )
  }
}
