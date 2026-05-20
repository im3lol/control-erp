import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

// POST /api/companies/setup - Full setup wizard endpoint
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      company: companyData,
      template = 'trading',
      warehouses = [],
      banks = [],
      cashBoxes = [],
      userId,
    } = body as {
      company: {
        nameAr: string
        nameEn?: string
        legalName?: string
        taxNumber?: string
        address?: string
        phone?: string
        email?: string
        baseCurrencyId?: string
        fiscalYearStart?: string
        vatRate?: number
      }
      template: 'trading' | 'manufacturing' | 'services'
      warehouses: Array<{ nameAr: string; location?: string; manager?: string }>
      banks: Array<{ name: string; accountNo?: string; branch?: string }>
      cashBoxes: Array<{ name: string }>
      userId: string
    }

    if (!companyData?.nameAr) {
      return NextResponse.json(
        { error: 'اسم الشركة بالعربية مطلوب' },
        { status: 400 }
      )
    }

    if (!userId) {
      return NextResponse.json(
        { error: 'معرف المستخدم مطلوب' },
        { status: 400 }
      )
    }

    // 1. Create Company record
    const company = await db.company.create({
      data: {
        nameAr: companyData.nameAr,
        nameEn: companyData.nameEn || companyData.nameAr,
        legalName: companyData.legalName,
        taxNumber: companyData.taxNumber,
        address: companyData.address,
        phone: companyData.phone,
        email: companyData.email,
        fiscalYearStart: companyData.fiscalYearStart,
        vatRate: companyData.vatRate ?? 14.0,
        status: 'active',
      },
    })

    // 2. Create CompanyUser link
    await db.companyUser.create({
      data: {
        companyId: company.id,
        userId,
        role: 'admin',
        isActive: true,
      },
    })

    // 3. Create full chart of accounts based on template
    const accountMap = await createChartOfAccountsFull(company.id, template)

    // 4. Bank accounts → each creates an Account under البنوك (1102) with code like 1102-01
    if (banks.length > 0 && accountMap['1102']) {
      const bankParentId = accountMap['1102']
      // Update البنوك to be non-leaf since it will have children
      await db.account.update({
        where: { id: bankParentId },
        data: { isLeaf: false },
      })
      for (let i = 0; i < banks.length; i++) {
        const bank = banks[i]
        const bankCode = `1102-${String(i + 1).padStart(2, '0')}`
        await db.account.create({
          data: {
            companyId: company.id,
            code: bankCode,
            nameAr: bank.name,
            nameEn: bank.name,
            type: 'ASSET',
            parentId: bankParentId,
            isLeaf: true,
          },
        })
      }
    }

    // 5. Cash boxes → each creates an Account under النقدية (1101) with code like 1101-01
    if (cashBoxes.length > 0 && accountMap['1101']) {
      const cashParentId = accountMap['1101']
      // Update النقدية to be non-leaf since it will have children
      await db.account.update({
        where: { id: cashParentId },
        data: { isLeaf: false },
      })
      for (let i = 0; i < cashBoxes.length; i++) {
        const cashBox = cashBoxes[i]
        const cashCode = `1101-${String(i + 1).padStart(2, '0')}`
        await db.account.create({
          data: {
            companyId: company.id,
            code: cashCode,
            nameAr: cashBox.name,
            nameEn: cashBox.name,
            type: 'ASSET',
            parentId: cashParentId,
            isLeaf: true,
          },
        })
      }
    }

    // 6. Create warehouses
    const defaultWarehouse = {
      nameAr: 'المخزن الرئيسي',
      location: '',
      manager: '',
    }
    const allWarehouses = [defaultWarehouse, ...warehouses]
    for (let i = 0; i < allWarehouses.length; i++) {
      const wh = allWarehouses[i]
      await db.warehouse.create({
        data: {
          companyId: company.id,
          code: `WH-${String(i + 1).padStart(3, '0')}`,
          nameAr: wh.nameAr,
          nameEn: wh.nameAr,
          location: wh.location || null,
          manager: wh.manager || null,
          isActive: true,
        },
      })
    }

    // 7. Create default currencies
    const currencies = [
      { companyId: company.id, code: 'EGP', nameAr: 'جنيه مصري', nameEn: 'Egyptian Pound', symbol: 'ج.م', isBase: true, exchangeRate: 1.0 },
      { companyId: company.id, code: 'USD', nameAr: 'دولار أمريكي', nameEn: 'US Dollar', symbol: '$', isBase: false, exchangeRate: 48.5 },
      { companyId: company.id, code: 'EUR', nameAr: 'يورو', nameEn: 'Euro', symbol: '€', isBase: false, exchangeRate: 52.3 },
      { companyId: company.id, code: 'SAR', nameAr: 'ريال سعودي', nameEn: 'Saudi Riyal', symbol: 'ر.س', isBase: false, exchangeRate: 12.9 },
    ]
    await db.currency.createMany({ data: currencies })

    // Set base currency reference
    const egpCurrency = await db.currency.findFirst({
      where: { companyId: company.id, code: 'EGP' },
    })
    if (egpCurrency) {
      await db.company.update({
        where: { id: company.id },
        data: { baseCurrencyId: egpCurrency.id },
      })
    }

    // 8. Create default UOMs
    const uoms = [
      { companyId: company.id, code: 'PCS', nameAr: 'قطعة', nameEn: 'Piece' },
      { companyId: company.id, code: 'KG', nameAr: 'كيلو', nameEn: 'Kilogram' },
      { companyId: company.id, code: 'LTR', nameAr: 'لتر', nameEn: 'Liter' },
      { companyId: company.id, code: 'BOX', nameAr: 'صندوق', nameEn: 'Box' },
      { companyId: company.id, code: 'MTR', nameAr: 'متر', nameEn: 'Meter' },
    ]
    await db.unitOfMeasure.createMany({ data: uoms })

    // Return the full company with details
    const result = await db.company.findUnique({
      where: { id: company.id },
      include: {
        currencies: true,
        unitOfMeasures: true,
        warehouses: true,
        _count: { select: { accounts: true } },
      },
    })

    return NextResponse.json(result, { status: 201 })
  } catch (error) {
    console.error('Setup company error:', error)
    return NextResponse.json(
      { error: 'Failed to setup company' },
      { status: 500 }
    )
  }
}

