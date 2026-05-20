import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { generateDocNumber } from '@/lib/erp-utils'

// GET /api/sales/receipts - List receipt vouchers with filters
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const companyId = searchParams.get('companyId')
    if (!companyId) {
      return NextResponse.json({ error: 'companyId is required' }, { status: 400 })
    }

    const customerId = searchParams.get('customerId')
    const fromDate = searchParams.get('fromDate')
    const toDate = searchParams.get('toDate')

    const where: Record<string, unknown> = { companyId }

    if (customerId) {
      where.customerId = customerId
    }
    if (fromDate || toDate) {
      where.date = {
        ...(fromDate && { gte: new Date(fromDate) }),
        ...(toDate && { lte: new Date(toDate) }),
      }
    }

    const receipts = await db.receiptVoucher.findMany({
      where,
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
      include: {
        customer: {
          select: {
            id: true,
            code: true,
            nameAr: true,
            nameEn: true,
          },
        },
        lines: {
          include: {
            salesInvoice: {
              select: {
                id: true,
                number: true,
                totalAmount: true,
                balanceDue: true,
              },
            },
          },
        },
      },
    })

    return NextResponse.json(receipts)
  } catch (error) {
    console.error('Get receipts error:', error)
    return NextResponse.json(
      { error: 'فشل في تحميل سندات القبض' },
      { status: 500 }
    )
  }
}

