import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

// DELETE /api/companies/[id]/force-delete - Force delete a company and ALL its related data
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { confirmedName } = body

    const existing = await db.company.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json(
        { error: 'الشركة غير موجودة' },
        { status: 404 }
      )
    }

    // Verify the user typed the correct company name
    if (!confirmedName || confirmedName.trim() !== existing.nameAr.trim()) {
      return NextResponse.json(
        { error: 'اسم الشركة غير مطابق' },
        { status: 400 }
      )
    }

    // Delete all related data in order (respecting foreign key constraints)

    // ── Sales Returns ──
    await db.salesReturnLine.deleteMany({ where: { salesReturn: { companyId: id } } })
    await db.salesReturn.deleteMany({ where: { companyId: id } })

    // ── Purchase Returns ──
    await db.purchaseReturnLine.deleteMany({ where: { purchaseReturn: { companyId: id } } })
    await db.purchaseReturn.deleteMany({ where: { companyId: id } })

    // ── Pick Lists ──
    await db.pickListLine.deleteMany({ where: { pickList: { companyId: id } } })
    await db.pickList.deleteMany({ where: { companyId: id } })

    // ── Purchase Receipts ──
    await db.purchaseReceiptLine.deleteMany({ where: { purchaseReceipt: { companyId: id } } })
    await db.purchaseReceipt.deleteMany({ where: { companyId: id } })

    // ── Material Requests ──
    await db.materialRequestLine.deleteMany({ where: { materialRequest: { companyId: id } } })
    await db.materialRequest.deleteMany({ where: { companyId: id } })

    // ── Delivery Notes ──
    await db.deliveryNoteLine.deleteMany({ where: { deliveryNote: { companyId: id } } })
    await db.deliveryNote.deleteMany({ where: { companyId: id } })

    // ── Purchase Orders ──
    await db.purchaseOrderLine.deleteMany({ where: { purchaseOrder: { companyId: id } } })
    await db.purchaseOrder.deleteMany({ where: { companyId: id } })

    // ── Sales Orders ──
    await db.salesOrderLine.deleteMany({ where: { salesOrder: { companyId: id } } })
    await db.salesOrder.deleteMany({ where: { companyId: id } })

    // ── Sales Invoices (receipt lines first, then sales invoice lines) ──
    await db.receiptLine.deleteMany({ where: { salesInvoice: { companyId: id } } })
    await db.salesInvoiceLine.deleteMany({ where: { salesInvoice: { companyId: id } } })
    await db.salesInvoice.deleteMany({ where: { companyId: id } })

    // ── Purchase Invoices (payment lines first, then purchase invoice lines) ──
    await db.paymentLine.deleteMany({ where: { purchaseInvoice: { companyId: id } } })
    await db.purchaseInvoiceLine.deleteMany({ where: { purchaseInvoice: { companyId: id } } })
    await db.purchaseInvoice.deleteMany({ where: { companyId: id } })

    // ── Receipt Vouchers ──
    await db.receiptLine.deleteMany({ where: { receiptVoucher: { companyId: id } } })
    await db.receiptVoucher.deleteMany({ where: { companyId: id } })

    // ── Payment Vouchers ──
    await db.paymentLine.deleteMany({ where: { paymentVoucher: { companyId: id } } })
    await db.paymentVoucher.deleteMany({ where: { companyId: id } })

    // ── Journal Entries ──
    await db.journalEntryLine.deleteMany({ where: { journalEntry: { companyId: id } } })
    await db.journalEntry.deleteMany({ where: { companyId: id } })

    // ── Stock Transfers ──
    await db.stockTransferLine.deleteMany({ where: { stockTransfer: { companyId: id } } })
    await db.stockTransfer.deleteMany({ where: { companyId: id } })

    // ── Stock Movements ──
    await db.stockMovement.deleteMany({ where: { companyId: id } })

    // ── FIFO Layers ──
    await db.fifoLayer.deleteMany({ where: { item: { companyId: id } } })

    // ── Item Balances ──
    await db.itemBalance.deleteMany({ where: { item: { companyId: id } } })

    // ── Item Codes ──
    await db.itemCode.deleteMany({ where: { item: { companyId: id } } })

    // ── Items ──
    await db.item.deleteMany({ where: { companyId: id } })

    // ── Customers ──
    await db.customer.deleteMany({ where: { companyId: id } })

    // ── Suppliers ──
    await db.supplier.deleteMany({ where: { companyId: id } })

    // ── Investors ──
    await db.investorShare.deleteMany({ where: { distribution: { companyId: id } } })
    await db.profitDistribution.deleteMany({ where: { companyId: id } })
    await db.withdrawal.deleteMany({ where: { investment: { companyId: id } } })
    await db.investment.deleteMany({ where: { companyId: id } })
    await db.investor.deleteMany({ where: { companyId: id } })

    // ── Accounts ──
    await db.account.deleteMany({ where: { companyId: id } })

    // ── Warehouses ──
    await db.warehouse.deleteMany({ where: { companyId: id } })

    // ── Currencies ──
    await db.currency.deleteMany({ where: { companyId: id } })

    // ── Units of Measure ──
    await db.unitOfMeasure.deleteMany({ where: { companyId: id } })

    // ── Item Categories ──
    await db.itemCategory.deleteMany({ where: { companyId: id } })

    // ── Company Users ──
    await db.companyUser.deleteMany({ where: { companyId: id } })

    // Finally delete the company itself
    await db.company.delete({ where: { id } })

    return NextResponse.json({ message: 'تم حذف الشركة وجميع البيانات المرتبطة بنجاح', deleted: true })
  } catch (error) {
    console.error('Force delete company error:', error)
    return NextResponse.json(
      { error: 'حدث خطأ أثناء حذف الشركة' },
      { status: 500 }
    )
  }
}
