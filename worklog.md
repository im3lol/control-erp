---
Task ID: 1
Agent: Main Agent
Task: Implement product detail page, stock transfer form page, barcode scanning, and navigation improvements

Work Log:
- Updated `src/lib/store.ts` to add `selectedItemId`, `selectedTransferId`, and their setters
- Created `src/components/inventory/item-detail-page.tsx` - Full-page product detail with back navigation, product info, codes, linked records (sales/purchases/movements/adjustments), stock balances table
- Created `src/components/inventory/stock-transfer-form-page.tsx` - Full-page stock transfer form with barcode scanning support, warehouse hierarchy selection, dual mode (create/view)
- Updated `src/components/inventory/items-list.tsx` - Removed detail dialog popup, replaced with page navigation via `setSelectedItemId` + `setView('item-detail')`
- Updated `src/components/inventory/stock-transfers-list.tsx` - Create/view buttons now navigate to `stock-transfer-form` page instead of opening dialogs
- Updated `src/app/page.tsx` - Added imports for `ItemDetailPage` and `StockTransferFormPage`, added route cases for `item-detail` and `stock-transfer-form` views, added view titles

Stage Summary:
- Product click → navigates to full detail page (not popup)
- Stock transfer create/view → navigates to full form page (not popup)
- Barcode scanning in stock transfer form auto-adds items on Enter key
- Warehouse selectors show full hierarchy path (Warehouse → Zone → Rack → Shelf → Box)
- All transfers support any location type (box→box, warehouse→warehouse, etc.)
- Lint passes, dev server running successfully

---
Task ID: 2
Agent: API Agent
Task: Create API routes for Material Request (طلب المواد) feature

Work Log:
- Created `src/app/api/inventory/material-requests/route.ts` - GET list and POST create
  - GET: Returns all material requests for a companyId with lines, items, UOM info, and line count
  - POST: Creates a new material request with lines. Auto-generates number like "MR-0001" by finding the last number and incrementing
  - Validates required fields (companyId, lines with itemId and quantity > 0)
  - Validates items exist and belong to the company
  - Creates request and lines in a transaction
- Created `src/app/api/inventory/material-requests/[id]/route.ts` - GET single and PUT status actions
  - GET: Returns single material request with full line details including item and UOM info
  - PUT supports four actions via body `{ companyId, action }`:
    - "submit" → DRAFT to PENDING
    - "approve" → PENDING to APPROVED (sets approvedBy from body or user name)
    - "fulfill" → APPROVED to FULFILLED
    - "cancel" → any non-fulfilled status to CANCELLED
  - All actions validate current status before transitioning
  - Prevents cancelling already-cancelled or fulfilled requests
- Followed existing stock-transfers route patterns: requirePermission, companyId filtering, error handling, Arabic error messages
- Lint passes cleanly

---
Task ID: 3
Agent: API Agent
Task: Create API routes for Delivery Note (إذن صرف) feature

Work Log:
- Created `src/app/api/inventory/delivery-notes/route.ts` - GET list and POST create
  - GET: Returns all delivery notes for a companyId with customer, warehouse, salesInvoice, and line count
  - POST: Creates a new delivery note with lines. Auto-generates number like "DN-0001" by counting existing records
  - Validates required fields (companyId, warehouseId, lines with itemId and quantity > 0)
  - Validates warehouse exists and belongs to company
  - When salesInvoiceId is provided: auto-fills customerId from the sales invoice, validates items belong to the invoice
  - Validates customer exists and belongs to company if provided
  - Validates all items exist and belong to company
  - Creates delivery note and lines in a transaction
- Created `src/app/api/inventory/delivery-notes/[id]/route.ts` - GET single and PUT status actions
  - GET: Returns single delivery note with full line details including item and UOM info, customer, warehouse, salesInvoice
  - PUT supports two actions via body `{ companyId, action }`:
    - "confirm" → DRAFT to CONFIRMED:
      - For each line, checks sufficient stock in the warehouse (ItemBalance)
      - Creates OUT StockMovement for each line using item's avgCost from ItemBalance
      - referenceType: "DELIVERY_NOTE", referenceId: deliveryNote.id
      - Updates ItemBalance (decrease quantity and recalculate avgCost)
      - All done in a transaction for atomicity
    - "cancel" → any to CANCELLED:
      - If CONFIRMED: reverses stock movements (creates IN movements with referenceType "DELIVERY_NOTE_CANCEL"), increases ItemBalance quantities back
      - If DRAFT: simply updates status without reversing stock movements
      - Prevents cancelling already-cancelled notes
  - All actions validate current status before transitioning
  - Company ownership validation on all operations