// Helper: Create full chart of accounts and return a map of code -> id
async function createChartOfAccountsFull(
  companyId: string,
  template: string
): Promise<Record<string, string>> {
  const map: Record<string, string> = {}

  // Level 1: Main account types
  const account1 = await db.account.create({
    data: { companyId, code: '1', nameAr: 'الأصول', nameEn: 'Assets', type: 'ASSET', isLeaf: false },
  })
  map['1'] = account1.id

  const account2 = await db.account.create({
    data: { companyId, code: '2', nameAr: 'الخصوم', nameEn: 'Liabilities', type: 'LIABILITY', isLeaf: false },
  })
  map['2'] = account2.id

  const account3 = await db.account.create({
    data: { companyId, code: '3', nameAr: 'حقوق الملكية', nameEn: 'Equity', type: 'EQUITY', isLeaf: false },
  })
  map['3'] = account3.id

  const account4 = await db.account.create({
    data: { companyId, code: '4', nameAr: 'الإيرادات', nameEn: 'Revenue', type: 'REVENUE', isLeaf: false },
  })
  map['4'] = account4.id

  const account5 = await db.account.create({
    data: { companyId, code: '5', nameAr: 'المصروفات', nameEn: 'Expenses', type: 'EXPENSE', isLeaf: false },
  })
  map['5'] = account5.id

  // Level 2: Sub-categories under Assets
  const account11 = await db.account.create({
    data: { companyId, code: '11', nameAr: 'أصول متداولة', nameEn: 'Current Assets', type: 'ASSET', parentId: account1.id, isLeaf: false },
  })
  map['11'] = account11.id

  const account12 = await db.account.create({
    data: { companyId, code: '12', nameAr: 'أصول ثابتة', nameEn: 'Fixed Assets', type: 'ASSET', parentId: account1.id, isLeaf: false },
  })
  map['12'] = account12.id

  const account13 = await db.account.create({
    data: { companyId, code: '13', nameAr: 'أصول أخرى', nameEn: 'Other Assets', type: 'ASSET', parentId: account1.id, isLeaf: false },
  })
  map['13'] = account13.id

  // Level 3: Current Asset accounts (common to all)
  const cashAccount = await db.account.create({
    data: { companyId, code: '1101', nameAr: 'النقدية', nameEn: 'Cash', type: 'ASSET', parentId: account11.id, isLeaf: true },
  })
  map['1101'] = cashAccount.id

  const bankAccount = await db.account.create({
    data: { companyId, code: '1102', nameAr: 'البنوك', nameEn: 'Banks', type: 'ASSET', parentId: account11.id, isLeaf: true },
  })
  map['1102'] = bankAccount.id

  await db.account.createMany({
    data: [
      { companyId, code: '1103', nameAr: 'العملاء', nameEn: 'Customers', type: 'ASSET', parentId: account11.id, isLeaf: true },
      { companyId, code: '1105', nameAr: 'أوراق القبض', nameEn: 'Notes Receivable', type: 'ASSET', parentId: account11.id, isLeaf: true },
      { companyId, code: '1106', nameAr: 'مصروفات مقدمة', nameEn: 'Prepaid Expenses', type: 'ASSET', parentId: account11.id, isLeaf: true },
    ],
  })

  // Inventory accounts based on template
  if (template === 'trading') {
    await db.account.create({
      data: { companyId, code: '1104', nameAr: 'المخزون', nameEn: 'Inventory', type: 'ASSET', parentId: account11.id, isLeaf: true },
    })
  } else if (template === 'manufacturing') {
    const inventoryAccount = await db.account.create({
      data: { companyId, code: '1104', nameAr: 'المخزون', nameEn: 'Inventory', type: 'ASSET', parentId: account11.id, isLeaf: false },
    })
    await db.account.createMany({
      data: [
        { companyId, code: '110401', nameAr: 'المواد الخام', nameEn: 'Raw Materials', type: 'ASSET', parentId: inventoryAccount.id, isLeaf: true },
        { companyId, code: '110402', nameAr: 'تحت التشغيل', nameEn: 'Work in Progress', type: 'ASSET', parentId: inventoryAccount.id, isLeaf: true },
        { companyId, code: '110403', nameAr: 'البضاعة التامة', nameEn: 'Finished Goods', type: 'ASSET', parentId: inventoryAccount.id, isLeaf: true },
        { companyId, code: '110404', nameAr: 'مستلزمات التصنيع', nameEn: 'Manufacturing Supplies', type: 'ASSET', parentId: inventoryAccount.id, isLeaf: true },
      ],
    })
  }

  // Fixed Asset accounts
  await db.account.createMany({
    data: [
      { companyId, code: '1201', nameAr: 'الأثاث والتجهيزات', nameEn: 'Furniture & Fixtures', type: 'ASSET', parentId: account12.id, isLeaf: true },
      { companyId, code: '1202', nameAr: 'السيارات', nameEn: 'Vehicles', type: 'ASSET', parentId: account12.id, isLeaf: true },
      { companyId, code: '1203', nameAr: 'الأجهزة والمعدات', nameEn: 'Equipment', type: 'ASSET', parentId: account12.id, isLeaf: true },
    ],
  })

  // Level 2: Liabilities sub-categories
  const account21 = await db.account.create({
    data: { companyId, code: '21', nameAr: 'خصوم متداولة', nameEn: 'Current Liabilities', type: 'LIABILITY', parentId: account2.id, isLeaf: false },
  })

  await db.account.createMany({
    data: [
      { companyId, code: '2101', nameAr: 'الموردين', nameEn: 'Suppliers', type: 'LIABILITY', parentId: account21.id, isLeaf: true },
      { companyId, code: '2102', nameAr: 'الضريبة المستحقة', nameEn: 'Tax Payable', type: 'LIABILITY', parentId: account21.id, isLeaf: true },
      { companyId, code: '2103', nameAr: 'أوراق الدفع', nameEn: 'Notes Payable', type: 'LIABILITY', parentId: account21.id, isLeaf: true },
      { companyId, code: '2104', nameAr: 'إيرادات مقدمة', nameEn: 'Unearned Revenue', type: 'LIABILITY', parentId: account21.id, isLeaf: true },
    ],
  })

  // Equity accounts
  await db.account.createMany({
    data: [
      { companyId, code: '31', nameAr: 'رأس المال', nameEn: 'Capital', type: 'EQUITY', parentId: account3.id, isLeaf: true },
      { companyId, code: '32', nameAr: 'الأرباح المحتجزة', nameEn: 'Retained Earnings', type: 'EQUITY', parentId: account3.id, isLeaf: true },
      { companyId, code: '33', nameAr: 'أرباح العام الحالي', nameEn: 'Current Year Earnings', type: 'EQUITY', parentId: account3.id, isLeaf: true },
    ],
  })

  // Revenue accounts based on template
  if (template === 'services') {
    await db.account.createMany({
      data: [
        { companyId, code: '41', nameAr: 'إيرادات الخدمات', nameEn: 'Service Revenue', type: 'REVENUE', parentId: account4.id, isLeaf: true },
        { companyId, code: '42', nameAr: 'إيرادات أخرى', nameEn: 'Other Revenue', type: 'REVENUE', parentId: account4.id, isLeaf: true },
        { companyId, code: '43', nameAr: 'خصم مكتسب', nameEn: 'Discount Received', type: 'REVENUE', parentId: account4.id, isLeaf: true },
      ],
    })
  } else {
    await db.account.createMany({
      data: [
        { companyId, code: '41', nameAr: 'المبيعات', nameEn: 'Sales', type: 'REVENUE', parentId: account4.id, isLeaf: true },
        { companyId, code: '42', nameAr: 'إيرادات أخرى', nameEn: 'Other Revenue', type: 'REVENUE', parentId: account4.id, isLeaf: true },
        { companyId, code: '43', nameAr: 'خصم مكتسب', nameEn: 'Discount Received', type: 'REVENUE', parentId: account4.id, isLeaf: true },
        { companyId, code: '44', nameAr: 'إيراد تسوية المخزون', nameEn: 'Inventory Adjustment Revenue', type: 'REVENUE', parentId: account4.id, isLeaf: true },
      ],
    })
  }

  // Expense accounts based on template
  if (template === 'trading') {
    const account52 = await db.account.create({
      data: { companyId, code: '52', nameAr: 'مصروفات تشغيل', nameEn: 'Operating Expenses', type: 'EXPENSE', parentId: account5.id, isLeaf: false },
    })
    await db.account.createMany({
      data: [
        { companyId, code: '51', nameAr: 'تكلفة البضاعة المباعة', nameEn: 'Cost of Goods Sold', type: 'EXPENSE', parentId: account5.id, isLeaf: true },
        { companyId, code: '521', nameAr: 'إيجار', nameEn: 'Rent', type: 'EXPENSE', parentId: account52.id, isLeaf: true },
        { companyId, code: '522', nameAr: 'مرتبات', nameEn: 'Salaries', type: 'EXPENSE', parentId: account52.id, isLeaf: true },
        { companyId, code: '523', nameAr: 'مرافق', nameEn: 'Utilities', type: 'EXPENSE', parentId: account52.id, isLeaf: true },
        { companyId, code: '53', nameAr: 'مصروف تسوية المخزون', nameEn: 'Inventory Adjustment Expense', type: 'EXPENSE', parentId: account5.id, isLeaf: true },
        { companyId, code: '54', nameAr: 'خصم مسموح', nameEn: 'Discount Allowed', type: 'EXPENSE', parentId: account5.id, isLeaf: true },
      ],
    })
  } else if (template === 'manufacturing') {
    const account52 = await db.account.create({
      data: { companyId, code: '52', nameAr: 'مصروفات تشغيل', nameEn: 'Operating Expenses', type: 'EXPENSE', parentId: account5.id, isLeaf: false },
    })
    const account55 = await db.account.create({
      data: { companyId, code: '55', nameAr: 'تكلفة الإنتاج', nameEn: 'Production Cost', type: 'EXPENSE', parentId: account5.id, isLeaf: false },
    })
    await db.account.createMany({
      data: [
        { companyId, code: '51', nameAr: 'تكلفة البضاعة المباعة', nameEn: 'Cost of Goods Sold', type: 'EXPENSE', parentId: account5.id, isLeaf: true },
        { companyId, code: '521', nameAr: 'إيجار', nameEn: 'Rent', type: 'EXPENSE', parentId: account52.id, isLeaf: true },
        { companyId, code: '522', nameAr: 'مرتبات', nameEn: 'Salaries', type: 'EXPENSE', parentId: account52.id, isLeaf: true },
        { companyId, code: '523', nameAr: 'مرافق', nameEn: 'Utilities', type: 'EXPENSE', parentId: account52.id, isLeaf: true },
        { companyId, code: '53', nameAr: 'مصروف تسوية المخزون', nameEn: 'Inventory Adjustment Expense', type: 'EXPENSE', parentId: account5.id, isLeaf: true },
        { companyId, code: '54', nameAr: 'خصم مسموح', nameEn: 'Discount Allowed', type: 'EXPENSE', parentId: account5.id, isLeaf: true },
        { companyId, code: '551', nameAr: 'مواد خام مستهلكة', nameEn: 'Raw Materials Consumed', type: 'EXPENSE', parentId: account55.id, isLeaf: true },
        { companyId, code: '552', nameAr: 'أجور مباشرة', nameEn: 'Direct Labor', type: 'EXPENSE', parentId: account55.id, isLeaf: true },
        { companyId, code: '553', nameAr: 'مصروفات تصنيع', nameEn: 'Manufacturing Overhead', type: 'EXPENSE', parentId: account55.id, isLeaf: true },
      ],
    })
  } else {
    // Services
    const account52 = await db.account.create({
      data: { companyId, code: '52', nameAr: 'مصروفات تشغيل', nameEn: 'Operating Expenses', type: 'EXPENSE', parentId: account5.id, isLeaf: false },
    })
    await db.account.createMany({
      data: [
        { companyId, code: '51', nameAr: 'تكلفة الخدمات', nameEn: 'Cost of Services', type: 'EXPENSE', parentId: account5.id, isLeaf: true },
        { companyId, code: '521', nameAr: 'إيجار', nameEn: 'Rent', type: 'EXPENSE', parentId: account52.id, isLeaf: true },
        { companyId, code: '522', nameAr: 'مرتبات', nameEn: 'Salaries', type: 'EXPENSE', parentId: account52.id, isLeaf: true },
        { companyId, code: '523', nameAr: 'مرافق', nameEn: 'Utilities', type: 'EXPENSE', parentId: account52.id, isLeaf: true },
        { companyId, code: '54', nameAr: 'خصم مسموح', nameEn: 'Discount Allowed', type: 'EXPENSE', parentId: account5.id, isLeaf: true },
      ],
    })
  }

  return map
}
