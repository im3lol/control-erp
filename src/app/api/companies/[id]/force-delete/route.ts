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
    // Pick lists
    await db.pickListItem.deleteMany({ where: { pickList: { companyId: id } } })
    await db.pickList.deleteMany({ where: { companyId: id } })

    // Purchase receipts
    await db.purchaseReceiptItem.deleteMany({ where: { purchaseReceipt: { companyId: id } } })
    await db.purchaseReceipt.deleteMany({ where: { companyId: id } })

    // Material requests
    await db.materialRequestItem.deleteMany({ where: { materialRequest: { companyId: id } } })
    await db.materialRequest.deleteMany({ where: { companyId: id } })

    // Delivery notes
    await db.deliveryNoteItem.deleteMany({ where: { deliveryNote: { companyId: id } } })
    await db.deliveryNote.deleteMany({ where: { companyId: id } })

    // Purchase orders
    await db.purchaseOrderItem.deleteMany({ where: { purchaseOrder: { companyId: id } } })
    await db.purchaseOrder.deleteMany({ where: { companyId: id } })

    // Sales orders
    await db.salesOrderItem.deleteMany({ where: { salesOrder: { companyId: id } } })
    await db.salesOrder.deleteMany({ where: { companyId: id } })

    // Sales invoices
    await db.salesInvoiceItem.deleteMany({ where: { salesInvoice: { companyId: id } } })
    await db.salesInvoice.deleteMany({ where: { companyId: id } })

    // Purchase invoices
    await db.purchaseInvoiceItem.deleteMany({ where: { purchaseInvoice: { companyId: id } } })
    await db.purchaseInvoice.deleteMany({ where: { companyId: id } })

    // Receipt vouchers
    await db.receiptVoucher.deleteMany({ where: { companyId: id } })

    // Payment vouchers
    await db.paymentVoucher.deleteMany({ where: { companyId: id } })

    // Journal entries
    await db.journalEntryLine.deleteMany({ where: { journalEntry: { companyId: id } } })
    await db.journalEntry.deleteMany({ where: { companyId: id } })

    // Stock transfers
    await db.stockTransferItem.deleteMany({ where: { stockTransfer: { companyId: id } } })
    await db.stockTransfer.deleteMany({ where: { companyId: id } })

    // Items
    await db.item.deleteMany({ where: { companyId: id } })

    // Customers
    await db.customer.deleteMany({ where: { companyId: id } })

    // Suppliers
    await db.supplier.deleteMany({ where: { companyId: id } })

    // Investors
    await db.withdrawal.deleteMany({ where: { investment: { companyId: id } } })
    await db.profitDistributionItem.deleteMany({ where: { profitDistribution: { companyId: id } } })
    await db.profitDistribution.deleteMany({ where: { companyId: id } })
    await db.investment.deleteMany({ where: { companyId: id } })
    await db.investor.deleteMany({ where: { companyId: id } })

    // Accounts
    await db.account.deleteMany({ where: { companyId: id } })

    // Warehouses
    await db.warehouse.deleteMany({ where: { companyId: id } })

    // Currencies
    await db.currency.deleteMany({ where: { companyId: id } })

    // UOMs
    await db.unitOfMeasure.deleteMany({ where: { companyId: id } })

    // Categories
    await db.itemCategory.deleteMany({ where: { companyId: id } })

    // Company users
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
