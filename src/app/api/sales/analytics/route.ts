import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

// GET /api/sales/analytics?companyId=xxx
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const companyId = searchParams.get('companyId')
    if (!companyId) {
      return NextResponse.json({ error: 'companyId is required' }, { status: 400 })
    }

    // Run independent count/aggregate queries in parallel
    const [
      customerCount,
      activeCustomerCount,
      totalSalesOrders,
      pendingSalesOrders,
      confirmedSalesOrders,
      totalSalesInvoices,
      pendingSalesInvoices,
      confirmedInvoices,
      recentOrders,
      recentInvoices,
      topCustomersRaw,
      monthlySalesRaw,
    ] = await Promise.all([
      // Customer counts
      db.customer.count({ where: { companyId } }),
      db.customer.count({ where: { companyId, isActive: true } }),

      // Sales order counts
      db.salesOrder.count({ where: { companyId } }),
      db.salesOrder.count({ where: { companyId, status: 'DRAFT' } }),
      db.salesOrder.count({ where: { companyId, status: 'CONFIRMED' } }),

      // Sales invoice counts
      db.salesInvoice.count({ where: { companyId } }),
      db.salesInvoice.count({ where: { companyId, status: 'DRAFT' } }),

      // Confirmed invoices for financial totals
      db.salesInvoice.findMany({
        where: { companyId, status: { in: ['CONFIRMED', 'PAID'] } },
        select: {
          totalAmount: true,
          paidAmount: true,
          balanceDue: true,
        },
      }),

      // Recent orders (last 5)
      db.salesOrder.findMany({
        where: { companyId },
        take: 5,
        orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
        select: {
          id: true,
          number: true,
          date: true,
          totalAmount: true,
          status: true,
          customer: {
            select: { nameAr: true, nameEn: true },
          },
        },
      }),

      // Recent invoices (last 5)
      db.salesInvoice.findMany({
        where: { companyId },
        take: 5,
        orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
        select: {
          id: true,
          number: true,
          date: true,
          totalAmount: true,
          status: true,
          balanceDue: true,
          customer: {
            select: { nameAr: true, nameEn: true },
          },
        },
      }),

      // Top customers: aggregate sales by customer from confirmed/paid invoices
      db.salesInvoice.findMany({
        where: { companyId, status: { in: ['CONFIRMED', 'PAID'] } },
        select: {
          customerId: true,
          totalAmount: true,
          customer: {
            select: { id: true, nameAr: true, nameEn: true },
          },
        },
      }),

      // Monthly sales: all confirmed/paid invoices for aggregation
      db.salesInvoice.findMany({
        where: { companyId, status: { in: ['CONFIRMED', 'PAID'] } },
        select: {
          date: true,
          totalAmount: true,
        },
        orderBy: { date: 'asc' },
      }),
    ])

    // Calculate financial totals from confirmed/paid invoices
    const totalSalesAmount = Math.round(
      confirmedInvoices.reduce((sum, inv) => sum + inv.totalAmount, 0) * 100
    ) / 100
    const totalPaidAmount = Math.round(
      confirmedInvoices.reduce((sum, inv) => sum + inv.paidAmount, 0) * 100
    ) / 100
    const totalBalanceDue = Math.round(
      confirmedInvoices.reduce((sum, inv) => sum + inv.balanceDue, 0) * 100
    ) / 100

    // Format recent orders
    const recentOrdersFormatted = recentOrders.map((o) => ({
      id: o.id,
      number: o.number,
      customerName: o.customer.nameAr || o.customer.nameEn,
      date: o.date,
      totalAmount: o.totalAmount,
      status: o.status,
    }))

    // Format recent invoices
    const recentInvoicesFormatted = recentInvoices.map((inv) => ({
      id: inv.id,
      number: inv.number,
      customerName: inv.customer.nameAr || inv.customer.nameEn,
      date: inv.date,
      totalAmount: inv.totalAmount,
      status: inv.status,
      balanceDue: inv.balanceDue,
    }))

    // Aggregate top customers by totalAmount and invoice count
    const customerMap = new Map<
      string,
      { customerId: string; customerName: string; totalAmount: number; invoiceCount: number }
    >()
    for (const inv of topCustomersRaw) {
      const existing = customerMap.get(inv.customerId)
      const name = inv.customer.nameAr || inv.customer.nameEn
      if (existing) {
        existing.totalAmount += inv.totalAmount
        existing.invoiceCount += 1
      } else {
        customerMap.set(inv.customerId, {
          customerId: inv.customerId,
          customerName: name,
          totalAmount: inv.totalAmount,
          invoiceCount: 1,
        })
      }
    }
    const topCustomers = Array.from(customerMap.values())
      .map((c) => ({
        ...c,
        totalAmount: Math.round(c.totalAmount * 100) / 100,
      }))
      .sort((a, b) => b.totalAmount - a.totalAmount)
      .slice(0, 10)

    // Aggregate monthly sales
    const monthMap = new Map<string, { month: string; totalAmount: number; invoiceCount: number }>()
    for (const inv of monthlySalesRaw) {
      const d = new Date(inv.date)
      const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      const existing = monthMap.get(monthKey)
      if (existing) {
        existing.totalAmount += inv.totalAmount
        existing.invoiceCount += 1
      } else {
        monthMap.set(monthKey, {
          month: monthKey,
          totalAmount: inv.totalAmount,
          invoiceCount: 1,
        })
      }
    }
    const monthlySales = Array.from(monthMap.values())
      .map((m) => ({
        ...m,
        totalAmount: Math.round(m.totalAmount * 100) / 100,
      }))
      .sort((a, b) => a.month.localeCompare(b.month))

    return NextResponse.json({
      customerCount,
      activeCustomerCount,
      totalSalesOrders,
      pendingSalesOrders,
      confirmedSalesOrders,
      totalSalesInvoices,
      pendingSalesInvoices,
      totalSalesAmount,
      totalPaidAmount,
      totalBalanceDue,
      recentOrders: recentOrdersFormatted,
      recentInvoices: recentInvoicesFormatted,
      topCustomers,
      monthlySales,
    })
  } catch (error) {
    console.error('Sales analytics error:', error)
    const msg = error instanceof Error ? error.message : 'فشل في تحميل تحليلات المبيعات'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
