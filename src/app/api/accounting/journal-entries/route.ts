import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { generateDocNumber } from '@/lib/erp-utils'
import { requirePermission } from '@/lib/auth-guard'

// GET /api/accounting/journal-entries - List journal entries with lines
export async function GET(request: NextRequest) {
  try {
    const user = await requirePermission('accounting.view', request)
    const { searchParams } = new URL(request.url)
    const companyId = searchParams.get('companyId')
    if (!companyId) {
      return NextResponse.json({ error: 'companyId is required' }, { status: 400 })
    }

    const status = searchParams.get('status')
    const sourceType = searchParams.get('sourceType')
    const fromDate = searchParams.get('fromDate')
    const toDate = searchParams.get('toDate')
    const limit = parseInt(searchParams.get('limit') || '50', 10)

    const where: Record<string, unknown> = { companyId }

    if (status) {
      where.status = status
    }
    if (sourceType) {
      where.sourceType = sourceType
    }
    if (fromDate || toDate) {
      where.date = {
        ...(fromDate && { gte: new Date(fromDate) }),
        ...(toDate && { lte: new Date(toDate) }),
      }
    }

    const entries = await db.journalEntry.findMany({
      where,
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
      take: limit,
      include: {
        lines: {
          include: {
            account: {
              select: {
                id: true,
                code: true,
                nameAr: true,
                nameEn: true,
                type: true,
              },
            },
          },
          orderBy: { id: 'asc' },
        },
      },
    })

    return NextResponse.json(entries)
  } catch (error) {
    if (error instanceof Error && (error.message.includes('غير مصرح') || error.message.includes('صلاحية'))) {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }
    console.error('Get journal entries error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch journal entries' },
      { status: 500 }
    )
  }
}

// POST /api/accounting/journal-entries - Create journal entry
export async function POST(request: NextRequest) {
  try {
    const user = await requirePermission('accounting.create', request)
    const body = await request.json()
    const { companyId, date, description, sourceType, sourceId, lines } = body

    if (!companyId) {
      return NextResponse.json({ error: 'companyId is required' }, { status: 400 })
    }

    // Validate required fields
    if (!date) {
      return NextResponse.json(
        { error: 'التاريخ مطلوب' },
        { status: 400 }
      )
    }

    if (!lines || !Array.isArray(lines) || lines.length < 2) {
      return NextResponse.json(
        { error: 'يجب أن يحتوي القيد على سطرين على الأقل' },
        { status: 400 }
      )
    }

    // Validate each line has accountId and at least debit or credit
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      if (!line.accountId) {
        return NextResponse.json(
          { error: `الحساب مطلوب في السطر ${i + 1}` },
          { status: 400 }
        )
      }
      const debit = parseFloat(line.debit) || 0
      const credit = parseFloat(line.credit) || 0
      if (debit < 0 || credit < 0) {
        return NextResponse.json(
          { error: `لا يمكن أن تكون القيم سالبة في السطر ${i + 1}` },
          { status: 400 }
        )
      }
      if (debit > 0 && credit > 0) {
        return NextResponse.json(
          { error: `لا يمكن أن يحتوي السطر ${i + 1} على مدين ودائن معاً` },
          { status: 400 }
        )
      }
    }

    // Validate balance
    const totalDebit = lines.reduce((sum: number, l: { debit?: number; credit?: number }) => sum + (parseFloat(String(l.debit)) || 0), 0)
    const totalCredit = lines.reduce((sum: number, l: { debit?: number; credit?: number }) => sum + (parseFloat(String(l.credit)) || 0), 0)

    if (Math.abs(totalDebit - totalCredit) > 0.01) {
      return NextResponse.json(
        { error: `القيد غير متوازن. إجمالي المدين: ${totalDebit.toFixed(2)}، إجمالي الدائن: ${totalCredit.toFixed(2)}` },
        { status: 400 }
      )
    }

    // Validate all accounts are leaf, active, and belong to the company
    const accountIds = lines.map((l: { accountId: string }) => l.accountId)
    const accounts = await db.account.findMany({
      where: { id: { in: accountIds }, companyId },
    })

    for (const line of lines) {
      const account = accounts.find((a) => a.id === line.accountId)
      if (!account) {
        return NextResponse.json(
          { error: `الحساب غير موجود أو لا ينتمي لهذه الشركة` },
          { status: 404 }
        )
      }
      if (!account.isLeaf) {
        return NextResponse.json(
          { error: `الحساب "${account.nameAr}" (${account.code}) ليس حساب فرعي. لا يمكن الترحيل عليه.` },
          { status: 400 }
        )
      }
      if (!account.isActive) {
        return NextResponse.json(
          { error: `الحساب "${account.nameAr}" (${account.code}) غير نشط` },
          { status: 400 }
        )
      }
    }

    // Generate entry number: JV-{year}-{seq}
    const entryDate = new Date(date)
    const year = entryDate.getFullYear()
    const prefix = `JV-${year}`

    const lastEntry = await db.journalEntry.findFirst({
      where: { companyId, number: { startsWith: prefix } },
      orderBy: { number: 'desc' },
      select: { number: true },
    })

    let seq = 1
    if (lastEntry) {
      const lastSeq = parseInt(lastEntry.number.split('-').pop() || '0', 10)
      seq = lastSeq + 1
    }

    const number = generateDocNumber('JV', year, seq)

    // Create the journal entry with all lines
    const entry = await db.journalEntry.create({
      data: {
        companyId,
        number,
        date: entryDate,
        description: description || null,
        status: 'DRAFT',
        sourceType: sourceType || null,
        sourceId: sourceId || null,
        lines: {
          create: lines.map((l: { accountId: string; debit?: number; credit?: number; description?: string }) => ({
            accountId: l.accountId,
            debit: parseFloat(String(l.debit)) || 0,
            credit: parseFloat(String(l.credit)) || 0,
            description: l.description || null,
          })),
        },
      },
      include: {
        lines: {
          include: {
            account: {
              select: {
                id: true,
                code: true,
                nameAr: true,
                nameEn: true,
                type: true,
              },
            },
          },
          orderBy: { id: 'asc' },
        },
      },
    })

    return NextResponse.json(entry, { status: 201 })
  } catch (error) {
    if (error instanceof Error && (error.message.includes('غير مصرح') || error.message.includes('صلاحية'))) {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }
    console.error('Create journal entry error:', error)
    return NextResponse.json(
      { error: 'Failed to create journal entry' },
      { status: 500 }
    )
  }
}
