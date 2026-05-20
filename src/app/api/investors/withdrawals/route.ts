import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { generateDocNumber } from '@/lib/erp-utils'

const DEFAULT_COMPANY_ID = 'company-default'

// GET /api/investors/withdrawals - List withdrawals with investor info
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

    const withdrawals = await db.withdrawal.findMany({
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

    return NextResponse.json(withdrawals)
  } catch (error) {
    console.error('Get withdrawals error:', error)
    return NextResponse.json(
      { error: 'فشل في تحميل بيانات المسحوبات' },
      { status: 500 }
    )
  }
}

// POST /api/investors/withdrawals - Record withdrawal
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { investorId, date, amount, type, notes } = body

    if (!investorId || !date || !amount || amount <= 0) {
      return NextResponse.json(
        { error: 'بيانات السحب غير مكتملة' },
        { status: 400 }
      )
    }

    const investor = await db.investor.findUnique({
      where: { id: investorId },
    })

    if (!investor) {
      return NextResponse.json(
        { error: 'المستثمر غير موجود' },
        { status: 404 }
      )
    }

    // Create Withdrawal record
    const withdrawal = await db.withdrawal.create({
      data: {
        companyId: DEFAULT_COMPANY_ID,
        investorId,
        date: new Date(date),
        amount: parseFloat(String(amount)),
        type: type || 'profit',
        notes: notes || null,
      },
      include: {
        investor: {
          select: { id: true, code: true, fullName: true },
        },
      },
    })

    // Create Journal Entry
    const cashAccount = await db.account.findFirst({
      where: { code: '1101', companyId: DEFAULT_COMPANY_ID },
    })

    const investorSeq = investor.code.split('-').pop() || '001'

    if (type === 'capital') {
      // Debit رأس المال - Investor (3101-xx), Credit النقدية (1101)
      const capitalAccountCode = `3101-${investorSeq.padStart(3, '0')}`
      const capitalAccount = await db.account.findFirst({
        where: { code: capitalAccountCode, companyId: DEFAULT_COMPANY_ID },
      })

      if (cashAccount && capitalAccount) {
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
            description: `سحب رأس مال - ${investor.fullName}`,
            status: 'POSTED',
            sourceType: 'CAPITAL_WITHDRAWAL',
            sourceId: withdrawal.id,
            lines: {
              create: [
                {
                  accountId: capitalAccount.id,
                  debit: parseFloat(String(amount)),
                  credit: 0,
                  description: `سحب رأس مال - ${investor.fullName}`,
                },
                {
                  accountId: cashAccount.id,
                  debit: 0,
                  credit: parseFloat(String(amount)),
                  description: `صرف سحب رأس مال - ${investor.fullName}`,
                },
              ],
            },
          },
        })
      }
    } else {
      // Debit أرباح مستحقة - Investor (2104-xx), Credit النقدية (1101)
      const profitAccountCode = `2104-${investorSeq.padStart(3, '0')}`
      const profitAccount = await db.account.findFirst({
        where: { code: profitAccountCode, companyId: DEFAULT_COMPANY_ID },
      })

      if (cashAccount && profitAccount) {
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
            description: `سحب أرباح - ${investor.fullName}`,
            status: 'POSTED',
            sourceType: 'PROFIT_WITHDRAWAL',
            sourceId: withdrawal.id,
            lines: {
              create: [
                {
                  accountId: profitAccount.id,
                  debit: parseFloat(String(amount)),
                  credit: 0,
                  description: `سحب أرباح مستحقة - ${investor.fullName}`,
                },
                {
                  accountId: cashAccount.id,
                  debit: 0,
                  credit: parseFloat(String(amount)),
                  description: `صرف أرباح - ${investor.fullName}`,
                },
              ],
            },
          },
        })
      }
    }

    return NextResponse.json(withdrawal, { status: 201 })
  } catch (error) {
    console.error('Create withdrawal error:', error)
    return NextResponse.json(
      { error: 'فشل في تسجيل السحب' },
      { status: 500 }
    )
  }
}
