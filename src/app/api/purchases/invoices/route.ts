import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { generateDocNumber } from '@/lib/erp-utils'

// GET /api/purchases/invoices - List purchase invoices with filters
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const supplierId = searchParams.get('supplierId')
    const fromDate = searchParams.get('fromDate')
    const toDate = searchParams.get('toDate')

    const where: Record<string, unknown> = {}

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

    const invoices = await db.purchaseInvoice.findMany({
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

    return NextResponse.json(invoices)
  } catch (error) {
    console.error('Get purchase invoices error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch purchase invoices' },
      { status: 500 }
    )
  }
}

// POST /api/purchases/invoices - Create purchase invoice
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      supplierId,
      warehouseId,
      date,
      dueDate,
      discountAmount,
      discountPercent,
      taxPercent,
      notes,
      lines,
    } = body

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
        { error: 'يجب أن تحتوي الفاتورة على سطر واحد على الأقل' },
        { status: 400 }
      )
    }

    // Validate supplier exists
    const supplier = await db.supplier.findUnique({ where: { id: supplierId } })
    if (!supplier) {
      return NextResponse.json(
        { error: 'المورد غير موجود' },
        { status: 404 }
      )
    }

    // Validate warehouse exists
    const warehouse = await db.warehouse.findUnique({ where: { id: warehouseId } })
    if (!warehouse) {
      return NextResponse.json(
        { error: 'المخزن غير موجود' },
        { status: 404 }
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

    const subtotal = processedLines.reduce((sum: number, l: { totalAmount: number; discountAmount: number; taxAmount: number }) => sum + l.totalAmount - l.taxAmount + l.discountAmount, 0)
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

    // Generate invoice number: PI-{year}-{seq}
    const invoiceDate = new Date(date || Date.now())
    const year = invoiceDate.getFullYear()
    const prefix = `PI-${year}`

    const lastInvoice = await db.purchaseInvoice.findFirst({
      where: { number: { startsWith: prefix } },
      orderBy: { number: 'desc' },
      select: { number: true },
    })

    let seq = 1
    if (lastInvoice) {
      const lastSeq = parseInt(lastInvoice.number.split('-').pop() || '0', 10)
      seq = lastSeq + 1
    }

    const number = generateDocNumber('PI', year, seq)

    // Create invoice with lines
    const invoice = await db.purchaseInvoice.create({
      data: {
        number,
        supplierId,
        warehouseId,
        date: invoiceDate,
        dueDate: dueDate ? new Date(dueDate) : null,
        status: 'DRAFT',
        subtotal: rawSubtotal - totalLineDiscounts,
        discountAmount: invoiceDiscount,
        discountPercent: invoiceTaxPercent > 0 ? 0 : (parseFloat(String(discountPercent)) || 0),
        taxAmount: totalTax,
        taxPercent: invoiceTaxPercent,
        totalAmount,
        paidAmount: 0,
        balanceDue: totalAmount,
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

    return NextResponse.json(invoice, { status: 201 })
  } catch (error) {
    console.error('Create purchase invoice error:', error)
    return NextResponse.json(
      { error: 'Failed to create purchase invoice' },
      { status: 500 }
    )
  }
}