- Followed existing stock-transfers route patterns: requirePermission, generateDocNumber, companyId filtering, error handling, Arabic error messages
- Lint passes cleanly

---
Task ID: 4
Agent: API Agent
Task: Create API routes for Purchase Receipt (إذن استلام مشتريات) feature

Work Log:
- Created `src/app/api/inventory/purchase-receipts/route.ts` - GET list and POST create
  - GET: Returns all purchase receipts for a companyId with supplier, warehouse, purchaseInvoice, and line count
  - POST: Creates a new purchase receipt with lines. Auto-generates number like "PR-0001" by counting existing records
  - Validates required fields (companyId, warehouseId, lines with itemId and quantity > 0)
  - Validates warehouse exists and belongs to company
  - When purchaseInvoiceId is provided: auto-fills supplierId from the purchase invoice, validates items belong to the invoice
  - Validates supplier exists and belongs to company if provided
  - Validates all items exist and belong to company
  - Creates purchase receipt and lines in a transaction
- Created `src/app/api/inventory/purchase-receipts/[id]/route.ts` - GET single and PUT status actions
  - GET: Returns single purchase receipt with full line details including item and UOM info, supplier, warehouse, purchaseInvoice
  - PUT supports two actions via body `{ companyId, action }`:
    - "confirm" → DRAFT to CONFIRMED:
      - For each line, determines unitCost: uses purchase invoice line's unitPrice if purchaseInvoiceLineId is available, falls back to invoice line lookup by itemId, then item's avgCost in warehouse
      - Creates IN StockMovement for each line using determined unitCost
      - referenceType: "PURCHASE_RECEIPT", referenceId: purchaseReceipt.id
      - Updates ItemBalance (increase quantity and recalculate weighted avgCost)
      - Creates new ItemBalance record if one doesn't exist
      - All done in a transaction for atomicity
    - "cancel" → any to CANCELLED:
      - If CONFIRMED: reverses stock movements (creates OUT movements with referenceType "PURCHASE_RECEIPT_CANCEL"), decreases ItemBalance quantities, checks sufficient stock before reversal
      - If DRAFT: simply updates status without reversing stock movements
      - Prevents cancelling already-cancelled receipts
  - All actions validate current status before transitioning
  - Company ownership validation on all operations
- Followed existing stock-transfers/delivery-notes route patterns: requirePermission, generateDocNumber, companyId filtering, error handling, Arabic error messages
- Lint passes cleanly

---
Task ID: 5
Agent: API Agent
Task: Create API routes for Pick List (قائمة تحضير) feature

Work Log:
- Created `src/app/api/inventory/pick-lists/route.ts` - GET list and POST create
  - GET: Returns all pick lists for a companyId with warehouse info, lines including item details, and line count
  - POST: Creates a new pick list with lines. Auto-generates number like "PK-0001" by counting existing records
  - Validates required fields (companyId, warehouseId, lines with itemId and quantity > 0)
  - Validates warehouse exists and belongs to company
  - Validates all items exist and belong to company (for manual lines)
  - Special feature: `fromPendingSales=true` in request body
    - Finds all CONFIRMED sales invoices for the company
    - Checks existing pick list lines (from non-cancelled pick lists) to determine already-picked quantities per (itemId, salesInvoiceId)
    - Calculates remaining unpicked quantity for each invoice line
    - Only creates lines for items with remaining quantity > 0
    - Returns appropriate Arabic error messages if no confirmed invoices exist or all items already picked
  - Creates pick list and lines in a transaction
