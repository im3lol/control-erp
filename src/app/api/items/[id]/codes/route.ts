import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

const VALID_CODE_TYPES = ['UPC', 'EAN', 'SKU', 'ASIN', 'FNSKU', 'OTHER']

// GET /api/items/[id]/codes - Get all codes for an item
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: itemId } = await params

    if (!itemId) {
      return NextResponse.json(
        { error: 'معرف الصنف مطلوب' },
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

// POST /api/items/[id]/codes - Add a new code to an item
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: itemId } = await params
    const body = await request.json()
    const { codeType, code, isPrimary } = body

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

// DELETE /api/items/[id]/codes - Remove a code from an item (by code ID in query param)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: itemId } = await params
    const { searchParams } = new URL(request.url)
    const codeId = searchParams.get('codeId')

    if (!itemId || !codeId) {
      return NextResponse.json(
        { error: 'itemId و codeId مطلوبان' },
        { status: 400 }
      )
    }

    const existing = await db.itemCode.findUnique({ where: { id: codeId } })
    if (!existing) {
      return NextResponse.json(
        { error: 'الكود غير موجود' },
        { status: 404 }
      )
    }

    // Verify the code belongs to the item
    if (existing.itemId !== itemId) {
      return NextResponse.json(
        { error: 'الكود لا ينتمي لهذا الصنف' },
        { status: 403 }
      )
    }

    await db.itemCode.delete({ where: { id: codeId } })

    return NextResponse.json({ message: 'تم حذف الكود بنجاح' })
  } catch (error) {
    console.error('Delete item code error:', error)
    return NextResponse.json(
      { error: 'فشل في حذف الكود' },
      { status: 500 }
    )
  }
}
