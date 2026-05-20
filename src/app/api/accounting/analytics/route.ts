import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth-guard'

// GET /api/accounting/analytics - Accounting module dashboard analytics
export async function GET(request: NextRequest) {
  try {
    await requirePermission('accounting.view', request)
    const { searchParams } = new URL(request.url)
    const companyId = searchParams.get('companyId')

    if (!companyId) {
      return NextResponse.json({ error: 'companyId is required' }, { status: 400 })
    }

    // Run independent queries in parallel
    const [
      totalAccounts,
      leafAccounts,
      activeAccounts,
      accountTypeCounts,
      totalJournalEntries,
      draftEntries,
      postedEntries,
      reversedEntries,
      recentEntries,
    ] = await Promise.all([
      // Total accounts
      db.account.count({ where: { companyId } }),

      // Leaf accounts (can be posted to)
      db.account.count({ where: { companyId, isLeaf: true } }),

      // Active accounts
      db.account.count({ where: { companyId, isActive: true } }),

      // Account count by type
      db.account.groupBy({
        by: ['type'],
        where: { companyId },
        _count: { id: true },
      }),

      // Total journal entries
      db.journalEntry.count({ where: { companyId } }),

      // Draft entries
      db.journalEntry.count({ where: { companyId, status: 'DRAFT' } }),

      // Posted entries
      db.journalEntry.count({ where: { companyId, status: 'POSTED' } }),

      // Reversed entries
      db.journalEntry.count({ where: { companyId, status: 'REVERSED' } }),

      // Recent journal entries (last 10)
      db.journalEntry.findMany({
        where: { companyId },
        orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
        take: 10,
        select: {
          id: true,
          number: true,
          date: true,
          description: true,
          status: true,
          sourceType: true,
          createdAt: true,
          lines: {
            select: {
              debit: true,
              credit: true,
              account: {
                select: {
                  code: true,
                  nameAr: true,
                  type: true,
                },
              },
            },
          },
        },
      }),
    ])

    // Aggregate financial data from POSTED entries
    const postedEntriesData = await db.journalEntryLine.findMany({
      where: {
        journalEntry: { companyId, status: 'POSTED' },
      },
      select: {
        debit: true,
        credit: true,
        account: {
          select: { type: true },
        },
      },
    })

    // Calculate totals by account type
    const totalsByType: Record<string, { debit: number; credit: number }> = {}
    let totalDebit = 0
    let totalCredit = 0

    for (const line of postedEntriesData) {
      const type = line.account.type
      if (!totalsByType[type]) {
        totalsByType[type] = { debit: 0, credit: 0 }
      }
      totalsByType[type].debit += line.debit
      totalsByType[type].credit += line.credit
      totalDebit += line.debit
      totalCredit += line.credit
    }

    // Account type distribution for chart
    const accountTypes = [
      { type: 'ASSET', label: 'أصول', color: 'bg-cyan-400' },
      { type: 'LIABILITY', label: 'خصوم', color: 'bg-red-400' },
      { type: 'EQUITY', label: 'حقوق ملكية', color: 'bg-purple-400' },
      { type: 'REVENUE', label: 'إيرادات', color: 'bg-emerald-400' },
      { type: 'EXPENSE', label: 'مصروفات', color: 'bg-orange-400' },
    ]

    const accountDistribution = accountTypes.map((at) => {
      const found = accountTypeCounts.find((c) => c.type === at.type)
      return {
        type: at.type,
        label: at.label,
        color: at.color,
        count: found?._count.id || 0,
      }
    })

    // Monthly journal entries aggregation (last 12 months)
    const twelveMonthsAgo = new Date()
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12)
    twelveMonthsAgo.setDate(1)
    twelveMonthsAgo.setHours(0, 0, 0, 0)

    const monthlyEntriesRaw = await db.journalEntry.findMany({
      where: {
        companyId,
        status: 'POSTED',
        date: { gte: twelveMonthsAgo },
      },
      select: {
        date: true,
        lines: {
          select: {
            debit: true,
            credit: true,
          },
        },
      },
      orderBy: { date: 'asc' },
    })

    // Group by month
    const monthlyMap = new Map<string, { totalDebit: number; totalCredit: number; entryCount: number }>()

    for (const entry of monthlyEntriesRaw) {
      const d = new Date(entry.date)
      const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      const existing = monthlyMap.get(monthKey) || { totalDebit: 0, totalCredit: 0, entryCount: 0 }
      const entryDebit = entry.lines.reduce((s, l) => s + l.debit, 0)
      const entryCredit = entry.lines.reduce((s, l) => s + l.credit, 0)
      existing.totalDebit += entryDebit
      existing.totalCredit += entryCredit
      existing.entryCount += 1
      monthlyMap.set(monthKey, existing)
    }

    const monthlyEntries = Array.from(monthlyMap.entries())
      .map(([month, data]) => ({
        month,
        totalDebit: data.totalDebit,
        totalCredit: data.totalCredit,
        entryCount: data.entryCount,
      }))
      .sort((a, b) => a.month.localeCompare(b.month))

    // Format recent entries
    const formattedRecentEntries = recentEntries.map((entry) => {
      const debit = entry.lines.reduce((s, l) => s + l.debit, 0)
      const credit = entry.lines.reduce((s, l) => s + l.credit, 0)
      return {
        id: entry.id,
        number: entry.number,
        date: entry.date,
        description: entry.description,
        status: entry.status,
        sourceType: entry.sourceType,
        totalDebit: debit,
        totalCredit: credit,
      }
    })

    // Top accounts by movement (debit + credit) from posted entries
    const topAccountsRaw = await db.journalEntryLine.groupBy({
      by: ['accountId'],
      where: {
        journalEntry: { companyId, status: 'POSTED' },
      },
      _sum: { debit: true, credit: true },
      _count: { id: true },
      orderBy: { _sum: { debit: 'desc' } },
      take: 8,
    })

    // Fetch account names
    const topAccountIds = topAccountsRaw.map((a) => a.accountId)
    const topAccountDetails = await db.account.findMany({
      where: { id: { in: topAccountIds } },
      select: { id: true, code: true, nameAr: true, type: true },
    })

    const accountNameMap = new Map(
      topAccountDetails.map((a) => [a.id, a])
    )

    const topAccounts = topAccountsRaw.map((a) => {
      const details = accountNameMap.get(a.accountId)
      return {
        accountId: a.accountId,
        code: details?.code || '',
        nameAr: details?.nameAr || '',
        type: details?.type || '',
        totalDebit: a._sum.debit || 0,
        totalCredit: a._sum.credit || 0,
        movementCount: a._count.id,
      }
    })

    return NextResponse.json({
      totalAccounts,
      leafAccounts,
      activeAccounts,
      accountDistribution,
      totalJournalEntries,
      draftEntries,
      postedEntries,
      reversedEntries,
      totalDebit,
      totalCredit,
      totalsByType,
      recentEntries: formattedRecentEntries,
      monthlyEntries,
      topAccounts,
    })
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message.includes('غير مصرح') || error.message.includes('صلاحية'))
    ) {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }
    console.error('Get accounting analytics error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch accounting analytics' },
      { status: 500 }
    )
  }
}