- Created `src/app/api/inventory/pick-lists/[id]/route.ts` - GET single and PUT status actions
  - GET: Returns single pick list with full line details including item and UOM info, warehouse
  - PUT supports four actions via body `{ companyId, action }`:
    - "start" → DRAFT to IN_PROGRESS:
      - Validates current status is DRAFT
      - Simple status update, no stock movements yet
    - "complete" → IN_PROGRESS to COMPLETED:
      - For each line with pickedQty > 0, checks sufficient stock in the warehouse (ItemBalance)
      - Creates OUT StockMovement for each picked line using item's avgCost from ItemBalance
      - referenceType: "PICK_LIST", referenceId: pickList.id
      - Updates ItemBalance (decrease quantity and recalculate avgCost)
      - All done in a transaction for atomicity
    - "cancel" → any to CANCELLED:
      - If COMPLETED: reverses stock movements (creates IN movements with referenceType "PICK_LIST_CANCEL"), increases ItemBalance quantities back
      - If DRAFT or IN_PROGRESS: simply updates status without reversing stock movements
      - Prevents cancelling already-cancelled pick lists
    - "updateLines" → update pickedQty for each line:
      - Only allowed when status is IN_PROGRESS
      - Validates each line belongs to the pick list
      - Validates pickedQty is not negative and doesn't exceed the required quantity
      - Supports updating notes per line as well
      - All updates in a transaction
  - All actions validate current status before transitioning
  - Company ownership validation on all operations
- Followed existing stock-transfers/delivery-notes route patterns: requirePermission, companyId filtering, error handling, Arabic error messages
- Lint passes cleanly

---
Task ID: 6-a
Agent: UI Agent
Task: Create Material Request (طلب المواد) UI component

Work Log:
- Created `src/components/inventory/material-requests-list.tsx` following the exact same pattern as stock-transfers-list.tsx
- Component features:
  - Header with ClipboardList icon and title "طلبات المواد" + "طلب جديد" button
  - Table with 6 columns: رقم الطلب, التاريخ, الطالب, الحالة, عدد الأصناف, إجراءات
  - Status badges with Arabic labels and color coding:
    - DRAFT → "مسودة" (slate), PENDING → "قيد المراجعة" (amber), APPROVED → "معتمد" (emerald), FULFILLED → "مكتمل" (teal), CANCELLED → "ملغى" (red)
  - Create dialog with: date, requestedBy, notes, and dynamic lines (itemId + quantity + notes)
  - View dialog showing full details + lines table (item name, code, UOM, requested qty, fulfilled qty, notes)
  - Status action buttons per status: DRAFT: Submit+Cancel, PENDING: Approve+Cancel, APPROVED: Fulfill+Cancel, FULFILLED/CANCELLED: View only
  - Inline status action buttons on table rows, AlertDialog for cancel confirmation
  - Loading skeleton state, Empty state with ClipboardList icon
  - RTL layout, Arabic labels, useAppStore for companyId, formatDate from erp-utils, toast from sonner
- Lint passes cleanly

---
Task ID: 6-b
Agent: UI Agent
Task: Create Delivery Note (إذن صرف) UI component

Work Log:
- Created `src/components/inventory/delivery-notes-list.tsx` following the exact same pattern as stock-transfers-list.tsx and material-requests-list.tsx
- Component features:
  - Header with Truck icon and title "أذون الصرف" + "إذن صرف جديد" button
  - Table with 8 columns: رقم الإذن, التاريخ, العميل, المخزن, فاتورة البيع, عدد الأصناف, الحالة, إجراءات
  - Status badges with Arabic labels and color coding:
    - DRAFT → "مسودة" (slate), CONFIRMED → "مؤكد" (emerald), CANCELLED → "ملغى" (red)
  - Create dialog with: warehouseId (select), salesInvoiceId (optional select), customerId (auto-filled from invoice), date, notes, and dynamic lines (itemId + quantity + notes)
  - When salesInvoiceId is selected: fetches full invoice details, auto-fills customerId, pre-populates lines from invoice items, disables line editing/add/remove
  - Sales invoice dropdown filters to CONFIRMED invoices only, with "بدون فاتورة" option
  - View dialog showing full details + lines table (item name, code, UOM, quantity, notes)
  - Status action buttons per status: DRAFT: Confirm+Cancel, CONFIRMED: Cancel (with reversal warning), CANCELLED: View only
  - Inline status action buttons on table rows, AlertDialog for cancel confirmation with different messages for DRAFT vs CONFIRMED
  - Warehouse hierarchy display name support (same as stock-transfers-list)
  - Customer display name lookup from fetched customers list
  - Additional data fetches: warehouses, items, customers, sales invoices
  - Loading skeleton state, Empty state with Truck icon
  - RTL layout, Arabic labels, useAppStore for companyId, formatDate from erp-utils, toast from sonner
