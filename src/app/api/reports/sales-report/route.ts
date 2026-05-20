import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

// GET /api/reports/sales-report
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const companyId = searchParams.get('companyId')
    if (!companyId) {
      return NextResponse.json({ error: 'companyId is required' }, { status: 400 })
    }

    const fromDate = searchParams.get('fromDate')
    const toDate = searchParams.get('toDate')
    const customerId = searchParams.get('customerId')

    const where: Record<string, unknown> = {
      companyId,
      status: { in: ['CONFIRMED', 'POSTED', 'PAID', 'PARTIAL_PAID'] },
    }
    if (customerId) where.customerId = customerId
    if (fromDate || toDate) {
      where.date = {
        ...(fromDate && { gte: new Date(fromDate) }),
        ...(toDate && { lte: new Date(toDate) }),
      }
    }

    const invoices = await db.salesInvoice.findMany({
      where,
      orderBy: { date: 'desc' },
      include: {
        customer: { select: { id: true, code: true, nameAr: true } },
        lines: { select: { costAmount: true } },
      },
    })

    const totalSales = invoices.reduce((s, inv) => s + inv.totalAmount, 0)
    const totalDiscount = invoices.reduce((s, inv) => s + inv.discountAmount, 0)
    const totalTax = invoices.reduce((s, inv) => s + inv.taxAmount, 0)
    const totalCOGS = invoices.reduce((s, inv) =>
      s + inv.lines.reduce((ls, l) => ls + l.costAmount, 0), 0)
    const grossProfit = totalSales - totalCOGS

    // By customer
    const customerMap: Record<string, { customerId: string; customerName: string; totalSales: number; invoiceCount: number }> = {}
    for (const inv of invoices) {
      const cid = inv.customerId
      if (!customerMap[cid]) {
        customerMap[cid] = {
          customerId: cid,
          customerName: inv.customer.nameAr,
          totalSales: 0,
          invoiceCount: 0,
        }
      }
      customerMap[cid].totalSales += inv.totalAmount
      customerMap[cid].invoiceCount += 1
    }
    const byCustomer = Object.values(customerMap).sort((a, b) => b.totalSales - a.totalSales)

    // By month
    const monthMap: Record<string, string> = {}
    const monthSales: Record<string, number> = {}
    for (const inv of invoices) {
      const d = new Date(inv.date)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      monthMap[key] = key
      monthSales[key] = (monthSales[key] || 0) + inv.totalAmount
    }
    const byMonth = Object.keys(monthMap).sort().map(key => ({
      month: key,
      totalSales: Math.round((monthSales[key] || 0) * 100) / 100,
    }))

    return NextResponse.json({
      totalSales: Math.round(totalSales * 100) / 100,
      totalDiscount: Math.round(totalDiscount * 100) / 100,
      totalTax: Math.round(totalTax * 100) / 100,
      totalCOGS: Math.round(totalCOGS * 100) / 100,
      grossProfit: Math.round(grossProfit * 100) / 100,
      invoices: invoices.map(inv => ({
        id: inv.id,
        number: inv.number,
        date: inv.date,
        customerName: inv.customer.nameAr,
        totalAmount: inv.totalAmount,
        discountAmount: inv.discountAmount,
        taxAmount: inv.taxAmount,
        status: inv.status,
      })),
      byCustomer,
      byMonth,
    })
  } catch (error) {
    console.error('Sales report error:', error)
    return NextResponse.json({ error: 'فشل في تحميل تقرير المبيعات' }, { status: 500 })
  }
}
