import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth-guard'

// GET /api/purchases/analytics - Purchases module dashboard analytics
export async function GET(request: NextRequest) {
  try {
    await requirePermission('purchases.view', request)
    const { searchParams } = new URL(request.url)
    const companyId = searchParams.get('companyId')

    if (!companyId) {
      return NextResponse.json({ error: 'companyId is required' }, { status: 400 })
    }

    // Run independent counts in parallel
    const [
      supplierCount,
      activeSupplierCount,
      totalPurchaseOrders,
      pendingPurchaseOrders,
      confirmedPurchaseOrders,
      totalPurchaseInvoices,
      pendingPurchaseInvoices,
      recentOrders,
      recentInvoices,
    ] = await Promise.all([
      // Total suppliers
      db.supplier.count({ where: { companyId } }),

      // Active suppliers
      db.supplier.count({ where: { companyId, isActive: true } }),

      // Total purchase orders
      db.purchaseOrder.count({ where: { companyId } }),

      // Pending (DRAFT) purchase orders
      db.purchaseOrder.count({ where: { companyId, status: 'DRAFT' } }),

      // Confirmed purchase orders
      db.purchaseOrder.count({ where: { companyId, status: 'CONFIRMED' } }),

      // Total purchase invoices
      db.purchaseInvoice.count({ where: { companyId } }),

      // Pending (DRAFT) purchase invoices
      db.purchaseInvoice.count({ where: { companyId, status: 'DRAFT' } }),

      // Recent purchase orders (last 10)
      db.purchaseOrder.findMany({
        where: { companyId },
        orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
        take: 10,
        select: {
          id: true,
          number: true,
          date: true,
          totalAmount: true,
          status: true,
          supplier: {
            select: { nameAr: true, nameEn: true },
          },
        },
      }),

      // Recent purchase invoices (last 10)
      db.purchaseInvoice.findMany({
        where: { companyId },
        orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
        take: 10,
        select: {
          id: true,
          number: true,
          date: true,
          totalAmount: true,
          status: true,
          balanceDue: true,
          supplier: {
            select: { nameAr: true, nameEn: true },
          },
        },
      }),
    ])

    // Aggregate financial data from confirmed invoices
    const invoiceAggregates = await db.purchaseInvoice.aggregate({
      where: { companyId, status: 'CONFIRMED' },
      _sum: {
        totalAmount: true,
        paidAmount: true,
        balanceDue: true,
      },
    })

    const totalPurchaseAmount = invoiceAggregates._sum.totalAmount || 0
    const totalPaidAmount = invoiceAggregates._sum.paidAmount || 0
    const totalBalanceDue = invoiceAggregates._sum.balanceDue || 0

    // Top suppliers by total invoice amount
    const topSuppliersRaw = await db.purchaseInvoice.groupBy({
      by: ['supplierId'],
      where: { companyId, status: 'CONFIRMED' },
      _sum: { totalAmount: true },
      _count: { id: true },
      orderBy: { _sum: { totalAmount: 'desc' } },
      take: 10,
    })

    // Fetch supplier names for top suppliers
    const topSupplierIds = topSuppliersRaw.map((s) => s.supplierId)
    const topSupplierDetails = await db.supplier.findMany({
      where: { id: { in: topSupplierIds } },
      select: { id: true, nameAr: true, nameEn: true },
    })

    const supplierNameMap = new Map(
      topSupplierDetails.map((s) => [s.id, s.nameAr || s.nameEn || ''])
    )

    const topSuppliers = topSuppliersRaw.map((s) => ({
      supplierId: s.supplierId,
      supplierName: supplierNameMap.get(s.supplierId) || '',
      totalAmount: s._sum.totalAmount || 0,
      invoiceCount: s._count.id,
    }))

    // Monthly purchases aggregation (last 12 months)
    // Fetch all confirmed invoices and aggregate in JS for SQLite compatibility
    const twelveMonthsAgo = new Date()
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12)
    twelveMonthsAgo.setDate(1)
    twelveMonthsAgo.setHours(0, 0, 0, 0)

    const monthlyInvoices = await db.purchaseInvoice.findMany({
      where: {
        companyId,
        status: 'CONFIRMED',
        date: { gte: twelveMonthsAgo },
      },
      select: {
        date: true,
        totalAmount: true,
      },
      orderBy: { date: 'asc' },
    })

    // Group by month
    const monthlyMap = new Map<string, { totalAmount: number; invoiceCount: number }>()

    for (const inv of monthlyInvoices) {
      const d = new Date(inv.date)
      const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      const existing = monthlyMap.get(monthKey) || { totalAmount: 0, invoiceCount: 0 }
      existing.totalAmount += inv.totalAmount
      existing.invoiceCount += 1
      monthlyMap.set(monthKey, existing)
    }

    const monthlyPurchases = Array.from(monthlyMap.entries())
      .map(([month, data]) => ({
        month,
        totalAmount: data.totalAmount,
        invoiceCount: data.invoiceCount,
      }))
      .sort((a, b) => a.month.localeCompare(b.month))

    // Format recent orders
    const formattedRecentOrders = recentOrders.map((o) => ({
      id: o.id,
      number: o.number,
      supplierName: o.supplier.nameAr || o.supplier.nameEn || '',
      date: o.date,
      totalAmount: o.totalAmount,
      status: o.status,
    }))

    // Format recent invoices
    const formattedRecentInvoices = recentInvoices.map((inv) => ({
      id: inv.id,
      number: inv.number,
      supplierName: inv.supplier.nameAr || inv.supplier.nameEn || '',
      date: inv.date,
      totalAmount: inv.totalAmount,
      status: inv.status,
      balanceDue: inv.balanceDue,
    }))

    return NextResponse.json({
      supplierCount,
      activeSupplierCount,
      totalPurchaseOrders,
      pendingPurchaseOrders,
      confirmedPurchaseOrders,
      totalPurchaseInvoices,
      pendingPurchaseInvoices,
      totalPurchaseAmount,
      totalPaidAmount,
      totalBalanceDue,
      recentOrders: formattedRecentOrders,
      recentInvoices: formattedRecentInvoices,
      topSuppliers,
      monthlyPurchases,
    })
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message.includes('غير مصرح') || error.message.includes('صلاحية'))
    ) {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }
    console.error('Get purchases analytics error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch purchases analytics' },
      { status: 500 }
    )
  }
}
