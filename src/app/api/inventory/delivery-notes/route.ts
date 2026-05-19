import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth-guard'

// GET /api/inventory/delivery-notes - List delivery notes
export async function GET(request: NextRequest) {
  try {
    const user = await requirePermission('inventory.view', request)
    const { searchParams } = new URL(request.url)
    const companyId = searchParams.get('companyId')
    if (!companyId) {
      return NextResponse.json({ error: 'companyId is required' }, { status: 400 })
    }

    const deliveryNotes = await db.deliveryNote.findMany({
      where: { companyId },
      include: {
        customer: {
          select: { id: true, code: true, nameAr: true, nameEn: true },
        },
        warehouse: {
          select: { id: true, code: true, nameAr: true, nameEn: true, type: true, parentId: true },
        },
        salesInvoice: {
          select: { id: true, number: true },
        },
        _count: {
          select: { lines: true },
        },
      },
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
    })

    return NextResponse.json(deliveryNotes)
  } catch (error) {
    if (error instanceof Error && (error.message.includes('غير مصرح') || error.message.includes('صلاحية'))) {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }
    console.error('Get delivery notes error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch delivery notes' },
      { status: 500 }
    )
  }
}

// POST /api/inventory/delivery-notes - Create a new delivery note
export async function POST(request: NextRequest) {
  try {
    const user = await requirePermission('inventory.create', request)
    const body = await request.json()
    const { companyId, salesInvoiceId, customerId, warehouseId, date, notes, lines } = body

    if (!companyId) {
      return NextResponse.json({ error: 'companyId is required' }, { status: 400 })
    }

    if (!warehouseId) {
      return NextResponse.json(
        { error: 'warehouseId is required' },
        { status: 400 }
      )
    }

    if (!lines || !Array.isArray(lines) || lines.length === 0) {
      return NextResponse.json(
        { error: 'يجب إضافة سطر واحد على الأقل' },
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

    // If salesInvoiceId is provided, auto-fill customerId and validate items
    let resolvedCustomerId = customerId || null
    if (salesInvoiceId) {
      const salesInvoice = await db.salesInvoice.findUnique({
        where: { id: salesInvoiceId },
        include: {
          lines: {
            select: { id: true, itemId: true, quantity: true },
          },
        },
      })

      if (!salesInvoice || salesInvoice.companyId !== companyId) {
        return NextResponse.json(
          { error: 'فاتورة المبيعات غير موجودة أو لا تنتمي لهذه الشركة' },
          { status: 404 }
        )
      }

      // Auto-fill customerId from the sales invoice
      resolvedCustomerId = salesInvoice.customerId

      // Validate that items in delivery note lines belong to the sales invoice
      const invoiceItemIds = new Set(salesInvoice.lines.map((l) => l.itemId))
      for (const line of lines) {
        if (!invoiceItemIds.has(line.itemId)) {
          return NextResponse.json(
            { error: `الصنف ${line.itemId} لا ينتمي لفاتورة المبيعات المحددة` },
            { status: 400 }
          )
        }
      }
    }

    // Validate customer if provided
    if (resolvedCustomerId) {
      const customer = await db.customer.findUnique({ where: { id: resolvedCustomerId } })
      if (!customer || customer.companyId !== companyId) {
        return NextResponse.json(
          { error: 'العميل غير موجود أو لا ينتمي لهذه الشركة' },
          { status: 404 }
        )
      }
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

    // Generate delivery note number: DN-{seq}
    const deliveryNoteCount = await db.deliveryNote.count({
      where: { companyId },
    })
    const number = `DN-${String(deliveryNoteCount + 1).padStart(4, '0')}`

    const deliveryNoteDate = date ? new Date(date) : new Date()

    // Create delivery note and lines in a transaction
    const deliveryNote = await db.$transaction(async (tx) => {
      const dn = await tx.deliveryNote.create({
        data: {
          companyId,
          number,
          date: deliveryNoteDate,
          status: 'DRAFT',
          salesInvoiceId: salesInvoiceId || null,
          customerId: resolvedCustomerId,
          warehouseId,
          notes: notes || null,
          lines: {
            create: lines.map((line: { itemId: string; quantity: number; salesInvoiceLineId?: string; notes?: string }) => ({
              itemId: line.itemId,
              quantity: line.quantity,
              salesInvoiceLineId: line.salesInvoiceLineId || null,
              notes: line.notes || null,
            })),
          },
        },
        include: {
          customer: {
            select: { id: true, code: true, nameAr: true, nameEn: true },
          },
          warehouse: {
            select: { id: true, code: true, nameAr: true, nameEn: true },
          },
          salesInvoice: {
            select: { id: true, number: true },
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

      return dn
    })

    return NextResponse.json(deliveryNote, { status: 201 })
  } catch (error) {
    if (error instanceof Error && (error.message.includes('غير مصرح') || error.message.includes('صلاحية'))) {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }
    console.error('Create delivery note error:', error)
    return NextResponse.json(
      { error: 'Failed to create delivery note' },
      { status: 500 }
    )
  }
}
