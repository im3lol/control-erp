import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { generateDocNumber } from '@/lib/erp-utils'

// GET /api/sales/invoices/[id] - Get single invoice with full details
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const invoice = await db.salesInvoice.findUnique({
      where: { id },
      include: {
        customer: true,
        lines: {
          include: {
            item: {
              select: {
                id: true,
                code: true,
                nameAr: true,
                nameEn: true,
                sellPrice: true,
                uom: {
                  select: { id: true, nameAr: true, code: true },
                },
              },
            },
          },
          orderBy: { id: 'asc' },
        },
        receiptLines: {
          include: {
            receiptVoucher: {
              select: {
                id: true,
                number: true,
                date: true,
                amount: true,
                paymentMethod: true,
              },
            },
          },
          orderBy: { id: 'asc' },
        },
      },
    })

    if (!invoice) {
      return NextResponse.json(
        { error: 'فاتورة البيع غير موجودة' },
        { status: 404 }
      )
    }

    return NextResponse.json(invoice)
  } catch (error) {
    console.error('Get sales invoice error:', error)
    return NextResponse.json(
      { error: 'فشل في تحميل فاتورة البيع' },
      { status: 500 }
    )
  }
}

// PUT /api/sales/invoices/[id] - Actions on sales invoice
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { action } = body

    const invoice = await db.salesInvoice.findUnique({
      where: { id },
      include: {
        lines: true,
        customer: true,
      },
    })

    if (!invoice) {
      return NextResponse.json(
        { error: 'فاتورة البيع غير موجودة' },
        { status: 404 }
      )
    }

    // ── CONFIRM action: Change DRAFT → CONFIRMED ──
    if (action === 'confirm') {
      if (invoice.status !== 'DRAFT') {
        return NextResponse.json(
          { error: 'يمكن تأكيد الفواتير المسودة فقط' },
          { status: 400 }
        )
      }

      // 1. Validate stock availability for each line item
      for (const line of invoice.lines) {
        const totalBalance = await db.itemBalance.aggregate({
          where: { itemId: line.itemId },
          _sum: { quantity: true },
        })
        const availableQty = totalBalance._sum.quantity || 0

        if (availableQty < line.quantity) {
          const item = await db.item.findUnique({ where: { id: line.itemId } })
          return NextResponse.json(
            {
              error: `رصيد غير كافي للصنف "${item?.nameAr || line.itemId}". المتوفر: ${availableQty}، المطلوب: ${line.quantity}`,
            },
            { status: 400 }
          )
        }
      }

      // 2. Process each line: FIFO cost calculation + stock movement + balance update
      let totalCOGS = 0
      const stockMovements: Array<{
        itemId: string
        warehouseId: string
        quantity: number
        unitCost: number
        totalCost: number
      }> = []

      const fifoUpdates: Array<{
        layerId: string
        consumeQty: number
      }> = []

      const balanceUpdates: Array<{
        itemId: string
        warehouseId: string
        quantity: number
      }> = []

      for (const line of invoice.lines) {
        let remainingQty = line.quantity
        let lineCOGS = 0

        // Get FIFO layers for this item, ordered by date (oldest first)
        const fifoLayers = await db.fifoLayer.findMany({
          where: {
            itemId: line.itemId,
            remaining: { gt: 0 },
          },
          orderBy: [{ date: 'asc' }, { createdAt: 'asc' }],
        })

        if (fifoLayers.length === 0) {
          const item = await db.item.findUnique({ where: { id: line.itemId } })
          return NextResponse.json(
            { error: `لا توجد طبقات تكلفة للصنف "${item?.nameAr || line.itemId}"` },
            { status: 400 }
          )
        }

        for (const layer of fifoLayers) {
          if (remainingQty <= 0) break

          const consumeQty = Math.min(remainingQty, layer.remaining)
          const cost = consumeQty * layer.unitCost
          lineCOGS += cost

          fifoUpdates.push({
            layerId: layer.id,
            consumeQty,
          })

          // Track stock movement per warehouse
          const existingMovement = stockMovements.find(
            (m) => m.itemId === line.itemId && m.warehouseId === layer.warehouseId
          )

          if (existingMovement) {
            existingMovement.quantity += consumeQty
            existingMovement.totalCost += cost
            existingMovement.unitCost = existingMovement.totalCost / existingMovement.quantity
          } else {
            stockMovements.push({
              itemId: line.itemId,
              warehouseId: layer.warehouseId,
              quantity: consumeQty,
              unitCost: layer.unitCost,
              totalCost: cost,
            })
          }

          // Track balance updates
          const existingBalance = balanceUpdates.find(
            (b) => b.itemId === line.itemId && b.warehouseId === layer.warehouseId
          )
          if (existingBalance) {
            existingBalance.quantity += consumeQty
          } else {
            balanceUpdates.push({
              itemId: line.itemId,
              warehouseId: layer.warehouseId,
              quantity: consumeQty,
            })
          }

          remainingQty -= consumeQty
        }

        if (remainingQty > 0) {
          const item = await db.item.findUnique({ where: { id: line.itemId } })
          return NextResponse.json(
            { error: `رصيد FIFO غير كافي للصنف "${item?.nameAr || line.itemId}". الناقص: ${remainingQty}` },
            { status: 400 }
          )
        }

        // Update the line's costAmount
        totalCOGS += lineCOGS
        await db.salesInvoiceLine.update({
          where: { id: line.id },
          data: { costAmount: Math.round(lineCOGS * 100) / 100 },
        })
      }

      // 3. Create StockMovements (OUT type)
      const movementPromises = stockMovements.map(async (sm, idx) => {
        const mvPrefix = `SM-${new Date().getFullYear()}`
        const lastMV = await db.stockMovement.findFirst({
          where: { number: { startsWith: mvPrefix } },
          orderBy: { number: 'desc' },
          select: { number: true },
        })
        let mvSeq = 1
        if (lastMV) {
          const parsed = parseInt(lastMV.number.split('-').pop() || '0', 10)
          if (!isNaN(parsed)) mvSeq = parsed + 1
        }
        // Add offset for multiple movements in same request
        mvSeq += idx

        return db.stockMovement.create({
          data: {
            number: generateDocNumber('SM', new Date().getFullYear(), mvSeq),
            type: 'OUT',
            itemId: sm.itemId,
            warehouseId: sm.warehouseId,
            quantity: sm.quantity,
            unitCost: Math.round(sm.unitCost * 100) / 100,
            totalCost: Math.round(sm.totalCost * 100) / 100,
            referenceType: 'SALES_INVOICE',
            referenceId: id,
            reason: `فاتورة بيع ${invoice.number}`,
            date: invoice.date,
          },
        })
      })

      await Promise.all(movementPromises)

      // 4. Update ItemBalance (subtract quantity)
      for (const bu of balanceUpdates) {
        const existingBalance = await db.itemBalance.findUnique({
          where: {
            itemId_warehouseId: {
              itemId: bu.itemId,
              warehouseId: bu.warehouseId,
            },
          },
        })

        if (existingBalance) {
          const newQty = existingBalance.quantity - bu.quantity
          const newAvgCost = newQty > 0 ? existingBalance.avgCost : 0
          await db.itemBalance.update({
            where: { id: existingBalance.id },
            data: {
              quantity: newQty,
              avgCost: newAvgCost,
            },
          })
        }
      }

      // Update FIFO layers (reduce remaining)
      for (const fu of fifoUpdates) {
        const layer = await db.fifoLayer.findUnique({ where: { id: fu.layerId } })
        if (layer) {
          await db.fifoLayer.update({
            where: { id: fu.layerId },
            data: { remaining: layer.remaining - fu.consumeQty },
          })
        }
      }

      // 5. Create Journal Entry
      const jePrefix = `JV-${invoice.date.getFullYear()}`
      const lastJE = await db.journalEntry.findFirst({
        where: { number: { startsWith: jePrefix } },
        orderBy: { number: 'desc' },
        select: { number: true },
      })
      let jeSeq = 1
      if (lastJE) {
        const parsed = parseInt(lastJE.number.split('-').pop() || '0', 10)
        if (!isNaN(parsed)) jeSeq = parsed + 1
      }

      // Find accounts by code
      const accountsNeeded = ['1103', '41', '2102', '51', '1104']
      const accounts = await db.account.findMany({
        where: { code: { in: accountsNeeded } },
      })

      const getAccount = (code: string) => accounts.find((a) => a.code === code)
      const customersAccount = getAccount('1103') // العملاء
      const salesAccount = getAccount('41') // المبيعات
      const taxAccount = getAccount('2102') // الضريبة المستحقة
      const cogsAccount = getAccount('51') // تكلفة البضاعة
      const inventoryAccount = getAccount('1104') // المخزون

      const journalLines: Array<{
        accountId: string
        debit: number
        credit: number
        description: string | null
      }> = []

      // Debit: العملاء = totalAmount
      if (customersAccount) {
        journalLines.push({
          accountId: customersAccount.id,
          debit: invoice.totalAmount,
          credit: 0,
          description: `فاتورة بيع ${invoice.number} - ${invoice.customer.nameAr}`,
        })
      }

      // Credit: المبيعات = subtotal
      if (salesAccount) {
        journalLines.push({
          accountId: salesAccount.id,
          debit: 0,
          credit: invoice.subtotal,
          description: `إيراد مبيعات - فاتورة ${invoice.number}`,
        })
      }

      // Credit: الضريبة المستحقة = taxAmount (if any)
      if (invoice.taxAmount > 0 && taxAccount) {
        journalLines.push({
          accountId: taxAccount.id,
          debit: 0,
          credit: invoice.taxAmount,
          description: `ضريبة فاتورة ${invoice.number}`,
        })
      }

      // Debit: تكلفة البضاعة = total COGS
      if (totalCOGS > 0 && cogsAccount) {
        journalLines.push({
          accountId: cogsAccount.id,
          debit: Math.round(totalCOGS * 100) / 100,
          credit: 0,
          description: `تكلفة بضاعة مباعة - فاتورة ${invoice.number}`,
        })
      }

      // Credit: المخزون = total COGS
      if (totalCOGS > 0 && inventoryAccount) {
        journalLines.push({
          accountId: inventoryAccount.id,
          debit: 0,
          credit: Math.round(totalCOGS * 100) / 100,
          description: `تخفيض مخزون - فاتورة ${invoice.number}`,
        })
      }

      if (journalLines.length >= 2) {
        await db.journalEntry.create({
          data: {
            number: generateDocNumber('JV', invoice.date.getFullYear(), jeSeq),
            date: invoice.date,
            description: `فاتورة بيع ${invoice.number} - ${invoice.customer.nameAr}`,
            status: 'POSTED',
            sourceType: 'SALES_INVOICE',
            sourceId: id,
            lines: {
              create: journalLines,
            },
          },
        })
      }

      // 6. Update customer balance: +totalAmount
      await db.customer.update({
        where: { id: invoice.customerId },
        data: {
          balance: invoice.customer.balance + invoice.totalAmount,
        },
      })

      // 7. Set invoice status to CONFIRMED
      const updated = await db.salesInvoice.update({
        where: { id },
        data: { status: 'CONFIRMED' },
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
              item: {
                select: {
                  id: true,
                  code: true,
                  nameAr: true,
                  nameEn: true,
                },
              },
            },
          },
        },
      })

      return NextResponse.json(updated)
    }

    // ── CANCEL action: Change DRAFT/CONFIRMED → CANCELLED ──
    if (action === 'cancel') {
      if (invoice.status !== 'DRAFT' && invoice.status !== 'CONFIRMED') {
        return NextResponse.json(
          { error: 'يمكن إلغاء الفواتير المسودة أو المؤكدة فقط' },
          { status: 400 }
        )
      }

      // If CONFIRMED, reverse all stock movements and journal entries
      if (invoice.status === 'CONFIRMED') {
        // 1. Reverse stock movements
        const stockMovements = await db.stockMovement.findMany({
          where: {
            referenceType: 'SALES_INVOICE',
            referenceId: id,
          },
        })

        // Create IN movements to reverse OUT movements
        for (const sm of stockMovements) {
          const mvPrefix = `SM-${new Date().getFullYear()}`
          const lastMV = await db.stockMovement.findFirst({
            where: { number: { startsWith: mvPrefix } },
            orderBy: { number: 'desc' },
            select: { number: true },
          })
          let mvSeq = 1
          if (lastMV) {
            const parsed = parseInt(lastMV.number.split('-').pop() || '0', 10)
            if (!isNaN(parsed)) mvSeq = parsed + 1
          }

          await db.stockMovement.create({
            data: {
              number: generateDocNumber('SM', new Date().getFullYear(), mvSeq),
              type: 'IN',
              itemId: sm.itemId,
              warehouseId: sm.warehouseId,
              quantity: sm.quantity,
              unitCost: sm.unitCost,
              totalCost: sm.totalCost,
              referenceType: 'SALES_INVOICE_CANCEL',
              referenceId: id,
              reason: `إلغاء فاتورة بيع ${invoice.number}`,
              date: new Date(),
            },
          })

          // Update ItemBalance (add quantity back)
          const existingBalance = await db.itemBalance.findUnique({
            where: {
              itemId_warehouseId: {
                itemId: sm.itemId,
                warehouseId: sm.warehouseId,
              },
            },
          })

          if (existingBalance) {
            const newQty = existingBalance.quantity + sm.quantity
            const newAvgCost = newQty > 0
              ? (existingBalance.avgCost * existingBalance.quantity + sm.totalCost) / newQty
              : 0
            await db.itemBalance.update({
              where: { id: existingBalance.id },
              data: {
                quantity: newQty,
                avgCost: newAvgCost,
              },
            })
          } else {
            await db.itemBalance.create({
              data: {
                itemId: sm.itemId,
                warehouseId: sm.warehouseId,
                quantity: sm.quantity,
                avgCost: sm.unitCost,
              },
            })
          }

          // Restore FIFO layers - add back to the original layers
          // We'll add new FIFO layers to restore stock
          await db.fifoLayer.create({
            data: {
              itemId: sm.itemId,
              warehouseId: sm.warehouseId,
              quantity: sm.quantity,
              remaining: sm.quantity,
              unitCost: sm.unitCost,
              date: new Date(),
            },
          })
        }

        // 2. Reverse journal entry
        const originalJE = await db.journalEntry.findFirst({
          where: {
            sourceType: 'SALES_INVOICE',
            sourceId: id,
            status: 'POSTED',
          },
          include: { lines: true },
        })

        if (originalJE) {
          const jePrefix = `JV-${new Date().getFullYear()}`
          const lastJE = await db.journalEntry.findFirst({
            where: { number: { startsWith: jePrefix } },
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
              number: generateDocNumber('JV', new Date().getFullYear(), jeSeq),
              date: new Date(),
              description: `إلغاء فاتورة بيع ${invoice.number}`,
              status: 'POSTED',
              sourceType: 'SALES_INVOICE_CANCEL',
              sourceId: id,
              lines: {
                create: originalJE.lines.map((l) => ({
                  accountId: l.accountId,
                  debit: l.credit, // swap
                  credit: l.debit, // swap
                  description: `إلغاء: ${l.description || ''}`,
                })),
              },
            },
          })

          // Mark original as reversed
          await db.journalEntry.update({
            where: { id: originalJE.id },
            data: { status: 'REVERSED' },
          })
        }

        // 3. Reverse customer balance
        await db.customer.update({
          where: { id: invoice.customerId },
          data: {
            balance: invoice.customer.balance - invoice.totalAmount,
          },
        })
      }

      // Set status to CANCELLED
      const updated = await db.salesInvoice.update({
        where: { id },
        data: { status: 'CANCELLED' },
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
              item: {
                select: {
                  id: true,
                  code: true,
                  nameAr: true,
                  nameEn: true,
                },
              },
            },
          },
        },
      })

      return NextResponse.json(updated)
    }

    // ── UPDATE action: Only if DRAFT ──
    if (action === 'update') {
      if (invoice.status !== 'DRAFT') {
        return NextResponse.json(
          { error: 'يمكن تعديل الفواتير المسودة فقط' },
          { status: 400 }
        )
      }

      const {
        customerId,
        date,
        dueDate,
        discountAmount,
        discountPercent,
        taxAmount,
        taxPercent,
        notes,
        lines: newLines,
      } = body

      // Validate customer if changed
      if (customerId && customerId !== invoice.customerId) {
        const customer = await db.customer.findUnique({ where: { id: customerId } })
        if (!customer) {
          return NextResponse.json(
            { error: 'العميل غير موجود' },
            { status: 404 }
          )
        }
      }

      // Validate lines if provided
      if (newLines && Array.isArray(newLines)) {
        if (newLines.length === 0) {
          return NextResponse.json(
            { error: 'يجب أن تحتوي الفاتورة على سطر واحد على الأقل' },
            { status: 400 }
          )
        }
      }

      // Recalculate totals
      const processedLines = newLines
        ? newLines.map(
            (l: { itemId: string; quantity: number; unitPrice: number; discountAmount?: number; taxAmount?: number }) => ({
              itemId: l.itemId,
              quantity: l.quantity,
              unitPrice: l.unitPrice,
              discountAmount: l.discountAmount || 0,
              taxAmount: l.taxAmount || 0,
              totalAmount: l.quantity * l.unitPrice - (l.discountAmount || 0) + (l.taxAmount || 0),
            })
          )
        : null

      const subtotal = processedLines
        ? processedLines.reduce((sum: number, l: { totalAmount: number; discountAmount: number; taxAmount: number }) => {
            return sum + l.totalAmount - l.taxAmount + l.discountAmount
          }, 0)
        : undefined

      const finalDiscountAmount = discountAmount ?? invoice.discountAmount
      const finalTaxAmount = taxAmount ?? invoice.taxAmount
      const finalSubtotal = subtotal ?? invoice.subtotal
      const totalAmount = finalSubtotal - finalDiscountAmount + finalTaxAmount

      // Update the invoice
      const updateData: Record<string, unknown> = {}
      if (customerId !== undefined) updateData.customerId = customerId
      if (date !== undefined) updateData.date = new Date(date)
      if (dueDate !== undefined) updateData.dueDate = dueDate ? new Date(dueDate) : null
      if (discountAmount !== undefined) updateData.discountAmount = discountAmount
      if (discountPercent !== undefined) updateData.discountPercent = discountPercent
      if (taxAmount !== undefined) updateData.taxAmount = taxAmount
      if (taxPercent !== undefined) updateData.taxPercent = taxPercent
      if (notes !== undefined) updateData.notes = notes || null

      updateData.subtotal = Math.round(finalSubtotal * 100) / 100
      updateData.totalAmount = Math.round(totalAmount * 100) / 100
      updateData.balanceDue = Math.round(totalAmount * 100) / 100

      // If lines are provided, delete old and create new
      if (processedLines) {
        await db.salesInvoiceLine.deleteMany({
          where: { salesInvoiceId: id },
        })

        updateData.lines = {
          create: processedLines,
        }
      }

      const updated = await db.salesInvoice.update({
        where: { id },
        data: updateData,
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
              item: {
                select: {
                  id: true,
                  code: true,
                  nameAr: true,
                  nameEn: true,
                },
              },
            },
          },
        },
      })

      return NextResponse.json(updated)
    }

    return NextResponse.json(
      { error: 'إجراء غير صالح. استخدم: confirm, cancel, update' },
      { status: 400 }
    )
  } catch (error) {
    console.error('Sales invoice action error:', error)
    return NextResponse.json(
      { error: 'فشل في معالجة إجراء فاتورة البيع' },
      { status: 500 }
    )
  }
}
