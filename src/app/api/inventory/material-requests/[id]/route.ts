import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth-guard'

// GET /api/inventory/material-requests/[id] - Get single material request with full details
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requirePermission('inventory.view', request)
    const { id } = await params
    const { searchParams } = new URL(request.url)
    const companyId = searchParams.get('companyId')
    if (!companyId) {
      return NextResponse.json({ error: 'companyId is required' }, { status: 400 })
    }

    const materialRequest = await db.materialRequest.findUnique({
      where: { id },
      include: {
        lines: {
          include: {
            item: {
              select: { id: true, code: true, nameAr: true, nameEn: true, uom: { select: { id: true, nameAr: true, nameEn: true } } },
            },
          },
          orderBy: { id: 'asc' },
        },
      },
    })

    if (!materialRequest) {
      return NextResponse.json(
        { error: 'طلب المواد غير موجود' },
        { status: 404 }
      )
    }

    if (materialRequest.companyId !== companyId) {
      return NextResponse.json(
        { error: 'طلب المواد لا ينتمي لهذه الشركة' },
        { status: 403 }
      )
    }

    return NextResponse.json(materialRequest)
  } catch (error) {
    if (error instanceof Error && (error.message.includes('غير مصرح') || error.message.includes('صلاحية'))) {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }
    console.error('Get material request error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch material request' },
      { status: 500 }
    )
  }
}

// PUT /api/inventory/material-requests/[id] - Actions: submit, approve, fulfill, cancel
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requirePermission('inventory.create', request)
    const { id } = await params
    const body = await request.json()
    const { companyId, action, approvedBy, notes } = body

    if (!companyId) {
      return NextResponse.json({ error: 'companyId is required' }, { status: 400 })
    }

    const materialRequest = await db.materialRequest.findUnique({
      where: { id },
      include: {
        lines: {
          include: {
            item: {
              select: { id: true, code: true, nameAr: true, nameEn: true },
            },
          },
        },
      },
    })

    if (!materialRequest) {
      return NextResponse.json(
        { error: 'طلب المواد غير موجود' },
        { status: 404 }
      )
    }

    if (materialRequest.companyId !== companyId) {
      return NextResponse.json(
        { error: 'طلب المواد لا ينتمي لهذه الشركة' },
        { status: 403 }
      )
    }

    // ── SUBMIT action: DRAFT → PENDING ──
    if (action === 'submit') {
      if (materialRequest.status !== 'DRAFT') {
        return NextResponse.json(
          { error: 'يمكن تقديم الطلبات المسودة فقط' },
          { status: 400 }
        )
      }

      const updated = await db.materialRequest.update({
        where: { id },
        data: { status: 'PENDING' },
        include: {
          lines: {
            include: {
              item: {
                select: { id: true, code: true, nameAr: true, nameEn: true, uom: { select: { id: true, nameAr: true, nameEn: true } } },
              },
            },
            orderBy: { id: 'asc' },
          },
        },
      })

      return NextResponse.json(updated)
    }

    // ── APPROVE action: PENDING → APPROVED ──
    if (action === 'approve') {
      if (materialRequest.status !== 'PENDING') {
        return NextResponse.json(
          { error: 'يمكن اعتماد الطلبات المعلقة فقط' },
          { status: 400 }
        )
      }

      const updated = await db.materialRequest.update({
        where: { id },
        data: {
          status: 'APPROVED',
          approvedBy: approvedBy || user.name || null,
        },
        include: {
          lines: {
            include: {
              item: {
                select: { id: true, code: true, nameAr: true, nameEn: true, uom: { select: { id: true, nameAr: true, nameEn: true } } },
              },
            },
            orderBy: { id: 'asc' },
          },
        },
      })

      return NextResponse.json(updated)
    }

    // ── FULFILL action: APPROVED → FULFILLED ──
    if (action === 'fulfill') {
      if (materialRequest.status !== 'APPROVED') {
        return NextResponse.json(
          { error: 'يمكن تنفيذ الطلبات المعتمدة فقط' },
          { status: 400 }
        )
      }

      const updated = await db.materialRequest.update({
        where: { id },
        data: { status: 'FULFILLED' },
        include: {
          lines: {
            include: {
              item: {
                select: { id: true, code: true, nameAr: true, nameEn: true, uom: { select: { id: true, nameAr: true, nameEn: true } } },
              },
            },
            orderBy: { id: 'asc' },
          },
        },
      })

      return NextResponse.json(updated)
    }

    // ── CANCEL action: any → CANCELLED ──
    if (action === 'cancel') {
      if (materialRequest.status === 'CANCELLED') {
        return NextResponse.json(
          { error: 'طلب المواد ملغي بالفعل' },
          { status: 400 }
        )
      }

      if (materialRequest.status === 'FULFILLED') {
        return NextResponse.json(
          { error: 'لا يمكن إلغاء طلب تم تنفيذه' },
          { status: 400 }
        )
      }

      const updated = await db.materialRequest.update({
        where: { id },
        data: { status: 'CANCELLED' },
        include: {
          lines: {
            include: {
              item: {
                select: { id: true, code: true, nameAr: true, nameEn: true, uom: { select: { id: true, nameAr: true, nameEn: true } } },
              },
            },
            orderBy: { id: 'asc' },
          },
        },
      })

      return NextResponse.json(updated)
    }

    return NextResponse.json(
      { error: 'إجراء غير صالح. استخدم: submit, approve, fulfill, cancel' },
      { status: 400 }
    )
  } catch (error) {
    if (error instanceof Error && (error.message.includes('غير مصرح') || error.message.includes('صلاحية'))) {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }
    console.error('Material request action error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to process material request action' },
      { status: 500 }
    )
  }
}
