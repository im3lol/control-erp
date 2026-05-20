import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

// GET /api/reports/purchase-report
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const companyId = searchParams.get('companyId')
    if (!companyId) {
      return NextResponse.json({ error: 'companyId is required' }, { status: 400 })
    }

    const fromDate = searchParams.get('fromDate')
    const toDate = searchParams.get('toDate')
    const supplierId = searchParams.get('supplierId')

    const where: Record<string, unknown> = {
      companyId,
      status: { in: ['CONFIRMED', 'POSTED', 'PAID', 'PARTIAL_PAID'] },
    }
    if (supplierId) where.supplierId = supplierId
    if (fromDate || toDate) {
      where.date = {
        ...(fromDate && { gte: new Date(fromDate) }),
        ...(toDate && { lte: new Date(toDate) }),
      }
    }

    const invoices = await db.purchaseInvoice.findMany({
      where,
      orderBy: { date: 'desc' },
      include: {
        supplier: { select: { id: true, code: true, nameAr: true } },
      },
    })

    const totalPurchases = invoices.reduce((s, inv) => s + inv.totalAmount, 0)
    const totalDiscount = invoices.reduce((s, inv) => s + inv.discountAmount, 0)
    const totalTax = invoices.reduce((s, inv) => s + inv.taxAmount, 0)

    // By supplier
    const supplierMap: Record<string, { supplierId: string; supplierName: string; totalPurchases: number; invoiceCount: number }> = {}
    for (const inv of invoices) {
      const sid = inv.supplierId
      if (!supplierMap[sid]) {
        supplierMap[sid] = {
          supplierId: sid,
          supplierName: inv.supplier.nameAr,
          totalPurchases: 0,
          invoiceCount: 0,
        }
      }
      supplierMap[sid].totalPurchases += inv.totalAmount
      supplierMap[sid].invoiceCount += 1
    }
    const bySupplier = Object.values(supplierMap).sort((a, b) => b.totalPurchases - a.totalPurchases)

    // By month
    const monthMap: Record<string, string> = {}
    const monthPurchases: Record<string, number> = {}
    for (const inv of invoices) {
      const d = new Date(inv.date)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      monthMap[key] = key
      monthPurchases[key] = (monthPurchases[key] || 0) + inv.totalAmount
    }
    const byMonth = Object.keys(monthMap).sort().map(key => ({
      month: key,
      totalPurchases: Math.round((monthPurchases[key] || 0) * 100) / 100,
    }))

    return NextResponse.json({
      totalPurchases: Math.round(totalPurchases * 100) / 100,
      totalDiscount: Math.round(totalDiscount * 100) / 100,
      totalTax: Math.round(totalTax * 100) / 100,
      invoices: invoices.map(inv => ({
        id: inv.id,
        number: inv.number,
        date: inv.date,
        supplierName: inv.supplier.nameAr,
        totalAmount: inv.totalAmount,
        discountAmount: inv.discountAmount,
        taxAmount: inv.taxAmount,
        status: inv.status,
      })),
      bySupplier,
      byMonth,
    })
  } catch (error) {
    console.error('Purchase report error:', error)
    return NextResponse.json({ error: 'فشل في تحميل تقرير المشتريات' }, { status: 500 })
  }
}
