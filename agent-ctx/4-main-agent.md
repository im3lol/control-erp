---
Task ID: 4
Agent: Main Agent
Task: Create Stock Transfer feature between warehouses/locations

Work Log:
- Created Stock Transfer list/create API at `src/app/api/inventory/stock-transfers/route.ts`:
  - GET: Lists stock transfers with fromWarehouse, toWarehouse names, and _count.lines
  - POST: Creates new stock transfer with lines, auto-generates transfer number (TR-XXXX), validates fromWarehouseId !== toWarehouseId, creates in transaction
- Created Stock Transfer detail API at `src/app/api/inventory/stock-transfers/[id]/route.ts`:
  - GET: Returns transfer with lines, items, and warehouse details
  - PUT: Handles confirm, cancel, and update actions
  - On confirm: Creates OUT StockMovement from source and IN StockMovement to destination, updates ItemBalances for both warehouses
  - On cancel (if CONFIRMED): Reverses stock movements by creating opposite OUT/IN movements and adjusting balances back
  - On cancel (if DRAFT): Simply sets status to CANCELLED
- Created Stock Transfer UI at `src/components/inventory/stock-transfers-list.tsx`:
  - Lists all transfers in a table with: number, date, from, to, line count, status, actions
  - Status badges with colors (DRAFT=slate, CONFIRMED=emerald, CANCELLED=red)
  - Create Transfer Dialog: warehouse selectors with hierarchy display, item/quantity lines, date picker, notes
  - View/Confirm Dialog: full transfer details with lines table, confirm and cancel buttons
  - Cancel confirmation AlertDialog for safety
  - Inline confirm/cancel buttons in table actions for DRAFT transfers
  - Cancel button for CONFIRMED transfers (with reversal)
- Updated page.tsx:
  - Added StockTransfersList import
  - Added 'stock-transfers' nav child under inventory with ArrowLeftRight icon
  - Added view title 'تحويلات المخزون'
  - Added renderContent case for 'stock-transfers'
- Ran db:push (schema already in sync), lint passed clean, dev server running

Stage Summary:
- Full Stock Transfer feature implemented with CRUD API and UI
- Transfer workflow: DRAFT → CONFIRMED (creates stock movements) or CANCELLED
- Confirming creates OUT/IN stock movements and updates item balances
- Cancelling a confirmed transfer reverses all stock movements
- Warehouse hierarchy display names using tree traversal
- Arabic RTL layout with emerald theme throughout
