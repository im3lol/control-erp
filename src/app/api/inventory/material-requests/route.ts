import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth-guard'

// GET /api/inventory/material-requests - List material requests
export async function GET(request: NextRequest) {
  try {
    const user = await requirePermission('inventory.view', request)
    const { searchParams } = new URL(request.url)
    const companyId = searchParams.get('companyId')
    if (!companyId) {
      return NextResponse.json({ error: 'companyId is required' }, { status: 400 })
    }

    const materialRequests = await db.materialRequest.findMany({
      where: { companyId },
      include: {
        _count: {
          select: { lines: true },
        },
        lines: {
          include: {
            item: {
              select: { id: true, code: true, nameAr: true, nameEn: true, uom: { select: { id: true, nameAr: true, nameEn: true } } },
            },
          },
          orderBy: { id: 'asc' },
        },
      },
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
    })

    return NextResponse.json(materialRequests)
  } catch (error) {
    if (error instanceof Error && (error.message.includes('غير مصرح') || error.message.includes('صلاحية'))) {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }
    console.error('Get material requests error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch material requests' },
      { status: 500 }
    )
  }
}

// POST /api/inventory/material-requests - Create a new material request
export async function POST(request: NextRequest) {
  try {
    const user = await requirePermission('inventory.create', request)
    const body = await request.json()
    const { companyId, date, requestedBy, notes, lines } = body

    if (!companyId) {
      return NextResponse.json({ error: 'companyId is required' }, { status: 400 })
    }

    if (!lines || !Array.isArray(lines) || lines.length === 0) {
      return NextResponse.json(
        { error: 'يجب إضافة سطر واحد على الأقل' },
        { status: 400 }
      )
    }

    // Validate items exist and belong to company
    for (const line of lines) {
      if (!line.itemId || !line.quantity || line.quantity <= 0) {
        return NextResponse.json(
          { error: 'كل سطر يجب أن يحتوي على صنف وكمية أكبر من صفر' },
          { status: 400 }
        )
      }

      const item = await db.item.findUnique({ where: { id: line.itemId } })
      if (!item || item.companyId !== companyId) {
        return NextResponse.json(
          { error: `الصنف ${line.itemId} غير موجود أو لا ينتمي لهذه الشركة` },
          { status: 404 }
        )
      }
    }

    // Generate material request number: MR-{seq}
    const lastMR = await db.materialRequest.findFirst({
      where: { companyId },
      orderBy: { number: 'desc' },
      select: { number: true },
    })
    let seq = 1
    if (lastMR) {
      const lastSeq = parseInt(lastMR.number.split('-').pop() || '0', 10)
      seq = lastSeq + 1
    }
    const number = `MR-${String(seq).padStart(4, '0')}`

    const requestDate = date ? new Date(date) : new Date()

    // Create material request and lines in a transaction
    const materialRequest = await db.$transaction(async (tx) => {
      const mr = await tx.materialRequest.create({
        data: {
          companyId,
          number,
          date: requestDate,
          status: 'DRAFT',
          requestedBy: requestedBy || null,
          notes: notes || null,
          lines: {
            create: lines.map((line: { itemId: string; quantity: number; uomId?: string; notes?: string }) => ({
              itemId: line.itemId,
              quantity: line.quantity,
              uomId: line.uomId || null,
              notes: line.notes || null,
            })),
          },
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

      return mr
    })

    return NextResponse.json(materialRequest, { status: 201 })
  } catch (error) {
    if (error instanceof Error && (error.message.includes('غير مصرح') || error.message.includes('صلاحية'))) {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }
    console.error('Create material request error:', error)
    return NextResponse.json(
      { error: 'Failed to create material request' },
      { status: 500 }
    )
  }
}
