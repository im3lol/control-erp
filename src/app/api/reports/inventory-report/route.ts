import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

// GET /api/reports/inventory-report
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const companyId = searchParams.get('companyId')
    if (!companyId) {
      return NextResponse.json({ error: 'companyId is required' }, { status: 400 })
    }

    const warehouseId = searchParams.get('warehouseId')

    // Filter items by companyId through the item relation
    const where: Record<string, unknown> = {
      item: { companyId },
    }
    if (warehouseId) where.warehouseId = warehouseId

    const balances = await db.itemBalance.findMany({
      where,
      include: {
        item: { select: { id: true, code: true, nameAr: true, minStock: true } },
        warehouse: { select: { id: true, nameAr: true } },
      },
      orderBy: [{ item: { code: 'asc' } }],
    })

    const lines = balances.map(b => ({
      itemCode: b.item.code,
      itemNameAr: b.item.nameAr,
      warehouseName: b.warehouse.nameAr,
      warehouseId: b.warehouseId,
      quantity: b.quantity,
      avgCost: b.avgCost,
      totalValue: Math.round(b.quantity * b.avgCost * 100) / 100,
      minStock: b.item.minStock,
      isLowStock: b.quantity <= b.item.minStock,
    }))

    // Warehouse subtotals
    const warehouseMap: Record<string, { warehouseName: string; totalValue: number; itemCount: number }> = {}
    for (const line of lines) {
      if (!warehouseMap[line.warehouseId]) {
        warehouseMap[line.warehouseId] = { warehouseName: line.warehouseName, totalValue: 0, itemCount: 0 }
      }
      warehouseMap[line.warehouseId].totalValue += line.totalValue
      warehouseMap[line.warehouseId].itemCount += 1
    }

    const warehouseSubtotals = Object.entries(warehouseMap).map(([id, data]) => ({
      warehouseId: id,
      warehouseName: data.warehouseName,
      totalValue: Math.round(data.totalValue * 100) / 100,
      itemCount: data.itemCount,
    }))

    const grandTotal = lines.reduce((s, l) => s + l.totalValue, 0)

    return NextResponse.json({
      lines,
      warehouseSubtotals,
      grandTotal: Math.round(grandTotal * 100) / 100,
    })
  } catch (error) {
    console.error('Inventory report error:', error)
    return NextResponse.json({ error: 'فشل في تحميل تقرير المخازن' }, { status: 500 })
  }
}
