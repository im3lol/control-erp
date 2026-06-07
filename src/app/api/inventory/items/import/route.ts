import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth-guard'
import * as XLSX from 'xlsx'

// POST /api/inventory/items/import - Import items from xlsx file
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

    const validCostMethods = ['FIFO', 'WAC']
    let successCount = 0
    let errorCount = 0
    const errors: string[] = []

    // Get existing data for reference resolution
    const [existingItems, existingCategories, existingUoms] = await Promise.all([
      db.item.findMany({ where: { companyId }, select: { id: true, code: true } }),
      db.category.findMany({ where: { companyId }, select: { id: true, code: true } }),
      db.uOM.findMany({ where: { companyId }, select: { id: true, code: true } }),
    ])

    const itemCodeToIdMap = new Map(existingItems.map((i) => [i.code, i.id]))
    const categoryCodeToIdMap = new Map(existingCategories.map((c) => [c.code, c.id]))
    const uomCodeToIdMap = new Map(existingUoms.map((u) => [u.code, u.id]))

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      const rowNum = i + 2 // Excel row number (1-indexed + header)

      const code = String(row['code'] || '').trim()
      const nameAr = String(row['nameAr'] || '').trim() || null
      const nameEn = String(row['nameEn'] || '').trim() || null
      const categoryCode = String(row['categoryCode'] || '').trim()
      const uomCode = String(row['uomCode'] || '').trim()
      const costMethod = String(row['costMethod'] || 'FIFO').trim().toUpperCase()
      const sellPrice = parseFloat(row['sellPrice']) || 0
      const minStock = parseFloat(row['minStock']) || 0
      const maxStock = row['maxStock'] ? parseFloat(row['maxStock']) : null
      const description = String(row['description'] || '').trim() || null
      const isActive = row['isActive'] !== undefined ? Boolean(row['isActive']) : true

      if (!code) {
        errors.push(`Row ${rowNum}: code is required`)
        errorCount++
        continue
      }

      // Check for duplicate code in this import or existing data
      if (itemCodeToIdMap.has(code)) {
        errors.push(`Row ${rowNum}: code "${code}" already exists`)
        errorCount++
        continue
      }

      if (!validCostMethods.includes(costMethod)) {
        errors.push(`Row ${rowNum}: invalid costMethod "${costMethod}", must be one of: ${validCostMethods.join(', ')}`)
        errorCount++
        continue
      }

      // Resolve category code
      let categoryId: string | null = null
      if (categoryCode) {
        categoryId = categoryCodeToIdMap.get(categoryCode) || null
        if (!categoryId) {
          errors.push(`Row ${rowNum}: category code "${categoryCode}" not found`)
          errorCount++
          continue
        }
      }

      // Resolve UOM code
      let uomId: string | null = null
      if (uomCode) {
        uomId = uomCodeToIdMap.get(uomCode) || null
        if (!uomId) {
          errors.push(`Row ${rowNum}: UOM code "${uomCode}" not found`)
          errorCount++
          continue
        }
      }

      try {
        const item = await db.item.create({
          data: {
            companyId,
            code,
            nameAr,
            nameEn,
            categoryId,
            uomId,
            costMethod,
            sellPrice,
            minStock,
            maxStock,
            description,
            isActive,
          },
        })
        itemCodeToIdMap.set(code, item.id)
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
    console.error('Import items error:', error)
    return NextResponse.json(
      { error: 'Failed to import items' },
      { status: 500 }
    )
  }
}
