import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth-guard'

// GET /api/sales/orders/[id] - Get single sales order with full details
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requirePermission('sales.view', request)
    const { id } = await params
    const { searchParams } = new URL(request.url)
    const companyId = searchParams.get('companyId')
    if (!companyId) {
      return NextResponse.json({ error: 'companyId is required' }, { status: 400 })
    }

    const order = await db.salesOrder.findUnique({
      where: { id },
      include: {
        customer: true,
        lines: {
          include: {
            item: {
              select: {
                id: true,
                code: true,
                nameAr: true,
                nameEn: true,
                sellPrice: true,
                uom: {
                  select: { id: true, nameAr: true, code: true },
                },
              },
            },
          },
          orderBy: { id: 'asc' },
        },
        deliveryNotes: {
          select: {
            id: true,
            number: true,
            date: true,
            status: true,
            _count: {
              select: { lines: true },
            },
          },
          orderBy: { date: 'desc' },
        },
      },
    })

    if (!order) {
      return NextResponse.json(
        { error: 'أمر البيع غير موجود' },
        { status: 404 }
      )
    }

    // Verify the order belongs to the company
    if (order.companyId !== companyId) {
      return NextResponse.json(
        { error: 'Order does not belong to this company' },
        { status: 403 }
      )
    }

    return NextResponse.json(order)
  } catch (error) {
    if (error instanceof Error && (error.message.includes('غير مصرح') || error.message.includes('صلاحية'))) {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }
    console.error('Get sales order error:', error)
    return NextResponse.json(
      { error: 'فشل في تحميل أمر البيع' },
      { status: 500 }
    )
  }
}

