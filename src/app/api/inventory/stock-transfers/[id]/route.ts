import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth-guard'
import { generateDocNumber } from '@/lib/erp-utils'

// GET /api/inventory/stock-transfers/[id] - Get single transfer with full details
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

    const transfer = await db.stockTransfer.findUnique({
      where: { id },
      include: {
        fromWarehouse: {
          select: { id: true, code: true, nameAr: true, nameEn: true, type: true },
        },
        toWarehouse: {
          select: { id: true, code: true, nameAr: true, nameEn: true, type: true },
        },
        lines: {
          include: {
            item: {
              select: { id: true, code: true, nameAr: true, nameEn: true, uom: { select: { nameAr: true } } },
            },
          },
          orderBy: { id: 'asc' },
        },
      },
    })

    if (!transfer) {
      return NextResponse.json(
        { error: 'تحويل المخزون غير موجود' },
        { status: 404 }
      )
    }

    if (transfer.companyId !== companyId) {
      return NextResponse.json(
        { error: 'التحويل لا ينتمي لهذه الشركة' },
        { status: 403 }
      )
    }

    return NextResponse.json(transfer)
  } catch (error) {
    if (error instanceof Error && (error.message.includes('غير مصرح') || error.message.includes('صلاحية'))) {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }
    console.error('Get stock transfer error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch stock transfer' },
      { status: 500 }
    )
  }
}

