import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { generateDocNumber } from '@/lib/erp-utils'
import { requirePermission } from '@/lib/auth-guard'

// GET /api/sales/invoices - List sales invoices with filters
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
    const itemId = searchParams.get('itemId')

    const where: Record<string, unknown> = { companyId }

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
    if (itemId) {
      where.lines = { some: { itemId } }
    }

    const invoices = await db.salesInvoice.findMany({
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
        _count: {
          select: { lines: true },
        },
      },
    })

    return NextResponse.json(invoices)
  } catch (error) {
    if (error instanceof Error && (error.message.includes('غير مصرح') || error.message.includes('صلاحية'))) {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }
    console.error('Get sales invoices error:', error)
    return NextResponse.json(
      { error: 'فشل في تحميل فواتير البيع' },
      { status: 500 }
    )
  }
}

// POST /api/sales/invoices - Create sales invoice
export async function POST(request: NextRequest) {
  try {
    const user = await requirePermission('sales.create', request)
    const body = await request.json()
    const {
      companyId,
      customerId,
      date,
      dueDate,
      discountAmount,
      discountPercent,
      taxAmount,
      taxPercent,
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

    // Validate lines
    if (!lines || !Array.isArray(lines) || lines.length === 0) {
      return NextResponse.json(
        { error: 'يجب أن تحتوي الفاتورة على سطر واحد على الأقل' },
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

    // Calculate totals
    const subtotal = lines.reduce(
      (sum: number, l: { quantity: number; unitPrice: number; discountAmount?: number; taxAmount?: number }) => {
        const lineDiscount = l.discountAmount || 0
        const lineTotal = l.quantity * l.unitPrice - lineDiscount
        return sum + lineTotal
      },
      0
    )

    const invoiceDiscountAmount = discountAmount || 0
    const invoiceTaxAmount = taxAmount || 0
    const totalAmount = subtotal - invoiceDiscountAmount + invoiceTaxAmount

    // Calculate each line's totalAmount
    const processedLines = lines.map(
      (l: { itemId: string; quantity: number; unitPrice: number; discountAmount?: number; taxAmount?: number }) => ({
        itemId: l.itemId,
        quantity: l.quantity,
        unitPrice: l.unitPrice,
        discountAmount: l.discountAmount || 0,
        taxAmount: l.taxAmount || 0,
        totalAmount: l.quantity * l.unitPrice - (l.discountAmount || 0) + (l.taxAmount || 0),
      })
    )

    // Generate invoice number: SI-{year}-{seq}
    const invoiceDate = date ? new Date(date) : new Date()
    const year = invoiceDate.getFullYear()
    const prefix = `SI-${year}`

    const lastInvoice = await db.salesInvoice.findFirst({
      where: { companyId, number: { startsWith: prefix } },
      orderBy: { number: 'desc' },
      select: { number: true },
    })

    let seq = 1
    if (lastInvoice) {
      const lastSeq = parseInt(lastInvoice.number.split('-').pop() || '0', 10)
      if (!isNaN(lastSeq)) seq = lastSeq + 1
    }

    const number = generateDocNumber('SI', year, seq)

    // Create the invoice
    const invoice = await db.salesInvoice.create({
      data: {
        companyId,
        number,
        customerId,
        date: invoiceDate,
        dueDate: dueDate ? new Date(dueDate) : null,
        status: 'DRAFT',
        subtotal: Math.round(subtotal * 100) / 100,
        discountAmount: Math.round(invoiceDiscountAmount * 100) / 100,
        discountPercent: discountPercent || 0,
        taxAmount: Math.round(invoiceTaxAmount * 100) / 100,
        taxPercent: taxPercent || 0,
        totalAmount: Math.round(totalAmount * 100) / 100,
        paidAmount: 0,
        balanceDue: Math.round(totalAmount * 100) / 100,
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

    return NextResponse.json(invoice, { status: 201 })
  } catch (error) {
    if (error instanceof Error && (error.message.includes('غير مصرح') || error.message.includes('صلاحية'))) {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }
    console.error('Create sales invoice error:', error)
    return NextResponse.json(
      { error: 'فشل في إنشاء فاتورة البيع' },
      { status: 500 }
    )
  }
}
