import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

// GET /api/inventory/item-balances - List item balances with filters
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const warehouseId = searchParams.get('warehouseId')
    const itemId = searchParams.get('itemId')
    const lowStock = searchParams.get('lowStock')

    const where: Record<string, unknown> = {}

    if (warehouseId) {
      where.warehouseId = warehouseId
    }

    if (itemId) {
      where.itemId = itemId
    }

    // Low stock: items where quantity <= item's minStock
    if (lowStock === 'true') {
      where.quantity = { lte: 0 } // Will be refined after query
    }

    const balances = await db.itemBalance.findMany({
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
      orderBy: { item: { code: 'asc' } },
    })

    // Filter for low stock: quantity <= item.minStock
    let result = balances
    if (lowStock === 'true') {
      result = balances.filter((b) => b.quantity <= b.item.minStock)
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error('Get item balances error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch item balances' },
      { status: 500 }
    )
  }
}