// PUT /api/inventory/stock-transfers/[id] - Actions: confirm, cancel, update
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requirePermission('inventory.create', request)
    const { id } = await params
    const body = await request.json()
    const { companyId, action, notes } = body

    if (!companyId) {
      return NextResponse.json({ error: 'companyId is required' }, { status: 400 })
    }

    const transfer = await db.stockTransfer.findUnique({
      where: { id },
      include: {
        lines: {
          include: {
            item: true,
          },
        },
      },
    })

    if (!transfer) {
      return NextResponse.json(
        { error: 'تحويل المخزون غير موجود' },
        { status: 404 }
      )
    }

    if (transfer.companyId !== companyId) {
      return NextResponse.json(
        { error: 'التحويل لا ينتمي لهذه الشركة' },
        { status: 403 }
      )
    }

    // ── CONFIRM action: DRAFT → CONFIRMED ──
    if (action === 'confirm') {
      if (transfer.status !== 'DRAFT') {
        return NextResponse.json(
          { error: 'يمكن تأكيد التحويلات المسودة فقط' },
          { status: 400 }
        )
      }

      const result = await db.$transaction(async (tx) => {
        // For each line: create OUT movement from source, IN movement to destination, update balances
        for (const line of transfer.lines) {
          const qty = line.quantity

          // Get the avgCost from source warehouse for the item
          const sourceBalance = await tx.itemBalance.findUnique({
            where: {
              itemId_warehouseId: {
                itemId: line.itemId,
                warehouseId: transfer.fromWarehouseId,
              },
            },
          })

          // Check sufficient stock in source warehouse
          const sourceQty = sourceBalance?.quantity ?? 0
          if (sourceQty < qty) {
            throw new Error(`الرصدة غير كافية للصنف ${line.item.nameAr || line.item.code}. المتوفر: ${sourceQty}, المطلوب: ${qty}`)
          }

          const unitCost = sourceBalance?.avgCost ?? 0
          const totalCost = qty * unitCost

          // ── 1. Create OUT StockMovement from source ──
          const smOutPrefix = `SM-${new Date(transfer.date).getFullYear()}`
          const lastOutSM = await tx.stockMovement.findFirst({
            where: { companyId, number: { startsWith: smOutPrefix } },
            orderBy: { number: 'desc' },
            select: { number: true },
          })
          let outSeq = 1
          if (lastOutSM) {
            outSeq = parseInt(lastOutSM.number.split('-').pop() || '0', 10) + 1
          }
          const smOutNumber = generateDocNumber('SM', new Date(transfer.date).getFullYear(), outSeq)

          await tx.stockMovement.create({
            data: {
              companyId,
              number: smOutNumber,
              type: 'OUT',
              itemId: line.itemId,
              warehouseId: transfer.fromWarehouseId,
              quantity: qty,
              unitCost,
              totalCost,
              referenceType: 'STOCK_TRANSFER',
              referenceId: transfer.id,
              reason: `تحويل مخزون ${transfer.number} - خروج`,
              date: transfer.date,
            },
          })

          // ── 2. Update source ItemBalance (decrease) ──
          if (sourceBalance) {
            const newSourceQty = sourceBalance.quantity - qty
            const newSourceAvgCost = newSourceQty > 0
              ? (sourceBalance.quantity * sourceBalance.avgCost - totalCost) / newSourceQty
              : 0
            await tx.itemBalance.update({
              where: { id: sourceBalance.id },
              data: {
                quantity: Math.max(0, newSourceQty),
                avgCost: Math.max(0, newSourceAvgCost),
              },
            })
          }

          // ── 3. Create IN StockMovement to destination ──
          const smInPrefix = `SM-${new Date(transfer.date).getFullYear()}`
          const lastInSM = await tx.stockMovement.findFirst({
            where: { companyId, number: { startsWith: smInPrefix } },
            orderBy: { number: 'desc' },
            select: { number: true },
          })
          let inSeq = outSeq + 1 // Use next sequence
          if (lastInSM && lastInSM.id !== lastOutSM?.id) {
            inSeq = parseInt(lastInSM.number.split('-').pop() || '0', 10) + 1
          }
          const smInNumber = generateDocNumber('SM', new Date(transfer.date).getFullYear(), inSeq)

          await tx.stockMovement.create({
            data: {
              companyId,
              number: smInNumber,
              type: 'IN',
              itemId: line.itemId,
              warehouseId: transfer.toWarehouseId,
              quantity: qty,
              unitCost,
              totalCost,
              referenceType: 'STOCK_TRANSFER',
              referenceId: transfer.id,
              reason: `تحويل مخزون ${transfer.number} - دخول`,
              date: transfer.date,
            },
          })

          // ── 4. Update destination ItemBalance (increase) ──
          const destBalance = await tx.itemBalance.findUnique({
            where: {
              itemId_warehouseId: {
                itemId: line.itemId,
                warehouseId: transfer.toWarehouseId,
              },
            },
          })

          if (destBalance) {
            const newDestQty = destBalance.quantity + qty
            const newDestAvgCost = newDestQty > 0
              ? (destBalance.quantity * destBalance.avgCost + totalCost) / newDestQty
              : 0
            await tx.itemBalance.update({
              where: { id: destBalance.id },
              data: {
                quantity: newDestQty,
                avgCost: newDestAvgCost,
              },
            })
          } else {
            await tx.itemBalance.create({
              data: {
                itemId: line.itemId,
                warehouseId: transfer.toWarehouseId,
                quantity: qty,
                avgCost: qty > 0 ? unitCost : 0,
              },
            })
          }
        }

        // ── 5. Update transfer status to CONFIRMED ──
        const updated = await tx.stockTransfer.update({
          where: { id },
          data: { status: 'CONFIRMED' },
          include: {
            fromWarehouse: { select: { id: true, code: true, nameAr: true, nameEn: true } },
            toWarehouse: { select: { id: true, code: true, nameAr: true, nameEn: true } },
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
      if (transfer.status === 'CANCELLED') {
        return NextResponse.json(
          { error: 'التحويل ملغي بالفعل' },
          { status: 400 }
        )
      }
      if (transfer.status === 'CONFIRMED') {
        // Reverse the stock movements if it was confirmed
        const result = await db.$transaction(async (tx) => {
          for (const line of transfer.lines) {
            const qty = line.quantity

            // Get the avgCost from destination for the item
            const destBalance = await tx.itemBalance.findUnique({
              where: {
                itemId_warehouseId: {
                  itemId: line.itemId,
                  warehouseId: transfer.toWarehouseId,
                },
              },
            })

            const unitCost = destBalance?.avgCost ?? 0
            const totalCost = qty * unitCost

            // ── 1. Create reverse OUT from destination (undo the IN) ──
            const smOutPrefix = `SM-${new Date().getFullYear()}`
            const lastOutSM = await tx.stockMovement.findFirst({
              where: { companyId, number: { startsWith: smOutPrefix } },
              orderBy: { number: 'desc' },
              select: { number: true },
            })
            let outSeq = 1
            if (lastOutSM) {
              outSeq = parseInt(lastOutSM.number.split('-').pop() || '0', 10) + 1
            }
            const smOutNumber = generateDocNumber('SM', new Date().getFullYear(), outSeq)

            await tx.stockMovement.create({
              data: {
                companyId,
                number: smOutNumber,
                type: 'OUT',
                itemId: line.itemId,
                warehouseId: transfer.toWarehouseId,
                quantity: qty,
                unitCost,
                totalCost,
                referenceType: 'STOCK_TRANSFER_CANCEL',
                referenceId: transfer.id,
                reason: `إلغاء تحويل مخزون ${transfer.number} - عكس دخول`,
                date: new Date(),
              },
            })

            // ── 2. Reverse destination ItemBalance (decrease) ──
            if (destBalance) {
              const newDestQty = destBalance.quantity - qty
              const newDestAvgCost = newDestQty > 0
                ? Math.max(0, (destBalance.quantity * destBalance.avgCost - totalCost) / newDestQty)
                : 0
              await tx.itemBalance.update({
                where: { id: destBalance.id },
                data: {
                  quantity: Math.max(0, newDestQty),
                  avgCost: Math.max(0, newDestAvgCost),
                },
              })
            }

            // ── 3. Create reverse IN to source (undo the OUT) ──
            const smInPrefix = `SM-${new Date().getFullYear()}`
            const lastInSM = await tx.stockMovement.findFirst({
              where: { companyId, number: { startsWith: smInPrefix } },
              orderBy: { number: 'desc' },
              select: { number: true },
            })
            let inSeq = outSeq + 1
            if (lastInSM && lastInSM.id !== lastOutSM?.id) {
              inSeq = parseInt(lastInSM.number.split('-').pop() || '0', 10) + 1
            }
            const smInNumber = generateDocNumber('SM', new Date().getFullYear(), inSeq)

            await tx.stockMovement.create({
              data: {
                companyId,
                number: smInNumber,
                type: 'IN',
                itemId: line.itemId,
                warehouseId: transfer.fromWarehouseId,
                quantity: qty,
                unitCost,
                totalCost,
                referenceType: 'STOCK_TRANSFER_CANCEL',
                referenceId: transfer.id,
                reason: `إلغاء تحويل مخزون ${transfer.number} - عكس خروج`,
                date: new Date(),
              },
            })

            // ── 4. Reverse source ItemBalance (increase) ──
            const sourceBalance = await tx.itemBalance.findUnique({
              where: {
                itemId_warehouseId: {
                  itemId: line.itemId,
                  warehouseId: transfer.fromWarehouseId,
                },
              },
            })

            if (sourceBalance) {
              const newSourceQty = sourceBalance.quantity + qty
              const newSourceAvgCost = newSourceQty > 0
                ? (sourceBalance.quantity * sourceBalance.avgCost + totalCost) / newSourceQty
                : 0
              await tx.itemBalance.update({
                where: { id: sourceBalance.id },
                data: {
                  quantity: newSourceQty,
                  avgCost: Math.max(0, newSourceAvgCost),
                },
              })
            } else {
              await tx.itemBalance.create({
                data: {
                  itemId: line.itemId,
                  warehouseId: transfer.fromWarehouseId,
                  quantity: qty,
                  avgCost: qty > 0 ? unitCost : 0,
                },
              })
            }
          }

          // ── 5. Update transfer status to CANCELLED ──
          const updated = await tx.stockTransfer.update({
            where: { id },
            data: { status: 'CANCELLED' },
            include: {
              fromWarehouse: { select: { id: true, code: true, nameAr: true, nameEn: true } },
              toWarehouse: { select: { id: true, code: true, nameAr: true, nameEn: true } },
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

      // If DRAFT, just cancel
      const updated = await db.stockTransfer.update({
        where: { id },
        data: { status: 'CANCELLED' },
        include: {
          fromWarehouse: { select: { id: true, code: true, nameAr: true, nameEn: true } },
          toWarehouse: { select: { id: true, code: true, nameAr: true, nameEn: true } },
          lines: {
            include: {
              item: { select: { id: true, code: true, nameAr: true, nameEn: true } },
            },
          },
        },
      })

      return NextResponse.json(updated)
    }

    // ── UPDATE action: update notes only ──
    if (action === 'update') {
      if (transfer.status !== 'DRAFT') {
        return NextResponse.json(
          { error: 'يمكن تعديل التحويلات المسودة فقط' },
          { status: 400 }
        )
      }

      const updated = await db.stockTransfer.update({
        where: { id },
        data: {
          ...(notes !== undefined && { notes: notes || null }),
        },
        include: {
          fromWarehouse: { select: { id: true, code: true, nameAr: true, nameEn: true } },
          toWarehouse: { select: { id: true, code: true, nameAr: true, nameEn: true } },
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
    console.error('Stock transfer action error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to process stock transfer action' },
      { status: 500 }
    )
  }
}
