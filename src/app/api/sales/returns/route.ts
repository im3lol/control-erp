import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { generateDocNumber } from '@/lib/erp-utils'
import { requirePermission } from '@/lib/auth-guard'

// GET /api/sales/returns - List sales returns with filters
export async function GET(request: NextRequest) {
  try {
    const user = await requirePermission('sales.view', request)
    const { searchParams } = new URL(request.url)
    const companyId = searchParams.get('companyId')
    if (!companyId) {
      return NextResponse.json({ error: 'companyId is required' }, { status: 400 })
    }

    const status = searchParams.get('status')
    const customerId = searchParams.get('customerId')
    const fromDate = searchParams.get('fromDate')
    const toDate = searchParams.get('toDate')

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = { companyId }

    if (status) {
      where.status = status
    }
    if (customerId) {
      where.customerId = customerId
    }
    if (fromDate || toDate) {
      where.date = {
        ...(fromDate && { gte: new Date(fromDate) }),
        ...(toDate && { lte: new Date(toDate) }),
      }
    }

    const returns = await db.salesReturn.findMany({
      where,
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
      include: {
        customer: {
          select: {
            id: true,
            code: true,
            nameAr: true,
            nameEn: true,
          },
        },
        warehouse: {
          select: {
            id: true,
            code: true,
            nameAr: true,
            nameEn: true,
          },
        },
        salesOrder: {
          select: {
            id: true,
            number: true,
          },
        },
        salesInvoice: {
          select: {
            id: true,
            number: true,
          },
        },
        deliveryNote: {
          select: {
            id: true,
            number: true,
          },
        },
        lines: {
          include: {
            item: {
              select: {
                id: true,
                code: true,
                nameAr: true,
                nameEn: true,
              },
            },
          },
        },
        _count: {
          select: { lines: true },
        },
      },
    })

    return NextResponse.json(returns)
  } catch (error) {
    if (error instanceof Error && (error.message.includes('غير مصرح') || error.message.includes('صلاحية'))) {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }
    console.error('Get sales returns error:', error)
    return NextResponse.json(
      { error: 'فشل في تحميل مرتجعات البيع' },
      { status: 500 }
    )
  }
}

