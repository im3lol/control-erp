import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { generateDocNumber } from '@/lib/erp-utils'
import { requirePermission } from '@/lib/auth-guard'

// GET /api/purchases/returns/[id] - Get single purchase return with full details
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

    const purchaseReturn = await db.purchaseReturn.findUnique({
      where: { id },
      include: {
        supplier: {
          select: { id: true, code: true, nameAr: true, nameEn: true, phone: true, address: true },
        },
        warehouse: {
          select: { id: true, code: true, nameAr: true, nameEn: true, type: true },
        },
        purchaseOrder: {
          select: { id: true, number: true, status: true },
        },
        purchaseInvoice: {
          select: { id: true, number: true, totalAmount: true, status: true },
        },
        purchaseReceipt: {
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
                uom: { select: { nameAr: true } },
              },
            },
          },
          orderBy: { id: 'asc' },
        },
      },
    })

    if (!purchaseReturn) {
      return NextResponse.json(
        { error: 'مرتجع الشراء غير موجود' },
        { status: 404 }
      )
    }

    // Verify the return belongs to the company
    if (purchaseReturn.companyId !== companyId) {
      return NextResponse.json(
        { error: 'مرتجع الشراء لا ينتمي لهذه الشركة' },
        { status: 403 }
      )
    }

    return NextResponse.json(purchaseReturn)
  } catch (error) {
    if (error instanceof Error && (error.message.includes('غير مصرح') || error.message.includes('صلاحية'))) {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }
    console.error('Get purchase return error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch purchase return' },
      { status: 500 }
    )
  }
}

