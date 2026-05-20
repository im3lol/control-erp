import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

// GET /api/settings/company - Get company info by companyId
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const companyId = searchParams.get('companyId')
    if (!companyId) {
      return NextResponse.json({ error: 'companyId is required' }, { status: 400 })
    }

    const company = await db.company.findUnique({
      where: { id: companyId },
    })

    if (!company) {
      return NextResponse.json(
        { error: 'Company not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(company)
  } catch (error) {
    console.error('Get company error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch company data' },
      { status: 500 }
    )
  }
}

// PUT /api/settings/company - Update company info
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { companyId, nameAr, nameEn, address, phone, email, taxNumber, logo, baseCurrencyId, fiscalYearStart, vatRate, status } = body

    if (!companyId) {
      return NextResponse.json({ error: 'companyId is required' }, { status: 400 })
    }

    const existingCompany = await db.company.findUnique({
      where: { id: companyId },
    })

    if (!existingCompany) {
      return NextResponse.json(
        { error: 'Company not found' },
        { status: 404 }
      )
    }

    const updatedCompany = await db.company.update({
      where: { id: companyId },
      data: {
        ...(nameAr !== undefined && { nameAr }),
        ...(nameEn !== undefined && { nameEn }),
        ...(address !== undefined && { address }),
        ...(phone !== undefined && { phone }),
        ...(email !== undefined && { email }),
        ...(taxNumber !== undefined && { taxNumber }),
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
      { error: 'Failed to update company data' },
      { status: 500 }
    )
  }
}
