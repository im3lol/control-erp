import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth-guard'

// GET /api/purchases/suppliers - List suppliers with filters for a company
export async function GET(request: NextRequest) {
  try {
    const user = await requirePermission('purchases.view', request)
    const { searchParams } = new URL(request.url)
    const companyId = searchParams.get('companyId')
    if (!companyId) {
      return NextResponse.json({ error: 'companyId is required' }, { status: 400 })
    }

    const search = searchParams.get('search')
    const activeOnly = searchParams.get('activeOnly')

    const where: Record<string, unknown> = { companyId }

    if (search) {
      where.OR = [
        { nameAr: { contains: search } },
        { nameEn: { contains: search } },
        { code: { contains: search } },
        { phone: { contains: search } },
      ]
    }

    if (activeOnly === 'true') {
      where.isActive = true
    }

    const suppliers = await db.supplier.findMany({
      where,
      orderBy: { code: 'asc' },
    })

    return NextResponse.json(suppliers)
  } catch (error) {
    if (error instanceof Error && (error.message.includes('غير مصرح') || error.message.includes('صلاحية'))) {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }
    console.error('Get suppliers error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch suppliers' },
      { status: 500 }
    )
  }
}

// POST /api/purchases/suppliers - Create supplier
export async function POST(request: NextRequest) {
  try {
    const user = await requirePermission('purchases.create', request)
    const body = await request.json()
    const { companyId, code, nameAr, nameEn, phone, email, address, paymentTerms, isActive } = body

    if (!companyId) {
      return NextResponse.json({ error: 'companyId is required' }, { status: 400 })
    }

    if (!nameAr) {
      return NextResponse.json(
        { error: 'الاسم بالعربية مطلوب' },
        { status: 400 }
      )
    }

    // Auto-generate code if not provided: S-{seq}
    let supplierCode = code
    if (!supplierCode) {
      const lastSupplier = await db.supplier.findFirst({
        where: { companyId, code: { startsWith: 'S-' } },
        orderBy: { code: 'desc' },
        select: { code: true },
      })

      let seq = 1
      if (lastSupplier) {
        const lastSeq = parseInt(lastSupplier.code.split('-').pop() || '0', 10)
        seq = lastSeq + 1
      }
      supplierCode = `S-${String(seq).padStart(4, '0')}`
    }

    // Check if code already exists within company
    const existing = await db.supplier.findUnique({
      where: { companyId_code: { companyId, code: supplierCode } },
    })
    if (existing) {
      return NextResponse.json(
        { error: `كود المورد "${supplierCode}" مستخدم بالفعل` },
        { status: 409 }
      )
    }

    const supplier = await db.supplier.create({
      data: {
        companyId,
        code: supplierCode,
        nameAr,
        nameEn: nameEn || null,
        phone: phone || null,
        email: email || null,
        address: address || null,
        paymentTerms: paymentTerms ?? 30,
        isActive: isActive ?? true,
      },
    })

    return NextResponse.json(supplier, { status: 201 })
  } catch (error) {
    if (error instanceof Error && (error.message.includes('غير مصرح') || error.message.includes('صلاحية'))) {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }
    console.error('Create supplier error:', error)
    return NextResponse.json(
      { error: 'Failed to create supplier' },
      { status: 500 }
    )
  }
}

// PUT /api/purchases/suppliers - Update supplier
export async function PUT(request: NextRequest) {
  try {
    const user = await requirePermission('purchases.edit', request)
    const body = await request.json()
    const { companyId, id, code, nameAr, nameEn, phone, email, address, paymentTerms, isActive } = body

    if (!companyId) {
      return NextResponse.json({ error: 'companyId is required' }, { status: 400 })
    }

    if (!id) {
      return NextResponse.json(
        { error: 'id is required' },
        { status: 400 }
      )
    }

    const existing = await db.supplier.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json(
        { error: 'المورد غير موجود' },
        { status: 404 }
      )
    }

    // Verify the supplier belongs to the company
    if (existing.companyId !== companyId) {
      return NextResponse.json(
        { error: 'Supplier does not belong to this company' },
        { status: 403 }
      )
    }

    // If code is being changed, check for uniqueness within company
    if (code && code !== existing.code) {
      const codeExists = await db.supplier.findUnique({
        where: { companyId_code: { companyId, code } },
      })
      if (codeExists) {
        return NextResponse.json(
          { error: `كود المورد "${code}" مستخدم بالفعل` },
          { status: 409 }
        )
      }
    }

    const supplier = await db.supplier.update({
      where: { id },
      data: {
        ...(code !== undefined && { code }),
        ...(nameAr !== undefined && { nameAr }),
        ...(nameEn !== undefined && { nameEn: nameEn || null }),
        ...(phone !== undefined && { phone: phone || null }),
        ...(email !== undefined && { email: email || null }),
        ...(address !== undefined && { address: address || null }),
        ...(paymentTerms !== undefined && { paymentTerms }),
        ...(isActive !== undefined && { isActive }),
      },
    })

    return NextResponse.json(supplier)
  } catch (error) {
    if (error instanceof Error && (error.message.includes('غير مصرح') || error.message.includes('صلاحية'))) {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }
    console.error('Update supplier error:', error)
    return NextResponse.json(
      { error: 'Failed to update supplier' },
      { status: 500 }
    )
  }
}

// DELETE /api/purchases/suppliers - Delete supplier
export async function DELETE(request: NextRequest) {
  try {
    const user = await requirePermission('purchases.edit', request)
    const body = await request.json()
    const { companyId, id } = body

    if (!companyId) {
      return NextResponse.json({ error: 'companyId is required' }, { status: 400 })
    }

    if (!id) {
      return NextResponse.json(
        { error: 'id is required' },
        { status: 400 }
      )
    }

    const existing = await db.supplier.findUnique({
      where: { id },
      include: { _count: { select: { purchaseInvoices: true } } },
    })
    if (!existing) {
      return NextResponse.json(
        { error: 'المورد غير موجود' },
        { status: 404 }
      )
    }

    // Verify the supplier belongs to the company
    if (existing.companyId !== companyId) {
      return NextResponse.json(
        { error: 'Supplier does not belong to this company' },
        { status: 403 }
      )
    }

    // Prevent deletion if supplier has purchase invoices
    if (existing._count.purchaseInvoices > 0) {
      return NextResponse.json(
        { error: `لا يمكن حذف المورد: لديه ${existing._count.purchaseInvoices} فاتورة شراء` },
        { status: 400 }
      )
    }

    await db.supplier.delete({ where: { id } })

    return NextResponse.json({ message: 'تم حذف المورد بنجاح' })
  } catch (error) {
    if (error instanceof Error && (error.message.includes('غير مصرح') || error.message.includes('صلاحية'))) {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }
    console.error('Delete supplier error:', error)
    return NextResponse.json(
      { error: 'Failed to delete supplier' },
      { status: 500 }
    )
  }
}
