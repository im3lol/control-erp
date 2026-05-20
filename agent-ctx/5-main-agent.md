# Task 5: Add related item counts and clickable navigation in Item detail view

## Agent: Main Agent
## Status: COMPLETED

## Changes Made:

### 1. Store (`src/lib/store.ts`)
- Added `itemFilter: string | null` state field
- Added `setItemFilter: (filter: string | null) => void` action
- Used to pass item ID filter between modules when navigating from item detail

### 2. Items API (`src/app/api/inventory/items/route.ts`)
- Extended `_count` select to include `salesLines`, `purchaseLines`, `stockMovements`
- Added `_stats` object in response with:
  - `salesCount`: from `_count.salesLines`
  - `purchaseCount`: from `_count.purchaseLines`
  - `movementCount`: from `_count.stockMovements`
  - `adjustmentCount`: separate query counting stockMovements where type in ['ADJ', 'ADJ+', 'ADJ-']

### 3. New Stats API (`src/app/api/inventory/items/[id]/stats/route.ts`)
- GET endpoint returning counts for a specific item:
  - `salesCount`: unique sales invoice IDs containing this item
  - `purchaseCount`: unique purchase invoice IDs containing this item
  - `movementCount`: all stock movements for this item
  - `adjustmentCount`: stock movements where type in ['ADJ', 'ADJ+', 'ADJ-']

### 4. Items List Component (`src/components/inventory/items-list.tsx`)
- Added `ItemStats` interface with salesCount, purchaseCount, movementCount, adjustmentCount
- Added `_stats?: ItemStats` to Item interface
- Added new Lucide icon imports: FileText, Receipt, ArrowLeftRight, Sliders
- Added store access for `setModule`, `setView`, `setItemFilter`
- Added `handleNavigateToRelated` function that:
  1. Closes the detail dialog
  2. Sets the itemFilter in store
  3. Navigates to the appropriate module/view
- Added "السجلات المرتبطة" (Related Records) section in Item Detail Dialog with 4 clickable cards:
  - مبيعات (Sales) → navigates to sales/sales-invoices
  - مشتريات (Purchases) → navigates to purchases/purchase-invoices
  - حركة (Movements) → navigates to inventory/stock-movements
  - تسوية (Adjustments) → navigates to inventory/stock-movements
- Cards use emerald color theme with icons and count display

### 5. Sales Invoices API (`src/app/api/sales/invoices/route.ts`)
- Added `itemId` query parameter support
- When `itemId` is provided, filters invoices using `where.lines = { some: { itemId } }`

### 6. Purchase Invoices API (`src/app/api/purchases/invoices/route.ts`)
- Added `itemId` query parameter support
- Same filtering approach as sales invoices

### 7. Stock Movements API (`src/app/api/inventory/stock-movements/route.ts`)
- Already had `itemId` filter support - no changes needed to API

### 8. Sales Invoices Component (`src/components/sales/sales-invoices-list.tsx`)
- Added `itemFilter` and `setItemFilter` from store
- Added `itemId` param to fetchInvoices when `itemFilter` is set
- Added `itemFilter` to useCallback dependency array
- Added clear filter chip (emerald-themed) showing "تصفية حسب الصنف" with X button

### 9. Purchase Invoices Component (`src/components/purchases/purchase-invoices-list.tsx`)
- Same pattern as sales invoices
- Added `itemFilter`, `setItemFilter`, filter chip, and API integration

### 10. Stock Movements Component (`src/components/inventory/stock-movements-list.tsx`)
- Added `itemFilter` and `setItemFilter` from store
- Added `itemId` query param to fetchMovements when `itemFilter` is set
- Added useEffect to refetch when `itemFilter` changes
- Added clear filter chip

## Lint: PASSED (no errors)
