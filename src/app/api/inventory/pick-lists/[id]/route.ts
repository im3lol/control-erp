import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth-guard'

// GET /api/inventory/pick-lists/[id] - Get single pick list with full details
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

    const pickList = await db.pickList.findUnique({
      where: { id },
      include: {
        warehouse: {
          select: { id: true, code: true, nameAr: true, nameEn: true, type: true },
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

    if (!pickList) {
      return NextResponse.json(
        { error: 'قائمة التحضير غير موجودة' },
        { status: 404 }
      )
    }

    if (pickList.companyId !== companyId) {
      return NextResponse.json(
        { error: 'قائمة التحضير لا تنتمي لهذه الشركة' },
        { status: 403 }
      )
    }

    return NextResponse.json(pickList)
  } catch (error) {
    if (error instanceof Error && (error.message.includes('غير مصرح') || error.message.includes('صلاحية'))) {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }
    console.error('Get pick list error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch pick list' },
      { status: 500 }
    )
  }
}

// PUT /api/inventory/pick-lists/[id] - Actions: start, complete, cancel, updateLines
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requirePermission('inventory.create', request)
    const { id } = await params
    const body = await request.json()
    const { companyId, action, lines, notes } = body

    if (!companyId) {
      return NextResponse.json({ error: 'companyId is required' }, { status: 400 })
    }

    const pickList = await db.pickList.findUnique({
      where: { id },
      include: {
        lines: {
          include: {
            item: true,
          },
        },
      },
    })

    if (!pickList) {
      return NextResponse.json(
        { error: 'قائمة التحضير غير موجودة' },
        { status: 404 }
      )
    }

    if (pickList.companyId !== companyId) {
      return NextResponse.json(
        { error: 'قائمة التحضير لا تنتمي لهذه الشركة' },
        { status: 403 }
      )
    }

    // ── START action: DRAFT → IN_PROGRESS ──
    if (action === 'start') {
      if (pickList.status !== 'DRAFT') {
        return NextResponse.json(
          { error: 'يمكن بدء قوائم التحضير المسودة فقط' },
          { status: 400 }
        )
      }

      const updated = await db.pickList.update({
        where: { id },
        data: { status: 'IN_PROGRESS' },
        include: {
          warehouse: { select: { id: true, code: true, nameAr: true, nameEn: true } },
          lines: {
            include: {
              item: { select: { id: true, code: true, nameAr: true, nameEn: true } },
            },
            orderBy: { id: 'asc' },
          },
        },
      })

      return NextResponse.json(updated)
    }

    // ── COMPLETE action: IN_PROGRESS → COMPLETED ──
    if (action === 'complete') {
      if (pickList.status !== 'IN_PROGRESS') {
        return NextResponse.json(
          { error: 'يمكن إكمال قوائم التحضير قيد التنفيذ فقط' },
          { status: 400 }
        )
      }

      const result = await db.$transaction(async (tx) => {
        // Create OUT stock movements for each picked line and update item balances
        for (const line of pickList.lines) {
          const pickedQty = line.pickedQty
          if (pickedQty <= 0) continue

          // Get the avgCost from warehouse for the item
          const itemBalance = await tx.itemBalance.findUnique({
            where: {
              itemId_warehouseId: {
                itemId: line.itemId,
                warehouseId: pickList.warehouseId,
              },
            },
          })

          const unitCost = itemBalance?.avgCost ?? 0
          const totalCost = pickedQty * unitCost

          // Check sufficient stock
          const availableQty = itemBalance?.quantity ?? 0
          if (availableQty < pickedQty) {
            throw new Error(`الرصدة غير كافية للصنف ${line.item.nameAr || line.item.code}. المتوفر: ${availableQty}, المطلوب: ${pickedQty}`)
          }

          // Create OUT StockMovement
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
          const smNumber = `SM-${new Date().getFullYear()}-${String(seq).padStart(4, '0')}`

          await tx.stockMovement.create({
            data: {
              companyId,
              number: smNumber,
              type: 'OUT',
              itemId: line.itemId,
              warehouseId: pickList.warehouseId,
              quantity: pickedQty,
              unitCost,
              totalCost,
              referenceType: 'PICK_LIST',
              referenceId: pickList.id,
              reason: `قائمة تحضير ${pickList.number} - خروج`,
              date: new Date(),
            },
          })

          // Update ItemBalance (decrease)
          if (itemBalance) {
            const newQty = itemBalance.quantity - pickedQty
            const newAvgCost = newQty > 0
              ? (itemBalance.quantity * itemBalance.avgCost - totalCost) / newQty
              : 0
            await tx.itemBalance.update({
              where: { id: itemBalance.id },
              data: {
                quantity: Math.max(0, newQty),
                avgCost: Math.max(0, newAvgCost),
              },
            })
          }
        }

        // Update pick list status to COMPLETED
        const updated = await tx.pickList.update({
          where: { id },
          data: { status: 'COMPLETED' },
          include: {
            warehouse: { select: { id: true, code: true, nameAr: true, nameEn: true } },
            lines: {
              include: {
                item: { select: { id: true, code: true, nameAr: true, nameEn: true } },
              },
              orderBy: { id: 'asc' },
            },
          },
        })

        return updated
      })

      return NextResponse.json(result)
    }

    // ── CANCEL action: any → CANCELLED ──
    if (action === 'cancel') {
      if (pickList.status === 'CANCELLED') {
        return NextResponse.json(
          { error: 'قائمة التحضير ملغية بالفعل' },
          { status: 400 }
        )
      }

      // If COMPLETED, reverse the stock movements
      if (pickList.status === 'COMPLETED') {
        const result = await db.$transaction(async (tx) => {
          for (const line of pickList.lines) {
            const pickedQty = line.pickedQty
            if (pickedQty <= 0) continue

            // Get the avgCost from warehouse for the item
            const itemBalance = await tx.itemBalance.findUnique({
              where: {
                itemId_warehouseId: {
                  itemId: line.itemId,
                  warehouseId: pickList.warehouseId,
                },
              },
            })

            const unitCost = itemBalance?.avgCost ?? 0
            const totalCost = pickedQty * unitCost

            // Create reverse IN StockMovement
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
            const smNumber = `SM-${new Date().getFullYear()}-${String(seq).padStart(4, '0')}`

            await tx.stockMovement.create({
              data: {
                companyId,
                number: smNumber,
                type: 'IN',
                itemId: line.itemId,
                warehouseId: pickList.warehouseId,
                quantity: pickedQty,
                unitCost,
                totalCost,
                referenceType: 'PICK_LIST_CANCEL',
                referenceId: pickList.id,
                reason: `إلغاء قائمة تحضير ${pickList.number} - عكس خروج`,
                date: new Date(),
              },
            })

            // Reverse ItemBalance (increase back)
            if (itemBalance) {
              const newQty = itemBalance.quantity + pickedQty
              const newAvgCost = newQty > 0
                ? (itemBalance.quantity * itemBalance.avgCost + totalCost) / newQty
                : 0
              await tx.itemBalance.update({
                where: { id: itemBalance.id },
                data: {
                  quantity: newQty,
                  avgCost: Math.max(0, newAvgCost),
                },
              })
            } else {
              await tx.itemBalance.create({
                data: {
                  itemId: line.itemId,
                  warehouseId: pickList.warehouseId,
                  quantity: pickedQty,
                  avgCost: pickedQty > 0 ? unitCost : 0,
                },
              })
            }
          }

          // Update pick list status to CANCELLED
          const updated = await tx.pickList.update({
            where: { id },
            data: { status: 'CANCELLED' },
            include: {
              warehouse: { select: { id: true, code: true, nameAr: true, nameEn: true } },
              lines: {
                include: {
                  item: { select: { id: true, code: true, nameAr: true, nameEn: true } },
                },
                orderBy: { id: 'asc' },
              },
            },
          })

          return updated
        })

        return NextResponse.json(result)
      }

      // If DRAFT or IN_PROGRESS, just cancel without reversing stock
      const updated = await db.pickList.update({
        where: { id },
        data: { status: 'CANCELLED' },
        include: {
          warehouse: { select: { id: true, code: true, nameAr: true, nameEn: true } },
          lines: {
            include: {
              item: { select: { id: true, code: true, nameAr: true, nameEn: true } },
            },
            orderBy: { id: 'asc' },
          },
        },
      })

      return NextResponse.json(updated)
    }

    // ── UPDATE_LINES action: update pickedQty for each line ──
    if (action === 'updateLines') {
      if (pickList.status !== 'IN_PROGRESS') {
        return NextResponse.json(
          { error: 'يمكن تحديث الكميات المُحضّرة لقوائم التحضير قيد التنفيذ فقط' },
          { status: 400 }
        )
      }

      if (!lines || !Array.isArray(lines) || lines.length === 0) {
        return NextResponse.json(
          { error: 'يجب توفير بيانات الأسطر للتحديث' },
          { status: 400 }
        )
      }

      const result = await db.$transaction(async (tx) => {
        for (const lineUpdate of lines) {
          if (!lineUpdate.id) {
            throw new Error('معرف السطر مطلوب لكل سطر')
          }

          // Validate that the line belongs to this pick list
          const existingLine = await tx.pickListLine.findUnique({
            where: { id: lineUpdate.id },
          })

          if (!existingLine || existingLine.pickListId !== id) {
            throw new Error(`السطر ${lineUpdate.id} لا ينتمي لقائمة التحضير هذه`)
          }

          // Validate pickedQty doesn't exceed quantity
          if (lineUpdate.pickedQty !== undefined) {
            if (lineUpdate.pickedQty < 0) {
              throw new Error('الكمية المُحضّرة لا يمكن أن تكون سالبة')
            }
            if (lineUpdate.pickedQty > existingLine.quantity) {
              throw new Error(`الكمية المُحضّرة لا يمكن أن تتجاوز الكمية المطلوبة (${existingLine.quantity})`)
            }
          }

          await tx.pickListLine.update({
            where: { id: lineUpdate.id },
            data: {
              ...(lineUpdate.pickedQty !== undefined && { pickedQty: lineUpdate.pickedQty }),
              ...(lineUpdate.notes !== undefined && { notes: lineUpdate.notes || null }),
            },
          })
        }

        // Return updated pick list
        const updated = await tx.pickList.findUnique({
          where: { id },
          include: {
            warehouse: { select: { id: true, code: true, nameAr: true, nameEn: true } },
            lines: {
              include: {
                item: { select: { id: true, code: true, nameAr: true, nameEn: true } },
              },
              orderBy: { id: 'asc' },
            },
          },
        })

        return updated
      })

      return NextResponse.json(result)
    }

    return NextResponse.json(
      { error: 'إجراء غير صالح. استخدم: start, complete, cancel, updateLines' },
      { status: 400 }
    )
  } catch (error) {
    if (error instanceof Error && (error.message.includes('غير مصرح') || error.message.includes('صلاحية'))) {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }
    console.error('Pick list action error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to process pick list action' },
      { status: 500 }
    )
  }
}
