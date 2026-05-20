import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

// GET /api/dashboard
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const companyId = searchParams.get('companyId')
    if (!companyId) {
      return NextResponse.json({ error: 'companyId is required' }, { status: 400 })
    }

    // Total confirmed/posted sales
    const salesInvoices = await db.salesInvoice.findMany({
      where: { companyId, status: { in: ['CONFIRMED', 'POSTED', 'PAID', 'PARTIAL_PAID'] } },
      select: { totalAmount: true },
    })
    const totalSales = salesInvoices.reduce((s, inv) => s + inv.totalAmount, 0)

    // Total confirmed/posted purchases
    const purchaseInvoices = await db.purchaseInvoice.findMany({
      where: { companyId, status: { in: ['CONFIRMED', 'POSTED', 'PAID', 'PARTIAL_PAID'] } },
      select: { totalAmount: true },
    })
    const totalPurchases = purchaseInvoices.reduce((s, inv) => s + inv.totalAmount, 0)

    // Customer count
    const customerCount = await db.customer.count({ where: { companyId, isActive: true } })

    // Supplier count
    const supplierCount = await db.supplier.count({ where: { companyId, isActive: true } })

    // Inventory value - filter items by companyId
    const itemBalances = await db.itemBalance.findMany({
      where: { item: { companyId } },
      select: { quantity: true, avgCost: true },
    })
    const inventoryValue = itemBalances.reduce((s, ib) => s + ib.quantity * ib.avgCost, 0)

    // Due invoices count
    const dueInvoices = await db.salesInvoice.count({
      where: { companyId, balanceDue: { gt: 0 }, status: { in: ['CONFIRMED', 'POSTED', 'PARTIAL_PAID'] } },
    })

    // Recent activities - last 10 combined from stock movements and invoices
    const [stockMovements, recentSales, recentPurchases] = await Promise.all([
      db.stockMovement.findMany({
        where: { companyId },
        take: 10,
        orderBy: { date: 'desc' },
        include: {
          item: { select: { code: true, nameAr: true } },
          warehouse: { select: { nameAr: true } },
        },
      }),
      db.salesInvoice.findMany({
        where: { companyId },
        take: 10,
        orderBy: { date: 'desc' },
        include: {
          customer: { select: { nameAr: true } },
        },
      }),
      db.purchaseInvoice.findMany({
        where: { companyId },
        take: 10,
        orderBy: { date: 'desc' },
        include: {
          supplier: { select: { nameAr: true } },
        },
      }),
    ])

    const activities: Array<{
      id: string; type: string; date: Date; description: string; amount: number;
    }> = []

    for (const sm of stockMovements) {
      activities.push({
        id: sm.id,
        type: 'stock_movement',
        date: sm.date,
        description: `${sm.type === 'IN' ? 'وارد' : 'صادر'} - ${sm.item.nameAr} (${sm.warehouse.nameAr})`,
        amount: sm.totalCost,
      })
    }

    for (const si of recentSales) {
      activities.push({
        id: si.id,
        type: 'sales_invoice',
        date: si.date,
        description: `فاتورة بيع - ${si.customer.nameAr}`,
        amount: si.totalAmount,
      })
    }

    for (const pi of recentPurchases) {
      activities.push({
        id: pi.id,
        type: 'purchase_invoice',
        date: pi.date,
        description: `فاتورة شراء - ${pi.supplier.nameAr}`,
        amount: pi.totalAmount,
      })
    }

    // Sort by date descending and take last 10
    activities.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    const recentActivities = activities.slice(0, 10)

    return NextResponse.json({
      totalSales: Math.round(totalSales * 100) / 100,
      totalPurchases: Math.round(totalPurchases * 100) / 100,
      customerCount,
      supplierCount,
      inventoryValue: Math.round(inventoryValue * 100) / 100,
      dueInvoices,
      recentActivities,
    })
  } catch (error) {
    console.error('Dashboard error:', error)
    return NextResponse.json({ error: 'فشل في تحميل لوحة التحكم' }, { status: 500 })
  }
}
