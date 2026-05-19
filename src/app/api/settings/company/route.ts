import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

// GET /api/settings/company - Get company info (first record)
export async function GET() {
  try {
    const company = await db.company.findFirst()

    if (!company) {
      return NextResponse.json(
        { error: 'No company found. Please seed the database first.' },
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
    const { nameAr, nameEn, address, phone, email, taxNumber, logo, baseCurrencyId, fiscalYearStart } = body

    // Get the first (and likely only) company record
    const existingCompany = await db.company.findFirst()

    if (!existingCompany) {
      return NextResponse.json(
        { error: 'No company found. Please seed the database first.' },
        { status: 404 }
      )
    }

    const updatedCompany = await db.company.update({
      where: { id: existingCompany.id },
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
