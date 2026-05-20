import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth-guard'

// GET /api/inventory/stock-transfers - List stock transfers
export async function GET(request: NextRequest) {
  try {
    const user = await requirePermission('inventory.view', request)
    const { searchParams } = new URL(request.url)
    const companyId = searchParams.get('companyId')
    if (!companyId) {
      return NextResponse.json({ error: 'companyId is required' }, { status: 400 })
    }

    const transfers = await db.stockTransfer.findMany({
      where: { companyId },
      include: {
        fromWarehouse: {
          select: { id: true, code: true, nameAr: true, nameEn: true, type: true, parentId: true },
        },
        toWarehouse: {
          select: { id: true, code: true, nameAr: true, nameEn: true, type: true, parentId: true },
        },
        _count: {
          select: { lines: true },
        },
      },
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
    })

    return NextResponse.json(transfers)
  } catch (error) {
    if (error instanceof Error && (error.message.includes('غير مصرح') || error.message.includes('صلاحية'))) {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }
    console.error('Get stock transfers error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch stock transfers' },
      { status: 500 }
    )
  }
}

// POST /api/inventory/stock-transfers - Create a new stock transfer
export async function POST(request: NextRequest) {
  try {
    const user = await requirePermission('inventory.create', request)
    const body = await request.json()
    const { companyId, fromWarehouseId, toWarehouseId, date, notes, lines } = body

    if (!companyId) {
      return NextResponse.json({ error: 'companyId is required' }, { status: 400 })
    }

    if (!fromWarehouseId || !toWarehouseId) {
      return NextResponse.json(
        { error: 'fromWarehouseId and toWarehouseId are required' },
        { status: 400 }
      )
    }

    if (fromWarehouseId === toWarehouseId) {
      return NextResponse.json(
        { error: 'لا يمكن أن يكون المخزن المصدر والمخزن الوجهة واحد' },
        { status: 400 }
      )
    }

    if (!lines || !Array.isArray(lines) || lines.length === 0) {
      return NextResponse.json(
        { error: 'يجب إضافة سطر واحد على الأقل' },
        { status: 400 }
      )
    }

    // Validate warehouses exist and belong to company
    const [fromWarehouse, toWarehouse] = await Promise.all([
      db.warehouse.findUnique({ where: { id: fromWarehouseId } }),
      db.warehouse.findUnique({ where: { id: toWarehouseId } }),
    ])

    if (!fromWarehouse || fromWarehouse.companyId !== companyId) {
      return NextResponse.json(
        { error: 'المخزن المصدر غير موجود أو لا ينتمي لهذه الشركة' },
        { status: 404 }
      )
    }
    if (!toWarehouse || toWarehouse.companyId !== companyId) {
      return NextResponse.json(
        { error: 'المخزن الوجهة غير موجود أو لا ينتمي لهذه الشركة' },
        { status: 404 }
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

    // Generate transfer number: TR-{seq}
    const transferCount = await db.stockTransfer.count({
      where: { companyId },
    })
    const number = `TR-${String(transferCount + 1).padStart(4, '0')}`

    const transferDate = date ? new Date(date) : new Date()

    // Create transfer and lines in a transaction
    const transfer = await db.$transaction(async (tx) => {
      const st = await tx.stockTransfer.create({
        data: {
          companyId,
          number,
          date: transferDate,
          fromWarehouseId,
          toWarehouseId,
          status: 'DRAFT',
          notes: notes || null,
          lines: {
            create: lines.map((line: { itemId: string; quantity: number; notes?: string }) => ({
              itemId: line.itemId,
              quantity: line.quantity,
              notes: line.notes || null,
            })),
          },
        },
        include: {
          fromWarehouse: {
            select: { id: true, code: true, nameAr: true, nameEn: true },
          },
          toWarehouse: {
            select: { id: true, code: true, nameAr: true, nameEn: true },
          },
          lines: {
            include: {
              item: {
                select: { id: true, code: true, nameAr: true, nameEn: true },
              },
            },
          },
        },
      })

      return st
    })

    return NextResponse.json(transfer, { status: 201 })
  } catch (error) {
    if (error instanceof Error && (error.message.includes('غير مصرح') || error.message.includes('صلاحية'))) {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }
    console.error('Create stock transfer error:', error)
    return NextResponse.json(
      { error: 'Failed to create stock transfer' },
      { status: 500 }
    )
  }
}
