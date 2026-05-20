import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function POST() {
  try {
    const counts = {
      company: 0,
      currencies: 0,
      uoms: 0,
      users: 0,
      companyUsers: 0,
      accounts: 0,
      warehouses: 0,
    }

    // ── 1. Seed Company ──────────────────────────────────────
    const company = await db.company.upsert({
      where: { id: 'company-default' },
      update: {},
      create: {
        id: 'company-default',
        nameAr: 'شركة الأمل للتجارة',
        nameEn: 'Al-Amal Trading Co.',
        legalName: 'شركة الأمل للتجارة ذ.م.م',
        address: 'القاهرة، مصر',
        phone: '+20 2 1234567',
        email: 'info@alamal-trading.com',
        taxNumber: 'TAX-001',
        vatRate: 14.0,
        status: 'active',
      },
    })
    counts.company++

    // ── 2. Seed Currencies ───────────────────────────────────
    const currencies = [
      { code: 'EGP', nameAr: 'جنيه مصري', nameEn: 'Egyptian Pound', symbol: 'ج.م', isBase: true, exchangeRate: 1.0 },
      { code: 'USD', nameAr: 'دولار أمريكي', nameEn: 'US Dollar', symbol: '$', isBase: false, exchangeRate: 48.5 },
      { code: 'EUR', nameAr: 'يورو', nameEn: 'Euro', symbol: '€', isBase: false, exchangeRate: 52.3 },
      { code: 'SAR', nameAr: 'ريال سعودي', nameEn: 'Saudi Riyal', symbol: 'ر.س', isBase: false, exchangeRate: 12.9 },
    ]

    for (const currency of currencies) {
      await db.currency.upsert({
        where: { companyId_code: { companyId: company.id, code: currency.code } },
        update: {},
        create: { ...currency, companyId: company.id },
      })
      counts.currencies++
    }

    // ── 3. Seed Units of Measure ─────────────────────────────
    const uoms = [
      { code: 'PCS', nameAr: 'قطعة', nameEn: 'Piece' },
      { code: 'KG', nameAr: 'كيلو', nameEn: 'Kilogram' },
      { code: 'LTR', nameAr: 'لتر', nameEn: 'Liter' },
      { code: 'MTR', nameAr: 'متر', nameEn: 'Meter' },
      { code: 'BOX', nameAr: 'صندوق', nameEn: 'Box' },
    ]

    for (const uom of uoms) {
      await db.unitOfMeasure.upsert({
        where: { companyId_code: { companyId: company.id, code: uom.code } },
        update: {},
        create: { ...uom, companyId: company.id },
      })
      counts.uoms++
    }

    // ── 4. Seed Admin User ───────────────────────────────────
    const adminUser = await db.user.upsert({
      where: { username: 'admin' },
      update: {},
      create: {
        username: 'admin',
        name: 'مدير النظام',
        email: 'admin@erp.com',
        password: Buffer.from('admin123').toString('base64'),
        role: 'super_admin',
        isActive: true,
      },
    })
    counts.users++

    // ── 5. Link Admin to Company ─────────────────────────────
    await db.companyUser.upsert({
      where: { companyId_userId: { companyId: company.id, userId: adminUser.id } },
      update: {},
      create: {
        companyId: company.id,
        userId: adminUser.id,
        role: 'admin',
        isActive: true,
      },
    })
    counts.companyUsers++

    // ── 6. Seed Default Warehouse ────────────────────────────
    await db.warehouse.upsert({
      where: { companyId_code: { companyId: company.id, code: 'WH-001' } },
      update: {},
      create: {
        companyId: company.id,
        code: 'WH-001',
        nameAr: 'المخزن الرئيسي',
        nameEn: 'Main Warehouse',
        location: 'القاهرة',
        manager: 'أحمد محمد',
        isActive: true,
      },
    })
    counts.warehouses++

    // ── 7. Seed Chart of Accounts ────────────────────────────
    const cId = company.id

    // Level 1: Main account types
    const account1 = await db.account.upsert({
      where: { companyId_code: { companyId: cId, code: '1' } },
      update: {},
      create: { companyId: cId, code: '1', nameAr: 'الأصول', nameEn: 'ASSET', type: 'ASSET', isLeaf: false },
    })

    const account2 = await db.account.upsert({
      where: { companyId_code: { companyId: cId, code: '2' } },
      update: {},
      create: { companyId: cId, code: '2', nameAr: 'الخصوم', nameEn: 'LIABILITY', type: 'LIABILITY', isLeaf: false },
    })

    const account3 = await db.account.upsert({
      where: { companyId_code: { companyId: cId, code: '3' } },
      update: {},
      create: { companyId: cId, code: '3', nameAr: 'حقوق الملكية', nameEn: 'EQUITY', type: 'EQUITY', isLeaf: false },
    })

    const account4 = await db.account.upsert({
      where: { companyId_code: { companyId: cId, code: '4' } },
      update: {},
      create: { companyId: cId, code: '4', nameAr: 'الإيرادات', nameEn: 'REVENUE', type: 'REVENUE', isLeaf: false },
    })

    const account5 = await db.account.upsert({
      where: { companyId_code: { companyId: cId, code: '5' } },
      update: {},
      create: { companyId: cId, code: '5', nameAr: 'المصروفات', nameEn: 'EXPENSE', type: 'EXPENSE', isLeaf: false },
    })

    counts.accounts += 5

    // Level 2: Sub-categories under Assets (1)
    const account11 = await db.account.upsert({
      where: { companyId_code: { companyId: cId, code: '11' } },
      update: {},
      create: { companyId: cId, code: '11', nameAr: 'أصول متداولة', nameEn: 'Current Assets', type: 'ASSET', parentId: account1.id, isLeaf: false },
    })

    const account12 = await db.account.upsert({
      where: { companyId_code: { companyId: cId, code: '12' } },
      update: {},
      create: { companyId: cId, code: '12', nameAr: 'أصول ثابتة', nameEn: 'Fixed Assets', type: 'ASSET', parentId: account1.id, isLeaf: false },
    })

    counts.accounts += 2

    // Level 3: Leaf accounts under Current Assets (11)
    await db.account.upsert({
      where: { companyId_code: { companyId: cId, code: '1101' } },
      update: {},
      create: { companyId: cId, code: '1101', nameAr: 'النقدية', nameEn: 'Cash', type: 'ASSET', parentId: account11.id, isLeaf: true },
    })

    await db.account.upsert({
      where: { companyId_code: { companyId: cId, code: '1102' } },
      update: {},
      create: { companyId: cId, code: '1102', nameAr: 'البنوك', nameEn: 'Banks', type: 'ASSET', parentId: account11.id, isLeaf: true },
    })

    await db.account.upsert({
      where: { companyId_code: { companyId: cId, code: '1103' } },
      update: {},
      create: { companyId: cId, code: '1103', nameAr: 'العملاء', nameEn: 'Customers', type: 'ASSET', parentId: account11.id, isLeaf: true },
    })

    await db.account.upsert({
      where: { companyId_code: { companyId: cId, code: '1104' } },
      update: {},
      create: { companyId: cId, code: '1104', nameAr: 'المخزون', nameEn: 'Inventory', type: 'ASSET', parentId: account11.id, isLeaf: true },
    })

    counts.accounts += 4

    // Level 2: Sub-categories under Liabilities (2)
    const account21 = await db.account.upsert({
      where: { companyId_code: { companyId: cId, code: '21' } },
      update: {},
      create: { companyId: cId, code: '21', nameAr: 'خصوم متداولة', nameEn: 'Current Liabilities', type: 'LIABILITY', parentId: account2.id, isLeaf: false },
    })

    counts.accounts++

    // Level 3: Leaf accounts under Current Liabilities (21)
    await db.account.upsert({
      where: { companyId_code: { companyId: cId, code: '2101' } },
      update: {},
      create: { companyId: cId, code: '2101', nameAr: 'الموردين', nameEn: 'Suppliers', type: 'LIABILITY', parentId: account21.id, isLeaf: true },
    })

    await db.account.upsert({
      where: { companyId_code: { companyId: cId, code: '2102' } },
      update: {},
      create: { companyId: cId, code: '2102', nameAr: 'الضريبة المستحقة', nameEn: 'Tax Payable', type: 'LIABILITY', parentId: account21.id, isLeaf: true },
    })

    counts.accounts += 2

    // Level 2: Accounts under Equity (3) - 31 is non-leaf for investor sub-accounts
    const account31 = await db.account.upsert({
      where: { companyId_code: { companyId: cId, code: '31' } },
      update: { isLeaf: false },
      create: { companyId: cId, code: '31', nameAr: 'رأس المال', nameEn: 'Capital', type: 'EQUITY', parentId: account3.id, isLeaf: false },
    })

    await db.account.upsert({
      where: { companyId_code: { companyId: cId, code: '32' } },
      update: {},
      create: { companyId: cId, code: '32', nameAr: 'الأرباح المحتجزة', nameEn: 'Retained Earnings', type: 'EQUITY', parentId: account3.id, isLeaf: true },
    })

    counts.accounts += 2

    // Investor accounts: 2104 under Current Liabilities (21) - profit payable parent
    await db.account.upsert({
      where: { companyId_code: { companyId: cId, code: '2104' } },
      update: {},
      create: { companyId: cId, code: '2104', nameAr: 'أرباح مستحقة للمستثمرين', nameEn: 'Investor Profit Payable', type: 'LIABILITY', parentId: account21.id, isLeaf: false },
    })

    counts.accounts++

    // Level 2: Leaf accounts under Revenue (4)
    await db.account.upsert({
      where: { companyId_code: { companyId: cId, code: '41' } },
      update: {},
      create: { companyId: cId, code: '41', nameAr: 'المبيعات', nameEn: 'Sales', type: 'REVENUE', parentId: account4.id, isLeaf: true },
    })

    await db.account.upsert({
      where: { companyId_code: { companyId: cId, code: '42' } },
      update: {},
      create: { companyId: cId, code: '42', nameAr: 'إيراد تسوية المخزون', nameEn: 'Inventory Adjustment Revenue', type: 'REVENUE', parentId: account4.id, isLeaf: true },
    })

    counts.accounts += 2

    // Level 2: Accounts under Expenses (5)
    await db.account.upsert({
      where: { companyId_code: { companyId: cId, code: '51' } },
      update: {},
      create: { companyId: cId, code: '51', nameAr: 'تكلفة البضاعة المباعة', nameEn: 'Cost of Goods Sold', type: 'EXPENSE', parentId: account5.id, isLeaf: true },
    })

    const account52 = await db.account.upsert({
      where: { companyId_code: { companyId: cId, code: '52' } },
      update: {},
      create: { companyId: cId, code: '52', nameAr: 'مصروفات تشغيل', nameEn: 'Operating Expenses', type: 'EXPENSE', parentId: account5.id, isLeaf: false },
    })

    await db.account.upsert({
      where: { companyId_code: { companyId: cId, code: '53' } },
      update: {},
      create: { companyId: cId, code: '53', nameAr: 'مصروف تسوية المخزون', nameEn: 'Inventory Adjustment Expense', type: 'EXPENSE', parentId: account5.id, isLeaf: true },
    })

    counts.accounts += 3

    // Level 3: Leaf accounts under Operating Expenses (52)
    await db.account.upsert({
      where: { companyId_code: { companyId: cId, code: '521' } },
      update: {},
      create: { companyId: cId, code: '521', nameAr: 'إيجار', nameEn: 'Rent', type: 'EXPENSE', parentId: account52.id, isLeaf: true },
    })

    await db.account.upsert({
      where: { companyId_code: { companyId: cId, code: '522' } },
      update: {},
      create: { companyId: cId, code: '522', nameAr: 'مرتبات', nameEn: 'Salaries', type: 'EXPENSE', parentId: account52.id, isLeaf: true },
    })

    counts.accounts += 2

    return NextResponse.json({
      message: 'Seed data created successfully',
      counts,
      companyId: company.id,
    })
  } catch (error) {
    console.error('Seed error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to seed data' },
      { status: 500 }
    )
  }
}
