import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth-guard'

// Build a nested tree from flat warehouse list
function buildTree(warehouses: any[]): any[] {
  const map = new Map<string, any>()
  const roots: any[] = []

  // First pass: create map entries
  for (const wh of warehouses) {
    map.set(wh.id, { ...wh, children: [] })
  }

  // Second pass: build tree
  for (const wh of warehouses) {
    const node = map.get(wh.id)!
    if (wh.parentId && map.has(wh.parentId)) {
      map.get(wh.parentId)!.children.push(node)
    } else {
      roots.push(node)
    }
  }

  return roots
}

// GET /api/inventory/warehouses - List all warehouses for a company
export async function GET(request: NextRequest) {
  try {
    const user = await requirePermission('inventory.view', request)
    const { searchParams } = new URL(request.url)
    const companyId = searchParams.get('companyId')
    const view = searchParams.get('view') // 'tree' or 'list' (default: list)

    if (!companyId) {
      return NextResponse.json({ error: 'companyId is required' }, { status: 400 })
    }

    const warehouses = await db.warehouse.findMany({
      where: { companyId },
      include: {
        parent: {
          select: { id: true, code: true, nameAr: true, type: true },
        },
        _count: {
          select: {
            itemBalances: true,
            stockMovements: true,
            children: true,
          },
        },
      },
      orderBy: { code: 'asc' },
    })

    if (view === 'tree') {
      const tree = buildTree(warehouses)
      return NextResponse.json(tree)
    }

    return NextResponse.json(warehouses)
  } catch (error) {
    if (error instanceof Error && (error.message.includes('غير مصرح') || error.message.includes('صلاحية'))) {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }
    console.error('Get warehouses error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch warehouses' },
      { status: 500 }
    )
  }
}

// POST /api/inventory/warehouses - Create warehouse
export async function POST(request: NextRequest) {
  try {
    const user = await requirePermission('inventory.create', request)
    const body = await request.json()
    const { companyId, code, nameAr, nameEn, type, parentId, location, manager, isActive } = body

    if (!companyId) {
      return NextResponse.json({ error: 'companyId is required' }, { status: 400 })
    }

    if (!code) {
      return NextResponse.json(
        { error: 'code is required' },
        { status: 400 }
      )
    }

    // Check if warehouse code already exists within the company
    const existing = await db.warehouse.findUnique({
      where: { companyId_code: { companyId, code } },
    })
    if (existing) {
      return NextResponse.json(
        { error: `Warehouse with code "${code}" already exists in this company` },
        { status: 409 }
      )
    }

    // Validate parentId if provided
    if (parentId) {
      const parent = await db.warehouse.findUnique({ where: { id: parentId } })
      if (!parent || parent.companyId !== companyId) {
        return NextResponse.json(
          { error: 'Invalid parent location' },
          { status: 400 }
        )
      }
    }

    const warehouse = await db.warehouse.create({
      data: {
        companyId,
        code,
        nameAr: nameAr || '',
        nameEn,
        type: type || 'WAREHOUSE',
        parentId: parentId || null,
        location,
        manager,
        isActive: isActive ?? true,
      },
      include: {
        parent: {
          select: { id: true, code: true, nameAr: true, type: true },
        },
      },
    })

    return NextResponse.json(warehouse, { status: 201 })
  } catch (error) {
    if (error instanceof Error && (error.message.includes('غير مصرح') || error.message.includes('صلاحية'))) {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }
    console.error('Create warehouse error:', error)
    return NextResponse.json(
      { error: 'Failed to create warehouse' },
      { status: 500 }
    )
  }
}
