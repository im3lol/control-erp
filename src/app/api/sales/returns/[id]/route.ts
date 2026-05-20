import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth-guard'
import { generateDocNumber } from '@/lib/erp-utils'

// GET /api/sales/returns/[id] - Get single sales return with full details
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

    const salesReturn = await db.salesReturn.findUnique({
      where: { id },
      include: {
        customer: {
          select: { id: true, code: true, nameAr: true, nameEn: true, phone: true, address: true },
        },
        warehouse: {
          select: { id: true, code: true, nameAr: true, nameEn: true, type: true },
        },
        salesOrder: {
          select: { id: true, number: true, status: true },
        },
        salesInvoice: {
          select: { id: true, number: true, totalAmount: true, status: true },
        },
        deliveryNote: {
          select: { id: true, number: true, status: true },
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
                uom: {
                  select: { id: true, nameAr: true, code: true },
                },
              },
            },
          },
          orderBy: { id: 'asc' },
        },
      },
    })

    if (!salesReturn) {
      return NextResponse.json(
        { error: 'مرتجع البيع غير موجود' },
        { status: 404 }
      )
    }

    // Verify the sales return belongs to the company
    if (salesReturn.companyId !== companyId) {
      return NextResponse.json(
        { error: 'Sales return does not belong to this company' },
        { status: 403 }
      )
    }

    return NextResponse.json(salesReturn)
  } catch (error) {
    if (error instanceof Error && (error.message.includes('غير مصرح') || error.message.includes('صلاحية'))) {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }
    console.error('Get sales return error:', error)
    return NextResponse.json(
      { error: 'فشل في تحميل مرتجع البيع' },
      { status: 500 }
    )
  }
}

