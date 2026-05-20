import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

const VALID_CODE_TYPES = ['UPC', 'EAN', 'SKU', 'ASIN', 'FNSKU', 'OTHER']

// GET /api/inventory/item-codes - List codes for an item
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const itemId = searchParams.get('itemId')

    if (!itemId) {
      return NextResponse.json(
        { error: 'itemId مطلوب' },
        { status: 400 }
      )
    }

    const codes = await db.itemCode.findMany({
      where: { itemId },
      orderBy: [{ isPrimary: 'desc' }, { codeType: 'asc' }],
    })

    return NextResponse.json(codes)
  } catch (error) {
    console.error('Get item codes error:', error)
    return NextResponse.json(
      { error: 'فشل في تحميل أكواد الصنف' },
      { status: 500 }
    )
  }
}

// POST /api/inventory/item-codes - Add code to item
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { itemId, codeType, code, isPrimary } = body

    if (!itemId || !codeType || !code) {
      return NextResponse.json(
        { error: 'itemId و codeType و code مطلوبون' },
        { status: 400 }
      )
    }

    if (!VALID_CODE_TYPES.includes(codeType)) {
      return NextResponse.json(
        { error: `codeType يجب أن يكون أحد: ${VALID_CODE_TYPES.join(', ')}` },
        { status: 400 }
      )
    }

    // Check if item exists
    const item = await db.item.findUnique({ where: { id: itemId } })
    if (!item) {
      return NextResponse.json(
        { error: 'الصنف غير موجود' },
        { status: 404 }
      )
    }

    // Check uniqueness: code must be unique for that codeType within the item
    const existingCode = await db.itemCode.findFirst({
      where: { itemId, codeType, code },
    })
    if (existingCode) {
      return NextResponse.json(
        { error: `يوجد كود من نوع ${codeType} بنفس القيمة لهذا الصنف بالفعل` },
        { status: 409 }
      )
    }

    // If setting as primary, unset any existing primary
    if (isPrimary) {
      await db.itemCode.updateMany({
        where: { itemId, isPrimary: true },
        data: { isPrimary: false },
      })
    }

    const itemCode = await db.itemCode.create({
      data: {
        itemId,
        codeType,
        code: code.trim(),
        isPrimary: isPrimary || false,
      },
    })

    return NextResponse.json(itemCode, { status: 201 })
  } catch (error) {
    console.error('Create item code error:', error)
    return NextResponse.json(
      { error: 'فشل في إضافة الكود' },
      { status: 500 }
    )
  }
}

// PUT /api/inventory/item-codes - Update code
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, codeType, code, isPrimary } = body

    if (!id) {
      return NextResponse.json(
        { error: 'id مطلوب' },
        { status: 400 }
      )
    }

    const existing = await db.itemCode.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json(
        { error: 'الكود غير موجود' },
        { status: 404 }
      )
    }

    if (codeType && !VALID_CODE_TYPES.includes(codeType)) {
      return NextResponse.json(
        { error: `codeType يجب أن يكون أحد: ${VALID_CODE_TYPES.join(', ')}` },
        { status: 400 }
      )
    }

    // If changing codeType or code, check uniqueness
    if ((codeType && codeType !== existing.codeType) || (code && code !== existing.code)) {
      const duplicate = await db.itemCode.findFirst({
        where: {
          itemId: existing.itemId,
          codeType: codeType || existing.codeType,
          code: code || existing.code,
        },
      })
      if (duplicate) {
        return NextResponse.json(
          { error: `يوجد كود من نوع ${codeType || existing.codeType} بنفس القيمة لهذا الصنف بالفعل` },
          { status: 409 }
        )
      }
    }

    // If setting as primary, unset any existing primary
    if (isPrimary) {
      await db.itemCode.updateMany({
        where: { itemId: existing.itemId, isPrimary: true },
        data: { isPrimary: false },
      })
    }

    const updated = await db.itemCode.update({
      where: { id },
      data: {
        ...(codeType !== undefined && { codeType }),
        ...(code !== undefined && { code: code.trim() }),
        ...(isPrimary !== undefined && { isPrimary }),
      },
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error('Update item code error:', error)
    return NextResponse.json(
      { error: 'فشل في تحديث الكود' },
      { status: 500 }
    )
  }
}

// DELETE /api/inventory/item-codes - Delete code
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json()
    const { id } = body

    if (!id) {
      return NextResponse.json(
        { error: 'id مطلوب' },
        { status: 400 }
      )
    }

    const existing = await db.itemCode.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json(
        { error: 'الكود غير موجود' },
        { status: 404 }
      )
    }

    await db.itemCode.delete({ where: { id } })

    return NextResponse.json({ message: 'تم حذف الكود بنجاح' })
  } catch (error) {
    console.error('Delete item code error:', error)
    return NextResponse.json(
      { error: 'فشل في حذف الكود' },
      { status: 500 }
    )
  }
}
