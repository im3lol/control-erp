# Task 4-5: Add barcode scanning, name search, and document linking shortcuts

## Task
Add barcode scanning, name search, and document linking shortcuts to PO/SO/PI form pages

## Work Done

### 1. Purchase Order Form Page (`purchase-order-form-page.tsx`)
- Added `ScanLine`, `Search`, `PackageCheck` imports from lucide-react
- Added `setEditingDocId` from store
- Added state: `barcodeInput`, `searchQuery`
- Added `filteredItems` computed value (filters items by Arabic name, English name, or code when query > 1 char)
- Added `handleBarcodeScan` - on Enter key, searches `/api/inventory/item-codes?companyId=X&code=Y`, adds new line with found item
- Added `handleAddItemById` - adds new line with selected item from search dropdown
- Added barcode input + name search dropdown above the lines table (only shown when editable)
- Added "تحويل لإذن استلام" (Convert to Purchase Receipt) button when status is CONFIRMED
  - Stores data in localStorage key `pendingPurchaseReceipt`
  - Navigates to inventory module, `purchase-receipt-form` view

### 2. Sales Order Form Page (`sales-order-form-page.tsx`)
- Added `ScanLine`, `Search`, `Truck` imports from lucide-react
- Added `setEditingDocId` from store
- Added state: `barcodeInput`, `searchQuery`
- Added same barcode scanning + name search pattern as PO
- Added "تحويل لإذن صرف" (Convert to Delivery Note) button when status is CONFIRMED
  - Stores data in localStorage key `pendingDeliveryNote`
  - Navigates to inventory module, `delivery-note-form` view

### 3. Purchase Invoice Form Page (`purchase-invoice-form-page.tsx`)
- Added `ScanLine`, `Search`, `PackageCheck` imports from lucide-react
- Added state: `barcodeInput`, `searchQuery`, `purchaseReceipts`, `selectedReceiptId`, `loadingReceipts`
- Added same barcode scanning + name search pattern
- Added "استدعاء أذون استلام" (Call Purchase Receipts) section with:
  - Fetch uninvoiced receipts button (fetches all, filters client-side for CONFIRMED + no purchaseInvoiceId)
  - Select dropdown to choose a receipt
  - On selection: fetches receipt details, auto-fills supplierId/warehouseId, populates invoice lines

## Lint
- All changes pass lint cleanly
