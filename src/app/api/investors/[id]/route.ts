import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth-guard'

// DELETE /api/investors/[id] - Delete an investor and all related data
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requirePermission('investors.delete', request)
    const { id } = await params

    const existing = await db.investor.findUnique({
      where: { id },
      include: {
        investments: { select: { id: true } },
        withdrawals: { select: { id: true } },
        investorShares: { select: { id: true } },
      },
    })

    if (!existing) {
      return NextResponse.json(
        { error: 'المستثمر غير موجود' },
        { status: 404 }
      )
    }

    // Delete related data in order
    // 1. Investor shares (profit distributions)
    await db.investorShare.deleteMany({ where: { investorId: id } })
    // 2. Withdrawals
    await db.withdrawal.deleteMany({ where: { investorId: id } })
    // 3. Investments
    await db.investment.deleteMany({ where: { investorId: id } })

    // 4. Delete related accounts (capital + profit payable)
    const seqPart = existing.code.split('-').pop()
    if (seqPart) {
      const capitalAccountCode = `3101-${seqPart}`
      const profitAccountCode = `2104-${seqPart}`
      await db.account.deleteMany({
        where: { code: capitalAccountCode, companyId: existing.companyId }
      })
      await db.account.deleteMany({
        where: { code: profitAccountCode, companyId: existing.companyId }
      })
    }

    // 5. Finally delete the investor
    await db.investor.delete({ where: { id } })

    return NextResponse.json({ message: 'تم حذف المستثمر وجميع البيانات المرتبطة بنجاح', deleted: true })
  } catch (error) {
    if (error instanceof Error && (error.message.includes('غير مصرح') || error.message.includes('صلاحية'))) {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }
    console.error('Delete investor error:', error)
    return NextResponse.json(
      { error: 'فشل في حذف المستثمر' },
      { status: 500 }
    )
  }
}
