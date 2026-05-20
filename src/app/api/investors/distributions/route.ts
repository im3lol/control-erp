import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

const DEFAULT_COMPANY_ID = 'company-default'

// GET /api/investors/distributions - List profit distributions
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')

    const where: Record<string, unknown> = {
      companyId: DEFAULT_COMPANY_ID,
    }

    if (status) {
      where.status = status
    }

    const distributions = await db.profitDistribution.findMany({
      where,
      orderBy: { distributionDate: 'desc' },
      include: {
        investorShares: {
          include: {
            investor: {
              select: {
                id: true,
                code: true,
                fullName: true,
              },
            },
          },
          orderBy: { investor: { code: 'asc' } },
        },
      },
    })

    return NextResponse.json(distributions)
  } catch (error) {
    console.error('Get distributions error:', error)
    return NextResponse.json(
      { error: 'فشل في تحميل بيانات التوزيعات' },
      { status: 500 }
    )
  }
}

// POST /api/investors/distributions - Create profit distribution
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { periodName, periodStart, periodEnd, totalProfit, distributionDate } = body

    if (!periodName || !periodStart || !periodEnd || !totalProfit || totalProfit <= 0) {
      return NextResponse.json(
        { error: 'بيانات التوزيع غير مكتملة' },
        { status: 400 }
      )
    }

    // Create ProfitDistribution record (DRAFT status)
    const distribution = await db.profitDistribution.create({
      data: {
        companyId: DEFAULT_COMPANY_ID,
        periodName,
        periodStart: new Date(periodStart),
        periodEnd: new Date(periodEnd),
        totalProfit: parseFloat(String(totalProfit)),
        distributionDate: distributionDate ? new Date(distributionDate) : new Date(),
        status: 'DRAFT',
      },
    })

    // Get all active investors with their total capital
    const activeInvestors = await db.investor.findMany({
      where: {
        companyId: DEFAULT_COMPANY_ID,
        status: 'active',
      },
      include: {
        investments: {
          select: { amount: true },
        },
      },
    })

    // Calculate total company capital
    const totalCompanyCapital = activeInvestors.reduce(
      (sum, inv) => sum + inv.investments.reduce((s, i) => s + i.amount, 0),
      0
    )

    if (totalCompanyCapital === 0) {
      await db.profitDistribution.delete({ where: { id: distribution.id } })
      return NextResponse.json(
        { error: 'لا يوجد رأس مال مستثمر لتوزيع الأرباح عليه' },
        { status: 400 }
      )
    }

    // Create InvestorShare for each active investor
    const shares = []
    for (const investor of activeInvestors) {
      const investorCapital = investor.investments.reduce((s, i) => s + i.amount, 0)
      if (investorCapital <= 0) continue

      const ownershipPercent = (investorCapital / totalCompanyCapital) * 100
      const profitShare = (investorCapital / totalCompanyCapital) * parseFloat(String(totalProfit))

      const share = await db.investorShare.create({
        data: {
          distributionId: distribution.id,
          investorId: investor.id,
          ownershipPercent: Math.round(ownershipPercent * 100) / 100,
          profitShare: Math.round(profitShare * 100) / 100,
          status: 'PENDING',
        },
        include: {
          investor: {
            select: { id: true, code: true, fullName: true },
          },
        },
      })
      shares.push(share)
    }

    return NextResponse.json(
      {
        ...distribution,
        investorShares: shares,
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('Create distribution error:', error)
    return NextResponse.json(
      { error: 'فشل في إنشاء توزيع الأرباح' },
      { status: 500 }
    )
  }
}
