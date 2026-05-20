import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

const DEFAULT_COMPANY_ID = 'company-default'

// GET /api/investors/[id]/ledger - Get investor's complete ledger
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const investor = await db.investor.findUnique({
      where: { id },
    })

    if (!investor) {
      return NextResponse.json(
        { error: 'المستثمر غير موجود' },
        { status: 404 }
      )
    }

    // Fetch all related transactions
    const [investments, investorShares, withdrawals] = await Promise.all([
      db.investment.findMany({
        where: { investorId: id },
        orderBy: { date: 'asc' },
      }),
      db.investorShare.findMany({
        where: { investorId: id },
        include: {
          distribution: {
            select: {
              id: true,
              periodName: true,
              distributionDate: true,
              status: true,
            },
          },
        },
        orderBy: { createdAt: 'asc' },
      }),
      db.withdrawal.findMany({
        where: { investorId: id },
        orderBy: { date: 'asc' },
      }),
    ])

    // Calculate totals
    const totalInvestment = investments.reduce((sum, i) => sum + i.amount, 0)
    const totalProfitShare = investorShares.reduce((sum, s) => sum + s.profitShare, 0)
    const totalPaidProfit = investorShares
      .filter((s) => s.status === 'PAID')
      .reduce((sum, s) => sum + s.profitShare, 0)
    const totalWithdrawals = withdrawals.reduce((sum, w) => sum + w.amount, 0)
    const capitalWithdrawals = withdrawals
      .filter((w) => w.type === 'capital')
      .reduce((sum, w) => sum + w.amount, 0)
    const profitWithdrawals = withdrawals
      .filter((w) => w.type === 'profit')
      .reduce((sum, w) => sum + w.amount, 0)

    const netCapital = totalInvestment - capitalWithdrawals
    const pendingProfit = totalProfitShare - totalPaidProfit - profitWithdrawals

    // Calculate total company capital for ownership %
    const allInvestors = await db.investor.findMany({
      where: {
        companyId: DEFAULT_COMPANY_ID,
        status: 'active',
      },
      include: {
        investments: { select: { amount: true } },
        withdrawals: {
          where: { type: 'capital' },
          select: { amount: true },
        },
      },
    })

    const totalCompanyCapital = allInvestors.reduce((sum, inv) => {
      const invTotal = inv.investments.reduce((s, i) => s + i.amount, 0)
      const invWithdrawn = inv.withdrawals.reduce((s, w) => s + w.amount, 0)
      return sum + (invTotal - invWithdrawn)
    }, 0)

    const ownershipPercent =
      totalCompanyCapital > 0 ? (netCapital / totalCompanyCapital) * 100 : 0

    // Build unified transaction list with running balance
    type LedgerEntry = {
      id: string
      date: string
      type: 'investment' | 'profit_distribution' | 'withdrawal'
      description: string
      amount: number
      balance: number
      extra: Record<string, unknown>
    }

    const transactions: LedgerEntry[] = []
    let runningBalance = 0

    // Add investments
    for (const inv of investments) {
      runningBalance += inv.amount
      transactions.push({
        id: inv.id,
        date: inv.date.toISOString(),
        type: 'investment',
        description: inv.notes || 'استثمار رأس مال',
        amount: inv.amount,
        balance: runningBalance,
        extra: { investmentType: inv.type },
      })
    }

    // Add profit shares
    for (const share of investorShares) {
      runningBalance += share.profitShare
      transactions.push({
        id: share.id,
        date: share.createdAt.toISOString(),
        type: 'profit_distribution',
        description: `توزيع أرباح - ${share.distribution.periodName}`,
        amount: share.profitShare,
        balance: runningBalance,
        extra: {
          distributionId: share.distributionId,
          periodName: share.distribution.periodName,
          shareStatus: share.status,
          paymentDate: share.paymentDate?.toISOString(),
        },
      })
    }

    // Add withdrawals
    for (const w of withdrawals) {
      runningBalance -= w.amount
      transactions.push({
        id: w.id,
        date: w.date.toISOString(),
        type: 'withdrawal',
        description: w.type === 'capital' ? 'سحب رأس مال' : 'سحب أرباح',
        amount: -w.amount,
        balance: runningBalance,
        extra: { withdrawalType: w.type, notes: w.notes },
      })
    }

    // Sort by date
    transactions.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

    // Recalculate running balance after sort
    let recalculated = 0
    for (const tx of transactions) {
      recalculated += tx.amount
      tx.balance = recalculated
    }

    return NextResponse.json({
      investor: {
        id: investor.id,
        code: investor.code,
        fullName: investor.fullName,
        phone: investor.phone,
        email: investor.email,
        nationalId: investor.nationalId,
        joinDate: investor.joinDate,
        status: investor.status,
      },
      summary: {
        totalInvestment,
        totalProfitShare,
        totalPaidProfit,
        totalWithdrawals,
        netCapital,
        pendingProfit,
        ownershipPercent: Math.round(ownershipPercent * 100) / 100,
      },
      transactions,
    })
  } catch (error) {
    console.error('Get investor ledger error:', error)
    return NextResponse.json(
      { error: 'فشل في تحميل دفتر المستثمر' },
      { status: 500 }
    )
  }
}