// PUT /api/sales/orders/[id] - Actions on sales order
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { companyId, action } = body

    if (!companyId) {
      return NextResponse.json({ error: 'companyId is required' }, { status: 400 })
    }

    const order = await db.salesOrder.findUnique({
      where: { id },
      include: {
        lines: true,
        customer: true,
      },
    })

    if (!order) {
      return NextResponse.json(
        { error: 'أمر البيع غير موجود' },
        { status: 404 }
      )
    }

    // Verify the order belongs to the company
    if (order.companyId !== companyId) {
      return NextResponse.json(
        { error: 'Order does not belong to this company' },
        { status: 403 }
      )
    }

    // ── CONFIRM action: Change DRAFT → CONFIRMED ──
    if (action === 'confirm') {
      const user = await requirePermission('sales.edit', request)

      if (order.status !== 'DRAFT') {
        return NextResponse.json(
          { error: 'يمكن تأكيد أوامر البيع المسودة فقط' },
          { status: 400 }
        )
      }

      const updated = await db.salesOrder.update({
        where: { id },
        data: { status: 'CONFIRMED' },
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
                },
              },
            },
          },
        },
      })

      return NextResponse.json(updated)
    }

    // ── CANCEL action: Change DRAFT/CONFIRMED → CANCELLED ──
    if (action === 'cancel') {
      const user = await requirePermission('sales.edit', request)

      if (order.status !== 'DRAFT' && order.status !== 'CONFIRMED') {
        return NextResponse.json(
          { error: 'يمكن إلغاء أوامر البيع المسودة أو المؤكدة فقط' },
          { status: 400 }
        )
      }

      const updated = await db.salesOrder.update({
        where: { id },
        data: { status: 'CANCELLED' },
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
                },
              },
            },
          },
        },
      })

      return NextResponse.json(updated)
    }

    // ── CLOSE action: Change CONFIRMED → CLOSED (when fully delivered) ──
    if (action === 'close') {
      const user = await requirePermission('sales.edit', request)

      if (order.status !== 'CONFIRMED') {
        return NextResponse.json(
          { error: 'يمكن إغلاق أوامر البيع المؤكدة فقط' },
          { status: 400 }
        )
      }

      // Check if all lines are fully delivered
      const allDelivered = order.lines.every(
        (line) => line.deliveredQty >= line.quantity
      )

      if (!allDelivered) {
        return NextResponse.json(
          { error: 'لا يمكن إغلاق أمر البيع حتى يتم تسليم جميع الأصناف' },
          { status: 400 }
        )
      }

      const updated = await db.salesOrder.update({
        where: { id },
        data: { status: 'CLOSED' },
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
                },
              },
            },
          },
        },
      })

      return NextResponse.json(updated)
    }

    // ── UPDATE action: Only if DRAFT ──
    if (action === 'update') {
      const user = await requirePermission('sales.edit', request)

      if (order.status !== 'DRAFT') {
        return NextResponse.json(
          { error: 'يمكن تعديل أوامر البيع المسودة فقط' },
          { status: 400 }
        )
      }

      const {
        customerId,
        date,
        dueDate,
        discountAmount,
        discountPercent,
        taxPercent,
        notes,
        lines: newLines,
      } = body

      // Validate customer if changed
      if (customerId && customerId !== order.customerId) {
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
      }

      // Validate lines if provided
      if (newLines && Array.isArray(newLines)) {
        if (newLines.length === 0) {
          return NextResponse.json(
            { error: 'يجب أن يحتوي أمر البيع على سطر واحد على الأقل' },
            { status: 400 }
          )
        }
      }

      // Recalculate totals
      const processedLines = newLines
        ? newLines.map(
            (l: { itemId: string; quantity: number; unitPrice: number; discountAmount?: number; taxAmount?: number }) => ({
              itemId: l.itemId,
              quantity: l.quantity,
              unitPrice: l.unitPrice,
              discountAmount: l.discountAmount || 0,
              taxAmount: l.taxAmount || 0,
              totalAmount: l.quantity * l.unitPrice - (l.discountAmount || 0) + (l.taxAmount || 0),
            })
          )
        : null

      const subtotal = processedLines
        ? processedLines.reduce((sum: number, l: { totalAmount: number; discountAmount: number; taxAmount: number }) => {
            return sum + l.totalAmount - l.taxAmount + l.discountAmount
          }, 0)
        : undefined

      const finalDiscountAmount = discountAmount ?? order.discountAmount
      const finalTaxPercent = taxPercent ?? order.taxPercent
      const finalSubtotal = subtotal ?? order.subtotal
      const calculatedTaxAmount = Math.round(finalSubtotal * finalTaxPercent / 100 * 100) / 100
      const totalAmount = finalSubtotal - finalDiscountAmount + calculatedTaxAmount

      // Update the order
      const updateData: Record<string, unknown> = {}
      if (customerId !== undefined) updateData.customerId = customerId
      if (date !== undefined) updateData.date = new Date(date)
      if (dueDate !== undefined) updateData.dueDate = dueDate ? new Date(dueDate) : null
      if (discountAmount !== undefined) updateData.discountAmount = discountAmount
      if (discountPercent !== undefined) updateData.discountPercent = discountPercent
      if (taxPercent !== undefined) updateData.taxPercent = taxPercent
      if (notes !== undefined) updateData.notes = notes || null

      updateData.subtotal = Math.round(finalSubtotal * 100) / 100
      updateData.taxAmount = calculatedTaxAmount
      updateData.totalAmount = Math.round(totalAmount * 100) / 100

      // If lines are provided, delete old and create new
      if (processedLines) {
        await db.salesOrderLine.deleteMany({
          where: { salesOrderId: id },
        })

        updateData.lines = {
          create: processedLines,
        }
      }

      const updated = await db.salesOrder.update({
        where: { id },
        data: updateData,
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
                },
              },
            },
          },
        },
      })

      return NextResponse.json(updated)
    }

    return NextResponse.json(
      { error: 'إجراء غير صالح. استخدم: confirm, cancel, close, update' },
      { status: 400 }
    )
  } catch (error) {
    if (error instanceof Error && (error.message.includes('غير مصرح') || error.message.includes('صلاحية'))) {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }
    console.error('Sales order action error:', error)
    return NextResponse.json(
      { error: 'فشل في معالجة إجراء أمر البيع' },
      { status: 500 }
    )
  }
}
