import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { generateDocNumber } from '@/lib/erp-utils'

// GET /api/accounting/journal-entries/[id] - Get single journal entry
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { searchParams } = new URL(request.url)
    const companyId = searchParams.get('companyId')
    if (!companyId) {
      return NextResponse.json({ error: 'companyId is required' }, { status: 400 })
    }

    const entry = await db.journalEntry.findUnique({
      where: { id },
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
        reversedBy: {
          select: {
            id: true,
            number: true,
          },
        },
      },
    })

    if (!entry) {
      return NextResponse.json(
        { error: 'القيد غير موجود' },
        { status: 404 }
      )
    }

    // Verify the entry belongs to the company
    if (entry.companyId !== companyId) {
      return NextResponse.json(
        { error: 'Journal entry does not belong to this company' },
        { status: 403 }
      )
    }

    return NextResponse.json(entry)
  } catch (error) {
    console.error('Get journal entry error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch journal entry' },
      { status: 500 }
    )
  }
}

// PUT /api/accounting/journal-entries/[id] - Actions on journal entry
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { companyId, action } = body

    if (!companyId) {
      return NextResponse.json({ error: 'companyId is required' }, { status: 400 })
    }

    const entry = await db.journalEntry.findUnique({
      where: { id },
      include: {
        lines: true,
      },
    })

    if (!entry) {
      return NextResponse.json(
        { error: 'القيد غير موجود' },
        { status: 404 }
      )
    }

    // Verify the entry belongs to the company
    if (entry.companyId !== companyId) {
      return NextResponse.json(
        { error: 'Journal entry does not belong to this company' },
        { status: 403 }
      )
    }

    // ── POST action: Change status from DRAFT to POSTED ──
    if (action === 'post') {
      if (entry.status !== 'DRAFT') {
        return NextResponse.json(
          { error: 'يمكن ترحيل القيود المسودة فقط' },
          { status: 400 }
        )
      }

      // Validate balance
      const totalDebit = entry.lines.reduce((sum, l) => sum + l.debit, 0)
      const totalCredit = entry.lines.reduce((sum, l) => sum + l.credit, 0)

      if (Math.abs(totalDebit - totalCredit) > 0.01) {
        return NextResponse.json(
          { error: `القيد غير متوازن. لا يمكن ترحيل قيد غير متوازن` },
          { status: 400 }
        )
      }

      const updated = await db.journalEntry.update({
        where: { id },
        data: { status: 'POSTED' },
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

      return NextResponse.json(updated)
    }

    // ── REVERSE action: Create a reversal entry ──
    if (action === 'reverse') {
      if (entry.status !== 'POSTED') {
        return NextResponse.json(
          { error: 'يمكن عكس القيود المرحلة فقط' },
          { status: 400 }
        )
      }

      // Check if already reversed
      const existingReversal = await db.journalEntry.findFirst({
        where: { reversedById: id },
      })
      if (existingReversal) {
        return NextResponse.json(
          { error: 'تم عكس هذا القيد مسبقاً' },
          { status: 400 }
        )
      }

      // Generate reversal entry number
      const now = new Date()
      const year = now.getFullYear()
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

      const reversalNumber = generateDocNumber('JV', year, seq)

      // Create reversal entry (swap debit/credit) and update original status
      const [reversalEntry] = await db.$transaction([
        db.journalEntry.create({
          data: {
            companyId,
            number: reversalNumber,
            date: now,
            description: `عكس القيد ${entry.number}${entry.description ? ' - ' + entry.description : ''}`,
            status: 'POSTED',
            sourceType: 'REVERSAL',
            sourceId: entry.id,
            reversedById: id,
            lines: {
              create: entry.lines.map((l) => ({
                accountId: l.accountId,
                debit: l.credit, // swap
                credit: l.debit, // swap
                description: l.description ? `عكس: ${l.description}` : 'عكس قيد',
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
        }),
        db.journalEntry.update({
          where: { id },
          data: { status: 'REVERSED' },
        }),
      ])

      return NextResponse.json(reversalEntry)
    }

    // ── UPDATE action: Only allowed if status is DRAFT ──
    if (action === 'update') {
      if (entry.status !== 'DRAFT') {
        return NextResponse.json(
          { error: 'يمكن تعديل القيود المسودة فقط' },
          { status: 400 }
        )
      }

      const { date, description, lines: newLines } = body

      // Validate lines if provided
      if (newLines && Array.isArray(newLines)) {
        if (newLines.length < 2) {
          return NextResponse.json(
            { error: 'يجب أن يحتوي القيد على سطرين على الأقل' },
            { status: 400 }
          )
        }

        // Validate each line
        for (let i = 0; i < newLines.length; i++) {
          const line = newLines[i]
          if (!line.accountId) {
            return NextResponse.json(
              { error: `الحساب مطلوب في السطر ${i + 1}` },
              { status: 400 }
            )
          }
          const debit = parseFloat(line.debit) || 0
          const credit = parseFloat(line.credit) || 0
          if (debit > 0 && credit > 0) {
            return NextResponse.json(
              { error: `لا يمكن أن يحتوي السطر ${i + 1} على مدين ودائن معاً` },
              { status: 400 }
            )
          }
        }

        // Validate balance
        const totalDebit = newLines.reduce(
          (sum: number, l: { debit?: number }) => sum + (parseFloat(String(l.debit)) || 0),
          0
        )
        const totalCredit = newLines.reduce(
          (sum: number, l: { credit?: number }) => sum + (parseFloat(String(l.credit)) || 0),
          0
        )

        if (Math.abs(totalDebit - totalCredit) > 0.01) {
          return NextResponse.json(
            { error: `القيد غير متوازن. إجمالي المدين: ${totalDebit.toFixed(2)}، إجمالي الدائن: ${totalCredit.toFixed(2)}` },
            { status: 400 }
          )
        }

        // Validate accounts are leaf, active, and belong to the company
        const accountIds = newLines.map((l: { accountId: string }) => l.accountId)
        const accounts = await db.account.findMany({
          where: { id: { in: accountIds }, companyId },
        })

        for (const line of newLines) {
          const account = accounts.find((a) => a.id === line.accountId)
          if (!account) {
            return NextResponse.json(
              { error: 'الحساب غير موجود أو لا ينتمي لهذه الشركة' },
              { status: 404 }
            )
          }
          if (!account.isLeaf) {
            return NextResponse.json(
              { error: `الحساب "${account.nameAr}" (${account.code}) ليس حساب فرعي` },
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
      }

      // Update the entry
      const updateData: Record<string, unknown> = {}
      if (date !== undefined) updateData.date = new Date(date)
      if (description !== undefined) updateData.description = description || null

      // If lines are provided, delete old and create new
      if (newLines && Array.isArray(newLines)) {
        await db.journalEntryLine.deleteMany({
          where: { journalEntryId: id },
        })

        updateData.lines = {
          create: newLines.map((l: { accountId: string; debit?: number; credit?: number; description?: string }) => ({
            accountId: l.accountId,
            debit: parseFloat(String(l.debit)) || 0,
            credit: parseFloat(String(l.credit)) || 0,
            description: l.description || null,
          })),
        }
      }

      const updated = await db.journalEntry.update({
        where: { id },
        data: updateData,
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

      return NextResponse.json(updated)
    }

    return NextResponse.json(
      { error: 'إجراء غير صالح. استخدم: post, reverse, update' },
      { status: 400 }
    )
  } catch (error) {
    console.error('Journal entry action error:', error)
    return NextResponse.json(
      { error: 'Failed to process journal entry action' },
      { status: 500 }
    )
  }
}
