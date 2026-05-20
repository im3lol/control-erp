import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth-guard'

// GET /api/inventory/purchase-receipts - List purchase receipts
export async function GET(request: NextRequest) {
  try {
    const user = await requirePermission('inventory.view', request)
    const { searchParams } = new URL(request.url)
    const companyId = searchParams.get('companyId')
    if (!companyId) {
      return NextResponse.json({ error: 'companyId is required' }, { status: 400 })
    }

    const purchaseReceipts = await db.purchaseReceipt.findMany({
      where: { companyId },
      include: {
        supplier: {
          select: { id: true, code: true, nameAr: true, nameEn: true },
        },
        warehouse: {
          select: { id: true, code: true, nameAr: true, nameEn: true, type: true, parentId: true },
        },
        purchaseInvoice: {
          select: { id: true, number: true },
        },
        purchaseOrder: {
          select: { id: true, number: true },
        },
        _count: {
          select: { lines: true },
        },
      },
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
    })

    return NextResponse.json(purchaseReceipts)
  } catch (error) {
    if (error instanceof Error && (error.message.includes('غير مصرح') || error.message.includes('صلاحية'))) {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }
    console.error('Get purchase receipts error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch purchase receipts' },
      { status: 500 }
    )
  }
}

// POST /api/inventory/purchase-receipts - Create a new purchase receipt
export async function POST(request: NextRequest) {
  try {
    const user = await requirePermission('inventory.create', request)
    const body = await request.json()
    const { companyId, purchaseInvoiceId, purchaseOrderId, supplierId, warehouseId, date, notes, lines } = body

    if (!companyId) {
      return NextResponse.json({ error: 'companyId is required' }, { status: 400 })
    }

    if (!warehouseId) {
      return NextResponse.json(
        { error: 'warehouseId is required' },
        { status: 400 }
      )
    }

    if (!lines || !Array.isArray(lines) || lines.length === 0) {
      return NextResponse.json(
        { error: 'يجب إضافة سطر واحد على الأقل' },
        { status: 400 }
      )
    }

    // Validate warehouse exists and belongs to company
    const warehouse = await db.warehouse.findUnique({ where: { id: warehouseId } })
    if (!warehouse || warehouse.companyId !== companyId) {
      return NextResponse.json(
        { error: 'المخزن غير موجود أو لا ينتمي لهذه الشركة' },
        { status: 404 }
      )
    }

    // If purchaseOrderId is provided, validate and auto-fill
    let resolvedSupplierId = supplierId || null
    let resolvedWarehouseId = warehouseId
    if (purchaseOrderId) {
      const purchaseOrder = await db.purchaseOrder.findUnique({
        where: { id: purchaseOrderId },
        include: {
          lines: {
            select: { id: true, itemId: true, quantity: true, receivedQty: true },
          },
        },
      })

      if (!purchaseOrder || purchaseOrder.companyId !== companyId) {
        return NextResponse.json(
          { error: 'أمر الشراء غير موجود أو لا ينتمي لهذه الشركة' },
          { status: 404 }
        )
      }

      // Auto-fill supplierId and warehouseId from the purchase order
      resolvedSupplierId = purchaseOrder.supplierId
      resolvedWarehouseId = purchaseOrder.warehouseId

      // Validate that items in purchase receipt lines belong to the purchase order
      const orderItemIds = new Set(purchaseOrder.lines.map((l) => l.itemId))
      for (const line of lines) {
        if (!orderItemIds.has(line.itemId)) {
          return NextResponse.json(
            { error: `الصنف ${line.itemId} لا ينتمي لأمر الشراء المحدد` },
            { status: 400 }
          )
        }
      }
    }

    // If purchaseInvoiceId is provided, auto-fill supplierId and validate items
    if (purchaseInvoiceId) {
      const purchaseInvoice = await db.purchaseInvoice.findUnique({
        where: { id: purchaseInvoiceId },
        include: {
          lines: {
            select: { id: true, itemId: true, quantity: true },
          },
        },
      })

      if (!purchaseInvoice || purchaseInvoice.companyId !== companyId) {
        return NextResponse.json(
          { error: 'فاتورة المشتريات غير موجودة أو لا تنتمي لهذه الشركة' },
          { status: 404 }
        )
      }

      // Auto-fill supplierId from the purchase invoice (only if not already set by purchase order)
      if (!resolvedSupplierId) {
        resolvedSupplierId = purchaseInvoice.supplierId
      }

      // Validate that items in purchase receipt lines belong to the purchase invoice
      const invoiceItemIds = new Set(purchaseInvoice.lines.map((l) => l.itemId))
      for (const line of lines) {
        if (!invoiceItemIds.has(line.itemId)) {
          return NextResponse.json(
            { error: `الصنف ${line.itemId} لا ينتمي لفاتورة المشتريات المحددة` },
            { status: 400 }
          )
        }
      }
    }

    // Validate supplier if provided
    if (resolvedSupplierId) {
      const supplier = await db.supplier.findUnique({ where: { id: resolvedSupplierId } })
      if (!supplier || supplier.companyId !== companyId) {
        return NextResponse.json(
          { error: 'المورد غير موجود أو لا ينتمي لهذه الشركة' },
          { status: 404 }
        )
      }
    }

    // Validate items exist and belong to company
    for (const line of lines) {
      if (!line.itemId || !line.quantity || line.quantity <= 0) {
        return NextResponse.json(
          { error: 'كل سطر يجب أن يحتوي على صنف وكمية أكبر من صفر' },
          { status: 400 }
        )
      }

      const item = await db.item.findUnique({ where: { id: line.itemId } })
      if (!item || item.companyId !== companyId) {
        return NextResponse.json(
          { error: `الصنف ${line.itemId} غير موجود أو لا ينتمي لهذه الشركة` },
          { status: 404 }
        )
      }
    }

    // Generate purchase receipt number: PR-{seq}
    const purchaseReceiptCount = await db.purchaseReceipt.count({
      where: { companyId },
    })
    const number = `PR-${String(purchaseReceiptCount + 1).padStart(4, '0')}`

    const receiptDate = date ? new Date(date) : new Date()

    // Create purchase receipt and lines in a transaction
    const purchaseReceipt = await db.$transaction(async (tx) => {
      const pr = await tx.purchaseReceipt.create({
        data: {
          companyId,
          number,
          date: receiptDate,
          status: 'DRAFT',
          purchaseInvoiceId: purchaseInvoiceId || null,
          purchaseOrderId: purchaseOrderId || null,
          supplierId: resolvedSupplierId,
          warehouseId: resolvedWarehouseId,
          notes: notes || null,
          lines: {
            create: lines.map((line: { itemId: string; quantity: number; purchaseInvoiceLineId?: string; notes?: string }) => ({
              itemId: line.itemId,
              quantity: line.quantity,
              purchaseInvoiceLineId: line.purchaseInvoiceLineId || null,
              notes: line.notes || null,
            })),
          },
        },
        include: {
          supplier: {
            select: { id: true, code: true, nameAr: true, nameEn: true },
          },
          warehouse: {
            select: { id: true, code: true, nameAr: true, nameEn: true },
          },
          purchaseInvoice: {
            select: { id: true, number: true },
          },
          purchaseOrder: {
            select: { id: true, number: true },
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

      // If linked to a purchase order, update receivedQty on order lines
      if (purchaseOrderId) {
        for (const line of lines) {
          const qty = parseFloat(String(line.quantity)) || 0
          if (qty > 0) {
            const orderLine = await tx.purchaseOrderLine.findFirst({
              where: { purchaseOrderId, itemId: line.itemId },
            })
            if (orderLine) {
              await tx.purchaseOrderLine.update({
                where: { id: orderLine.id },
                data: { receivedQty: { increment: qty } },
              })
            }
          }
        }
      }

      return pr
    })

    return NextResponse.json(purchaseReceipt, { status: 201 })
  } catch (error) {
    if (error instanceof Error && (error.message.includes('غير مصرح') || error.message.includes('صلاحية'))) {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }
    console.error('Create purchase receipt error:', error)
    return NextResponse.json(
      { error: 'Failed to create purchase receipt' },
      { status: 500 }
    )
  }
}
