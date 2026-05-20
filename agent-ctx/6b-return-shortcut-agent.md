# Task 6b - Return Shortcut Agent

## Summary
Added "إنشاء مرتجع" (Create Return) shortcut buttons to 6 existing document form pages. The shortcut only appears when the document status is CONFIRMED.

## Files Modified

### Form Pages (6 files)
1. `/home/z/my-project/src/components/purchases/purchase-order-form-page.tsx`
   - Added Undo2 import, handleCreateReturn function, shortcut in shortcutActions array
   - sourceType: 'purchaseOrder', localStorage key: 'pendingPurchaseReturn'

2. `/home/z/my-project/src/components/purchases/purchase-invoice-form-page.tsx`
   - Added Undo2 import, handleCreateReturn function, new shortcutActions prop
   - sourceType: 'purchaseInvoice', localStorage key: 'pendingPurchaseReturn'

3. `/home/z/my-project/src/components/inventory/purchase-receipt-form-page.tsx`
   - Added Undo2 import, handleCreateReturn function, shortcut added alongside existing
   - sourceType: 'purchaseReceipt', localStorage key: 'pendingPurchaseReturn', unitPrice: 0

4. `/home/z/my-project/src/components/sales/sales-order-form-page.tsx`
   - Added Undo2 import, handleCreateReturn function, shortcut added alongside existing
   - sourceType: 'salesOrder', localStorage key: 'pendingSalesReturn', warehouseId: ''

5. `/home/z/my-project/src/components/sales/sales-invoice-form-page.tsx`
   - Added Undo2 import, handleCreateReturn function, new shortcutActions prop
   - sourceType: 'salesInvoice', localStorage key: 'pendingSalesReturn', warehouseId: ''

6. `/home/z/my-project/src/components/inventory/delivery-note-form-page.tsx`
   - Added Undo2 import, handleCreateReturn function, shortcut added alongside existing
   - sourceType: 'deliveryNote', localStorage key: 'pendingSalesReturn', unitPrice: 0

### Infrastructure (2 files)
7. `/home/z/my-project/src/app/page.tsx`
   - Added imports for PurchaseReturnFormPage and SalesReturnFormPage
   - Added switch cases for 'purchase-return-form' and 'sales-return-form'
   - Added view title mappings for both return form views

8. `/home/z/my-project/src/lib/store.ts`
   - Added 'purchase-return-form' to PurchasesView type
   - Added 'sales-return-form' to SalesView type

## Data Format
- Purchase returns: localStorage key `pendingPurchaseReturn` with PendingPurchaseReturn interface
- Sales returns: localStorage key `pendingSalesReturn` with PendingSalesReturn interface
- Both include: sourceType, sourceId, sourceNumber, supplierId/customerId, supplierName/customerName, warehouseId, lines[]
- Purchase receipt and delivery note lines have unitPrice: 0 (no price data on those documents)

## Status
- Lint: PASS (0 errors)
- Dev server: Running on port 3000 (HTTP 200)
