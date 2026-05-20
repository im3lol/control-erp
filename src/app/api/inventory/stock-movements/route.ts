import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth-guard'

// GET /api/inventory/stock-movements - List stock movements with filters
export async function GET(request: NextRequest) {
  try {
    const user = await requirePermission('inventory.view', request)
    const { searchParams } = new URL(request.url)
    const companyId = searchParams.get('companyId')
    if (!companyId) {
      return NextResponse.json({ error: 'companyId is required' }, { status: 400 })
    }

    const type = searchParams.get('type')
    const warehouseId = searchParams.get('warehouseId')
    const itemId = searchParams.get('itemId')
    const fromDate = searchParams.get('fromDate')
    const toDate = searchParams.get('toDate')
    const limitParam = searchParams.get('limit')

    const where: Record<string, unknown> = { companyId }

    if (type) {
      where.type = type
    }
    if (warehouseId) {
      where.warehouseId = warehouseId
    }
    if (itemId) {
      where.itemId = itemId
    }

    if (fromDate || toDate) {
      const dateFilter: Record<string, Date> = {}
      if (fromDate) dateFilter.gte = new Date(fromDate)
      if (toDate) dateFilter.lte = new Date(toDate)
      where.date = dateFilter
    }

    const limit = limitParam ? parseInt(limitParam, 10) : 50

    const movements = await db.stockMovement.findMany({
      where,
      include: {
        item: {
          include: {
            category: true,
            uom: true,
          },
        },
        warehouse: true,
      },
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
      take: limit,
    })

    return NextResponse.json(movements)
  } catch (error) {
    if (error instanceof Error && (error.message.includes('غير مصرح') || error.message.includes('صلاحية'))) {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }
    console.error('Get stock movements error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch stock movements' },
      { status: 500 }
    )
  }
}

