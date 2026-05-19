import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth-guard'

// GET /api/purchases/orders/[id] - Get single purchase order with full details
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requirePermission('purchases.view', request)
    const { id } = await params
    const { searchParams } = new URL(request.url)
    const companyId = searchParams.get('companyId')
    if (!companyId) {
      return NextResponse.json({ error: 'companyId is required' }, { status: 400 })
    }

    const order = await db.purchaseOrder.findUnique({
      where: { id },
      include: {
        supplier: true,
        warehouse: true,
        lines: {
          include: {
            item: {
              select: { id: true, code: true, nameAr: true, nameEn: true, uom: { select: { nameAr: true } } },
            },
          },
          orderBy: { id: 'asc' },
        },
        purchaseReceipts: {
          select: { id: true, number: true, date: true, status: true },
        },
      },
    })

    if (!order) {
      return NextResponse.json(
        { error: 'أمر الشراء غير موجود' },
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
    console.error('Get purchase order error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch purchase order' },
      { status: 500 }
    )
  }
}

// PUT /api/purchases/orders/[id] - Actions: update, confirm, cancel, close
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

    const order = await db.purchaseOrder.findUnique({
      where: { id },
      include: {
        lines: {
          include: {
            item: true,
          },
        },
      },
    })

    if (!order) {
      return NextResponse.json(
        { error: 'أمر الشراء غير موجود' },
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

    // ── CONFIRM action: DRAFT → CONFIRMED ──
    if (action === 'confirm') {
      await requirePermission('purchases.confirm', request)

      if (order.status !== 'DRAFT') {
        return NextResponse.json(
          { error: 'يمكن تأكيد أوامر الشراء المسودة فقط' },
          { status: 400 }
        )
      }

      const updated = await db.purchaseOrder.update({
        where: { id },
        data: { status: 'CONFIRMED' },
        include: {
          supplier: { select: { id: true, code: true, nameAr: true, nameEn: true } },
          warehouse: { select: { id: true, code: true, nameAr: true } },
          lines: {
            include: {
              item: { select: { id: true, code: true, nameAr: true, nameEn: true } },
            },
          },
        },
      })

      return NextResponse.json(updated)
    }

    // ── CANCEL action ──
    if (action === 'cancel') {
      await requirePermission('purchases.edit', request)

      if (order.status === 'CANCELLED') {
        return NextResponse.json(
          { error: 'أمر الشراء ملغى بالفعل' },
          { status: 400 }
        )
      }

      if (order.status === 'CLOSED') {
        return NextResponse.json(
          { error: 'لا يمكن إلغاء أمر شراء مغلقة' },
          { status: 400 }
        )
      }

      // Only DRAFT or CONFIRMED can be cancelled
      if (order.status !== 'DRAFT' && order.status !== 'CONFIRMED') {
        return NextResponse.json(
          { error: 'لا يمكن إلغاء أمر الشراء في حالته الحالية' },
          { status: 400 }
        )
      }

      const updated = await db.purchaseOrder.update({
        where: { id },
        data: { status: 'CANCELLED' },
        include: {
          supplier: { select: { id: true, code: true, nameAr: true, nameEn: true } },
          warehouse: { select: { id: true, code: true, nameAr: true } },
          lines: {
            include: {
              item: { select: { id: true, code: true, nameAr: true, nameEn: true } },
            },
          },
        },
      })

      return NextResponse.json(updated)
    }

    // ── CLOSE action: → CLOSED (when fully received) ──
    if (action === 'close') {
      await requirePermission('purchases.edit', request)

      if (order.status !== 'CONFIRMED') {
        return NextResponse.json(
          { error: 'يمكن إغلاق أوامر الشراء المؤكدة فقط' },
          { status: 400 }
        )
      }

      // Check if all lines are fully received
      const allReceived = order.lines.every(
        (line) => line.receivedQty >= line.quantity
      )

      if (!allReceived) {
        return NextResponse.json(
          { error: 'لا يمكن إغلاق أمر الشراء قبل استلام جميع الكميات' },
          { status: 400 }
        )
      }

      const updated = await db.purchaseOrder.update({
        where: { id },
        data: { status: 'CLOSED' },
        include: {
          supplier: { select: { id: true, code: true, nameAr: true, nameEn: true } },
          warehouse: { select: { id: true, code: true, nameAr: true } },
          lines: {
            include: {
              item: { select: { id: true, code: true, nameAr: true, nameEn: true } },
            },
          },
        },
      })

      return NextResponse.json(updated)
    }

    // ── UPDATE action: Only if DRAFT ──
    if (action === 'update') {
      await requirePermission('purchases.edit', request)

      if (order.status !== 'DRAFT') {
        return NextResponse.json(
          { error: 'يمكن تعديل أوامر الشراء المسودة فقط' },
          { status: 400 }
        )
      }

      const {
        supplierId,
        warehouseId,
        date,
        discountAmount,
        discountPercent,
        taxPercent,
        notes,
        lines: newLines,
      } = body

      if (newLines && Array.isArray(newLines)) {
        if (newLines.length === 0) {
          return NextResponse.json(
            { error: 'يجب أن يحتوي أمر الشراء على سطر واحد على الأقل' },
            { status: 400 }
          )
        }

        // Recalculate totals
        const processedLines = newLines.map((line: { itemId: string; quantity: number; unitPrice: number; discountAmount?: number; taxAmount?: number }) => {
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

        const rawSubtotal = processedLines.reduce((sum: number, l: { quantity: number; unitPrice: number }) => sum + (l.quantity * l.unitPrice), 0)
        const totalLineDiscounts = processedLines.reduce((sum: number, l: { discountAmount: number }) => sum + l.discountAmount, 0)
        const totalLineTaxes = processedLines.reduce((sum: number, l: { taxAmount: number }) => sum + l.taxAmount, 0)

        const invoiceDiscount = parseFloat(String(discountAmount)) || 0
        const invoiceTaxPercent = parseFloat(String(taxPercent)) || 0
        const afterDiscount = rawSubtotal - totalLineDiscounts - invoiceDiscount
        const invoiceTax = invoiceTaxPercent > 0 ? afterDiscount * (invoiceTaxPercent / 100) : 0
        const totalTax = totalLineTaxes + invoiceTax
        const totalAmount = afterDiscount + totalTax

        // Delete old lines and create new ones
        await db.purchaseOrderLine.deleteMany({
          where: { purchaseOrderId: id },
        })

        const updated = await db.purchaseOrder.update({
          where: { id },
          data: {
            ...(supplierId !== undefined && { supplierId }),
            ...(warehouseId !== undefined && { warehouseId }),
            ...(date !== undefined && { date: new Date(date) }),
            subtotal: rawSubtotal - totalLineDiscounts,
            discountAmount: invoiceDiscount,
            discountPercent: parseFloat(String(discountPercent)) || 0,
            taxAmount: totalTax,
            taxPercent: invoiceTaxPercent,
            totalAmount,
            notes: notes || null,
            lines: {
              create: processedLines,
            },
          },
          include: {
            supplier: { select: { id: true, code: true, nameAr: true, nameEn: true } },
            warehouse: { select: { id: true, code: true, nameAr: true } },
            lines: {
              include: {
                item: { select: { id: true, code: true, nameAr: true, nameEn: true } },
              },
            },
          },
        })

        return NextResponse.json(updated)
      }

      // Update without changing lines
      const updateData: Record<string, unknown> = {}
      if (supplierId !== undefined) updateData.supplierId = supplierId
      if (warehouseId !== undefined) updateData.warehouseId = warehouseId
      if (date !== undefined) updateData.date = new Date(date)
      if (notes !== undefined) updateData.notes = notes || null

      const updated = await db.purchaseOrder.update({
        where: { id },
        data: updateData,
        include: {
          supplier: { select: { id: true, code: true, nameAr: true, nameEn: true } },
          warehouse: { select: { id: true, code: true, nameAr: true } },
          lines: {
            include: {
              item: { select: { id: true, code: true, nameAr: true, nameEn: true } },
            },
          },
        },
      })

      return NextResponse.json(updated)
    }

    return NextResponse.json(
      { error: 'إجراء غير صالح. استخدم: update, confirm, cancel, close' },
      { status: 400 }
    )
  } catch (error) {
    if (error instanceof Error && (error.message.includes('غير مصرح') || error.message.includes('صلاحية'))) {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }
    console.error('Purchase order action error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to process purchase order action' },
      { status: 500 }
    )
  }
}