// POST /api/sales/receipts - Create receipt voucher
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      companyId,
      customerId,
      date,
      amount,
      paymentMethod,
      reference,
      notes,
      receiptLines,
    } = body

    if (!companyId) {
      return NextResponse.json({ error: 'companyId is required' }, { status: 400 })
    }

    // Validate customer
    if (!customerId) {
      return NextResponse.json(
        { error: 'العميل مطلوب' },
        { status: 400 }
      )
    }

    const customer = await db.customer.findUnique({ where: { id: customerId } })
    if (!customer) {
      return NextResponse.json(
        { error: 'العميل غير موجود' },
        { status: 404 }
      )
    }
    if (customer.companyId !== companyId) {
      return NextResponse.json(
        { error: 'Customer does not belong to this company' },
        { status: 403 }
      )
    }

    // Validate amount
    if (!amount || amount <= 0) {
      return NextResponse.json(
        { error: 'المبلغ يجب أن يكون أكبر من صفر' },
        { status: 400 }
      )
    }

    // Validate receipt lines if provided
    if (receiptLines && Array.isArray(receiptLines) && receiptLines.length > 0) {
      for (let i = 0; i < receiptLines.length; i++) {
        const line = receiptLines[i]
        if (!line.salesInvoiceId) {
          return NextResponse.json(
            { error: `فاتورة البيع مطلوبة في السطر ${i + 1}` },
            { status: 400 }
          )
        }
        // Validate invoice belongs to this customer and company
        const inv = await db.salesInvoice.findUnique({
          where: { id: line.salesInvoiceId },
        })
        if (!inv) {
          return NextResponse.json(
            { error: `فاتورة البيع في السطر ${i + 1} غير موجودة` },
            { status: 400 }
          )
        }
        if (inv.companyId !== companyId) {
          return NextResponse.json(
            { error: `فاتورة البيع في السطر ${i + 1} لا تنتمي لهذه الشركة` },
            { status: 400 }
          )
        }
        if (inv.customerId !== customerId) {
          return NextResponse.json(
            { error: `فاتورة البيع في السطر ${i + 1} لا تنتمي لهذا العميل` },
            { status: 400 }
          )
        }
        if (line.amount <= 0) {
          return NextResponse.json(
            { error: `المبلغ في السطر ${i + 1} يجب أن يكون أكبر من صفر` },
            { status: 400 }
          )
        }
      }

      // Validate total lines amount doesn't exceed receipt amount
      const linesTotal = receiptLines.reduce(
        (sum: number, l: { amount: number }) => sum + l.amount,
        0
      )
      if (linesTotal > amount + 0.01) {
        return NextResponse.json(
          { error: `إجمالي توزيع الفواتير (${linesTotal.toFixed(2)}) يتجاوز مبلغ السند (${amount.toFixed(2)})` },
          { status: 400 }
        )
      }
    }

    // Generate receipt number: SP-{year}-{seq}
    const receiptDate = date ? new Date(date) : new Date()
    const year = receiptDate.getFullYear()
    const prefix = `SP-${year}`

    const lastReceipt = await db.receiptVoucher.findFirst({
      where: { companyId, number: { startsWith: prefix } },
      orderBy: { number: 'desc' },
      select: { number: true },
    })

    let seq = 1
    if (lastReceipt) {
      const lastSeq = parseInt(lastReceipt.number.split('-').pop() || '0', 10)
      if (!isNaN(lastSeq)) seq = lastSeq + 1
    }

    const number = generateDocNumber('SP', year, seq)

    // Create receipt voucher with lines
    const receipt = await db.receiptVoucher.create({
      data: {
        companyId,
        number,
        customerId,
        date: receiptDate,
        amount,
        paymentMethod: paymentMethod || 'CASH',
        reference: reference?.trim() || null,
        notes: notes?.trim() || null,
        lines: receiptLines && receiptLines.length > 0
          ? {
              create: receiptLines.map(
                (l: { salesInvoiceId: string; amount: number }) => ({
                  salesInvoiceId: l.salesInvoiceId,
                  amount: l.amount,
                })
              ),
            }
          : undefined,
      },
      include: {
        customer: {
          select: {
            id: true,
            code: true,
            nameAr: true,
            nameEn: true,
          },
        },
        lines: {
          include: {
            salesInvoice: {
              select: {
                id: true,
                number: true,
                totalAmount: true,
                balanceDue: true,
              },
            },
          },
        },
      },
    })

    // Update invoice paidAmount and balanceDue for each receipt line
    if (receiptLines && Array.isArray(receiptLines) && receiptLines.length > 0) {
      for (const line of receiptLines) {
        const inv = await db.salesInvoice.findUnique({
          where: { id: line.salesInvoiceId },
        })
        if (inv) {
          const newPaidAmount = inv.paidAmount + line.amount
          const newBalanceDue = inv.totalAmount - newPaidAmount
          const newStatus = newBalanceDue <= 0.01 ? 'PAID' : newPaidAmount > 0 ? 'PARTIAL_PAID' : inv.status

          await db.salesInvoice.update({
            where: { id: line.salesInvoiceId },
            data: {
              paidAmount: Math.round(newPaidAmount * 100) / 100,
              balanceDue: Math.round(Math.max(0, newBalanceDue) * 100) / 100,
              status: newStatus,
            },
          })
        }
      }
    }

    // Update customer balance: -amount
    await db.customer.update({
      where: { id: customerId },
      data: {
        balance: customer.balance - amount,
      },
    })

    // Create Journal Entry - look up accounts by companyId + code
    const accountsNeeded = ['1101', '1103']
    const accounts = await db.account.findMany({
      where: { companyId, code: { in: accountsNeeded } },
    })

    const cashAccount = accounts.find((a) => a.code === '1101') // النقدية
    const customersAccount = accounts.find((a) => a.code === '1103') // العملاء

    if (cashAccount && customersAccount) {
      const jePrefix = `JV-${receiptDate.getFullYear()}`
      const lastJE = await db.journalEntry.findFirst({
        where: { companyId, number: { startsWith: jePrefix } },
        orderBy: { number: 'desc' },
        select: { number: true },
      })

      let jeSeq = 1
      if (lastJE) {
        const parsed = parseInt(lastJE.number.split('-').pop() || '0', 10)
        if (!isNaN(parsed)) jeSeq = parsed + 1
      }

      await db.journalEntry.create({
        data: {
          companyId,
          number: generateDocNumber('JV', receiptDate.getFullYear(), jeSeq),
          date: receiptDate,
          description: `سند قبض ${number} - ${customer.nameAr}`,
          status: 'POSTED',
          sourceType: 'RECEIPT_VOUCHER',
          sourceId: receipt.id,
          lines: {
            create: [
              {
                accountId: cashAccount.id,
                debit: amount,
                credit: 0,
                description: `سند قبض ${number}`,
              },
              {
                accountId: customersAccount.id,
                debit: 0,
                credit: amount,
                description: `تحصيل من ${customer.nameAr}`,
              },
            ],
          },
        },
      })
    }

    return NextResponse.json(receipt, { status: 201 })
  } catch (error) {
    console.error('Create receipt error:', error)
    return NextResponse.json(
      { error: 'فشل في إنشاء سند القبض' },
      { status: 500 }
    )
  }
}
