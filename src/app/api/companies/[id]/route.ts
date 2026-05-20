import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

// GET /api/companies/[id] - Get company details
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const company = await db.company.findUnique({
      where: { id },
      include: {
        currencies: { orderBy: { code: 'asc' } },
        unitOfMeasures: { orderBy: { code: 'asc' } },
        warehouses: { orderBy: { code: 'asc' } },
        companyUsers: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                username: true,
                email: true,
                role: true,
              },
            },
          },
        },
        _count: {
          select: {
            accounts: true,
            items: true,
            customers: true,
            suppliers: true,
          },
        },
      },
    })

    if (!company) {
      return NextResponse.json(
        { error: 'الشركة غير موجودة' },
        { status: 404 }
      )
    }

    return NextResponse.json(company)
  } catch (error) {
    console.error('Get company error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch company' },
      { status: 500 }
    )
  }
}

// PUT /api/companies/[id] - Update company
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const {
      nameAr,
      nameEn,
      legalName,
      taxNumber,
      address,
      phone,
      email,
      logo,
      baseCurrencyId,
      fiscalYearStart,
      vatRate,
      status,
    } = body

    const existing = await db.company.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json(
        { error: 'الشركة غير موجودة' },
        { status: 404 }
      )
    }

    const updatedCompany = await db.company.update({
      where: { id },
      data: {
        ...(nameAr !== undefined && { nameAr }),
        ...(nameEn !== undefined && { nameEn }),
        ...(legalName !== undefined && { legalName }),
        ...(taxNumber !== undefined && { taxNumber }),
        ...(address !== undefined && { address }),
        ...(phone !== undefined && { phone }),
        ...(email !== undefined && { email }),
        ...(logo !== undefined && { logo }),
        ...(baseCurrencyId !== undefined && { baseCurrencyId }),
        ...(fiscalYearStart !== undefined && { fiscalYearStart }),
        ...(vatRate !== undefined && { vatRate }),
        ...(status !== undefined && { status }),
      },
    })

    return NextResponse.json(updatedCompany)
  } catch (error) {
    console.error('Update company error:', error)
    return NextResponse.json(
      { error: 'Failed to update company' },
      { status: 500 }
    )
  }
}

// DELETE /api/companies/[id] - Delete a company
// Returns related data counts so the UI can warn the user
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const existing = await db.company.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json(
        { error: 'الشركة غير موجودة' },
        { status: 404 }
      )
    }

    // Count related data
    const counts = {
      items: await db.item.count({ where: { companyId: id } }),
      customers: await db.customer.count({ where: { companyId: id } }),
      suppliers: await db.supplier.count({ where: { companyId: id } }),
      salesOrders: await db.salesOrder.count({ where: { companyId: id } }),
      purchaseOrders: await db.purchaseOrder.count({ where: { companyId: id } }),
      salesInvoices: await db.salesInvoice.count({ where: { companyId: id } }),
      purchaseInvoices: await db.purchaseInvoice.count({ where: { companyId: id } }),
      deliveryNotes: await db.deliveryNote.count({ where: { companyId: id } }),
      materialRequests: await db.materialRequest.count({ where: { companyId: id } }),
      purchaseReceipts: await db.purchaseReceipt.count({ where: { companyId: id } }),
      pickLists: await db.pickList.count({ where: { companyId: id } }),
      journalEntries: await db.journalEntry.count({ where: { companyId: id } }),
      warehouses: await db.warehouse.count({ where: { companyId: id } }),
      accounts: await db.account.count({ where: { companyId: id } }),
    }

    const totalRelated = Object.values(counts).reduce((s, c) => s + c, 0)

    // If there is related data, return counts so the UI can prompt the user
    if (totalRelated > 0) {
      return NextResponse.json({
        hasRelatedData: true,
        companyName: existing.nameAr,
        counts,
        totalRelated,
      }, { status: 409 })
    }

    // No related data – safe to delete
    await db.company.delete({ where: { id } })
    return NextResponse.json({ message: 'تم حذف الشركة بنجاح', deleted: true })
  } catch (error) {
    console.error('Delete company error:', error)
    return NextResponse.json(
      { error: 'Failed to delete company' },
      { status: 500 }
    )
  }
}
