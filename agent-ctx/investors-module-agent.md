# Task: Investors Module, Product Codes, and Product Images

## Summary
Created all 12 required files plus necessary fixes to existing code:

### Investors API Routes (6 files)
1. `/src/app/api/investors/route.ts` - GET/POST investors with auto code generation (INV-{seq}), auto account creation (3101-{seq} capital, 2104-{seq} profit payable)
2. `/src/app/api/investors/investments/route.ts` - GET/POST investments with journal entry creation
3. `/src/app/api/investors/distributions/route.ts` - GET/POST distributions with auto share calculation
4. `/src/app/api/investors/distributions/[id]/route.ts` - PUT distribute/pay actions with journal entries
5. `/src/app/api/investors/withdrawals/route.ts` - GET/POST withdrawals with journal entries for capital/profit types
6. `/src/app/api/investors/[id]/ledger/route.ts` - GET complete ledger with running balance

### Investors UI Components (3 files)
7. `/src/components/investors/investors-list.tsx` - Dashboard with summary cards, investor table with ownership %, progress bars, action buttons
8. `/src/components/investors/investor-ledger.tsx` - Investor detail with transaction history, running balance, action buttons
9. `/src/components/investors/distributions-list.tsx` - Distributions table with create, distribute, and pay actions

### Product Codes & Image API (2 files)
10. `/src/app/api/inventory/item-codes/route.ts` - CRUD for UPC/EAN/SKU/ASIN/FNSKU codes with uniqueness validation
11. `/src/app/api/inventory/items/image/route.ts` - Image upload with sharp resize to 400x400 webp

### Updated Items Component (1 file)
12. `/src/components/inventory/items-list.tsx` - Added product codes section, image upload, detail view dialog

### Additional Changes
- Updated `/src/lib/store.ts` - Added 'investors' to Module type
- Updated `/src/app/page.tsx` - Added investors navigation and rendering
- Updated `/src/app/api/seed/route.ts` - Made account 31 non-leaf, added 2104 account
- Fixed `/src/app/api/inventory/items/route.ts` - Fixed companyId and findUnique issues

## All APIs Tested Successfully
- Investors CRUD, investments, distributions, withdrawals, ledger - all working
- Item codes CRUD - working
- Items API - fixed and working
