import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

// GET /api/companies - List all companies
// Query params: userId (optional - filter by user access)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')

    let companies

    if (userId) {
      // Get companies the user has access to
      const companyUsers = await db.companyUser.findMany({
        where: { userId, isActive: true },
        include: {
          company: {
            select: {
              id: true,
              nameAr: true,
              nameEn: true,
              logo: true,
              taxNumber: true,
              status: true,
              vatRate: true,
              createdAt: true,
            },
          },
        },
        orderBy: { joinedAt: 'desc' },
      })
      companies = companyUsers.map((cu) => ({
        ...cu.company,
        role: cu.role,
      }))
    } else {
      // Super admin - get all companies
      companies = await db.company.findMany({
        select: {
          id: true,
          nameAr: true,
          nameEn: true,
          logo: true,
          taxNumber: true,
          status: true,
          vatRate: true,
          address: true,
          phone: true,
          email: true,
          fiscalYearStart: true,
          createdAt: true,
          _count: {
            select: {
              items: true,
              customers: true,
              suppliers: true,
              salesInvoices: true,
              purchaseInvoices: true,
              warehouses: true,
              journalEntries: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      })
    }

    return NextResponse.json(companies)
  } catch (error) {
    console.error('Get companies error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch companies' },
      { status: 500 }
    )
  }
}

// POST /api/companies - Create a new company with defaults
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      nameAr,
      nameEn,
      legalName,
      taxNumber,
      address,
      phone,
      email,
      baseCurrencyId,
      fiscalYearStart,
      vatRate,
      userId,
      template = 'trading',
    } = body

    if (!nameAr) {
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
        nameAr,
        nameEn: nameEn || nameAr,
        legalName,
        taxNumber,
        address,
        phone,
        email,
        baseCurrencyId,
        fiscalYearStart,
        vatRate: vatRate ?? 14.0,
        status: 'active',
      },
    })

    // 2. Create default Chart of Accounts
    await createChartOfAccounts(company.id, template)

    // 3. Create default warehouse
    await db.warehouse.create({
      data: {
        companyId: company.id,
        code: 'WH-001',
        nameAr: 'المخزن الرئيسي',
        nameEn: 'Main Warehouse',
        isActive: true,
      },
    })

    // 4. Create default currencies
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
    if (egpCurrency && !company.baseCurrencyId) {
      await db.company.update({
        where: { id: company.id },
        data: { baseCurrencyId: egpCurrency.id },
      })
    }

    // 5. Create default UOMs
    const uoms = [
      { companyId: company.id, code: 'PCS', nameAr: 'قطعة', nameEn: 'Piece' },
      { companyId: company.id, code: 'KG', nameAr: 'كيلو', nameEn: 'Kilogram' },
      { companyId: company.id, code: 'LTR', nameAr: 'لتر', nameEn: 'Liter' },
      { companyId: company.id, code: 'BOX', nameAr: 'صندوق', nameEn: 'Box' },
      { companyId: company.id, code: 'MTR', nameAr: 'متر', nameEn: 'Meter' },
    ]
    await db.unitOfMeasure.createMany({ data: uoms })

    // 6. Create CompanyUser linking the creator with admin role
    await db.companyUser.create({
      data: {
        companyId: company.id,
        userId,
        role: 'admin',
        isActive: true,
      },
    })

    return NextResponse.json(company, { status: 201 })
  } catch (error) {
    console.error('Create company error:', error)
    return NextResponse.json(
      { error: 'Failed to create company' },
      { status: 500 }
    )
  }
}

// Helper: Create chart of accounts based on template type
async function createChartOfAccounts(companyId: string, template: string) {
  // Level 1: Main account types
  const account1 = await db.account.create({
    data: { companyId, code: '1', nameAr: 'الأصول', nameEn: 'Assets', type: 'ASSET', isLeaf: false },
  })
  const account2 = await db.account.create({
    data: { companyId, code: '2', nameAr: 'الخصوم', nameEn: 'Liabilities', type: 'LIABILITY', isLeaf: false },
  })
  const account3 = await db.account.create({
    data: { companyId, code: '3', nameAr: 'حقوق الملكية', nameEn: 'Equity', type: 'EQUITY', isLeaf: false },
  })
  const account4 = await db.account.create({
    data: { companyId, code: '4', nameAr: 'الإيرادات', nameEn: 'Revenue', type: 'REVENUE', isLeaf: false },
  })
  const account5 = await db.account.create({
    data: { companyId, code: '5', nameAr: 'المصروفات', nameEn: 'Expenses', type: 'EXPENSE', isLeaf: false },
  })

  // Level 2: Sub-categories under Assets
  const account11 = await db.account.create({
    data: { companyId, code: '11', nameAr: 'أصول متداولة', nameEn: 'Current Assets', type: 'ASSET', parentId: account1.id, isLeaf: false },
  })
  const account12 = await db.account.create({
    data: { companyId, code: '12', nameAr: 'أصول ثابتة', nameEn: 'Fixed Assets', type: 'ASSET', parentId: account1.id, isLeaf: false },
  })
  const account13 = await db.account.create({
    data: { companyId, code: '13', nameAr: 'أصول أخرى', nameEn: 'Other Assets', type: 'ASSET', parentId: account1.id, isLeaf: false },
  })

  // Level 3: Current Asset accounts
  await db.account.createMany({
    data: [
      { companyId, code: '1101', nameAr: 'النقدية', nameEn: 'Cash', type: 'ASSET', parentId: account11.id, isLeaf: true },
      { companyId, code: '1102', nameAr: 'البنوك', nameEn: 'Banks', type: 'ASSET', parentId: account11.id, isLeaf: true },
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
  // Services: no inventory accounts

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

  // Level 3: Liability accounts
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
}
