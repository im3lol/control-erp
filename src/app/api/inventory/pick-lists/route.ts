import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth-guard'

// GET /api/inventory/pick-lists - List pick lists
export async function GET(request: NextRequest) {
  try {
    const user = await requirePermission('inventory.view', request)
    const { searchParams } = new URL(request.url)
    const companyId = searchParams.get('companyId')
    if (!companyId) {
      return NextResponse.json({ error: 'companyId is required' }, { status: 400 })
    }

    const pickLists = await db.pickList.findMany({
      where: { companyId },
      include: {
        warehouse: {
          select: { id: true, code: true, nameAr: true, nameEn: true, type: true, parentId: true },
        },
        lines: {
          include: {
            item: {
              select: { id: true, code: true, nameAr: true, nameEn: true },
            },
          },
          orderBy: { id: 'asc' },
        },
        _count: {
          select: { lines: true },
        },
      },
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
    })

    return NextResponse.json(pickLists)
  } catch (error) {
    if (error instanceof Error && (error.message.includes('غير مصرح') || error.message.includes('صلاحية'))) {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }
    console.error('Get pick lists error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch pick lists' },
      { status: 500 }
    )
  }
}

// POST /api/inventory/pick-lists - Create a new pick list
export async function POST(request: NextRequest) {
  try {
    const user = await requirePermission('inventory.create', request)
    const body = await request.json()
    const {
      companyId,
      warehouseId,
      date,
      notes,
      lines,
      fromPendingSales,
    } = body

    if (!companyId) {
      return NextResponse.json({ error: 'companyId is required' }, { status: 400 })
    }

    if (!warehouseId) {
      return NextResponse.json(
        { error: 'warehouseId is required' },
        { status: 400 }
      )
    }

    // Validate warehouse exists and belongs to company
    const warehouse = await db.warehouse.findUnique({ where: { id: warehouseId } })
    if (!warehouse || warehouse.companyId !== companyId) {
      return NextResponse.json(
        { error: 'المخزن غير موجود أو لا ينتمي لهذه الشركة' },
        { status: 404 }
      )
    }

    // Determine the lines to create
    let pickListLines: {
      itemId: string
      quantity: number
      salesInvoiceId?: string | null
      notes?: string | null
    }[] = []

    if (fromPendingSales === true) {
      // ── Auto-generate from pending sales invoices ──
      // Find all CONFIRMED sales invoices for this company
      const confirmedInvoices = await db.salesInvoice.findMany({
        where: {
          companyId,
          status: 'CONFIRMED',
        },
        include: {
          lines: {
            include: {
              item: {
                select: { id: true, code: true, nameAr: true, nameEn: true, companyId: true },
              },
            },
          },
        },
      })

      if (confirmedInvoices.length === 0) {
        return NextResponse.json(
          { error: 'لا توجد فواتير مبيعات مؤكدة لإنشاء قائمة تحضير منها' },
          { status: 400 }
        )
      }

      // Find existing pick list lines for these invoices to determine what's already been picked
      const invoiceIds = confirmedInvoices.map((inv) => inv.id)

      const existingPickLines = await db.pickListLine.findMany({
        where: {
          salesInvoiceId: { in: invoiceIds },
          pickList: {
            status: { in: ['DRAFT', 'IN_PROGRESS', 'COMPLETED'] },
          },
        },
        select: {
          itemId: true,
          salesInvoiceId: true,
          quantity: true,
          pickedQty: true,
        },
      })

      // Build a map of already-picked quantities per (itemId, salesInvoiceId)
      const alreadyPickedMap = new Map<string, number>()
      for (const pl of existingPickLines) {
        const key = `${pl.itemId}:${pl.salesInvoiceId ?? 'null'}`
        alreadyPickedMap.set(key, (alreadyPickedMap.get(key) || 0) + pl.quantity)
      }

      // Collect unfulfilled lines
      for (const invoice of confirmedInvoices) {
        for (const line of invoice.lines) {
          const key = `${line.itemId}:${invoice.id}`
          const alreadyPicked = alreadyPickedMap.get(key) || 0
          const remainingQty = line.quantity - alreadyPicked

          if (remainingQty > 0) {
            pickListLines.push({
              itemId: line.itemId,
              quantity: remainingQty,
              salesInvoiceId: invoice.id,
            })
          }
        }
      }

      if (pickListLines.length === 0) {
        return NextResponse.json(
          { error: 'جميع الأصناف من فواتير المبيعات المؤكدة تم تحضيرها بالفعل' },
          { status: 400 }
        )
      }
    } else {
      // ── Manual lines provided ──
      if (!lines || !Array.isArray(lines) || lines.length === 0) {
        return NextResponse.json(
          { error: 'يجب إضافة سطر واحد على الأقل' },
          { status: 400 }
        )
      }

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

        pickListLines.push({
          itemId: line.itemId,
          quantity: line.quantity,
          salesInvoiceId: line.salesInvoiceId || null,
          notes: line.notes || null,
        })
      }
    }

    // Generate pick list number: PK-{seq}
    const pickListCount = await db.pickList.count({
      where: { companyId },
    })
    const number = `PK-${String(pickListCount + 1).padStart(4, '0')}`

    const pickListDate = date ? new Date(date) : new Date()

    // Create pick list and lines in a transaction
    const pickList = await db.$transaction(async (tx) => {
      const pl = await tx.pickList.create({
        data: {
          companyId,
          number,
          date: pickListDate,
          warehouseId,
          status: 'DRAFT',
          notes: notes || null,
          lines: {
            create: pickListLines.map((line) => ({
              itemId: line.itemId,
              quantity: line.quantity,
              pickedQty: 0,
              salesInvoiceId: line.salesInvoiceId || null,
              notes: line.notes || null,
            })),
          },
        },
        include: {
          warehouse: {
            select: { id: true, code: true, nameAr: true, nameEn: true },
          },
          lines: {
            include: {
              item: {
                select: { id: true, code: true, nameAr: true, nameEn: true },
              },
            },
            orderBy: { id: 'asc' },
          },
        },
      })

      return pl
    })

    return NextResponse.json(pickList, { status: 201 })
  } catch (error) {
    if (error instanceof Error && (error.message.includes('غير مصرح') || error.message.includes('صلاحية'))) {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }
    console.error('Create pick list error:', error)
    return NextResponse.json(
      { error: 'Failed to create pick list' },
      { status: 500 }
    )
  }
}
