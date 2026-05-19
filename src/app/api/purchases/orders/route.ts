import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { generateDocNumber } from '@/lib/erp-utils'
import { requirePermission } from '@/lib/auth-guard'

// GET /api/purchases/orders - List purchase orders with filters
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
    const itemId = searchParams.get('itemId')

    const where: Record<string, unknown> = { companyId }

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
    if (itemId) {
      where.lines = { some: { itemId } }
    }

    const orders = await db.purchaseOrder.findMany({
      where,
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
      include: {
        supplier: {
          select: { id: true, code: true, nameAr: true, nameEn: true },
        },
        warehouse: {
          select: { id: true, code: true, nameAr: true },
        },
        _count: {
          select: { lines: true },
        },
      },
    })

    return NextResponse.json(orders)
  } catch (error) {
    if (error instanceof Error && (error.message.includes('غير مصرح') || error.message.includes('صلاحية'))) {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }
    console.error('Get purchase orders error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch purchase orders' },
      { status: 500 }
    )
  }
}

// POST /api/purchases/orders - Create purchase order
export async function POST(request: NextRequest) {
  try {
    const user = await requirePermission('purchases.create', request)
    const body = await request.json()
    const {
      companyId,
      supplierId,
      warehouseId,
      date,
      notes,
      discountAmount,
      discountPercent,
      taxPercent,
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
        { error: 'يجب أن يحتوي أمر الشراء على سطر واحد على الأقل' },
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

    // Calculate line totals and subtotal
    const processedLines = lines.map((line: { itemId: string; quantity: number; unitPrice: number; discountAmount?: number; taxAmount?: number }) => {
      const quantity = parseFloat(String(line.quantity)) || 0
      const unitPrice = parseFloat(String(line.unitPrice)) || 0
      const lineDiscount = parseFloat(String(line.discountAmount)) || 0
      const lineTax = parseFloat(String(line.taxAmount)) || 0
      const lineTotal = quantity * unitPrice - lineDiscount + lineTax

      return {
        itemId: line.itemId,
        quantity,
        unitPrice,
        discountAmount: lineDiscount,
        taxAmount: lineTax,
        totalAmount: lineTotal,
      }
    })

    // Recalculate: subtotal = sum of (qty * price) for each line before line-level discounts and taxes
    const rawSubtotal = processedLines.reduce((sum: number, l: { quantity: number; unitPrice: number }) => sum + (l.quantity * l.unitPrice), 0)
    const totalLineDiscounts = processedLines.reduce((sum: number, l: { discountAmount: number }) => sum + l.discountAmount, 0)
    const totalLineTaxes = processedLines.reduce((sum: number, l: { taxAmount: number }) => sum + l.taxAmount, 0)

    const invoiceDiscount = parseFloat(String(discountAmount)) || 0
    const invoiceTaxPercent = parseFloat(String(taxPercent)) || 0
    const afterDiscount = rawSubtotal - totalLineDiscounts - invoiceDiscount
    const invoiceTax = invoiceTaxPercent > 0 ? afterDiscount * (invoiceTaxPercent / 100) : 0
    const totalTax = totalLineTaxes + invoiceTax
    const totalAmount = afterDiscount + totalTax

    // Generate order number: PO-{year}-{seq}
    const orderDate = new Date(date || Date.now())
    const year = orderDate.getFullYear()
    const prefix = `PO-${year}`

    const lastOrder = await db.purchaseOrder.findFirst({
      where: { companyId, number: { startsWith: prefix } },
      orderBy: { number: 'desc' },
      select: { number: true },
    })

    let seq = 1
    if (lastOrder) {
      const lastSeq = parseInt(lastOrder.number.split('-').pop() || '0', 10)
      seq = lastSeq + 1
    }

    const number = generateDocNumber('PO', year, seq)

    // Create order with lines
    const order = await db.purchaseOrder.create({
      data: {
        companyId,
        number,
        supplierId,
        warehouseId,
        date: orderDate,
        status: 'DRAFT',
        subtotal: rawSubtotal - totalLineDiscounts,
        discountAmount: invoiceDiscount,
        discountPercent: invoiceTaxPercent > 0 ? 0 : (parseFloat(String(discountPercent)) || 0),
        taxAmount: totalTax,
        taxPercent: invoiceTaxPercent,
        totalAmount,
        notes: notes || null,
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
        lines: {
          include: {
            item: {
              select: { id: true, code: true, nameAr: true, nameEn: true },
            },
          },
        },
      },
    })

    return NextResponse.json(order, { status: 201 })
  } catch (error) {
    if (error instanceof Error && (error.message.includes('غير مصرح') || error.message.includes('صلاحية'))) {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }
    console.error('Create purchase order error:', error)
    return NextResponse.json(
      { error: 'Failed to create purchase order' },
      { status: 500 }
    )
  }
}