// POST /api/sales/returns - Create sales return
export async function POST(request: NextRequest) {
  try {
    const user = await requirePermission('sales.create', request)
    const body = await request.json()
    const {
      companyId,
      date,
      customerId,
      warehouseId,
      salesOrderId,
      salesInvoiceId,
      deliveryNoteId,
      notes,
      lines,
    } = body

    if (!companyId) {
      return NextResponse.json({ error: 'companyId is required' }, { status: 400 })
    }

    // Validate customer
    if (!customerId) {
      return NextResponse.json(
        { error: 'العميل مطلوب' },
        { status: 400 }
      )
    }

    const customer = await db.customer.findUnique({ where: { id: customerId } })
    if (!customer) {
      return NextResponse.json(
        { error: 'العميل غير موجود' },
        { status: 404 }
      )
    }
    if (customer.companyId !== companyId) {
      return NextResponse.json(
        { error: 'Customer does not belong to this company' },
        { status: 403 }
      )
    }

    // Validate warehouse
    if (!warehouseId) {
      return NextResponse.json(
        { error: 'المخزن مطلوب' },
        { status: 400 }
      )
    }

    const warehouse = await db.warehouse.findUnique({ where: { id: warehouseId } })
    if (!warehouse) {
      return NextResponse.json(
        { error: 'المخزن غير موجود' },
        { status: 404 }
      )
    }
    if (warehouse.companyId !== companyId) {
      return NextResponse.json(
        { error: 'Warehouse does not belong to this company' },
        { status: 403 }
      )
    }

    // Validate linked documents if provided
    if (salesOrderId) {
      const so = await db.salesOrder.findUnique({ where: { id: salesOrderId } })
      if (!so || so.companyId !== companyId) {
        return NextResponse.json(
          { error: 'أمر البيع غير موجود أو لا ينتمي لهذه الشركة' },
          { status: 403 }
        )
      }
    }

    if (salesInvoiceId) {
      const si = await db.salesInvoice.findUnique({ where: { id: salesInvoiceId } })
      if (!si || si.companyId !== companyId) {
        return NextResponse.json(
          { error: 'فاتورة البيع غير موجودة أو لا تنتمي لهذه الشركة' },
          { status: 403 }
        )
      }
    }

    if (deliveryNoteId) {
      const dn = await db.deliveryNote.findUnique({ where: { id: deliveryNoteId } })
      if (!dn || dn.companyId !== companyId) {
        return NextResponse.json(
          { error: 'إذن الصرف غير موجود أو لا ينتمي لهذه الشركة' },
          { status: 403 }
        )
      }
    }

    // Validate lines
    if (!lines || !Array.isArray(lines) || lines.length === 0) {
      return NextResponse.json(
        { error: 'يجب أن تحتوي مرتجع البيع على سطر واحد على الأقل' },
        { status: 400 }
      )
    }

    // Validate each line
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      if (!line.itemId) {
        return NextResponse.json(
          { error: `الصنف مطلوب في السطر ${i + 1}` },
          { status: 400 }
        )
      }
      if (!line.quantity || line.quantity <= 0) {
        return NextResponse.json(
          { error: `الكمية يجب أن تكون أكبر من صفر في السطر ${i + 1}` },
          { status: 400 }
        )
      }
      if (line.unitPrice === undefined || line.unitPrice < 0) {
        return NextResponse.json(
          { error: `سعر الوحدة غير صالح في السطر ${i + 1}` },
          { status: 400 }
        )
      }
    }

    // Calculate each line's totalAmount and the overall totalAmount
    const processedLines = lines.map(
      (l: { itemId: string; quantity: number; unitPrice: number }) => ({
        itemId: l.itemId,
        quantity: l.quantity,
        unitPrice: l.unitPrice,
        totalAmount: l.quantity * l.unitPrice,
      })
    )

    const totalAmount = processedLines.reduce(
      (sum: number, l: { totalAmount: number }) => sum + l.totalAmount,
      0
    )

    // Generate return number: SRET-{year}-{seq}
    const returnDate = date ? new Date(date) : new Date()
    const year = returnDate.getFullYear()
    const prefix = `SRET-${year}`

    const lastReturn = await db.salesReturn.findFirst({
      where: { companyId, number: { startsWith: prefix } },
      orderBy: { number: 'desc' },
      select: { number: true },
    })

    let seq = 1
    if (lastReturn) {
      const lastSeq = parseInt(lastReturn.number.split('-').pop() || '0', 10)
      if (!isNaN(lastSeq)) seq = lastSeq + 1
    }

    const number = generateDocNumber('SRET', year, seq)

    // Create the sales return
    const salesReturn = await db.salesReturn.create({
      data: {
        companyId,
        number,
        date: returnDate,
        status: 'DRAFT',
        customerId,
        warehouseId,
        salesOrderId: salesOrderId || null,
        salesInvoiceId: salesInvoiceId || null,
        deliveryNoteId: deliveryNoteId || null,
        totalAmount: Math.round(totalAmount * 100) / 100,
        notes: notes || null,
        lines: {
          create: processedLines,
        },
      },
      include: {
        customer: {
          select: {
            id: true,
            code: true,
            nameAr: true,
            nameEn: true,
          },
        },
        warehouse: {
          select: {
            id: true,
            code: true,
            nameAr: true,
            nameEn: true,
          },
        },
        salesOrder: {
          select: {
            id: true,
            number: true,
          },
        },
        salesInvoice: {
          select: {
            id: true,
            number: true,
          },
        },
        deliveryNote: {
          select: {
            id: true,
            number: true,
          },
        },
        lines: {
          include: {
            item: {
              select: {
                id: true,
                code: true,
                nameAr: true,
                nameEn: true,
                sellPrice: true,
              },
            },
          },
        },
      },
    })

    return NextResponse.json(salesReturn, { status: 201 })
  } catch (error) {
    if (error instanceof Error && (error.message.includes('غير مصرح') || error.message.includes('صلاحية'))) {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }
    console.error('Create sales return error:', error)
    return NextResponse.json(
      { error: 'فشل في إنشاء مرتجع البيع' },
      { status: 500 }
    )
  }
}
