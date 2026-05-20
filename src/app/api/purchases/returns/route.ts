import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { generateDocNumber } from '@/lib/erp-utils'
import { requirePermission } from '@/lib/auth-guard'

// GET /api/purchases/returns - List purchase returns with filters
export async function GET(request: NextRequest) {
  try {
    const user = await requirePermission('purchases.view', request)
    const { searchParams } = new URL(request.url)
    const companyId = searchParams.get('companyId')
    if (!companyId) {
      return NextResponse.json({ error: 'companyId is required' }, { status: 400 })
    }

    const status = searchParams.get('status')
    const supplierId = searchParams.get('supplierId')
    const fromDate = searchParams.get('fromDate')
    const toDate = searchParams.get('toDate')

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = { companyId }

    if (status) {
      where.status = status
    }
    if (supplierId) {
      where.supplierId = supplierId
    }
    if (fromDate || toDate) {
      where.date = {
        ...(fromDate && { gte: new Date(fromDate) }),
        ...(toDate && { lte: new Date(toDate) }),
      }
    }

    const returns = await db.purchaseReturn.findMany({
      where,
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
      include: {
        supplier: {
          select: { id: true, code: true, nameAr: true, nameEn: true },
        },
        warehouse: {
          select: { id: true, code: true, nameAr: true },
        },
        purchaseOrder: {
          select: { id: true, number: true },
        },
        purchaseInvoice: {
          select: { id: true, number: true },
        },
        purchaseReceipt: {
          select: { id: true, number: true },
        },
        lines: {
          include: {
            item: {
              select: { id: true, code: true, nameAr: true, nameEn: true },
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
    console.error('Get purchase returns error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch purchase returns' },
      { status: 500 }
    )
  }
}

// POST /api/purchases/returns - Create purchase return
export async function POST(request: NextRequest) {
  try {
    const user = await requirePermission('purchases.create', request)
    const body = await request.json()
    const {
      companyId,
      date,
      supplierId,
      warehouseId,
      purchaseOrderId,
      purchaseInvoiceId,
      purchaseReceiptId,
      notes,
      lines,
    } = body

    if (!companyId) {
      return NextResponse.json({ error: 'companyId is required' }, { status: 400 })
    }

    // Validate required fields
    if (!supplierId) {
      return NextResponse.json(
        { error: 'المورد مطلوب' },
        { status: 400 }
      )
    }

    if (!warehouseId) {
      return NextResponse.json(
        { error: 'المخزن مطلوب' },
        { status: 400 }
      )
    }

    if (!lines || !Array.isArray(lines) || lines.length === 0) {
      return NextResponse.json(
        { error: 'يجب أن يحتوي مرتجع الشراء على سطر واحد على الأقل' },
        { status: 400 }
      )
    }

    // Validate supplier exists and belongs to company
    const supplier = await db.supplier.findUnique({ where: { id: supplierId } })
    if (!supplier) {
      return NextResponse.json(
        { error: 'المورد غير موجود' },
        { status: 404 }
      )
    }
    if (supplier.companyId !== companyId) {
      return NextResponse.json(
        { error: 'Supplier does not belong to this company' },
        { status: 403 }
      )
    }

    // Validate warehouse exists and belongs to company
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
    if (purchaseOrderId) {
      const po = await db.purchaseOrder.findUnique({ where: { id: purchaseOrderId } })
      if (!po || po.companyId !== companyId) {
        return NextResponse.json(
          { error: 'أمر الشراء غير موجود أو لا ينتمي لهذه الشركة' },
          { status: 400 }
        )
      }
    }

    if (purchaseInvoiceId) {
      const pi = await db.purchaseInvoice.findUnique({ where: { id: purchaseInvoiceId } })
      if (!pi || pi.companyId !== companyId) {
        return NextResponse.json(
          { error: 'فاتورة الشراء غير موجودة أو لا تنتمي لهذه الشركة' },
          { status: 400 }
        )
      }
    }

    if (purchaseReceiptId) {
      const pr = await db.purchaseReceipt.findUnique({ where: { id: purchaseReceiptId } })
      if (!pr || pr.companyId !== companyId) {
        return NextResponse.json(
          { error: 'إذن الاستلام غير موجود أو لا ينتمي لهذه الشركة' },
          { status: 400 }
        )
      }
    }

    // Calculate line totals and totalAmount
    const processedLines = lines.map((line: { itemId: string; quantity: number; unitPrice: number; totalAmount?: number }) => {
      const quantity = parseFloat(String(line.quantity)) || 0
      const unitPrice = parseFloat(String(line.unitPrice)) || 0
      const lineTotal = quantity * unitPrice

      return {
        itemId: line.itemId,
        quantity,
        unitPrice,
        totalAmount: lineTotal,
      }
    })

    const totalAmount = processedLines.reduce(
      (sum: number, l: { totalAmount: number }) => sum + l.totalAmount,
      0
    )

    // Generate return number: PRET-{year}-{seq}
    const returnDate = new Date(date || Date.now())
    const year = returnDate.getFullYear()
    const prefix = `PRET-${year}`

    const lastReturn = await db.purchaseReturn.findFirst({
      where: { companyId, number: { startsWith: prefix } },
      orderBy: { number: 'desc' },
      select: { number: true },
    })

    let seq = 1
    if (lastReturn) {
      const lastSeq = parseInt(lastReturn.number.split('-').pop() || '0', 10)
      seq = lastSeq + 1
    }

    const number = generateDocNumber('PRET', year, seq)

    // Create purchase return with lines
    const purchaseReturn = await db.purchaseReturn.create({
      data: {
        companyId,
        number,
        date: returnDate,
        supplierId,
        warehouseId,
        purchaseOrderId: purchaseOrderId || null,
        purchaseInvoiceId: purchaseInvoiceId || null,
        purchaseReceiptId: purchaseReceiptId || null,
        totalAmount,
        notes: notes || null,
        status: 'DRAFT',
        lines: {
          create: processedLines,
        },
      },
      include: {
        supplier: {
          select: { id: true, code: true, nameAr: true, nameEn: true },
        },
        warehouse: {
          select: { id: true, code: true, nameAr: true },
        },
        purchaseOrder: {
          select: { id: true, number: true },
        },
        purchaseInvoice: {
          select: { id: true, number: true },
        },
        purchaseReceipt: {
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

    return NextResponse.json(purchaseReturn, { status: 201 })
  } catch (error) {
    if (error instanceof Error && (error.message.includes('غير مصرح') || error.message.includes('صلاحية'))) {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }
    console.error('Create purchase return error:', error)
    return NextResponse.json(
      { error: 'Failed to create purchase return' },
      { status: 500 }
    )
  }
}
