import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { generateDocNumber } from '@/lib/erp-utils'

// GET /api/purchases/invoices/[id] - Get single invoice with full details
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const invoice = await db.purchaseInvoice.findUnique({
      where: { id },
      include: {
        supplier: true,
        warehouse: true,
        lines: {
          include: {
            item: {
              select: { id: true, code: true, nameAr: true, nameEn: true, uom: { select: { nameAr: true } } },
            },
          },
          orderBy: { id: 'asc' },
        },
        paymentLines: {
          include: {
            paymentVoucher: {
              select: { id: true, number: true, date: true, amount: true },
            },
          },
        },
      },
    })

    if (!invoice) {
      return NextResponse.json(
        { error: 'فاتورة الشراء غير موجودة' },
        { status: 404 }
      )
    }

    return NextResponse.json(invoice)
  } catch (error) {
    console.error('Get purchase invoice error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch purchase invoice' },
      { status: 500 }
    )
  }
}

// PUT /api/purchases/invoices/[id] - Actions: confirm, cancel, update
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { action } = body

    const invoice = await db.purchaseInvoice.findUnique({
      where: { id },
      include: {
        lines: {
          include: {
            item: true,
          },
        },
      },
    })

    if (!invoice) {
      return NextResponse.json(
        { error: 'فاتورة الشراء غير موجودة' },
        { status: 404 }
      )
    }

    // ── CONFIRM action: DRAFT → CONFIRMED ──
    if (action === 'confirm') {
      if (invoice.status !== 'DRAFT') {
        return NextResponse.json(
          { error: 'يمكن تأكيد الفواتير المسودة فقط' },
          { status: 400 }
        )
      }

      // Use transaction for all confirm operations
      const result = await db.$transaction(async (tx) => {
        // 1. Create StockMovements (IN) and FifoLayers, update ItemBalances
        for (const line of invoice.lines) {
          const qty = line.quantity
          const unitCost = line.unitPrice
          const totalCost = qty * unitCost - line.discountAmount

          // Create StockMovement
          const smPrefix = `SM-${new Date(invoice.date).getFullYear()}`
          const lastSM = await tx.stockMovement.findFirst({
            where: { number: { startsWith: smPrefix } },
            orderBy: { number: 'desc' },
            select: { number: true },
          })
          let smSeq = 1
          if (lastSM) {
            smSeq = parseInt(lastSM.number.split('-').pop() || '0', 10) + 1
          }
          const smNumber = generateDocNumber('SM', new Date(invoice.date).getFullYear(), smSeq)

          await tx.stockMovement.create({
            data: {
              number: smNumber,
              type: 'IN',
              itemId: line.itemId,
              warehouseId: invoice.warehouseId,
              quantity: qty,
              unitCost,
              totalCost,
              referenceType: 'PURCHASE_INVOICE',
              referenceId: invoice.id,
              reason: `فاتورة شراء ${invoice.number}`,
              date: invoice.date,
            },
          })

          // 2. Create FifoLayer
          await tx.fifoLayer.create({
            data: {
              itemId: line.itemId,
              warehouseId: invoice.warehouseId,
              quantity: qty,
              remaining: qty,
              unitCost,
              purchaseInvoiceId: invoice.id,
              date: invoice.date,
            },
          })

          // 3. Update ItemBalance
          const existingBalance = await tx.itemBalance.findUnique({
            where: {
              itemId_warehouseId: {
                itemId: line.itemId,
                warehouseId: invoice.warehouseId,
              },
            },
          })

          if (existingBalance) {
            const newQty = existingBalance.quantity + qty
            const newAvgCost = newQty > 0
              ? (existingBalance.quantity * existingBalance.avgCost + totalCost) / newQty
              : 0

            await tx.itemBalance.update({
              where: { id: existingBalance.id },
              data: {
                quantity: newQty,
                avgCost: newAvgCost,
              },
            })
          } else {
            await tx.itemBalance.create({
              data: {
                itemId: line.itemId,
                warehouseId: invoice.warehouseId,
                quantity: qty,
                avgCost: qty > 0 ? totalCost / qty : 0,
              },
            })
          }
        }

        // 4. Create Journal Entry
        //   - Debit: المخزون (1104) = subtotal (total cost before invoice-level tax)
        //   - Debit: الضريبة المستحقة (2102) = taxAmount (if any)
        //   - Credit: الموردين (2101) = totalAmount
        const inventoryAccount = await tx.account.findUnique({ where: { code: '1104' } })
        const taxAccount = await tx.account.findUnique({ where: { code: '2102' } })
        const supplierAccount = await tx.account.findUnique({ where: { code: '2101' } })

        if (!inventoryAccount) {
          throw new Error('حساب المخزون (1104) غير موجود في شجرة الحسابات')
        }
        if (!supplierAccount) {
          throw new Error('حساب الموردين (2101) غير موجود في شجرة الحسابات')
        }

        // Generate journal entry number
        const jeYear = new Date(invoice.date).getFullYear()
        const jePrefix = `JV-${jeYear}`
        const lastJE = await tx.journalEntry.findFirst({
          where: { number: { startsWith: jePrefix } },
          orderBy: { number: 'desc' },
          select: { number: true },
        })
        let jeSeq = 1
        if (lastJE) {
          jeSeq = parseInt(lastJE.number.split('-').pop() || '0', 10) + 1
        }
        const jeNumber = generateDocNumber('JV', jeYear, jeSeq)

        const jeLines: { accountId: string; debit: number; credit: number; description: string }[] = [
          {
            accountId: inventoryAccount.id,
            debit: invoice.subtotal,
            credit: 0,
            description: `مخزون - فاتورة شراء ${invoice.number}`,
          },
        ]

        if (invoice.taxAmount > 0 && taxAccount) {
          jeLines.push({
            accountId: taxAccount.id,
            debit: invoice.taxAmount,
            credit: 0,
            description: `ضريبة - فاتورة شراء ${invoice.number}`,
          })
        }

        jeLines.push({
          accountId: supplierAccount.id,
          debit: 0,
          credit: invoice.totalAmount,
          description: `موردون - فاتورة شراء ${invoice.number}`,
        })

        await tx.journalEntry.create({
          data: {
            number: jeNumber,
            date: invoice.date,
            description: `تأكيد فاتورة شراء ${invoice.number} - ${invoice.number}`,
            status: 'POSTED',
            sourceType: 'PURCHASE_INVOICE',
            sourceId: invoice.id,
            lines: {
              create: jeLines,
            },
          },
        })

        // 5. Update supplier balance: +totalAmount (we owe them more)
        await tx.supplier.update({
          where: { id: invoice.supplierId },
          data: { balance: { increment: invoice.totalAmount } },
        })

        // 6. Set invoice status to CONFIRMED
        const updated = await tx.purchaseInvoice.update({
          where: { id },
          data: { status: 'CONFIRMED' },
          include: {
            supplier: { select: { id: true, code: true, nameAr: true, nameEn: true } },
            warehouse: { select: { id: true, code: true, nameAr: true } },
            lines: {
              include: {
                item: { select: { id: true, code: true, nameAr: true, nameEn: true } },
              },
            },
          },
        })

        return updated
      })

      return NextResponse.json(result)
    }

    // ── CANCEL action ──
    if (action === 'cancel') {
      if (invoice.status === 'CANCELLED') {
        return NextResponse.json(
          { error: 'الفاتورة ملغية بالفعل' },
          { status: 400 }
        )
      }
      if (invoice.status === 'PAID') {
        return NextResponse.json(
          { error: 'لا يمكن إلغاء فاتورة مدفوعة' },
          { status: 400 }
        )
      }

      // If CONFIRMED, reverse everything
      if (invoice.status === 'CONFIRMED') {
        const result = await db.$transaction(async (tx) => {
          // 1. Reverse StockMovements and FifoLayers, reverse ItemBalances
          for (const line of invoice.lines) {
            const qty = line.quantity
            const unitCost = line.unitPrice
            const totalCost = qty * unitCost - line.discountAmount

            // Create reverse StockMovement
            const smPrefix = `SM-${new Date().getFullYear()}`
            const lastSM = await tx.stockMovement.findFirst({
              where: { number: { startsWith: smPrefix } },
              orderBy: { number: 'desc' },
              select: { number: true },
            })
            let smSeq = 1
            if (lastSM) {
              smSeq = parseInt(lastSM.number.split('-').pop() || '0', 10) + 1
            }
            const smNumber = generateDocNumber('SM', new Date().getFullYear(), smSeq)

            await tx.stockMovement.create({
              data: {
                number: smNumber,
                type: 'OUT',
                itemId: line.itemId,
                warehouseId: invoice.warehouseId,
                quantity: qty,
                unitCost,
                totalCost: -totalCost,
                referenceType: 'PURCHASE_INVOICE_CANCEL',
                referenceId: invoice.id,
                reason: `إلغاء فاتورة شراء ${invoice.number}`,
                date: new Date(),
              },
            })

            // Reduce FifoLayer remaining
            // Find the fifo layer created by this invoice for this item
            const fifoLayer = await tx.fifoLayer.findFirst({
              where: {
                itemId: line.itemId,
                warehouseId: invoice.warehouseId,
                purchaseInvoiceId: invoice.id,
              },
            })
            if (fifoLayer) {
              const newRemaining = fifoLayer.remaining - qty
              if (newRemaining <= 0) {
                await tx.fifoLayer.delete({ where: { id: fifoLayer.id } })
              } else {
                await tx.fifoLayer.update({
                  where: { id: fifoLayer.id },
                  data: { remaining: newRemaining },
                })
              }
            }

            // Reverse ItemBalance
            const existingBalance = await tx.itemBalance.findUnique({
              where: {
                itemId_warehouseId: {
                  itemId: line.itemId,
                  warehouseId: invoice.warehouseId,
                },
              },
            })
            if (existingBalance) {
              const newQty = existingBalance.quantity - qty
              const newAvgCost = newQty > 0
                ? Math.max(0, (existingBalance.quantity * existingBalance.avgCost - totalCost) / newQty)
                : 0

              await tx.itemBalance.update({
                where: { id: existingBalance.id },
                data: {
                  quantity: Math.max(0, newQty),
                  avgCost: newAvgCost,
                },
              })
            }
          }

          // 2. Create reversal Journal Entry
          const inventoryAccount = await tx.account.findUnique({ where: { code: '1104' } })
          const taxAccount = await tx.account.findUnique({ where: { code: '2102' } })
          const supplierAccount = await tx.account.findUnique({ where: { code: '2101' } })

          if (inventoryAccount && supplierAccount) {
            const jeYear = new Date().getFullYear()
            const jePrefix = `JV-${jeYear}`
            const lastJE = await tx.journalEntry.findFirst({
              where: { number: { startsWith: jePrefix } },
              orderBy: { number: 'desc' },
              select: { number: true },
            })
            let jeSeq = 1
            if (lastJE) {
              jeSeq = parseInt(lastJE.number.split('-').pop() || '0', 10) + 1
            }
            const jeNumber = generateDocNumber('JV', jeYear, jeSeq)

            const reversalLines: { accountId: string; debit: number; credit: number; description: string }[] = [
              {
                accountId: supplierAccount.id,
                debit: invoice.totalAmount,
                credit: 0,
                description: `عكس موردون - إلغاء فاتورة شراء ${invoice.number}`,
              },
              {
                accountId: inventoryAccount.id,
                debit: 0,
                credit: invoice.subtotal,
                description: `عكس مخزون - إلغاء فاتورة شراء ${invoice.number}`,
              },
            ]

            if (invoice.taxAmount > 0 && taxAccount) {
              reversalLines.push({
                accountId: taxAccount.id,
                debit: 0,
                credit: invoice.taxAmount,
                description: `عكس ضريبة - إلغاء فاتورة شراء ${invoice.number}`,
              })
            }

            await tx.journalEntry.create({
              data: {
                number: jeNumber,
                date: new Date(),
                description: `إلغاء فاتورة شراء ${invoice.number}`,
                status: 'POSTED',
                sourceType: 'PURCHASE_INVOICE_CANCEL',
                sourceId: invoice.id,
                lines: {
                  create: reversalLines,
                },
              },
            })
          }

          // 3. Reverse supplier balance
          await tx.supplier.update({
            where: { id: invoice.supplierId },
            data: { balance: { decrement: invoice.totalAmount } },
          })

          // 4. Set invoice status to CANCELLED
          const updated = await tx.purchaseInvoice.update({
            where: { id },
            data: { status: 'CANCELLED' },
            include: {
              supplier: { select: { id: true, code: true, nameAr: true, nameEn: true } },
              warehouse: { select: { id: true, code: true, nameAr: true } },
              lines: {
                include: {
                  item: { select: { id: true, code: true, nameAr: true, nameEn: true } },
                },
              },
            },
          })

          return updated
        })

        return NextResponse.json(result)
      }

      // If DRAFT, just cancel
      const updated = await db.purchaseInvoice.update({
        where: { id },
        data: { status: 'CANCELLED' },
        include: {
          supplier: { select: { id: true, code: true, nameAr: true, nameEn: true } },
          warehouse: { select: { id: true, code: true, nameAr: true } },
          lines: {
            include: {
              item: { select: { id: true, code: true, nameAr: true, nameEn: true } },
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
        supplierId,
        warehouseId,
        date,
        dueDate,
        discountAmount,
        discountPercent,
        taxPercent,
        notes,
        lines: newLines,
      } = body

      if (newLines && Array.isArray(newLines)) {
        if (newLines.length === 0) {
          return NextResponse.json(
            { error: 'يجب أن تحتوي الفاتورة على سطر واحد على الأقل' },
            { status: 400 }
          )
        }

        // Recalculate totals
        const processedLines = newLines.map((line: { itemId: string; quantity: number; unitPrice: number; discountAmount?: number; taxAmount?: number }) => {
          const quantity = parseFloat(String(line.quantity)) || 0
          const unitPrice = parseFloat(String(line.unitPrice)) || 0
          const lineDiscount = parseFloat(String(line.discountAmount)) || 0
          const lineTax = parseFloat(String(line.taxAmount)) || 0
          const lineTotal = quantity * unitPrice - lineDiscount + lineTax

          return {
            itemId: line.itemId,
            quantity,
            unitPrice,
            discountAmount: lineDiscount,
            taxAmount: lineTax,
            totalAmount: lineTotal,
          }
        })

        const rawSubtotal = processedLines.reduce((sum: number, l: { quantity: number; unitPrice: number }) => sum + (l.quantity * l.unitPrice), 0)
        const totalLineDiscounts = processedLines.reduce((sum: number, l: { discountAmount: number }) => sum + l.discountAmount, 0)
        const totalLineTaxes = processedLines.reduce((sum: number, l: { taxAmount: number }) => sum + l.taxAmount, 0)

        const invoiceDiscount = parseFloat(String(discountAmount)) || 0
        const invoiceTaxPercent = parseFloat(String(taxPercent)) || 0
        const afterDiscount = rawSubtotal - totalLineDiscounts - invoiceDiscount
        const invoiceTax = invoiceTaxPercent > 0 ? afterDiscount * (invoiceTaxPercent / 100) : 0
        const totalTax = totalLineTaxes + invoiceTax
        const totalAmount = afterDiscount + totalTax

        // Delete old lines and create new ones
        await db.purchaseInvoiceLine.deleteMany({
          where: { purchaseInvoiceId: id },
        })

        const updated = await db.purchaseInvoice.update({
          where: { id },
          data: {
            ...(supplierId !== undefined && { supplierId }),
            ...(warehouseId !== undefined && { warehouseId }),
            ...(date !== undefined && { date: new Date(date) }),
            ...(dueDate !== undefined && { dueDate: dueDate ? new Date(dueDate) : null }),
            subtotal: rawSubtotal - totalLineDiscounts,
            discountAmount: invoiceDiscount,
            discountPercent: parseFloat(String(discountPercent)) || 0,
            taxAmount: totalTax,
            taxPercent: invoiceTaxPercent,
            totalAmount,
            balanceDue: totalAmount,
            notes: notes || null,
            lines: {
              create: processedLines,
            },
          },
          include: {
            supplier: { select: { id: true, code: true, nameAr: true, nameEn: true } },
            warehouse: { select: { id: true, code: true, nameAr: true } },
            lines: {
              include: {
                item: { select: { id: true, code: true, nameAr: true, nameEn: true } },
              },
            },
          },
        })

        return NextResponse.json(updated)
      }

      // Update without changing lines
      const updateData: Record<string, unknown> = {}
      if (supplierId !== undefined) updateData.supplierId = supplierId
      if (warehouseId !== undefined) updateData.warehouseId = warehouseId
      if (date !== undefined) updateData.date = new Date(date)
      if (dueDate !== undefined) updateData.dueDate = dueDate ? new Date(dueDate) : null
      if (notes !== undefined) updateData.notes = notes || null

      const updated = await db.purchaseInvoice.update({
        where: { id },
        data: updateData,
        include: {
          supplier: { select: { id: true, code: true, nameAr: true, nameEn: true } },
          warehouse: { select: { id: true, code: true, nameAr: true } },
          lines: {
            include: {
              item: { select: { id: true, code: true, nameAr: true, nameEn: true } },
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
    console.error('Purchase invoice action error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to process purchase invoice action' },
      { status: 500 }
    )
  }
}
