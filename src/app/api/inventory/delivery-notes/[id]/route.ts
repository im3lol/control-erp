import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth-guard'
import { generateDocNumber } from '@/lib/erp-utils'

// GET /api/inventory/delivery-notes/[id] - Get single delivery note with full details
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requirePermission('inventory.view', request)
    const { id } = await params
    const { searchParams } = new URL(request.url)
    const companyId = searchParams.get('companyId')
    if (!companyId) {
      return NextResponse.json({ error: 'companyId is required' }, { status: 400 })
    }

    const deliveryNote = await db.deliveryNote.findUnique({
      where: { id },
      include: {
        customer: {
          select: { id: true, code: true, nameAr: true, nameEn: true, phone: true, address: true },
        },
        warehouse: {
          select: { id: true, code: true, nameAr: true, nameEn: true, type: true },
        },
        salesInvoice: {
          select: { id: true, number: true, totalAmount: true, status: true },
        },
        salesOrder: {
          select: { id: true, number: true },
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

    if (!deliveryNote) {
      return NextResponse.json(
        { error: 'إذن الصرف غير موجود' },
        { status: 404 }
      )
    }

    if (deliveryNote.companyId !== companyId) {
      return NextResponse.json(
        { error: 'إذن الصرف لا ينتمي لهذه الشركة' },
        { status: 403 }
      )
    }

    return NextResponse.json(deliveryNote)
  } catch (error) {
    if (error instanceof Error && (error.message.includes('غير مصرح') || error.message.includes('صلاحية'))) {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }
    console.error('Get delivery note error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch delivery note' },
      { status: 500 }
    )
  }
}

// PUT /api/inventory/delivery-notes/[id] - Actions: confirm, cancel
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requirePermission('inventory.create', request)
    const { id } = await params
    const body = await request.json()
    const { companyId, action } = body

    if (!companyId) {
      return NextResponse.json({ error: 'companyId is required' }, { status: 400 })
    }

    const deliveryNote = await db.deliveryNote.findUnique({
      where: { id },
      include: {
        lines: {
          include: {
            item: true,
          },
        },
      },
    })

    if (!deliveryNote) {
      return NextResponse.json(
        { error: 'إذن الصرف غير موجود' },
        { status: 404 }
      )
    }

    if (deliveryNote.companyId !== companyId) {
      return NextResponse.json(
        { error: 'إذن الصرف لا ينتمي لهذه الشركة' },
        { status: 403 }
      )
    }

    // ── CONFIRM action: DRAFT → CONFIRMED ──
    if (action === 'confirm') {
      if (deliveryNote.status !== 'DRAFT') {
        return NextResponse.json(
          { error: 'يمكن تأكيد أذونات الصرف المسودة فقط' },
          { status: 400 }
        )
      }

      const result = await db.$transaction(async (tx) => {
        // For each line: create OUT stock movement, update ItemBalance
        for (const line of deliveryNote.lines) {
          const qty = line.quantity

          // Get the avgCost from the warehouse for the item
          const balance = await tx.itemBalance.findUnique({
            where: {
              itemId_warehouseId: {
                itemId: line.itemId,
                warehouseId: deliveryNote.warehouseId,
              },
            },
          })

          // Check sufficient stock
          const availableQty = balance?.quantity ?? 0
          if (availableQty < qty) {
            throw new Error(`الرصدة غير كافية للصنف ${line.item.nameAr || line.item.code}. المتوفر: ${availableQty}, المطلوب: ${qty}`)
          }

          const unitCost = balance?.avgCost ?? 0
          const totalCost = qty * unitCost

          // ── 1. Create OUT StockMovement ──
          const smPrefix = `SM-${new Date(deliveryNote.date).getFullYear()}`
          const lastSM = await tx.stockMovement.findFirst({
            where: { companyId, number: { startsWith: smPrefix } },
            orderBy: { number: 'desc' },
            select: { number: true },
          })
          let seq = 1
          if (lastSM) {
            seq = parseInt(lastSM.number.split('-').pop() || '0', 10) + 1
          }
          const smNumber = generateDocNumber('SM', new Date(deliveryNote.date).getFullYear(), seq)

          await tx.stockMovement.create({
            data: {
              companyId,
              number: smNumber,
              type: 'OUT',
              itemId: line.itemId,
              warehouseId: deliveryNote.warehouseId,
              quantity: qty,
              unitCost,
              totalCost,
              referenceType: 'DELIVERY_NOTE',
              referenceId: deliveryNote.id,
              reason: `إذن صرف ${deliveryNote.number} - خروج`,
              date: deliveryNote.date,
            },
          })

          // ── 2. Update ItemBalance (decrease quantity) ──
          if (balance) {
            const newQty = balance.quantity - qty
            const newAvgCost = newQty > 0
              ? (balance.quantity * balance.avgCost - totalCost) / newQty
              : 0
            await tx.itemBalance.update({
              where: { id: balance.id },
              data: {
                quantity: Math.max(0, newQty),
                avgCost: Math.max(0, newAvgCost),
              },
            })
          }
        }

        // ── 3. Update delivery note status to CONFIRMED ──
        const updated = await tx.deliveryNote.update({
          where: { id },
          data: { status: 'CONFIRMED' },
          include: {
            customer: { select: { id: true, code: true, nameAr: true, nameEn: true } },
            warehouse: { select: { id: true, code: true, nameAr: true, nameEn: true } },
            salesInvoice: { select: { id: true, number: true } },
            salesOrder: { select: { id: true, number: true } },
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

    // ── CANCEL action ──
    if (action === 'cancel') {
      if (deliveryNote.status === 'CANCELLED') {
        return NextResponse.json(
          { error: 'إذن الصرف ملغي بالفعل' },
          { status: 400 }
        )
      }

      if (deliveryNote.status === 'CONFIRMED') {
        // Reverse the stock movements if it was confirmed
        const result = await db.$transaction(async (tx) => {
          for (const line of deliveryNote.lines) {
            const qty = line.quantity

            // Get the current avgCost from the warehouse for the item
            const balance = await tx.itemBalance.findUnique({
              where: {
                itemId_warehouseId: {
                  itemId: line.itemId,
                  warehouseId: deliveryNote.warehouseId,
                },
              },
            })

            const unitCost = balance?.avgCost ?? 0
            const totalCost = qty * unitCost

            // ── 1. Create reverse IN StockMovement (undo the OUT) ──
            const smPrefix = `SM-${new Date().getFullYear()}`
            const lastSM = await tx.stockMovement.findFirst({
              where: { companyId, number: { startsWith: smPrefix } },
              orderBy: { number: 'desc' },
              select: { number: true },
            })
            let seq = 1
            if (lastSM) {
              seq = parseInt(lastSM.number.split('-').pop() || '0', 10) + 1
            }
            const smNumber = generateDocNumber('SM', new Date().getFullYear(), seq)

            await tx.stockMovement.create({
              data: {
                companyId,
                number: smNumber,
                type: 'IN',
                itemId: line.itemId,
                warehouseId: deliveryNote.warehouseId,
                quantity: qty,
                unitCost,
                totalCost,
                referenceType: 'DELIVERY_NOTE_CANCEL',
                referenceId: deliveryNote.id,
                reason: `إلغاء إذن صرف ${deliveryNote.number} - عكس خروج`,
                date: new Date(),
              },
            })

            // ── 2. Update ItemBalance (increase quantity back) ──
            if (balance) {
              const newQty = balance.quantity + qty
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
              await tx.itemBalance.create({
                data: {
                  itemId: line.itemId,
                  warehouseId: deliveryNote.warehouseId,
                  quantity: qty,
                  avgCost: qty > 0 ? unitCost : 0,
                },
              })
            }
          }

          // ── 3. Update delivery note status to CANCELLED ──
          const updated = await tx.deliveryNote.update({
            where: { id },
            data: { status: 'CANCELLED' },
            include: {
              customer: { select: { id: true, code: true, nameAr: true, nameEn: true } },
              warehouse: { select: { id: true, code: true, nameAr: true, nameEn: true } },
              salesInvoice: { select: { id: true, number: true } },
              salesOrder: { select: { id: true, number: true } },
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

      // If DRAFT, just cancel without reversing stock movements
      const updated = await db.deliveryNote.update({
        where: { id },
        data: { status: 'CANCELLED' },
        include: {
          customer: { select: { id: true, code: true, nameAr: true, nameEn: true } },
          warehouse: { select: { id: true, code: true, nameAr: true, nameEn: true } },
          salesInvoice: { select: { id: true, number: true } },
          salesOrder: { select: { id: true, number: true } },
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
      { error: 'إجراء غير صالح. استخدم: confirm, cancel' },
      { status: 400 }
    )
  } catch (error) {
    if (error instanceof Error && (error.message.includes('غير مصرح') || error.message.includes('صلاحية'))) {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }
    console.error('Delivery note action error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to process delivery note action' },
      { status: 500 }
    )
  }
}
