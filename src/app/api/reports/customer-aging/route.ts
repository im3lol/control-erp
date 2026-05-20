import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

// GET /api/reports/customer-aging
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const companyId = searchParams.get('companyId')
    if (!companyId) {
      return NextResponse.json({ error: 'companyId is required' }, { status: 400 })
    }

    const customers = await db.customer.findMany({
      where: { companyId, isActive: true },
      orderBy: { nameAr: 'asc' },
    })

    const invoices = await db.salesInvoice.findMany({
      where: {
        companyId,
        status: { in: ['CONFIRMED', 'POSTED', 'PARTIAL_PAID'] },
        balanceDue: { gt: 0 },
      },
      include: {
        customer: { select: { id: true } },
      },
    })

    const now = new Date()
    const customerAging: Record<string, {
      customerCode: string; customerName: string;
      current: number; days30: number; days60: number; days90plus: number;
    }> = {}

    for (const cust of customers) {
      customerAging[cust.id] = {
        customerCode: cust.code,
        customerName: cust.nameAr,
        current: 0,
        days30: 0,
        days60: 0,
        days90plus: 0,
      }
    }

    for (const inv of invoices) {
      const cid = inv.customerId
      if (!customerAging[cid]) continue

      const dueDate = inv.dueDate ? new Date(inv.dueDate) : new Date(inv.date)
      const diffMs = now.getTime() - dueDate.getTime()
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
      const amount = inv.balanceDue

      if (diffDays <= 30) {
        customerAging[cid].current += amount
      } else if (diffDays <= 60) {
        customerAging[cid].days30 += amount
      } else if (diffDays <= 90) {
        customerAging[cid].days60 += amount
      } else {
        customerAging[cid].days90plus += amount
      }
    }

    const result = Object.values(customerAging)
      .map(c => ({
        ...c,
        totalOutstanding: Math.round((c.current + c.days30 + c.days60 + c.days90plus) * 100) / 100,
        current: Math.round(c.current * 100) / 100,
        days30: Math.round(c.days30 * 100) / 100,
        days60: Math.round(c.days60 * 100) / 100,
        days90plus: Math.round(c.days90plus * 100) / 100,
      }))
      .filter(c => c.totalOutstanding > 0)

    const grandTotal = {
      totalOutstanding: Math.round(result.reduce((s, c) => s + c.totalOutstanding, 0) * 100) / 100,
      current: Math.round(result.reduce((s, c) => s + c.current, 0) * 100) / 100,
      days30: Math.round(result.reduce((s, c) => s + c.days30, 0) * 100) / 100,
      days60: Math.round(result.reduce((s, c) => s + c.days60, 0) * 100) / 100,
      days90plus: Math.round(result.reduce((s, c) => s + c.days90plus, 0) * 100) / 100,
    }

    return NextResponse.json({ customers: result, grandTotal })
  } catch (error) {
    console.error('Customer aging error:', error)
    return NextResponse.json({ error: 'فشل في تحميل أرصدة العملاء' }, { status: 500 })
  }
}