// PUT /api/purchases/returns/[id] - Actions: update, confirm, cancel
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

    const purchaseReturn = await db.purchaseReturn.findUnique({
      where: { id },
      include: {
        lines: {
          include: {
            item: true,
          },
        },
      },
    })

    if (!purchaseReturn) {
      return NextResponse.json(
        { error: 'مرتجع الشراء غير موجود' },
        { status: 404 }
      )
    }

    // Verify the return belongs to the company
    if (purchaseReturn.companyId !== companyId) {
      return NextResponse.json(
        { error: 'مرتجع الشراء لا ينتمي لهذه الشركة' },
        { status: 403 }
      )
    }

    // ── CONFIRM action: DRAFT → CONFIRMED ──
    if (action === 'confirm') {
      await requirePermission('purchases.confirm', request)

      if (purchaseReturn.status !== 'DRAFT') {
        return NextResponse.json(
          { error: 'يمكن تأكيد مرتجعات الشراء المسودة فقط' },
          { status: 400 }
        )
      }

      const result = await db.$transaction(async (tx) => {
        // For each line: create OUT stock movement, update ItemBalance (reduce quantity and avgCost)
        for (const line of purchaseReturn.lines) {
          const qty = line.quantity
          const unitCost = line.unitPrice
          const totalCost = qty * unitCost

          // Check sufficient stock
          const balance = await tx.itemBalance.findUnique({
            where: {
              itemId_warehouseId: {
                itemId: line.itemId,
                warehouseId: purchaseReturn.warehouseId,
              },
            },
          })

          const availableQty = balance?.quantity ?? 0
          if (availableQty < qty) {
            throw new Error(`لا يمكن تأكيد المرتجع: الرصدة غير كافية للصنف ${line.item.nameAr || line.item.code}. المتوفر: ${availableQty}, المطلوب صرفه: ${qty}`)
          }

          // ── 1. Create OUT StockMovement ──
          const smPrefix = `SM-${new Date(purchaseReturn.date).getFullYear()}`
          const lastSM = await tx.stockMovement.findFirst({
            where: { companyId, number: { startsWith: smPrefix } },
            orderBy: { number: 'desc' },
            select: { number: true },
          })
          let seq = 1
          if (lastSM) {
            seq = parseInt(lastSM.number.split('-').pop() || '0', 10) + 1
          }
          const smNumber = generateDocNumber('SM', new Date(purchaseReturn.date).getFullYear(), seq)

          await tx.stockMovement.create({
            data: {
              companyId,
              number: smNumber,
              type: 'OUT',
              itemId: line.itemId,
              warehouseId: purchaseReturn.warehouseId,
              quantity: qty,
              unitCost,
              totalCost,
              referenceType: 'PURCHASE_RETURN',
              referenceId: purchaseReturn.id,
              reason: `مرتجع شراء ${purchaseReturn.number} - صرف`,
              date: purchaseReturn.date,
            },
          })

          // ── 2. Update ItemBalance (reduce quantity and recalculate avgCost) ──
          if (balance) {
            const newQty = balance.quantity - qty
            const totalValueBefore = balance.quantity * balance.avgCost
            const totalValueAfter = totalValueBefore - totalCost
            const newAvgCost = newQty > 0
              ? Math.max(0, totalValueAfter / newQty)
              : 0

            await tx.itemBalance.update({
              where: { id: balance.id },
              data: {
                quantity: Math.max(0, newQty),
                avgCost: newAvgCost,
              },
            })
          } else {
            // No balance record exists — this shouldn't happen for a return
            // but create one with negative quantity as safety
            await tx.itemBalance.create({
              data: {
                itemId: line.itemId,
                warehouseId: purchaseReturn.warehouseId,
                quantity: -qty,
                avgCost: 0,
              },
            })
          }
        }

        // ── 3. Update purchase return status to CONFIRMED ──
        const updated = await tx.purchaseReturn.update({
          where: { id },
          data: { status: 'CONFIRMED' },
          include: {
            supplier: { select: { id: true, code: true, nameAr: true, nameEn: true } },
            warehouse: { select: { id: true, code: true, nameAr: true, nameEn: true } },
            purchaseOrder: { select: { id: true, number: true } },
            purchaseInvoice: { select: { id: true, number: true } },
            purchaseReceipt: { select: { id: true, number: true } },
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

    // ── CANCEL action: → CANCELLED (only from DRAFT) ──
    if (action === 'cancel') {
      await requirePermission('purchases.edit', request)

      if (purchaseReturn.status === 'CANCELLED') {
        return NextResponse.json(
          { error: 'مرتجع الشراء ملغى بالفعل' },
          { status: 400 }
        )
      }

      if (purchaseReturn.status !== 'DRAFT') {
        return NextResponse.json(
          { error: 'يمكن إلغاء مرتجعات الشراء المسودة فقط' },
          { status: 400 }
        )
      }

      const updated = await db.purchaseReturn.update({
        where: { id },
        data: { status: 'CANCELLED' },
        include: {
          supplier: { select: { id: true, code: true, nameAr: true, nameEn: true } },
          warehouse: { select: { id: true, code: true, nameAr: true, nameEn: true } },
          purchaseOrder: { select: { id: true, number: true } },
          purchaseInvoice: { select: { id: true, number: true } },
          purchaseReceipt: { select: { id: true, number: true } },
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

      if (purchaseReturn.status !== 'DRAFT') {
        return NextResponse.json(
          { error: 'يمكن تعديل مرتجعات الشراء المسودة فقط' },
          { status: 400 }
        )
      }

      const {
        supplierId,
        warehouseId,
        date,
        purchaseOrderId,
        purchaseInvoiceId,
        purchaseReceiptId,
        notes,
        lines: newLines,
      } = body

      if (newLines && Array.isArray(newLines)) {
        if (newLines.length === 0) {
          return NextResponse.json(
            { error: 'يجب أن يحتوي مرتجع الشراء على سطر واحد على الأقل' },
            { status: 400 }
          )
        }

        // Recalculate totals
        const processedLines = newLines.map((line: { itemId: string; quantity: number; unitPrice: number }) => {
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

        // Delete old lines and create new ones
        await db.purchaseReturnLine.deleteMany({
          where: { purchaseReturnId: id },
        })

        const updated = await db.purchaseReturn.update({
          where: { id },
          data: {
            ...(supplierId !== undefined && { supplierId }),
            ...(warehouseId !== undefined && { warehouseId }),
            ...(date !== undefined && { date: new Date(date) }),
            ...(purchaseOrderId !== undefined && { purchaseOrderId: purchaseOrderId || null }),
            ...(purchaseInvoiceId !== undefined && { purchaseInvoiceId: purchaseInvoiceId || null }),
            ...(purchaseReceiptId !== undefined && { purchaseReceiptId: purchaseReceiptId || null }),
            totalAmount,
            notes: notes || null,
            lines: {
              create: processedLines,
            },
          },
          include: {
            supplier: { select: { id: true, code: true, nameAr: true, nameEn: true } },
            warehouse: { select: { id: true, code: true, nameAr: true, nameEn: true } },
            purchaseOrder: { select: { id: true, number: true } },
            purchaseInvoice: { select: { id: true, number: true } },
            purchaseReceipt: { select: { id: true, number: true } },
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
      if (purchaseOrderId !== undefined) updateData.purchaseOrderId = purchaseOrderId || null
      if (purchaseInvoiceId !== undefined) updateData.purchaseInvoiceId = purchaseInvoiceId || null
      if (purchaseReceiptId !== undefined) updateData.purchaseReceiptId = purchaseReceiptId || null
      if (notes !== undefined) updateData.notes = notes || null

      const updated = await db.purchaseReturn.update({
        where: { id },
        data: updateData,
        include: {
          supplier: { select: { id: true, code: true, nameAr: true, nameEn: true } },
          warehouse: { select: { id: true, code: true, nameAr: true, nameEn: true } },
          purchaseOrder: { select: { id: true, number: true } },
          purchaseInvoice: { select: { id: true, number: true } },
          purchaseReceipt: { select: { id: true, number: true } },
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
      { error: 'إجراء غير صالح. استخدم: update, confirm, cancel' },
      { status: 400 }
    )
  } catch (error) {
    if (error instanceof Error && (error.message.includes('غير مصرح') || error.message.includes('صلاحية'))) {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }
    console.error('Purchase return action error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to process purchase return action' },
      { status: 500 }
    )
  }
}
