import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-guard'

// GET /api/inventory/items/[id]/stats - Get related record counts for a specific item
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth(request)
    const { id } = await params
    const { searchParams } = new URL(request.url)
    const companyId = searchParams.get('companyId')

    if (!companyId) {
      return NextResponse.json({ error: 'companyId is required' }, { status: 400 })
    }

    // Verify the item exists and belongs to the company
    const item = await db.item.findUnique({
      where: { id },
    })
    if (!item || item.companyId !== companyId) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 })
    }

    // Count unique sales invoices containing this item
    const salesLines = await db.salesInvoiceLine.findMany({
      where: { itemId: id },
      select: { salesInvoiceId: true },
    })
    const salesCount = new Set(salesLines.map((l) => l.salesInvoiceId)).size

    // Count unique purchase invoices containing this item
    const purchaseLines = await db.purchaseInvoiceLine.findMany({
      where: { itemId: id },
      select: { purchaseInvoiceId: true },
    })
    const purchaseCount = new Set(purchaseLines.map((l) => l.purchaseInvoiceId)).size

    // Count all stock movements for this item
    const movementCount = await db.stockMovement.count({
      where: { itemId: id },
    })

    // Count adjustment movements (type = ADJ, ADJ+, ADJ-)
    const adjustmentCount = await db.stockMovement.count({
      where: {
        itemId: id,
        type: { in: ['ADJ', 'ADJ+', 'ADJ-'] },
      },
    })

    return NextResponse.json({
      salesCount,
      purchaseCount,
      movementCount,
      adjustmentCount,
    })
  } catch (error) {
    if (error instanceof Error && (error.message.includes('غير مصرح') || error.message.includes('صلاحية'))) {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }
    console.error('Get item stats error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch item stats' },
      { status: 500 }
    )
  }
}
