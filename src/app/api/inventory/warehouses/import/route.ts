import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth-guard'
import * as XLSX from 'xlsx'

// POST /api/inventory/warehouses/import - Import warehouses from xlsx file
export async function POST(request: NextRequest) {
  try {
    const user = await requirePermission('inventory.create', request)
    const formData = await request.formData()
    const companyId = formData.get('companyId') as string
    const file = formData.get('file') as File

    if (!companyId) {
      return NextResponse.json({ error: 'companyId is required' }, { status: 400 })
    }

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const workbook = XLSX.read(buffer, { type: 'buffer' })
    const sheetName = workbook.SheetNames[0]
    const worksheet = workbook.Sheets[sheetName]
    const rows = XLSX.utils.sheet_to_json<Record<string, any>>(worksheet)

    if (rows.length === 0) {
      return NextResponse.json({ error: 'Excel file is empty' }, { status: 400 })
    }

    const validTypes = ['WAREHOUSE', 'ZONE', 'RACK', 'SHELF', 'BOX']
    let successCount = 0
    let errorCount = 0
    const errors: string[] = []

    // First pass: create all records (resolve parent references by code)
    // Get existing warehouses for parent code resolution
    const existingWarehouses = await db.warehouse.findMany({
      where: { companyId },
      select: { id: true, code: true },
    })
    const codeToIdMap = new Map(existingWarehouses.map((w) => [w.code, w.id]))

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      const rowNum = i + 2 // Excel row number (1-indexed + header)

      const code = String(row['code'] || '').trim()
      const nameAr = String(row['nameAr'] || '').trim()
      const nameEn = String(row['nameEn'] || '').trim() || null
      const type = String(row['type'] || 'WAREHOUSE').trim().toUpperCase()
      const parentCode = String(row['parentCode'] || '').trim()
      const location = String(row['location'] || '').trim() || null
      const manager = String(row['manager'] || '').trim() || null

      if (!code) {
        errors.push(`Row ${rowNum}: code is required`)
        errorCount++
        continue
      }

      if (!validTypes.includes(type)) {
        errors.push(`Row ${rowNum}: invalid type "${type}", must be one of: ${validTypes.join(', ')}`)
        errorCount++
        continue
      }

      // Check for duplicate code in this import or existing data
      if (codeToIdMap.has(code)) {
        errors.push(`Row ${rowNum}: code "${code}" already exists`)
        errorCount++
        continue
      }

      // Resolve parent code
      let parentId: string | null = null
      if (parentCode) {
        parentId = codeToIdMap.get(parentCode) || null
        if (!parentId) {
          errors.push(`Row ${rowNum}: parent code "${parentCode}" not found`)
          errorCount++
          continue
        }
      }

      try {
        const warehouse = await db.warehouse.create({
          data: {
            companyId,
            code,
            nameAr: nameAr || code,
            nameEn,
            type,
            parentId,
            location,
            manager,
            isActive: true,
          },
        })
        codeToIdMap.set(code, warehouse.id)
        successCount++
      } catch (err: any) {
        errors.push(`Row ${rowNum}: ${err.message || 'Failed to create record'}`)
        errorCount++
      }
    }

    return NextResponse.json({
      successCount,
      errorCount,
      errors: errors.slice(0, 50), // Limit error messages
      totalRows: rows.length,
    })
  } catch (error) {
    if (error instanceof Error && (error.message.includes('غير مصرح') || error.message.includes('صلاحية'))) {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }
    console.error('Import warehouses error:', error)
    return NextResponse.json(
      { error: 'Failed to import warehouses' },
      { status: 500 }
    )
  }
}