// POST /api/inventory/stock-movements - Create stock movement (manual adjustment)
export async function POST(request: NextRequest) {
  try {
    const user = await requirePermission('inventory.create', request)
    const body = await request.json()
    const { companyId, type, itemId, warehouseId, quantity, unitCost, reason, date } = body

    if (!companyId) {
      return NextResponse.json({ error: 'companyId is required' }, { status: 400 })
    }

    // Validate required fields
    if (!type || !itemId || !warehouseId || quantity === undefined) {
      return NextResponse.json(
        { error: 'type, itemId, warehouseId, and quantity are required' },
        { status: 400 }
      )
    }

    if (!['IN', 'OUT', 'ADJ'].includes(type)) {
      return NextResponse.json(
        { error: 'type must be IN, OUT, or ADJ' },
        { status: 400 }
      )
    }

    // For IN and OUT, quantity must be > 0
    // For ADJ, quantity can be negative (adjustment direction) or positive
    if (type === 'IN' || type === 'OUT') {
      if (quantity <= 0) {
        return NextResponse.json(
          { error: 'quantity must be > 0 for IN/OUT movements' },
          { status: 400 }
        )
      }
    } else if (type === 'ADJ') {
      if (quantity === 0) {
        return NextResponse.json(
          { error: 'quantity cannot be 0 for ADJ movements' },
          { status: 400 }
        )
      }
    }

    // Validate item exists and belongs to company
    const item = await db.item.findUnique({ where: { id: itemId } })
    if (!item) {
      return NextResponse.json(
        { error: 'Item not found' },
        { status: 404 }
      )
    }
    if (item.companyId !== companyId) {
      return NextResponse.json(
        { error: 'Item does not belong to this company' },
        { status: 403 }
      )
    }

    // Validate warehouse exists and belongs to company
    const warehouse = await db.warehouse.findUnique({
      where: { id: warehouseId },
    })
    if (!warehouse) {
      return NextResponse.json(
        { error: 'Warehouse not found' },
        { status: 404 }
      )
    }
    if (warehouse.companyId !== companyId) {
      return NextResponse.json(
        { error: 'Warehouse does not belong to this company' },
        { status: 403 }
      )
    }

    // Check sufficient stock for OUT and negative ADJ
    const absQuantity = Math.abs(quantity)
    if (type === 'OUT' || (type === 'ADJ' && quantity < 0)) {
      const balance = await db.itemBalance.findUnique({
        where: {
          itemId_warehouseId: { itemId, warehouseId },
        },
      })
      const currentQty = balance?.quantity ?? 0
      if (currentQty < absQuantity) {
        return NextResponse.json(
          {
            error: `Insufficient stock. Current: ${currentQty}, Requested: ${absQuantity}`,
          },
          { status: 400 }
        )
      }
    }

    const movementDate = date ? new Date(date) : new Date()
    const effectiveUnitCost = unitCost ?? 0
    const totalCost = absQuantity * effectiveUnitCost

    // Generate movement number: SM-{year}-{seq}
    const year = movementDate.getFullYear()
    const prefix = `SM-${year}-`

    const lastMovement = await db.stockMovement.findFirst({
      where: {
        companyId,
        number: { startsWith: prefix },
      },
      orderBy: { number: 'desc' },
    })

    let seq = 1
    if (lastMovement) {
      const lastSeq = parseInt(lastMovement.number.replace(prefix, ''), 10)
      if (!isNaN(lastSeq)) {
        seq = lastSeq + 1
      }
    }

    const number = `${prefix}${seq.toString().padStart(5, '0')}`

    // Use a transaction for atomicity
    const movement = await db.$transaction(async (tx) => {
      // Create the stock movement record
      const sm = await tx.stockMovement.create({
        data: {
          companyId,
          number,
          type,
          itemId,
          warehouseId,
          quantity,
          unitCost: effectiveUnitCost,
          totalCost,
          referenceType: 'MANUAL',
          reason,
          date: movementDate,
        },
        include: {
          item: {
            include: {
              category: true,
              uom: true,
            },
          },
          warehouse: true,
        },
      })

      // Update ItemBalance: upsert the item+warehouse balance
      const balanceKey = { itemId_warehouseId: { itemId, warehouseId } }
      const currentBalance = await tx.itemBalance.findUnique({
        where: balanceKey,
      })
      const currentQty = currentBalance?.quantity ?? 0
      const currentAvgCost = currentBalance?.avgCost ?? 0

      if (type === 'IN') {
        // IN: add quantity, recalculate avgCost (weighted average)
        const newQty = currentQty + quantity
        const newAvgCost =
          newQty > 0
            ? (currentQty * currentAvgCost + quantity * effectiveUnitCost) /
              newQty
            : 0

        await tx.itemBalance.upsert({
          where: balanceKey,
          update: { quantity: newQty, avgCost: newAvgCost },
          create: {
            itemId,
            warehouseId,
            quantity: newQty,
            avgCost: newAvgCost,
          },
        })

        // Create FifoLayer for IN movements
        await tx.fifoLayer.create({
          data: {
            itemId,
            warehouseId,
            quantity,
            remaining: quantity,
            unitCost: effectiveUnitCost,
            date: movementDate,
          },
        })
      } else if (type === 'OUT') {
        // OUT: subtract quantity, keep avgCost
        const newQty = currentQty - quantity

        await tx.itemBalance.upsert({
          where: balanceKey,
          update: { quantity: newQty },
          create: {
            itemId,
            warehouseId,
            quantity: newQty,
            avgCost: currentAvgCost,
          },
        })
      } else if (type === 'ADJ') {
        // ADJ: if positive add, if negative subtract
        const newQty = currentQty + quantity

        await tx.itemBalance.upsert({
          where: balanceKey,
          update: { quantity: newQty },
          create: {
            itemId,
            warehouseId,
            quantity: newQty,
            avgCost: currentAvgCost,
          },
        })
      }

      return sm
    })

    return NextResponse.json(movement, { status: 201 })
  } catch (error) {
    if (error instanceof Error && (error.message.includes('غير مصرح') || error.message.includes('صلاحية'))) {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }
    console.error('Create stock movement error:', error)
    return NextResponse.json(
      { error: 'Failed to create stock movement' },
      { status: 500 }
    )
  }
}
