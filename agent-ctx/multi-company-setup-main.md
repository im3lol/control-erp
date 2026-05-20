# Task: Multi-Company System & Setup Wizard

## Agent: Main Developer
## Task ID: multi-company-setup

## Summary

Created the Multi-Company system and Setup Wizard for the Arabic RTL ERP system. This includes 3 API route files and 2 React components, plus store updates and page integration.

## Files Created/Modified

### 1. Store Update: `/home/z/my-project/src/lib/store.ts`
- Added `CompanyInfo` interface with `id`, `nameAr`, `nameEn`, `role?`, `logo?`, `vatRate?`
- Added `addCompany` action to the store
- Made `role` optional in CompanyInfo to support both auth-companies and setup endpoints

### 2. API Route: `/home/z/my-project/src/app/api/companies/route.ts`
- **GET**: List all companies (supports `userId` query param to filter by user access)
- **POST**: Create a new company with:
  - Company record
  - Default Chart of Accounts based on template type (trading/manufacturing/services)
  - Default warehouse "المخزن الرئيسي"
  - Default currencies: EGP (base), USD, EUR, SAR
  - Default UOMs: PCS, KG, LTR, BOX, MTR
  - CompanyUser linking the creator with admin role

### 3. API Route: `/home/z/my-project/src/app/api/companies/[id]/route.ts`
- **GET**: Get company details with currencies, UOMs, warehouses, users, and counts
- **PUT**: Update company fields

### 4. API Route: `/home/z/my-project/src/app/api/companies/setup/route.ts`
- **POST**: Full setup wizard endpoint that accepts:
  - Company data (nameAr, nameEn, legalName, taxNumber, address, phone, email, vatRate, fiscalYearStart)
  - Template type (trading/manufacturing/services)
  - Warehouses list
  - Banks list → creates accounts under البنوك (1102)
  - Cash boxes list → creates accounts under النقدية (1101)
  - userId
- Creates: Company, CompanyUser, full chart of accounts, bank/cash accounts, warehouses, currencies, UOMs

### 5. Component: `/home/z/my-project/src/components/companies/setup-wizard.tsx`
- Full-screen 7-step wizard:
  1. بيانات الشركة - Company info form
  2. شجرة الحسابات - Template selection (3 cards with descriptions)
  3. المخازن - Dynamic warehouse list (add/remove)
  4. البنوك والصندوق - Dynamic bank and cash box lists
  5. وحدات القياس - Pre-filled defaults + custom
  6. إعدادات الضرائب - VAT rate, tax number
  7. مراجعة وتأكيد - Summary with sections
- Step progress indicator with check marks
- Back/Next navigation buttons
- POST to /api/companies/setup on submit
- Adds company to store on success

### 6. Component: `/home/z/my-project/src/components/companies/company-switcher.tsx`
- Dropdown with Building2 icon
- Shows current company name
- List of user's companies with check mark on current
- "إنشاء شركة جديدة" option at bottom (opens setup wizard)
- Switches currentCompanyId on selection

### 7. Page Integration: `/home/z/my-project/src/app/page.tsx`
- Imported CompanySwitcher and SetupWizard
- Replaced basic company dropdown with CompanySwitcher component
- Added setupWizardOpen state
- Added SetupWizard component to the layout

## Chart of Accounts Templates

### Trading Template
- Full current assets (cash, banks, customers, inventory, notes receivable, prepaid)
- Fixed assets (furniture, vehicles, equipment)
- Current liabilities (suppliers, tax payable, notes payable, unearned revenue)
- Equity (capital, retained earnings, current year earnings)
- Revenue (sales, other revenue, discount received, inventory adj revenue)
- Expenses (COGS, operating expenses, inventory adj expense, discount allowed)

### Manufacturing Template
- Same as trading plus:
- Inventory sub-accounts (raw materials, WIP, finished goods, manufacturing supplies)
- Production cost accounts (raw materials consumed, direct labor, manufacturing overhead)

### Services Template
- No inventory accounts
- Service revenue instead of sales
- Cost of services instead of COGS

## Testing Results
- All API endpoints tested and working via curl
- Lint passes cleanly
- Dev server running on port 3000
