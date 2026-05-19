import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth-guard'

const DEFAULT_COMPANY_ID = 'company-default'

// GET /api/investors - List investors with total investments
export async function GET(request: NextRequest) {
  try {
    const user = await requirePermission('investors.view')
    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search')
    const activeOnly = searchParams.get('activeOnly')

    const where: Record<string, unknown> = {
      companyId: DEFAULT_COMPANY_ID,
    }

    if (search) {
      where.OR = [
        { fullName: { contains: search } },
        { code: { contains: search } },
        { phone: { contains: search } },
        { nationalId: { contains: search } },
      ]
    }

    if (activeOnly === 'true') {
      where.status = 'active'
    }

    const investors = await db.investor.findMany({
      where,
      orderBy: { code: 'asc' },
      include: {
        investments: {
          select: { amount: true },
        },
        investorShares: {
          select: { profitShare: true, status: true },
        },
        withdrawals: {
          select: { amount: true, type: true },
        },
      },
    })

    // Calculate totals for each investor
    const investorsWithTotals = investors.map((inv) => {
      const totalInvestment = inv.investments.reduce((sum, i) => sum + i.amount, 0)
      const totalProfitShare = inv.investorShares.reduce((sum, s) => sum + s.profitShare, 0)
      const totalPaidProfit = inv.investorShares
        .filter((s) => s.status === 'PAID')
        .reduce((sum, s) => sum + s.profitShare, 0)
      const totalWithdrawals = inv.withdrawals.reduce((sum, w) => sum + w.amount, 0)
      const pendingProfit = totalProfitShare - totalPaidProfit

      return {
        id: inv.id,
        companyId: inv.companyId,
        code: inv.code,
        fullName: inv.fullName,
        phone: inv.phone,
        email: inv.email,
        nationalId: inv.nationalId,
        joinDate: inv.joinDate,
        status: inv.status,
        createdAt: inv.createdAt,
        updatedAt: inv.updatedAt,
        totalInvestment,
        totalProfitShare,
        pendingProfit,
        totalWithdrawals,
      }
    })

    return NextResponse.json(investorsWithTotals)
  } catch (error) {
    if (error instanceof Error && (error.message.includes('غير مصرح') || error.message.includes('صلاحية'))) {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }
    console.error('Get investors error:', error)
    return NextResponse.json(
      { error: 'فشل في تحميل بيانات المستثمرين' },
      { status: 500 }
    )
  }
}

// POST /api/investors - Create investor with auto accounts
export async function POST(request: NextRequest) {
  try {
    const user = await requirePermission('investors.create')
    const body = await request.json()
    const { fullName, phone, email, nationalId, status } = body

    if (!fullName || !fullName.trim()) {
      return NextResponse.json(
        { error: 'اسم المستثمر مطلوب' },
        { status: 400 }
      )
    }

    // Auto-generate investor code: INV-{seq}
    const lastInvestor = await db.investor.findFirst({
      where: { companyId: DEFAULT_COMPANY_ID },
      orderBy: { code: 'desc' },
      select: { code: true },
    })

    let seq = 1
    if (lastInvestor) {
      const lastSeq = parseInt(lastInvestor.code.split('-').pop() || '0', 10)
      seq = lastSeq + 1
    }
    const code = `INV-${String(seq).padStart(3, '0')}`

    // Create investor
    const investor = await db.investor.create({
      data: {
        companyId: DEFAULT_COMPANY_ID,
        code,
        fullName: fullName.trim(),
        phone: phone || null,
        email: email || null,
        nationalId: nationalId || null,
        status: status || 'active',
      },
    })

    // Create capital account under رأس المال (31): code 3101-{seq}
    const capitalParent = await db.account.findFirst({
      where: { code: '31', companyId: DEFAULT_COMPANY_ID },
    })

    if (capitalParent) {
      // Make parent non-leaf if it's currently leaf
      if (capitalParent.isLeaf) {
        await db.account.update({
          where: { id: capitalParent.id },
          data: { isLeaf: false },
        })
      }

      const capitalAccountCode = `3101-${String(seq).padStart(3, '0')}`
      await db.account.create({
        data: {
          companyId: DEFAULT_COMPANY_ID,
          code: capitalAccountCode,
          nameAr: `رأس مال - ${fullName.trim()}`,
          nameEn: `Capital - ${fullName.trim()}`,
          type: 'EQUITY',
          parentId: capitalParent.id,
          isLeaf: true,
        },
      })
    }

    // Create profit payable account under 2104: code 2104-{seq}
    let profitPayableParent = await db.account.findFirst({
      where: { code: '2104', companyId: DEFAULT_COMPANY_ID },
    })

    if (!profitPayableParent) {
      // Create 2104 parent account under خصوم متداولة (21)
      const liabilitiesParent = await db.account.findFirst({
        where: { code: '21', companyId: DEFAULT_COMPANY_ID },
      })

      if (liabilitiesParent) {
        profitPayableParent = await db.account.create({
          data: {
            companyId: DEFAULT_COMPANY_ID,
            code: '2104',
            nameAr: 'أرباح مستحقة للمستثمرين',
            nameEn: 'Investor Profit Payable',
            type: 'LIABILITY',
            parentId: liabilitiesParent.id,
            isLeaf: false,
          },
        })
      }
    }

    if (profitPayableParent) {
      const profitAccountCode = `2104-${String(seq).padStart(3, '0')}`
      await db.account.create({
        data: {
          companyId: DEFAULT_COMPANY_ID,
          code: profitAccountCode,
          nameAr: `أرباح مستحقة - ${fullName.trim()}`,
          nameEn: `Profit Payable - ${fullName.trim()}`,
          type: 'LIABILITY',
          parentId: profitPayableParent.id,
          isLeaf: true,
        },
      })
    }

    return NextResponse.json(investor, { status: 201 })
  } catch (error) {
    if (error instanceof Error && (error.message.includes('غير مصرح') || error.message.includes('صلاحية'))) {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }
    console.error('Create investor error:', error)
    return NextResponse.json(
      { error: 'فشل في إنشاء المستثمر' },
      { status: 500 }
    )
  }
}