- Lint passes cleanly

---
Task ID: 6-c
Agent: UI Agent
Task: Create Purchase Receipt (إذن استلام مشتريات) UI component

Work Log:
- Created `src/components/inventory/purchase-receipts-list.tsx` following the exact same pattern as delivery-notes-list.tsx and stock-transfers-list.tsx
- Component features:
  - Header with PackageCheck icon and title "أذون استلام المشتريات" + "إذن استلام جديد" button
  - Table with 8 columns: رقم الإذن, التاريخ, المورد, المخزن, فاتورة الشراء, عدد الأصناف, الحالة, إجراءات
  - Status badges with Arabic labels and color coding:
    - DRAFT → "مسودة" (slate), CONFIRMED → "مؤكد" (emerald), CANCELLED → "ملغى" (red)
  - Create dialog with: warehouseId (select), purchaseInvoiceId (optional select), supplierId (auto-filled from invoice), date, notes, and dynamic lines (itemId + quantity + notes)
  - When purchaseInvoiceId is selected: fetches full invoice details, auto-fills supplierId, pre-populates lines from invoice items, disables line editing/add/remove
  - Purchase invoice dropdown filters to CONFIRMED invoices only, with "بدون فاتورة" option
  - View dialog showing full details + lines table (item name, code, UOM, quantity, notes)
  - Status action buttons per status: DRAFT: Confirm+Cancel, CONFIRMED: Cancel (with reversal warning about stock reversal), CANCELLED: View only
  - Inline status action buttons on table rows, AlertDialog for cancel confirmation with different messages for DRAFT vs CONFIRMED
  - Warehouse hierarchy display name support (same as stock-transfers-list)
  - Supplier display name lookup from fetched suppliers list
  - Additional data fetches: warehouses, items, suppliers, purchase invoices
  - Loading skeleton state, Empty state with PackageCheck icon
  - RTL layout, Arabic labels, useAppStore for companyId, formatDate from erp-utils, toast from sonner
- Lint passes cleanly

---
Task ID: 6-d
Agent: UI Agent
Task: Create Pick List (قائمة تحضير) UI component

Work Log:
- Created `src/components/inventory/pick-lists-list.tsx` following the exact same pattern as stock-transfers-list.tsx
- Component features:
  - Header with ClipboardCheck icon and title "قوائم التحضير" + TWO buttons: "قائمة تحضير جديدة" and "توليد من المبيعات المعلقة" (Zap icon, amber styling)
  - Table with 6 columns: رقم القائمة, التاريخ, المخزن, عدد الأصناف, الحالة, إجراءات
  - Status badges with Arabic labels and color coding:
    - DRAFT → "مسودة" (slate), IN_PROGRESS → "قيد التحضير" (amber), COMPLETED → "مكتمل" (emerald), CANCELLED → "ملغى" (red)
  - Create dialog with: warehouseId (select), date, notes (Textarea), and dynamic lines (itemId + quantity + notes)
  - View dialog showing full details + lines table with columns: الصنف, الكود, الكمية المطلوبة, الكمية المحضرة, الوحدة, ملاحظات
  - Special "Generate from pending sales" button that calls POST with `fromPendingSales: true` in body
  - Status action buttons:
    - DRAFT: Start (Play icon, amber) + Cancel
    - IN_PROGRESS: Update Lines (Save icon, teal outline) + Complete (CheckCircle2, emerald) + Cancel
    - COMPLETED/CANCELLED: View only
  - When IN_PROGRESS, view dialog shows editable pickedQty inputs and editable notes inputs in the lines table
  - editedLines state tracks in-progress edits, handlePickedQtyChange/handleLineNotesChange for per-line updates
  - Inline status actions on table rows (Start + Cancel for DRAFT, Cancel for IN_PROGRESS)
  - AlertDialog for cancel confirmation with contextual message for IN_PROGRESS status
  - Warehouse hierarchy display name support (same as stock-transfers-list)
  - Additional data fetches: warehouses, items
  - Loading skeleton state, Empty state with ClipboardCheck icon
  - RTL layout, Arabic labels, useAppStore for companyId, formatDate from erp-utils, toast from sonner
- Lint passes cleanly
