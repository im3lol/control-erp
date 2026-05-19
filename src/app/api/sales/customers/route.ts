import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

// GET /api/sales/customers - List customers with filters
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search')
    const activeOnly = searchParams.get('activeOnly')

    const where: Record<string, unknown> = {}

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

    const customers = await db.customer.findMany({
      where,
      orderBy: { code: 'asc' },
    })

    return NextResponse.json(customers)
  } catch (error) {
    console.error('Get customers error:', error)
    return NextResponse.json(
      { error: 'فشل في تحميل العملاء' },
      { status: 500 }
    )
  }
}

// POST /api/sales/customers - Create customer
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      code,
      nameAr,
      nameEn,
      phone,
      email,
      address,
      creditLimit,
      paymentTerms,
      isActive,
    } = body

    if (!nameAr || !nameAr.trim()) {
      return NextResponse.json(
        { error: 'الاسم بالعربية مطلوب' },
        { status: 400 }
      )
    }

    // Auto-generate code if not provided
    let customerCode = code
    if (!customerCode || !customerCode.trim()) {
      const lastCustomer = await db.customer.findFirst({
        where: { code: { startsWith: 'C-' } },
        orderBy: { code: 'desc' },
        select: { code: true },
      })
      let seq = 1
      if (lastCustomer) {
        const lastSeq = parseInt(lastCustomer.code.replace('C-', ''), 10)
        if (!isNaN(lastSeq)) seq = lastSeq + 1
      }
      customerCode = `C-${String(seq).padStart(4, '0')}`
    }

    // Check code uniqueness
    const existing = await db.customer.findUnique({ where: { code: customerCode } })
    if (existing) {
      return NextResponse.json(
        { error: `كود العميل "${customerCode}" مستخدم بالفعل` },
        { status: 409 }
      )
    }

    const customer = await db.customer.create({
      data: {
        code: customerCode,
        nameAr: nameAr.trim(),
        nameEn: nameEn?.trim() || null,
        phone: phone?.trim() || null,
        email: email?.trim() || null,
        address: address?.trim() || null,
        creditLimit: creditLimit ?? 0,
        paymentTerms: paymentTerms ?? 30,
        isActive: isActive ?? true,
      },
    })

    return NextResponse.json(customer, { status: 201 })
  } catch (error) {
    console.error('Create customer error:', error)
    return NextResponse.json(
      { error: 'فشل في إنشاء العميل' },
      { status: 500 }
    )
  }
}

// PUT /api/sales/customers - Update customer
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      id,
      code,
      nameAr,
      nameEn,
      phone,
      email,
      address,
      creditLimit,
      paymentTerms,
      isActive,
    } = body

    if (!id) {
      return NextResponse.json(
        { error: 'معرف العميل مطلوب' },
        { status: 400 }
      )
    }

    const existing = await db.customer.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json(
        { error: 'العميل غير موجود' },
        { status: 404 }
      )
    }

    // If code is being changed, check uniqueness
    if (code && code !== existing.code) {
      const codeExists = await db.customer.findUnique({ where: { code } })
      if (codeExists) {
        return NextResponse.json(
          { error: `كود العميل "${code}" مستخدم بالفعل` },
          { status: 409 }
        )
      }
    }

    const customer = await db.customer.update({
      where: { id },
      data: {
        ...(code !== undefined && { code }),
        ...(nameAr !== undefined && { nameAr }),
        ...(nameEn !== undefined && { nameEn }),
        ...(phone !== undefined && { phone }),
        ...(email !== undefined && { email }),
        ...(address !== undefined && { address }),
        ...(creditLimit !== undefined && { creditLimit }),
        ...(paymentTerms !== undefined && { paymentTerms }),
        ...(isActive !== undefined && { isActive }),
      },
    })

    return NextResponse.json(customer)
  } catch (error) {
    console.error('Update customer error:', error)
    return NextResponse.json(
      { error: 'فشل في تحديث العميل' },
      { status: 500 }
    )
  }
}

// DELETE /api/sales/customers - Delete customer
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json()
    const { id } = body

    if (!id) {
      return NextResponse.json(
        { error: 'معرف العميل مطلوب' },
        { status: 400 }
      )
    }

    const existing = await db.customer.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json(
        { error: 'العميل غير موجود' },
        { status: 404 }
      )
    }

    // Check if customer has sales invoices
    const invoiceCount = await db.salesInvoice.count({
      where: { customerId: id },
    })
    if (invoiceCount > 0) {
      return NextResponse.json(
        { error: `لا يمكن حذف العميل لوجود ${invoiceCount} فاتورة بيع مرتبطة` },
        { status: 400 }
      )
    }

    await db.customer.delete({ where: { id } })

    return NextResponse.json({ message: 'تم حذف العميل بنجاح' })
  } catch (error) {
    console.error('Delete customer error:', error)
    return NextResponse.json(
      { error: 'فشل في حذف العميل' },
      { status: 500 }
    )
  }
}
