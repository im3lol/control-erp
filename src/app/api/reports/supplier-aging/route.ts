import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

// GET /api/reports/supplier-aging
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const companyId = searchParams.get('companyId')
    if (!companyId) {
      return NextResponse.json({ error: 'companyId is required' }, { status: 400 })
    }

    const suppliers = await db.supplier.findMany({
      where: { companyId, isActive: true },
      orderBy: { nameAr: 'asc' },
    })

    const invoices = await db.purchaseInvoice.findMany({
      where: {
        companyId,
        status: { in: ['CONFIRMED', 'POSTED', 'PARTIAL_PAID'] },
        balanceDue: { gt: 0 },
      },
      include: {
        supplier: { select: { id: true } },
      },
    })

    const now = new Date()
    const supplierAging: Record<string, {
      supplierCode: string; supplierName: string;
      current: number; days30: number; days60: number; days90plus: number;
    }> = {}

    for (const sup of suppliers) {
      supplierAging[sup.id] = {
        supplierCode: sup.code,
        supplierName: sup.nameAr,
        current: 0,
        days30: 0,
        days60: 0,
        days90plus: 0,
      }
    }

    for (const inv of invoices) {
      const sid = inv.supplierId
      if (!supplierAging[sid]) continue

      const dueDate = inv.dueDate ? new Date(inv.dueDate) : new Date(inv.date)
      const diffMs = now.getTime() - dueDate.getTime()
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
      const amount = inv.balanceDue

      if (diffDays <= 30) {
        supplierAging[sid].current += amount
      } else if (diffDays <= 60) {
        supplierAging[sid].days30 += amount
      } else if (diffDays <= 90) {
        supplierAging[sid].days60 += amount
      } else {
        supplierAging[sid].days90plus += amount
      }
    }

    const result = Object.values(supplierAging)
      .map(s => ({
        ...s,
        totalOutstanding: Math.round((s.current + s.days30 + s.days60 + s.days90plus) * 100) / 100,
        current: Math.round(s.current * 100) / 100,
        days30: Math.round(s.days30 * 100) / 100,
        days60: Math.round(s.days60 * 100) / 100,
        days90plus: Math.round(s.days90plus * 100) / 100,
      }))
      .filter(s => s.totalOutstanding > 0)

    const grandTotal = {
      totalOutstanding: Math.round(result.reduce((s, c) => s + c.totalOutstanding, 0) * 100) / 100,
      current: Math.round(result.reduce((s, c) => s + c.current, 0) * 100) / 100,
      days30: Math.round(result.reduce((s, c) => s + c.days30, 0) * 100) / 100,
      days60: Math.round(result.reduce((s, c) => s + c.days60, 0) * 100) / 100,
      days90plus: Math.round(result.reduce((s, c) => s + c.days90plus, 0) * 100) / 100,
    }

    return NextResponse.json({ suppliers: result, grandTotal })
  } catch (error) {
    console.error('Supplier aging error:', error)
    return NextResponse.json({ error: 'فشل في تحميل أرصدة الموردين' }, { status: 500 })
  }
}
