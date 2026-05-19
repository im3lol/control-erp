import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function POST() {
  try {
    const counts = {
      company: 0,
      currencies: 0,
      uoms: 0,
      users: 0,
      accounts: 0,
    }

    // 1. Seed Company
    const company = await db.company.upsert({
      where: { id: 'company-default' },
      update: {},
      create: {
        id: 'company-default',
        nameAr: 'شركة الأمل للتجارة',
        nameEn: 'Al-Amal Trading Co.',
      },
    })
    counts.company++

    // 2. Seed Currencies
    const currencies = [
      { code: 'EGP', nameAr: 'جنيه مصري', nameEn: 'Egyptian Pound', symbol: 'ج.م', isBase: true, exchangeRate: 1.0 },
      { code: 'USD', nameAr: 'دولار أمريكي', nameEn: 'US Dollar', symbol: '$', isBase: false, exchangeRate: 48.5 },
      { code: 'EUR', nameAr: 'يورو', nameEn: 'Euro', symbol: '€', isBase: false, exchangeRate: 52.3 },
      { code: 'SAR', nameAr: 'ريال سعودي', nameEn: 'Saudi Riyal', symbol: 'ر.س', isBase: false, exchangeRate: 12.9 },
    ]

    for (const currency of currencies) {
      await db.currency.upsert({
        where: { code: currency.code },
        update: {},
        create: currency,
      })
      counts.currencies++
    }

    // 3. Seed Units of Measure
    const uoms = [
      { code: 'PCS', nameAr: 'قطعة', nameEn: 'Piece' },
      { code: 'KG', nameAr: 'كيلو', nameEn: 'Kilogram' },
      { code: 'LTR', nameAr: 'لتر', nameEn: 'Liter' },
      { code: 'MTR', nameAr: 'متر', nameEn: 'Meter' },
      { code: 'BOX', nameAr: 'صندوق', nameEn: 'Box' },
    ]

    for (const uom of uoms) {
      await db.unitOfMeasure.upsert({
        where: { code: uom.code },
        update: {},
        create: uom,
      })
      counts.uoms++
    }

    // 4. Seed Admin User
    await db.user.upsert({
      where: { username: 'admin' },
      update: {},
      create: {
        username: 'admin',
        name: 'مدير النظام',
        password: Buffer.from('admin123').toString('base64'),
        role: 'admin',
      },
    })
    counts.users++

    // 5. Seed Chart of Accounts
    // Level 1: Main account types
    const account1 = await db.account.upsert({
      where: { code: '1' },
      update: {},
      create: { code: '1', nameAr: 'الأصول', nameEn: 'ASSET', type: 'ASSET', isLeaf: false },
    })

    const account2 = await db.account.upsert({
      where: { code: '2' },
      update: {},
      create: { code: '2', nameAr: 'الخصوم', nameEn: 'LIABILITY', type: 'LIABILITY', isLeaf: false },
    })

    const account3 = await db.account.upsert({
      where: { code: '3' },
      update: {},
      create: { code: '3', nameAr: 'حقوق الملكية', nameEn: 'EQUITY', type: 'EQUITY', isLeaf: false },
    })

    const account4 = await db.account.upsert({
      where: { code: '4' },
      update: {},
      create: { code: '4', nameAr: 'الإيرادات', nameEn: 'REVENUE', type: 'REVENUE', isLeaf: false },
    })

    const account5 = await db.account.upsert({
      where: { code: '5' },
      update: {},
      create: { code: '5', nameAr: 'المصروفات', nameEn: 'EXPENSE', type: 'EXPENSE', isLeaf: false },
    })

    counts.accounts += 5

    // Level 2: Sub-categories under Assets (1)
    const account11 = await db.account.upsert({
      where: { code: '11' },
      update: {},
      create: { code: '11', nameAr: 'أصول متداولة', nameEn: 'Current Assets', type: 'ASSET', parentId: account1.id, isLeaf: false },
    })

    const account12 = await db.account.upsert({
      where: { code: '12' },
      update: {},
      create: { code: '12', nameAr: 'أصول ثابتة', nameEn: 'Fixed Assets', type: 'ASSET', parentId: account1.id, isLeaf: false },
    })

    counts.accounts += 2

    // Level 3: Leaf accounts under Current Assets (11)
    await db.account.upsert({
      where: { code: '1101' },
      update: {},
      create: { code: '1101', nameAr: 'النقدية', nameEn: 'Cash', type: 'ASSET', parentId: account11.id, isLeaf: true },
    })

    await db.account.upsert({
      where: { code: '1102' },
      update: {},
      create: { code: '1102', nameAr: 'البنوك', nameEn: 'Banks', type: 'ASSET', parentId: account11.id, isLeaf: true },
    })

    await db.account.upsert({
      where: { code: '1103' },
      update: {},
      create: { code: '1103', nameAr: 'العملاء', nameEn: 'Customers', type: 'ASSET', parentId: account11.id, isLeaf: true },
    })

    await db.account.upsert({
      where: { code: '1104' },
      update: {},
      create: { code: '1104', nameAr: 'المخزون', nameEn: 'Inventory', type: 'ASSET', parentId: account11.id, isLeaf: true },
    })

    counts.accounts += 4

    // Level 2: Sub-categories under Liabilities (2)
    const account21 = await db.account.upsert({
      where: { code: '21' },
      update: {},
      create: { code: '21', nameAr: 'خصوم متداولة', nameEn: 'Current Liabilities', type: 'LIABILITY', parentId: account2.id, isLeaf: false },
    })

    counts.accounts++

    // Level 3: Leaf accounts under Current Liabilities (21)
    await db.account.upsert({
      where: { code: '2101' },
      update: {},
      create: { code: '2101', nameAr: 'الموردين', nameEn: 'Suppliers', type: 'LIABILITY', parentId: account21.id, isLeaf: true },
    })

    await db.account.upsert({
      where: { code: '2102' },
      update: {},
      create: { code: '2102', nameAr: 'الضريبة المستحقة', nameEn: 'Tax Payable', type: 'LIABILITY', parentId: account21.id, isLeaf: true },
    })

    counts.accounts += 2

    // Level 2: Leaf accounts under Equity (3)
    await db.account.upsert({
      where: { code: '31' },
      update: {},
      create: { code: '31', nameAr: 'رأس المال', nameEn: 'Capital', type: 'EQUITY', parentId: account3.id, isLeaf: true },
    })

    await db.account.upsert({
      where: { code: '32' },
      update: {},
      create: { code: '32', nameAr: 'الأرباح المحتجزة', nameEn: 'Retained Earnings', type: 'EQUITY', parentId: account3.id, isLeaf: true },
    })

    counts.accounts += 2

    // Level 2: Leaf accounts under Revenue (4)
    await db.account.upsert({
      where: { code: '41' },
      update: {},
      create: { code: '41', nameAr: 'المبيعات', nameEn: 'Sales', type: 'REVENUE', parentId: account4.id, isLeaf: true },
    })

    await db.account.upsert({
      where: { code: '42' },
      update: {},
      create: { code: '42', nameAr: 'إيراد تسوية المخزون', nameEn: 'Inventory Adjustment Revenue', type: 'REVENUE', parentId: account4.id, isLeaf: true },
    })

    counts.accounts += 2

    // Level 2: Accounts under Expenses (5)
    await db.account.upsert({
      where: { code: '51' },
      update: {},
      create: { code: '51', nameAr: 'تكلفة البضاعة المباعة', nameEn: 'Cost of Goods Sold', type: 'EXPENSE', parentId: account5.id, isLeaf: true },
    })

    const account52 = await db.account.upsert({
      where: { code: '52' },
      update: {},
      create: { code: '52', nameAr: 'مصروفات تشغيل', nameEn: 'Operating Expenses', type: 'EXPENSE', parentId: account5.id, isLeaf: false },
    })

    await db.account.upsert({
      where: { code: '53' },
      update: {},
      create: { code: '53', nameAr: 'مصروف تسوية المخزون', nameEn: 'Inventory Adjustment Expense', type: 'EXPENSE', parentId: account5.id, isLeaf: true },
    })

    counts.accounts += 3

    // Level 3: Leaf accounts under Operating Expenses (52)
    await db.account.upsert({
      where: { code: '521' },
      update: {},
      create: { code: '521', nameAr: 'إيجار', nameEn: 'Rent', type: 'EXPENSE', parentId: account52.id, isLeaf: true },
    })

    await db.account.upsert({
      where: { code: '522' },
      update: {},
      create: { code: '522', nameAr: 'مرتبات', nameEn: 'Salaries', type: 'EXPENSE', parentId: account52.id, isLeaf: true },
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