// PUT /api/sales/returns/[id] - Actions on sales return
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

    const salesReturn = await db.salesReturn.findUnique({
      where: { id },
      include: {
        lines: {
          include: {
            item: true,
          },
        },
        customer: true,
        warehouse: true,
      },
    })

    if (!salesReturn) {
      return NextResponse.json(
        { error: 'مرتجع البيع غير موجود' },
        { status: 404 }
      )
    }

    // Verify the sales return belongs to the company
    if (salesReturn.companyId !== companyId) {
      return NextResponse.json(
        { error: 'Sales return does not belong to this company' },
        { status: 403 }
      )
    }

    // ── CONFIRM action: Change DRAFT → CONFIRMED ──
    if (action === 'confirm') {
      const user = await requirePermission('sales.edit', request)

      if (salesReturn.status !== 'DRAFT') {
        return NextResponse.json(
          { error: 'يمكن تأكيد مرتجعات البيع المسودة فقط' },
          { status: 400 }
        )
      }

      const result = await db.$transaction(async (tx) => {
        // For each line: create IN stock movement, update ItemBalance
        for (const line of salesReturn.lines) {
          const qty = line.quantity
          const unitCost = line.unitPrice
          const totalCost = qty * unitCost

          // ── 1. Create IN StockMovement (items returning to warehouse) ──
          const smPrefix = `SM-${new Date(salesReturn.date).getFullYear()}`
          const lastSM = await tx.stockMovement.findFirst({
            where: { companyId, number: { startsWith: smPrefix } },
            orderBy: { number: 'desc' },
            select: { number: true },
          })
          let seq = 1
          if (lastSM) {
            seq = parseInt(lastSM.number.split('-').pop() || '0', 10) + 1
          }
          const smNumber = generateDocNumber('SM', new Date(salesReturn.date).getFullYear(), seq)

          await tx.stockMovement.create({
            data: {
              companyId,
              number: smNumber,
              type: 'IN',
              itemId: line.itemId,
              warehouseId: salesReturn.warehouseId,
              quantity: qty,
              unitCost,
              totalCost,
              referenceType: 'SALES_RETURN',
              referenceId: salesReturn.id,
              reason: `مرتجع بيع ${salesReturn.number} - دخول`,
              date: salesReturn.date,
            },
          })

          // ── 2. Update ItemBalance (increase quantity and recalculate avgCost) ──
          const balance = await tx.itemBalance.findUnique({
            where: {
              itemId_warehouseId: {
                itemId: line.itemId,
                warehouseId: salesReturn.warehouseId,
              },
            },
          })

          if (balance) {
            const newQty = balance.quantity + qty
            // Recalculate avgCost: weighted average of existing stock and returned items
            const newAvgCost = newQty > 0
              ? (balance.quantity * balance.avgCost + totalCost) / newQty
              : 0
            await tx.itemBalance.update({
              where: { id: balance.id },
              data: {
                quantity: newQty,
                avgCost: Math.max(0, newAvgCost),
              },
            })
          } else {
            // Create new balance record if none exists
            await tx.itemBalance.create({
              data: {
                itemId: line.itemId,
                warehouseId: salesReturn.warehouseId,
                quantity: qty,
                avgCost: qty > 0 ? unitCost : 0,
              },
            })
          }
        }

        // ── 3. Update sales return status to CONFIRMED ──
        const updated = await tx.salesReturn.update({
          where: { id },
          data: { status: 'CONFIRMED' },
          include: {
            customer: { select: { id: true, code: true, nameAr: true, nameEn: true } },
            warehouse: { select: { id: true, code: true, nameAr: true, nameEn: true } },
            salesOrder: { select: { id: true, number: true } },
            salesInvoice: { select: { id: true, number: true } },
            deliveryNote: { select: { id: true, number: true } },
            lines: {
              include: {
                item: { select: { id: true, code: true, nameAr: true, nameEn: true } },
              },
            },
          },
        })

        return updated
      })

      return NextResponse.json(result)
    }

    // ── CANCEL action: Change to CANCELLED (only from DRAFT) ──
    if (action === 'cancel') {
      const user = await requirePermission('sales.edit', request)

      if (salesReturn.status !== 'DRAFT') {
        return NextResponse.json(
          { error: 'يمكن إلغاء مرتجعات البيع المسودة فقط' },
          { status: 400 }
        )
      }

      const updated = await db.salesReturn.update({
        where: { id },
        data: { status: 'CANCELLED' },
        include: {
          customer: { select: { id: true, code: true, nameAr: true, nameEn: true } },
          warehouse: { select: { id: true, code: true, nameAr: true, nameEn: true } },
          salesOrder: { select: { id: true, number: true } },
          salesInvoice: { select: { id: true, number: true } },
          deliveryNote: { select: { id: true, number: true } },
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
      const user = await requirePermission('sales.edit', request)

      if (salesReturn.status !== 'DRAFT') {
        return NextResponse.json(
          { error: 'يمكن تعديل مرتجعات البيع المسودة فقط' },
          { status: 400 }
        )
      }

      const {
        customerId,
        date,
        warehouseId,
        salesOrderId,
        salesInvoiceId,
        deliveryNoteId,
        notes,
        lines: newLines,
      } = body

      // Validate customer if changed
      if (customerId && customerId !== salesReturn.customerId) {
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

      // Validate warehouse if changed
      if (warehouseId && warehouseId !== salesReturn.warehouseId) {
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
      }

      // Validate linked documents if changed
      if (salesOrderId !== undefined && salesOrderId !== null && salesOrderId !== salesReturn.salesOrderId) {
        const so = await db.salesOrder.findUnique({ where: { id: salesOrderId } })
        if (!so || so.companyId !== companyId) {
          return NextResponse.json(
            { error: 'أمر البيع غير موجود أو لا ينتمي لهذه الشركة' },
            { status: 403 }
          )
        }
      }

      if (salesInvoiceId !== undefined && salesInvoiceId !== null && salesInvoiceId !== salesReturn.salesInvoiceId) {
        const si = await db.salesInvoice.findUnique({ where: { id: salesInvoiceId } })
        if (!si || si.companyId !== companyId) {
          return NextResponse.json(
            { error: 'فاتورة البيع غير موجودة أو لا تنتمي لهذه الشركة' },
            { status: 403 }
          )
        }
      }

      if (deliveryNoteId !== undefined && deliveryNoteId !== null && deliveryNoteId !== salesReturn.deliveryNoteId) {
        const dn = await db.deliveryNote.findUnique({ where: { id: deliveryNoteId } })
        if (!dn || dn.companyId !== companyId) {
          return NextResponse.json(
            { error: 'إذن الصرف غير موجود أو لا ينتمي لهذه الشركة' },
            { status: 403 }
          )
        }
      }

      // Validate lines if provided
      if (newLines && Array.isArray(newLines)) {
        if (newLines.length === 0) {
          return NextResponse.json(
            { error: 'يجب أن تحتوي مرتجع البيع على سطر واحد على الأقل' },
            { status: 400 }
          )
        }

        for (let i = 0; i < newLines.length; i++) {
          const line = newLines[i]
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
      }

      // Recalculate totals
      const processedLines = newLines
        ? newLines.map(
            (l: { itemId: string; quantity: number; unitPrice: number }) => ({
              itemId: l.itemId,
              quantity: l.quantity,
              unitPrice: l.unitPrice,
              totalAmount: l.quantity * l.unitPrice,
            })
          )
        : null

      const totalAmount = processedLines
        ? processedLines.reduce((sum: number, l: { totalAmount: number }) => sum + l.totalAmount, 0)
        : undefined

      // Build update data
      const updateData: Record<string, unknown> = {}
      if (customerId !== undefined) updateData.customerId = customerId
      if (date !== undefined) updateData.date = new Date(date)
      if (warehouseId !== undefined) updateData.warehouseId = warehouseId
      if (salesOrderId !== undefined) updateData.salesOrderId = salesOrderId || null
      if (salesInvoiceId !== undefined) updateData.salesInvoiceId = salesInvoiceId || null
      if (deliveryNoteId !== undefined) updateData.deliveryNoteId = deliveryNoteId || null
      if (notes !== undefined) updateData.notes = notes || null
      if (totalAmount !== undefined) updateData.totalAmount = Math.round(totalAmount * 100) / 100

      // If lines are provided, delete old and create new
      if (processedLines) {
        await db.salesReturnLine.deleteMany({
          where: { salesReturnId: id },
        })

        updateData.lines = {
          create: processedLines,
        }
      }

      const updated = await db.salesReturn.update({
        where: { id },
        data: updateData,
        include: {
          customer: { select: { id: true, code: true, nameAr: true, nameEn: true } },
          warehouse: { select: { id: true, code: true, nameAr: true, nameEn: true } },
          salesOrder: { select: { id: true, number: true } },
          salesInvoice: { select: { id: true, number: true } },
          deliveryNote: { select: { id: true, number: true } },
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
      { error: 'إجراء غير صالح. استخدم: confirm, cancel, update' },
      { status: 400 }
    )
  } catch (error) {
    if (error instanceof Error && (error.message.includes('غير مصرح') || error.message.includes('صلاحية'))) {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }
    console.error('Sales return action error:', error)
    return NextResponse.json(
      { error: 'فشل في معالجة إجراء مرتجع البيع' },
      { status: 500 }
    )
  }
}
