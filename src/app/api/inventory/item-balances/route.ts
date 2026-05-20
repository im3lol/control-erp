import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth-guard'

// GET /api/inventory/item-balances - List item balances with filters
export async function GET(request: NextRequest) {
  try {
    const user = await requirePermission('inventory.view', request)
    const { searchParams } = new URL(request.url)
    const companyId = searchParams.get('companyId')
    if (!companyId) {
      return NextResponse.json({ error: 'companyId is required' }, { status: 400 })
    }

    const warehouseId = searchParams.get('warehouseId')
    const itemId = searchParams.get('itemId')
    const lowStock = searchParams.get('lowStock')

    // We need to filter items by companyId, so we join through item
    const itemWhere: Record<string, unknown> = { companyId }

    const where: Record<string, unknown> = {}
    where.item = itemWhere

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
    if (error instanceof Error && (error.message.includes('غير مصرح') || error.message.includes('صلاحية'))) {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }
    console.error('Get item balances error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch item balances' },
      { status: 500 }
    )
  }
}
