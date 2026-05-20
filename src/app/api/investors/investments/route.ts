import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { generateDocNumber } from '@/lib/erp-utils'

const DEFAULT_COMPANY_ID = 'company-default'

// GET /api/investors/investments - List investments with investor info
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const investorId = searchParams.get('investorId')

    const where: Record<string, unknown> = {
      companyId: DEFAULT_COMPANY_ID,
    }

    if (investorId) {
      where.investorId = investorId
    }

    const investments = await db.investment.findMany({
      where,
      orderBy: { date: 'desc' },
      include: {
        investor: {
          select: {
            id: true,
            code: true,
            fullName: true,
          },
        },
      },
    })

    return NextResponse.json(investments)
  } catch (error) {
    console.error('Get investments error:', error)
    return NextResponse.json(
      { error: 'فشل في تحميل بيانات الاستثمارات' },
      { status: 500 }
    )
  }
}

// POST /api/investors/investments - Record new investment
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { investorId, date, amount, type, accountId, notes } = body

    if (!investorId || !date || !amount || amount <= 0) {
      return NextResponse.json(
        { error: 'بيانات الاستثمار غير مكتملة' },
        { status: 400 }
      )
    }

    // Get investor
    const investor = await db.investor.findUnique({
      where: { id: investorId },
    })

    if (!investor) {
      return NextResponse.json(
        { error: 'المستثمر غير موجود' },
        { status: 404 }
      )
    }

    // Create Investment record
    const investment = await db.investment.create({
      data: {
        companyId: DEFAULT_COMPANY_ID,
        investorId,
        date: new Date(date),
        amount: parseFloat(String(amount)),
        type: type || 'cash',
        accountId: accountId || null,
        notes: notes || null,
      },
      include: {
        investor: {
          select: { id: true, code: true, fullName: true },
        },
      },
    })

    // Create Journal Entry: Debit النقدية/البنك (1101/1102), Credit investor's capital account (3101-xx)
    // Determine debit account: cash or bank
    const debitAccountCode = type === 'bank' ? '1102' : '1101'
    const debitAccount = await db.account.findFirst({
      where: { code: debitAccountCode, companyId: DEFAULT_COMPANY_ID },
    })

    // Find investor's capital account
    const investorSeq = investor.code.split('-').pop() || '001'
    const creditAccountCode = `3101-${investorSeq.padStart(3, '0')}`
    const creditAccount = await db.account.findFirst({
      where: { code: creditAccountCode, companyId: DEFAULT_COMPANY_ID },
    })

    if (debitAccount && creditAccount) {
      // Generate journal entry number
      const entryDate = new Date(date)
      const year = entryDate.getFullYear()
      const prefix = `JV-${year}`
      const lastEntry = await db.journalEntry.findFirst({
        where: { number: { startsWith: prefix } },
        orderBy: { number: 'desc' },
        select: { number: true },
      })
      let seq = 1
      if (lastEntry) {
        const lastSeq = parseInt(lastEntry.number.split('-').pop() || '0', 10)
        seq = lastSeq + 1
      }
      const number = generateDocNumber('JV', year, seq)

      await db.journalEntry.create({
        data: {
          companyId: DEFAULT_COMPANY_ID,
          number,
          date: entryDate,
          description: `استثمار رأس مال - ${investor.fullName}`,
          status: 'POSTED',
          sourceType: 'INVESTMENT',
          sourceId: investment.id,
          lines: {
            create: [
              {
                accountId: debitAccount.id,
                debit: parseFloat(String(amount)),
                credit: 0,
                description: `استلام استثمار من ${investor.fullName}`,
              },
              {
                accountId: creditAccount.id,
                debit: 0,
                credit: parseFloat(String(amount)),
                description: `رأس مال - ${investor.fullName}`,
              },
            ],
          },
        },
      })
    }

    // Update investor status to active if was inactive
    if (investor.status !== 'active') {
      await db.investor.update({
        where: { id: investorId },
        data: { status: 'active' },
      })
    }

    return NextResponse.json(investment, { status: 201 })
  } catch (error) {
    console.error('Create investment error:', error)
    return NextResponse.json(
      { error: 'فشل في تسجيل الاستثمار' },
      { status: 500 }
    )
  }
}
