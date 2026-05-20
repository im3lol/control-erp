import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { generateDocNumber } from '@/lib/erp-utils'

// GET /api/purchases/payments - List payment vouchers with filters
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const companyId = searchParams.get('companyId')
    if (!companyId) {
      return NextResponse.json({ error: 'companyId is required' }, { status: 400 })
    }

    const supplierId = searchParams.get('supplierId')
    const fromDate = searchParams.get('fromDate')
    const toDate = searchParams.get('toDate')

    const where: Record<string, unknown> = { companyId }

    if (supplierId) {
      where.supplierId = supplierId
    }
    if (fromDate || toDate) {
      where.date = {
        ...(fromDate && { gte: new Date(fromDate) }),
        ...(toDate && { lte: new Date(toDate) }),
      }
    }

    const payments = await db.paymentVoucher.findMany({
      where,
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
      include: {
        supplier: {
          select: { id: true, code: true, nameAr: true, nameEn: true },
        },
        lines: {
          include: {
            purchaseInvoice: {
              select: { id: true, number: true, totalAmount: true },
            },
          },
        },
      },
    })

    return NextResponse.json(payments)
  } catch (error) {
    console.error('Get payment vouchers error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch payment vouchers' },
      { status: 500 }
    )
  }
}

// POST /api/purchases/payments - Create payment voucher
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { companyId, supplierId, date, amount, paymentMethod, reference, notes, lines } = body

    if (!companyId) {
      return NextResponse.json({ error: 'companyId is required' }, { status: 400 })
    }

    // Validate required fields
    if (!supplierId) {
      return NextResponse.json(
        { error: 'المورد مطلوب' },
        { status: 400 }
      )
    }

    const paymentAmount = parseFloat(String(amount)) || 0
    if (paymentAmount <= 0) {
      return NextResponse.json(
        { error: 'يجب أن يكون المبلغ أكبر من صفر' },
        { status: 400 }
      )
    }

    // Validate supplier exists and belongs to company
    const supplier = await db.supplier.findUnique({ where: { id: supplierId } })
    if (!supplier) {
      return NextResponse.json(
        { error: 'المورد غير موجود' },
        { status: 404 }
      )
    }
    if (supplier.companyId !== companyId) {
      return NextResponse.json(
        { error: 'Supplier does not belong to this company' },
        { status: 403 }
      )
    }

    // Validate payment lines
    if (!lines || !Array.isArray(lines) || lines.length === 0) {
      return NextResponse.json(
        { error: 'يجب تحديد فاتورة واحدة على الأقل للسداد' },
        { status: 400 }
      )
    }

    // Generate payment number: PP-{year}-{seq}
    const paymentDate = new Date(date || Date.now())
    const year = paymentDate.getFullYear()
    const prefix = `PP-${year}`

    const lastPayment = await db.paymentVoucher.findFirst({
      where: { companyId, number: { startsWith: prefix } },
      orderBy: { number: 'desc' },
      select: { number: true },
    })

    let seq = 1
    if (lastPayment) {
      const lastSeq = parseInt(lastPayment.number.split('-').pop() || '0', 10)
      seq = lastSeq + 1
    }

    const number = generateDocNumber('PP', year, seq)

    // Process within transaction
    const result = await db.$transaction(async (tx) => {
      // Create payment voucher with lines
      const payment = await tx.paymentVoucher.create({
        data: {
          companyId,
          number,
          supplierId,
          date: paymentDate,
          amount: paymentAmount,
          paymentMethod: paymentMethod || 'CASH',
          reference: reference || null,
          notes: notes || null,
          lines: {
            create: lines.map((l: { purchaseInvoiceId: string; amount: number }) => ({
              purchaseInvoiceId: l.purchaseInvoiceId,
              amount: parseFloat(String(l.amount)) || 0,
            })),
          },
        },
        include: {
          supplier: {
            select: { id: true, code: true, nameAr: true, nameEn: true },
          },
          lines: {
            include: {
              purchaseInvoice: {
                select: { id: true, number: true, totalAmount: true },
              },
            },
          },
        },
      })

      // For each payment line: update PurchaseInvoice paidAmount and balanceDue
      for (const line of payment.lines) {
        const invoice = await tx.purchaseInvoice.findUnique({
          where: { id: line.purchaseInvoiceId },
        })
        if (!invoice) continue

        const newPaidAmount = invoice.paidAmount + line.amount
        const newBalanceDue = Math.max(0, invoice.totalAmount - newPaidAmount)
        let newStatus = invoice.status
        if (newBalanceDue <= 0) {
          newStatus = 'PAID'
        } else if (newPaidAmount > 0 && invoice.status === 'CONFIRMED') {
          newStatus = 'PARTIAL_PAID'
        }

        await tx.purchaseInvoice.update({
          where: { id: line.purchaseInvoiceId },
          data: {
            paidAmount: newPaidAmount,
            balanceDue: newBalanceDue,
            status: newStatus,
          },
        })
      }

      // Update supplier balance: -amount (we owe them less)
      await tx.supplier.update({
        where: { id: supplierId },
        data: { balance: { decrement: paymentAmount } },
      })

      // Create Journal Entry - look up accounts by companyId + code
      const supplierAccount = await tx.account.findFirst({
        where: { companyId, code: '2101' },
      })
      const cashAccount = await tx.account.findFirst({
        where: { companyId, code: '1101' },
      })

      if (supplierAccount && cashAccount) {
        const jeYear = paymentDate.getFullYear()
        const jePrefix = `JV-${jeYear}`
        const lastJE = await tx.journalEntry.findFirst({
          where: { companyId, number: { startsWith: jePrefix } },
          orderBy: { number: 'desc' },
          select: { number: true },
        })
        let jeSeq = 1
        if (lastJE) {
          jeSeq = parseInt(lastJE.number.split('-').pop() || '0', 10) + 1
        }
        const jeNumber = generateDocNumber('JV', jeYear, jeSeq)

        await tx.journalEntry.create({
          data: {
            companyId,
            number: jeNumber,
            date: paymentDate,
            description: `سند صرف ${number} - ${supplier.nameAr}`,
            status: 'POSTED',
            sourceType: 'PAYMENT_VOUCHER',
            sourceId: payment.id,
            lines: {
              create: [
                {
                  accountId: supplierAccount.id,
                  debit: paymentAmount,
                  credit: 0,
                  description: `موردون - سند صرف ${number}`,
                },
                {
                  accountId: cashAccount.id,
                  debit: 0,
                  credit: paymentAmount,
                  description: `نقدية - سند صرف ${number}`,
                },
              ],
            },
          },
        })
      }

      return payment
    })

    return NextResponse.json(result, { status: 201 })
  } catch (error) {
    console.error('Create payment voucher error:', error)
    return NextResponse.json(
      { error: 'Failed to create payment voucher' },
      { status: 500 }
    )
  }
}
