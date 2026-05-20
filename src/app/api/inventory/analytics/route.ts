import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

// GET /api/inventory/analytics?companyId=xxx
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const companyId = searchParams.get('companyId')
    if (!companyId) {
      return NextResponse.json({ error: 'companyId is required' }, { status: 400 })
    }

    const [
      warehouseCount,
      itemCount,
      categoryCount,
      itemBalances,
      pendingMaterialRequests,
      pendingDeliveryNotes,
      pendingPickLists,
      pendingStockTransfers,
      pendingPurchaseReceipts,
      recentMovements,
      lowStockItems,
      topItemsByValue,
      warehouseStockDistribution,
    ] = await Promise.all([
      db.warehouse.count({ where: { companyId, isActive: true, type: 'WAREHOUSE' } }),
      db.item.count({ where: { companyId, isActive: true } }),
      db.itemCategory.count({ where: { companyId, isActive: true } }),
      db.itemBalance.findMany({
        where: { item: { companyId, isActive: true } },
        include: {
          item: {
            select: {
              id: true, code: true, nameAr: true, nameEn: true,
              minStock: true, maxStock: true, sellPrice: true,
              category: { select: { id: true, nameAr: true } },
              uom: { select: { nameAr: true } },
            },
          },
          warehouse: { select: { id: true, nameAr: true, type: true } },
        },
      }),
      db.materialRequest.count({ where: { companyId, status: { in: ['DRAFT', 'PENDING', 'APPROVED'] } } }),
      db.deliveryNote.count({ where: { companyId, status: 'DRAFT' } }),
      db.pickList.count({ where: { companyId, status: { in: ['DRAFT', 'IN_PROGRESS'] } } }),
      db.stockTransfer.count({ where: { companyId, status: 'DRAFT' } }),
      db.purchaseReceipt.count({ where: { companyId, status: 'DRAFT' } }),
      db.stockMovement.findMany({
        where: { companyId },
        take: 15,
        orderBy: { date: 'desc' },
        include: {
          item: { select: { code: true, nameAr: true, nameEn: true } },
          warehouse: { select: { nameAr: true } },
        },
      }),
      db.itemBalance.findMany({
        where: {
          item: { companyId, isActive: true, minStock: { gt: 0 } },
          quantity: { lte: 0 },
        },
        include: {
          item: { select: { id: true, code: true, nameAr: true, nameEn: true, minStock: true, uom: { select: { nameAr: true } } } },
          warehouse: { select: { nameAr: true } },
        },
        take: 10,
      }),
      db.itemBalance.findMany({
        where: { item: { companyId, isActive: true }, quantity: { gt: 0 } },
        include: {
          item: { select: { id: true, code: true, nameAr: true, nameEn: true, uom: { select: { nameAr: true } } } },
        },
        orderBy: { avgCost: 'desc' },
        take: 10,
      }),
      db.itemBalance.groupBy({
        by: ['warehouseId'],
        where: { item: { companyId, isActive: true } },
        _sum: { quantity: true, avgCost: true },
        _count: true,
      }),
    ])

    const totalStockValue = itemBalances.reduce((s, ib) => s + ib.quantity * ib.avgCost, 0)
    const totalItemsInStock = itemBalances.reduce((s, ib) => s + ib.quantity, 0)
    const uniqueItemsInStock = new Set(itemBalances.filter(ib => ib.quantity > 0).map(ib => ib.itemId)).size

    const lowStockAlerts = lowStockItems.map(ib => ({
      itemId: ib.item.id, itemCode: ib.item.code,
      itemName: ib.item.nameAr || ib.item.nameEn,
      currentQty: ib.quantity, minStock: ib.item.minStock,
      warehouse: ib.warehouse.nameAr, uom: ib.item.uom?.nameAr,
    }))

    const topItems = topItemsByValue
      .map(ib => ({
        itemId: ib.item.id, itemCode: ib.item.code,
        itemName: ib.item.nameAr || ib.item.nameEn,
        quantity: ib.quantity, avgCost: ib.avgCost,
        totalValue: ib.quantity * ib.avgCost, uom: ib.item.uom?.nameAr,
      }))
      .sort((a, b) => b.totalValue - a.totalValue)

    const categoryMap = new Map<string, { name: string; count: number; value: number }>()
    for (const ib of itemBalances) {
      const catId = ib.item.category?.id || 'uncategorized'
      const catName = ib.item.category?.nameAr || 'غير مصنف'
      const val = ib.quantity * ib.avgCost
      if (!categoryMap.has(catId)) categoryMap.set(catId, { name: catName, count: 0, value: 0 })
      const cat = categoryMap.get(catId)!
      cat.count += 1
      cat.value += val
    }
    const categoryDistribution = Array.from(categoryMap.entries()).map(([id, data]) => ({
      id, ...data, value: Math.round(data.value * 100) / 100,
    }))

    const warehouseMap = new Map<string, string>()
    for (const ib of itemBalances) {
      if (!warehouseMap.has(ib.warehouseId)) warehouseMap.set(ib.warehouseId, ib.warehouse.nameAr)
    }
    const warehouseDistribution = warehouseStockDistribution.map(w => ({
      warehouseId: w.warehouseId,
      warehouseName: warehouseMap.get(w.warehouseId) || w.warehouseId,
      totalQuantity: w._sum.quantity || 0,
      itemCount: w._count,
      totalValue: Math.round(((w._sum.avgCost || 0) * (w._sum.quantity || 0)) * 100) / 100,
    }))

    return NextResponse.json({
      warehouseCount, itemCount, categoryCount,
      totalStockValue: Math.round(totalStockValue * 100) / 100,
      totalItemsInStock: Math.round(totalItemsInStock * 100) / 100,
      uniqueItemsInStock,
      lowStockAlerts,
      pendingActions: {
        materialRequests: pendingMaterialRequests,
        deliveryNotes: pendingDeliveryNotes,
        pickLists: pendingPickLists,
        stockTransfers: pendingStockTransfers,
        purchaseReceipts: pendingPurchaseReceipts,
        total: pendingMaterialRequests + pendingDeliveryNotes + pendingPickLists + pendingStockTransfers + pendingPurchaseReceipts,
      },
      topItemsByValue: topItems,
      categoryDistribution,
      warehouseDistribution,
      recentMovements: recentMovements.map(m => ({
        id: m.id, type: m.type, number: m.number, date: m.date,
        itemName: m.item.nameAr || m.item.nameEn,
        itemCode: m.item.code, warehouse: m.warehouse.nameAr,
        quantity: m.quantity, unitCost: m.unitCost, totalCost: m.totalCost,
      })),
    })
  } catch (error) {
    console.error('Inventory analytics error:', error)
    const msg = error instanceof Error ? error.message : 'فشل في تحميل تحليلات المخزون'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
