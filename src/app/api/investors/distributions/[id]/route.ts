import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { generateDocNumber } from '@/lib/erp-utils'

const DEFAULT_COMPANY_ID = 'company-default'

// PUT /api/investors/distributions/[id] - Distribution actions
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { action, shareIds } = body

    const distribution = await db.profitDistribution.findUnique({
      where: { id },
      include: {
        investorShares: {
          include: {
            investor: {
              select: { id: true, code: true, fullName: true },
            },
          },
        },
      },
    })

    if (!distribution) {
      return NextResponse.json(
        { error: 'التوزيع غير موجود' },
        { status: 404 }
      )
    }

    // ── DISTRIBUTE action: DRAFT → DISTRIBUTED ──
    if (action === 'distribute') {
      if (distribution.status !== 'DRAFT') {
        return NextResponse.json(
          { error: 'لا يمكن توزيع توزيع ليس في حالة مسودة' },
          { status: 400 }
        )
      }

      // Create journal entry: Debit الأرباح المحتجزة (3201), Credit أرباح مستحقة لكل مستثمر (2104-xx)
      const retainedEarningsAccount = await db.account.findFirst({
        where: { code: '32', companyId: DEFAULT_COMPANY_ID },
      })

      if (!retainedEarningsAccount) {
        return NextResponse.json(
          { error: 'حساب الأرباح المحتجزة غير موجود. يرجى إنشاء الحساب أولاً.' },
          { status: 400 }
        )
      }

      // Build journal entry lines
      const lines: { accountId: string; debit: number; credit: number; description: string }[] = []

      // Debit line: الأرباح المحتجزة
      lines.push({
        accountId: retainedEarningsAccount.id,
        debit: distribution.totalProfit,
        credit: 0,
        description: `توزيع أرباح - ${distribution.periodName}`,
      })

      // Credit lines: each investor's profit payable account
      for (const share of distribution.investorShares) {
        const investorSeq = share.investor.code.split('-').pop() || '001'
        const profitAccountCode = `2104-${investorSeq.padStart(3, '0')}`
        const profitAccount = await db.account.findFirst({
          where: { code: profitAccountCode, companyId: DEFAULT_COMPANY_ID },
        })

        if (profitAccount) {
          lines.push({
            accountId: profitAccount.id,
            debit: 0,
            credit: share.profitShare,
            description: `أرباح مستحقة - ${share.investor.fullName}`,
          })
        }
      }

      if (lines.length < 2) {
        return NextResponse.json(
          { error: 'لا توجد حسابات كافية لإنشاء القيد' },
          { status: 400 }
        )
      }

      // Generate journal entry number
      const entryDate = new Date()
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
          description: `توزيع أرباح - ${distribution.periodName}`,
          status: 'POSTED',
          sourceType: 'PROFIT_DISTRIBUTION',
          sourceId: distribution.id,
          lines: {
            create: lines,
          },
        },
      })

      // Update distribution status
      const updated = await db.profitDistribution.update({
        where: { id },
        data: { status: 'DISTRIBUTED' },
        include: {
          investorShares: {
            include: {
              investor: {
                select: { id: true, code: true, fullName: true },
              },
            },
          },
        },
      })

      return NextResponse.json(updated)
    }

    // ── PAY action: Mark individual investor shares as PAID ──
    if (action === 'pay') {
      if (!shareIds || !Array.isArray(shareIds) || shareIds.length === 0) {
        return NextResponse.json(
          { error: 'يرجى تحديد حصص لدفعها' },
          { status: 400 }
        )
      }

      const cashAccount = await db.account.findFirst({
        where: { code: '1101', companyId: DEFAULT_COMPANY_ID },
      })

      if (!cashAccount) {
        return NextResponse.json(
          { error: 'حساب النقدية غير موجود' },
          { status: 400 }
        )
      }

      // Process each share payment
      for (const shareId of shareIds) {
        const share = distribution.investorShares.find((s) => s.id === shareId)
        if (!share || share.status === 'PAID') continue

        // Create journal entry: Debit أرباح مستحقة (2104-xx), Credit النقدية (1101)
        const investorSeq = share.investor.code.split('-').pop() || '001'
        const profitAccountCode = `2104-${investorSeq.padStart(3, '0')}`
        const profitAccount = await db.account.findFirst({
          where: { code: profitAccountCode, companyId: DEFAULT_COMPANY_ID },
        })

        if (profitAccount) {
          const entryDate2 = new Date()
          const year2 = entryDate2.getFullYear()
          const prefix2 = `JV-${year2}`
          const lastEntry2 = await db.journalEntry.findFirst({
            where: { number: { startsWith: prefix2 } },
            orderBy: { number: 'desc' },
            select: { number: true },
          })
          let seq2 = 1
          if (lastEntry2) {
            const lastSeq = parseInt(lastEntry2.number.split('-').pop() || '0', 10)
            seq2 = lastSeq + 1
          }
          const number2 = generateDocNumber('JV', year2, seq2)

          await db.journalEntry.create({
            data: {
              companyId: DEFAULT_COMPANY_ID,
              number: number2,
              date: entryDate2,
              description: `سداد أرباح مستحقة - ${share.investor.fullName}`,
              status: 'POSTED',
              sourceType: 'PROFIT_PAYMENT',
              sourceId: share.id,
              lines: {
                create: [
                  {
                    accountId: profitAccount.id,
                    debit: share.profitShare,
                    credit: 0,
                    description: `سداد أرباح - ${share.investor.fullName}`,
                  },
                  {
                    accountId: cashAccount.id,
                    debit: 0,
                    credit: share.profitShare,
                    description: `صرف أرباح - ${share.investor.fullName}`,
                  },
                ],
              },
            },
          })
        }

        // Mark share as PAID
        await db.investorShare.update({
          where: { id: shareId },
          data: {
            status: 'PAID',
            paymentDate: new Date(),
          },
        })
      }

      // Return updated distribution
      const updatedDistribution = await db.profitDistribution.findUnique({
        where: { id },
        include: {
          investorShares: {
            include: {
              investor: {
                select: { id: true, code: true, fullName: true },
              },
            },
          },
        },
      })

      return NextResponse.json(updatedDistribution)
    }

    return NextResponse.json(
      { error: 'إجراء غير معروف' },
      { status: 400 }
    )
  } catch (error) {
    console.error('Distribution action error:', error)
    return NextResponse.json(
      { error: 'فشل في تنفيذ الإجراء' },
      { status: 500 }
    )
  }
}
