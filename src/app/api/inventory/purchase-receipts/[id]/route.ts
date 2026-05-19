import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth-guard'
import { generateDocNumber } from '@/lib/erp-utils'

// GET /api/inventory/purchase-receipts/[id] - Get single purchase receipt with full details
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

    const purchaseReceipt = await db.purchaseReceipt.findUnique({
      where: { id },
      include: {
        supplier: {
          select: { id: true, code: true, nameAr: true, nameEn: true, phone: true, address: true },
        },
        warehouse: {
          select: { id: true, code: true, nameAr: true, nameEn: true, type: true },
        },
        purchaseInvoice: {
          select: { id: true, number: true, totalAmount: true, status: true },
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

    if (!purchaseReceipt) {
      return NextResponse.json(
        { error: 'إذن استلام المشتريات غير موجود' },
        { status: 404 }
      )
    }

    if (purchaseReceipt.companyId !== companyId) {
      return NextResponse.json(
        { error: 'إذن استلام المشتريات لا ينتمي لهذه الشركة' },
        { status: 403 }
      )
    }

    return NextResponse.json(purchaseReceipt)
  } catch (error) {
    if (error instanceof Error && (error.message.includes('غير مصرح') || error.message.includes('صلاحية'))) {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }
    console.error('Get purchase receipt error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch purchase receipt' },
      { status: 500 }
    )
  }
}

// PUT /api/inventory/purchase-receipts/[id] - Actions: confirm, cancel
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

    const purchaseReceipt = await db.purchaseReceipt.findUnique({
      where: { id },
      include: {
        lines: {
          include: {
            item: true,
          },
        },
      },
    })

    if (!purchaseReceipt) {
      return NextResponse.json(
        { error: 'إذن استلام المشتريات غير موجود' },
        { status: 404 }
      )
    }

    if (purchaseReceipt.companyId !== companyId) {
      return NextResponse.json(
        { error: 'إذن استلام المشتريات لا ينتمي لهذه الشركة' },
        { status: 403 }
      )
    }

    // ── CONFIRM action: DRAFT → CONFIRMED ──
    if (action === 'confirm') {
      if (purchaseReceipt.status !== 'DRAFT') {
        return NextResponse.json(
          { error: 'يمكن تأكيد أذونات الاستلام المسودة فقط' },
          { status: 400 }
        )
      }

      const result = await db.$transaction(async (tx) => {
        // Fetch purchase invoice lines for unit price lookup (if purchaseInvoiceId exists)
        let invoiceLineMap: Map<string, { unitPrice: number }> = new Map()
        if (purchaseReceipt.purchaseInvoiceId) {
          const invoiceLines = await tx.purchaseInvoiceLine.findMany({
            where: { purchaseInvoiceId: purchaseReceipt.purchaseInvoiceId },
            select: { id: true, itemId: true, unitPrice: true },
          })
          // Map by line id for direct lookup from purchaseInvoiceLineId
          for (const il of invoiceLines) {
            invoiceLineMap.set(il.id, { unitPrice: il.unitPrice })
          }
        }

        // For each line: create IN stock movement, update ItemBalance
        for (const line of purchaseReceipt.lines) {
          const qty = line.quantity

          // Determine unitCost: use purchase invoice line's unitPrice if available, otherwise item's avgCost
          let unitCost = 0
          if (line.purchaseInvoiceLineId && invoiceLineMap.has(line.purchaseInvoiceLineId)) {
            unitCost = invoiceLineMap.get(line.purchaseInvoiceLineId)!.unitPrice
          } else {
            // Try to find the unit price from invoice lines by itemId
            if (purchaseReceipt.purchaseInvoiceId) {
              const invoiceLine = await tx.purchaseInvoiceLine.findFirst({
                where: {
                  purchaseInvoiceId: purchaseReceipt.purchaseInvoiceId,
                  itemId: line.itemId,
                },
                select: { unitPrice: true },
              })
              if (invoiceLine) {
                unitCost = invoiceLine.unitPrice
              }
            }

            // Fallback to item's avgCost in the warehouse
            if (unitCost === 0) {
              const existingBalance = await tx.itemBalance.findUnique({
                where: {
                  itemId_warehouseId: {
                    itemId: line.itemId,
                    warehouseId: purchaseReceipt.warehouseId,
                  },
                },
              })
              unitCost = existingBalance?.avgCost ?? 0
            }
          }

          const totalCost = qty * unitCost

          // ── 1. Create IN StockMovement ──
          const smPrefix = `SM-${new Date(purchaseReceipt.date).getFullYear()}`
          const lastSM = await tx.stockMovement.findFirst({
            where: { companyId, number: { startsWith: smPrefix } },
            orderBy: { number: 'desc' },
            select: { number: true },
          })
          let seq = 1
          if (lastSM) {
            seq = parseInt(lastSM.number.split('-').pop() || '0', 10) + 1
          }
          const smNumber = generateDocNumber('SM', new Date(purchaseReceipt.date).getFullYear(), seq)

          await tx.stockMovement.create({
            data: {
              companyId,
              number: smNumber,
              type: 'IN',
              itemId: line.itemId,
              warehouseId: purchaseReceipt.warehouseId,
              quantity: qty,
              unitCost,
              totalCost,
              referenceType: 'PURCHASE_RECEIPT',
              referenceId: purchaseReceipt.id,
              reason: `إذن استلام مشتريات ${purchaseReceipt.number} - دخول`,
              date: purchaseReceipt.date,
            },
          })

          // ── 2. Update ItemBalance (increase quantity and update avgCost) ──
          const balance = await tx.itemBalance.findUnique({
            where: {
              itemId_warehouseId: {
                itemId: line.itemId,
                warehouseId: purchaseReceipt.warehouseId,
              },
            },
          })

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
                warehouseId: purchaseReceipt.warehouseId,
                quantity: qty,
                avgCost: qty > 0 ? unitCost : 0,
              },
            })
          }
        }

        // ── 3. Update purchase receipt status to CONFIRMED ──
        const updated = await tx.purchaseReceipt.update({
          where: { id },
          data: { status: 'CONFIRMED' },
          include: {
            supplier: { select: { id: true, code: true, nameAr: true, nameEn: true } },
            warehouse: { select: { id: true, code: true, nameAr: true, nameEn: true } },
            purchaseInvoice: { select: { id: true, number: true } },
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
      if (purchaseReceipt.status === 'CANCELLED') {
        return NextResponse.json(
          { error: 'إذن استلام المشتريات ملغي بالفعل' },
          { status: 400 }
        )
      }

      if (purchaseReceipt.status === 'CONFIRMED') {
        // Reverse the stock movements if it was confirmed
        const result = await db.$transaction(async (tx) => {
          for (const line of purchaseReceipt.lines) {
            const qty = line.quantity

            // Get the current avgCost from the warehouse for the item
            const balance = await tx.itemBalance.findUnique({
              where: {
                itemId_warehouseId: {
                  itemId: line.itemId,
                  warehouseId: purchaseReceipt.warehouseId,
                },
              },
            })

            // Check sufficient stock to reverse
            const availableQty = balance?.quantity ?? 0
            if (availableQty < qty) {
              throw new Error(`لا يمكن الإلغاء: الرصدة غير كافية للصنف ${line.item.nameAr || line.item.code}. المتوفر: ${availableQty}, المطلوب عكسه: ${qty}`)
            }

            const unitCost = balance?.avgCost ?? 0
            const totalCost = qty * unitCost

            // ── 1. Create reverse OUT StockMovement (undo the IN) ──
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
                type: 'OUT',
                itemId: line.itemId,
                warehouseId: purchaseReceipt.warehouseId,
                quantity: qty,
                unitCost,
                totalCost,
                referenceType: 'PURCHASE_RECEIPT_CANCEL',
                referenceId: purchaseReceipt.id,
                reason: `إلغاء إذن استلام مشتريات ${purchaseReceipt.number} - عكس دخول`,
                date: new Date(),
              },
            })

            // ── 2. Update ItemBalance (decrease quantity back) ──
            if (balance) {
              const newQty = balance.quantity - qty
              const newAvgCost = newQty > 0
                ? Math.max(0, (balance.quantity * balance.avgCost - totalCost) / newQty)
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

          // ── 3. Update purchase receipt status to CANCELLED ──
          const updated = await tx.purchaseReceipt.update({
            where: { id },
            data: { status: 'CANCELLED' },
            include: {
              supplier: { select: { id: true, code: true, nameAr: true, nameEn: true } },
              warehouse: { select: { id: true, code: true, nameAr: true, nameEn: true } },
              purchaseInvoice: { select: { id: true, number: true } },
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
      const updated = await db.purchaseReceipt.update({
        where: { id },
        data: { status: 'CANCELLED' },
        include: {
          supplier: { select: { id: true, code: true, nameAr: true, nameEn: true } },
          warehouse: { select: { id: true, code: true, nameAr: true, nameEn: true } },
          purchaseInvoice: { select: { id: true, number: true } },
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
    console.error('Purchase receipt action error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to process purchase receipt action' },
      { status: 500 }
    )
  }
}
