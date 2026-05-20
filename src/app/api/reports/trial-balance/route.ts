import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth-guard'

// GET /api/reports/trial-balance
export async function GET(request: NextRequest) {
  try {
    const user = await requirePermission('reports.view', request)
    const { searchParams } = new URL(request.url)
    const companyId = searchParams.get('companyId')
    if (!companyId) {
      return NextResponse.json({ error: 'companyId is required' }, { status: 400 })
    }

    const asOfDate = searchParams.get('asOfDate') || new Date().toISOString().split('T')[0]

    const accounts = await db.account.findMany({
      where: { companyId },
      orderBy: { code: 'asc' },
      include: {
        children: { orderBy: { code: 'asc' } },
      },
    })

    const entryLines = await db.journalEntryLine.findMany({
      where: {
        journalEntry: {
          companyId,
          status: 'POSTED',
          date: { lte: new Date(asOfDate) },
        },
      },
    })

    // Aggregate debits and credits per account
    const accountTotals: Record<string, { totalDebit: number; totalCredit: number }> = {}
    for (const line of entryLines) {
      if (!accountTotals[line.accountId]) {
        accountTotals[line.accountId] = { totalDebit: 0, totalCredit: 0 }
      }
      accountTotals[line.accountId].totalDebit += line.debit
      accountTotals[line.accountId].totalCredit += line.credit
    }

    const accountMap: Record<string, {
      id: string; code: string; nameAr: string; type: string;
      parentId: string | null; isLeaf: boolean; children: string[];
    }> = {}
    for (const acc of accounts) {
      accountMap[acc.id] = {
        id: acc.id, code: acc.code, nameAr: acc.nameAr, type: acc.type,
        parentId: acc.parentId, isLeaf: acc.isLeaf,
        children: acc.children.map(c => c.id),
      }
    }

    function computeAccountTotals(accId: string): { debit: number; credit: number } {
      const acc = accountMap[accId]
      if (!acc) return { debit: 0, credit: 0 }
      if (acc.isLeaf || acc.children.length === 0) {
        const totals = accountTotals[accId] || { totalDebit: 0, totalCredit: 0 }
        return { debit: totals.totalDebit, credit: totals.totalCredit }
      }
      let debit = 0, credit = 0
      for (const childId of acc.children) {
        const childTotals = computeAccountTotals(childId)
        debit += childTotals.debit
        credit += childTotals.credit
      }
      return { debit, credit }
    }

    const resultLines: Array<{
      accountCode: string; accountNameAr: string; accountType: string;
      totalDebit: number; totalCredit: number; balance: number;
      isParent: boolean; indent: number;
    }> = []

    function buildRows(parentId: string | null, indent: number) {
      const children = accounts.filter(a => a.parentId === parentId)
      for (const acc of children) {
        const totals = computeAccountTotals(acc.id)
        const balance = totals.debit - totals.credit
        resultLines.push({
          accountCode: acc.code, accountNameAr: acc.nameAr, accountType: acc.type,
          totalDebit: Math.round(totals.debit * 100) / 100,
          totalCredit: Math.round(totals.credit * 100) / 100,
          balance: Math.round(balance * 100) / 100,
          isParent: !acc.isLeaf && acc.children.length > 0,
          indent,
        })
        if (acc.children.length > 0) buildRows(acc.id, indent + 1)
      }
    }

    buildRows(null, 0)

    // Grand totals from leaf accounts only
    const leafLines = resultLines.filter(l => !l.isParent)
    const grandDebit = leafLines.reduce((s, r) => s + r.totalDebit, 0)
    const grandCredit = leafLines.reduce((s, r) => s + r.totalCredit, 0)

    return NextResponse.json({
      asOfDate,
      lines: resultLines,
      grandTotals: {
        totalDebit: Math.round(grandDebit * 100) / 100,
        totalCredit: Math.round(grandCredit * 100) / 100,
        balance: Math.round((grandDebit - grandCredit) * 100) / 100,
      },
    })
  } catch (error) {
    if (error instanceof Error && (error.message.includes('غير مصرح') || error.message.includes('صلاحية'))) {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }
    console.error('Trial balance error:', error)
    return NextResponse.json({ error: 'فشل في تحميل ميزان المراجعة' }, { status: 500 })
  }
}
