import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

// GET /api/reports/balance-sheet
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const companyId = searchParams.get('companyId')
    if (!companyId) {
      return NextResponse.json({ error: 'companyId is required' }, { status: 400 })
    }

    const asOfDate = searchParams.get('asOfDate') || new Date().toISOString().split('T')[0]

    const accounts = await db.account.findMany({
      where: { companyId, type: { in: ['ASSET', 'LIABILITY', 'EQUITY'] } },
      orderBy: { code: 'asc' },
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

    // Aggregate per account
    const accountBalances: Record<string, number> = {}
    for (const line of entryLines) {
      if (!accountBalances[line.accountId]) accountBalances[line.accountId] = 0
      // Normal balance: ASSET/EXPENSE = debit - credit, LIABILITY/EQUITY/REVENUE = credit - debit
      const acc = accounts.find(a => a.id === line.accountId)
      if (acc) {
        if (acc.type === 'ASSET') {
          accountBalances[line.accountId] += line.debit - line.credit
        } else {
          accountBalances[line.accountId] += line.credit - line.debit
        }
      }
    }

    const assets = accounts
      .filter(a => a.type === 'ASSET')
      .map(a => ({
        accountCode: a.code,
        accountNameAr: a.nameAr,
        balance: Math.round((accountBalances[a.id] || 0) * 100) / 100,
      }))

    const liabilities = accounts
      .filter(a => a.type === 'LIABILITY')
      .map(a => ({
        accountCode: a.code,
        accountNameAr: a.nameAr,
        balance: Math.round((accountBalances[a.id] || 0) * 100) / 100,
      }))

    const equity = accounts
      .filter(a => a.type === 'EQUITY')
      .map(a => ({
        accountCode: a.code,
        accountNameAr: a.nameAr,
        balance: Math.round((accountBalances[a.id] || 0) * 100) / 100,
      }))

    // Calculate net income (revenue - expenses) to add to equity
    const revenueExpAccounts = await db.account.findMany({
      where: { companyId, type: { in: ['REVENUE', 'EXPENSE'] } },
    })
    const revenueExpLines = await db.journalEntryLine.findMany({
      where: {
        journalEntry: {
          companyId,
          status: 'POSTED',
          date: { lte: new Date(asOfDate) },
        },
        accountId: { in: revenueExpAccounts.map(a => a.id) },
      },
    })

    let netIncome = 0
    for (const line of revenueExpLines) {
      const acc = revenueExpAccounts.find(a => a.id === line.accountId)
      if (acc) {
        if (acc.type === 'REVENUE') {
          netIncome += line.credit - line.debit
        } else {
          netIncome -= line.debit - line.credit
        }
      }
    }

    const totalAssets = assets.reduce((s, a) => s + a.balance, 0)
    const totalLiabilities = liabilities.reduce((s, a) => s + a.balance, 0)
    const totalEquity = equity.reduce((s, a) => s + a.balance, 0) + Math.round(netIncome * 100) / 100
    const totalLiabilitiesAndEquity = totalLiabilities + totalEquity

    return NextResponse.json({
      asOfDate,
      assets: { accounts: assets, total: Math.round(totalAssets * 100) / 100 },
      liabilities: { accounts: liabilities, total: Math.round(totalLiabilities * 100) / 100 },
      equity: {
        accounts: equity,
        netIncome: Math.round(netIncome * 100) / 100,
        total: Math.round(totalEquity * 100) / 100,
      },
      totalLiabilitiesAndEquity: Math.round(totalLiabilitiesAndEquity * 100) / 100,
      isBalanced: Math.abs(totalAssets - totalLiabilitiesAndEquity) < 0.01,
    })
  } catch (error) {
    console.error('Balance sheet error:', error)
    return NextResponse.json({ error: 'فشل في تحميل الميزانية العمومية' }, { status: 500 })
  }
}
