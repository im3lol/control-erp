import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

// GET /api/reports/income-statement
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const companyId = searchParams.get('companyId')
    if (!companyId) {
      return NextResponse.json({ error: 'companyId is required' }, { status: 400 })
    }

    const fromDate = searchParams.get('fromDate')
    const toDate = searchParams.get('toDate') || new Date().toISOString().split('T')[0]

    const accounts = await db.account.findMany({
      where: { companyId, type: { in: ['REVENUE', 'EXPENSE'] } },
      orderBy: { code: 'asc' },
    })

    const dateFilter: { gte?: Date; lte: Date } = { lte: new Date(toDate) }
    if (fromDate) dateFilter.gte = new Date(fromDate)

    const entryLines = await db.journalEntryLine.findMany({
      where: {
        journalEntry: {
          companyId,
          status: 'POSTED',
          date: dateFilter,
        },
        accountId: { in: accounts.map(a => a.id) },
      },
    })

    // Aggregate per account
    const accountBalances: Record<string, number> = {}
    for (const line of entryLines) {
      const acc = accounts.find(a => a.id === line.accountId)
      if (!acc) continue
      if (!accountBalances[line.accountId]) accountBalances[line.accountId] = 0
      // Revenue: credit - debit (normal balance), Expense: debit - credit
      if (acc.type === 'REVENUE') {
        accountBalances[line.accountId] += line.credit - line.debit
      } else {
        accountBalances[line.accountId] += line.debit - line.credit
      }
    }

    const revenues = accounts
      .filter(a => a.type === 'REVENUE')
      .map(a => ({
        accountCode: a.code,
        accountNameAr: a.nameAr,
        balance: Math.round((accountBalances[a.id] || 0) * 100) / 100,
      }))

    const expenses = accounts
      .filter(a => a.type === 'EXPENSE')
      .map(a => ({
        accountCode: a.code,
        accountNameAr: a.nameAr,
        balance: Math.round((accountBalances[a.id] || 0) * 100) / 100,
      }))

    const totalRevenue = revenues.reduce((s, a) => s + a.balance, 0)
    const totalExpenses = expenses.reduce((s, a) => s + a.balance, 0)
    const netIncome = totalRevenue - totalExpenses

    return NextResponse.json({
      fromDate: fromDate || '',
      toDate,
      revenues: { accounts: revenues, total: Math.round(totalRevenue * 100) / 100 },
      expenses: { accounts: expenses, total: Math.round(totalExpenses * 100) / 100 },
      netIncome: Math.round(netIncome * 100) / 100,
    })
  } catch (error) {
    console.error('Income statement error:', error)
    return NextResponse.json({ error: 'فشل في تحميل قائمة الدخل' }, { status: 500 })
  }
}
