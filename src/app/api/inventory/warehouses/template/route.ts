import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth-guard'
import * as XLSX from 'xlsx'

// GET /api/inventory/warehouses/template - Download xlsx template
export async function GET(request: NextRequest) {
  try {
    const user = await requirePermission('inventory.view', request)

    const headers = ['code', 'nameAr', 'nameEn', 'type', 'parentCode', 'location', 'manager']
    const sampleRow = ['WH-001', 'المخزن الرئيسي', 'Main Warehouse', 'WAREHOUSE', '', 'الرياض', 'أحمد']

    const worksheet = XLSX.utils.aoa_to_sheet([headers, sampleRow])

    // Set column widths
    worksheet['!cols'] = [
      { wch: 15 }, // code
      { wch: 25 }, // nameAr
      { wch: 25 }, // nameEn
      { wch: 15 }, // type
      { wch: 15 }, // parentCode
      { wch: 20 }, // location
      { wch: 15 }, // manager
    ]

    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Warehouses')

    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' })

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="warehouses-template.xlsx"',
      },
    })
  } catch (error) {
    if (error instanceof Error && (error.message.includes('غير مصرح') || error.message.includes('صلاحية'))) {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }
    console.error('Download template error:', error)
    return NextResponse.json(
      { error: 'Failed to download template' },
      { status: 500 }
    )
  }
}
