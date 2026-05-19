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

---
Task ID: 3
Agent: API Agent
Task: Create API routes for Purchase Orders (أمر شراء) feature

Work Log:
- Created `src/app/api/purchases/orders/route.ts` - GET list and POST create
  - GET: Returns all purchase orders for a companyId with supplier, warehouse, _count.lines
  - Supports filters: status, supplierId, fromDate, toDate, itemId
  - Ordered by date desc, createdAt desc
  - Require permission: purchases.view
  - POST: Creates a new purchase order with lines
  - Require permission: purchases.create
  - Validates required fields: companyId, supplierId, warehouseId, lines (at least 1)
  - Validates supplier and warehouse exist and belong to company
  - Calculates totals: rawSubtotal (sum of qty*unitPrice), totalLineDiscounts, totalLineTaxes, invoiceDiscount, invoiceTax, totalAmount
  - Auto-generates number: PO-{year}-{seq} using generateDocNumber
  - Creates with status DRAFT
  - Returns created order with supplier, warehouse, lines.item
- Created `src/app/api/purchases/orders/[id]/route.ts` - GET single and PUT actions
  - GET: Returns single purchase order with all relations (supplier, warehouse, lines with item+uom, purchaseReceipts)
  - Require permission: purchases.view
  - Company ownership validation
  - PUT supports four actions via body `{ companyId, action }`:
    - "update" → Update DRAFT order fields and lines (delete old lines, create new)
      - Require permission: purchases.edit
      - Only allowed when status is DRAFT
      - Recalculates all totals when lines change
      - Supports partial updates (without changing lines)
    - "confirm" → DRAFT to CONFIRMED
      - Require permission: purchases.confirm
      - Simple status update, no stock movements or journal entries (those happen on Purchase Receipt/Invoice)
    - "cancel" → Change status to CANCELLED (if DRAFT or CONFIRMED)
      - Require permission: purchases.edit
      - Prevents cancelling already-cancelled or CLOSED orders
    - "close" → Change status to CLOSED (when fully received)
      - Require permission: purchases.edit
      - Only allowed when status is CONFIRMED
      - Validates all lines have receivedQty >= quantity before closing
  - All actions validate current status before transitioning
  - Company ownership validation on all operations
- Followed existing purchase invoices API patterns: requirePermission, generateDocNumber, companyId filtering, error handling, Arabic error messages
- Lint passes cleanly

---
Task ID: 4
Agent: API Agent
Task: Create Sales Orders API routes (أوامر البيع)

Work Log:
- Created `src/app/api/sales/orders/route.ts` - GET list and POST create
  - GET: Returns all sales orders for a companyId with customer info and _count.lines
  - Query params supported: companyId (required), status, customerId, fromDate, toDate, itemId
  - Filters: status, customerId, date range, lines by itemId
  - Ordered by date desc, createdAt desc
  - POST: Creates a new sales order with lines
  - Auto-generates number: SO-{year}-{seq} using generateDocNumber
  - Creates with status DRAFT
  - Validates: companyId, customerId (exists and belongs to company), lines (at least one, itemId/quantity/unitPrice required)
  - Calculates: subtotal (sum of qty*unitPrice - discount per line), taxAmount (from taxPercent on subtotal), totalAmount (subtotal - discount + tax)
  - Per-line totalAmount: qty * unitPrice - discount + tax
  - Returns created order with customer and lines.item relations
- Created `src/app/api/sales/orders/[id]/route.ts` - GET single and PUT actions
  - GET: Returns single sales order with full relations (customer, lines with item + UOM, deliveryNotes)
  - PUT supports four actions via body `{ companyId, action }`:
    - "confirm" → DRAFT to CONFIRMED:
      - Validates current status is DRAFT
      - Simple status change (no stock movements - orders are not stock documents)
      - Requires `sales.edit` permission
    - "cancel" → DRAFT/CONFIRMED to CANCELLED:
      - Validates current status is DRAFT or CONFIRMED
      - Simple status change (no stock reversal needed since confirm doesn't move stock)
      - Requires `sales.edit` permission
    - "close" → CONFIRMED to CLOSED:
      - Validates current status is CONFIRMED
      - Checks all lines are fully delivered (deliveredQty >= quantity)
      - Returns Arabic error if not all items delivered
      - Requires `sales.edit` permission
    - "update" → Update DRAFT order fields and lines:
      - Only allowed when status is DRAFT
      - Updates: customerId, date, dueDate, discountAmount, discountPercent, taxPercent, notes, lines
      - If lines provided: deletes old lines, creates new ones
      - Recalculates subtotal, taxAmount, totalAmount
      - Requires `sales.edit` permission
  - All actions validate company ownership
  - Error handling with Arabic messages, 403 for auth errors, proper HTTP status codes
- Followed exact same pattern as sales invoices API: requirePermission, generateDocNumber, companyId filtering, error handling, Arabic error messages
- Lint passes cleanly

---
Task ID: 6
Agent: UI Agent
Task: Create Sales Orders (أوامر البيع) UI component

Work Log:
- Created `src/components/sales/sales-orders-list.tsx` following the exact same pattern as sales-invoices-list.tsx
- Component features:
  - Header with FileText icon and title "أوامر البيع" + "أمر بيع جديد" button
  - Table with 7 columns: الرقم, العميل, التاريخ, الإجمالي, المسلم, الحالة, إجراءات
  - Status badges with Arabic labels and color coding (using getOrderStatusColor/getOrderStatusLabel helpers for CLOSED):
    - DRAFT → "مسودة" (yellow), CONFIRMED → "مؤكدة" (blue), CANCELLED → "ملغية" (red), CLOSED → "مغلق" (teal)
  - "المسلم" (delivered) column shows progress bar with percentage of delivered vs ordered quantities
  - Filters: status (DRAFT/CONFIRMED/CANCELLED/CLOSED), customer, date range, item filter from store
  - New/Edit Order Sheet (side="left") with:
    - Header: customer select, date, due date, notes
    - Lines: item, quantity, unit price, discount, line total, remove button
    - Footer: discount amount, tax percent, totals summary (subtotal, discount, tax, total)
    - "حفظ كمسودة" (save as draft) button
  - Detail Dialog showing:
    - Customer info + date + due date
    - Notes section
    - Lines table with: item name/code, quantity, delivered qty (with remaining/complete badges), unit price, discount, total
    - Totals summary
    - Linked Delivery Notes table (number, date, line count, status)
    - "إنشاء إذن صرف" button for CONFIRMED orders
  - Workflow Actions:
    - DRAFT: Confirm (CheckCircle2), Edit (Pencil), Cancel (XCircle)
    - CONFIRMED: View details (Eye), Create Delivery Note (Truck), Cancel (XCircle)
    - CLOSED/CANCELLED: View details (Eye)
  - Confirm AlertDialog with Arabic message about creating delivery notes after confirmation
  - Cancel AlertDialog with Arabic message
  - "Create Delivery Note" button on CONFIRMED orders:
    - Stores order data in localStorage under key `pendingDeliveryNote` (includes salesOrderId, customer, lines with remaining qty)
    - Navigates to inventory > delivery-notes via `useAppStore.getState().setModule('inventory')` and `setView('delivery-notes')`
  - Delivered qty tracking: progress bar in list view, per-line delivered/remaining in detail dialog
  - Loading skeleton state, Empty state with FileText icon
  - RTL layout, Arabic labels, useAppStore for companyId, formatCurrency/formatDate/getStatusColor/getStatusLabel from erp-utils, toast from sonner
  - Emerald color scheme for primary actions
  - API endpoints: `/api/sales/orders?companyId=X`, `/api/sales/orders/[id]?companyId=X`
- Lint passes cleanly

---
Task ID: 5
Agent: UI Agent
Task: Create Purchase Orders (أوامر الشراء) UI component

Work Log:
- Created `src/components/purchases/purchase-orders-list.tsx` following the exact same pattern as purchase-invoices-list.tsx
- Component features:
  - Header with FileText icon and title "أوامر الشراء" + "أمر شراء جديد" button
  - Table with 8 columns: رقم, المورد, المخزن, التاريخ, الإجمالي, المستلم, الحالة, إجراءات
  - "المستلم" column shows received status: "مكتمل" (teal) for CLOSED, "قيد الاستلام" (amber) for CONFIRMED, "—" for DRAFT/CANCELLED
  - Status badges with Arabic labels and color coding:
    - DRAFT → "مسودة" (yellow), CONFIRMED → "مؤكدة" (blue), CANCELLED → "ملغية" (red), CLOSED → "مغلق" (teal)
    - Extended `getOrderStatusColor` and `getOrderStatusLabel` locally for CLOSED status
  - Filters: status (DRAFT/CONFIRMED/CANCELLED/CLOSED), supplier, date range
  - New Order Dialog: supplier select, warehouse select, date, notes, dynamic lines (item/qty/unitPrice/discount/tax), invoice-level discount/tax percent, totals summary, save as draft button
  - Detail Dialog: header info grid (number/supplier/warehouse/date/status), lines table with received qty tracking columns (الكمية/المستلم/المتبقي/سعر الوحدة/الخصم/الضريبة/الإجمالي), totals section, linked purchase receipts list, notes
  - Received qty tracking in detail dialog: shows received vs ordered per line, remaining quantity in red if >0, green checkmark if fully received
  - Linked Purchase Receipts section: lists all PRs linked to the order with number, date, and status badge
  - Workflow Actions:
    - DRAFT: Confirm (→ CONFIRMED) + Cancel (→ CANCELLED)
    - CONFIRMED: Create Purchase Receipt button (PackageCheck icon) + Cancel (→ CANCELLED)
    - "Create Purchase Receipt" stores order data in localStorage under key `pendingPurchaseReceipt`, then navigates to inventory > purchase-receipts via `setModule('inventory')` + `setView('purchase-receipts')`
    - Full order details are fetched before storing in localStorage to ensure complete line data
  - Confirm/Cancel Dialog with contextual messages (confirm mentions PR creation capability)
  - Loading skeleton state, Empty state with FileText icon
  - RTL layout, Arabic labels, useAppStore for companyId, formatDate/formatCurrency from erp-utils, toast from sonner
  - API endpoints: `/api/purchases/orders?companyId=X` (GET/POST), `/api/purchases/orders/[id]?companyId=X` (GET/PUT)
- Lint passes cleanly

---
Task ID: 8
Agent: UI Agent
Task: Update Delivery Note component to support receiving Sales Order data

Work Log:
- Updated `src/app/api/inventory/delivery-notes/route.ts`:
  - GET: Added `salesOrder` include (select: id, number) to list query
  - POST: Added `salesOrderId` destructuring from body; added salesOrderId validation block that fetches the sales order, validates company ownership, and auto-fills customerId if not already set by salesInvoiceId; added `salesOrderId: salesOrderId || null` to create data; added `salesOrder` include in response
- Updated `src/app/api/inventory/delivery-notes/[id]/route.ts`:
  - GET: Added `salesOrder` include (select: id, number) to single query
  - PUT: Added `salesOrder` include (select: id, number) to all update responses (confirm, cancel CONFIRMED, cancel DRAFT)
- Updated `src/components/inventory/delivery-notes-list.tsx` with all 8 requirements:
  1. localStorage support: Added useEffect on mount that checks `pendingDeliveryNote` in localStorage, parses JSON, pre-fills create form (warehouseId empty, salesOrderId from order, customerId from order, lines with remaining qty), opens create dialog automatically, clears localStorage key
  2. salesOrderId in createForm state: Added `salesOrderId: ''` to createForm initial state
  3. Sales Order dropdown in create dialog: Added new Select field for choosing a Sales Order, shows only CONFIRMED orders, when selected fetches order details from `/api/sales/orders/[id]?companyId=X`, auto-fills customerId and lines (quantity = ordered - delivered), sets salesOrderId, "بدون أمر بيع" option; mutually exclusive with Sales Invoice selection
  4. salesOrderId in POST body: Added `salesOrderId: createForm.salesOrderId || undefined` to create request body
  5. Linked Sales Order in view dialog: Added "أمر البيع" field showing `selectedNote.salesOrder?.number || '—'`
  6. Updated DeliveryNote type: Added `salesOrderId: string | null` and `salesOrder?: { id: string; number: string }`
  7. fetchSalesOrders function: Added `fetchSalesOrders` useCallback that fetches from `/api/sales/orders?companyId=X&status=CONFIRMED`
  8. Table column: Added "أمر البيع" column showing `note.salesOrder?.number || '—'` between "فاتورة البيع" and "عدد الأصناف"
- Additional changes:
  - Added `SalesOrder` and `SalesOrderLine` interfaces
  - Added `salesOrders` state and `orderLoading` state
  - Added `handleSalesOrderChange` async handler (mirrors handleSalesInvoiceChange pattern)
  - Updated customer select to be disabled when salesOrderId is set (in addition to salesInvoiceId)
  - Updated line editing disabled conditions to include salesOrderId
  - Updated auto-fill messages from "من الفاتورة" to "من المستند المحدد"
  - Sales Invoice select is disabled when Sales Order is selected, and vice versa
  - Create button disabled condition includes orderLoading
  - Table colSpan updated from 8 to 9 for empty state
- Lint passes cleanly

---
Task ID: 7
Agent: UI Agent
Task: Update Purchase Receipt component to support receiving Purchase Order data

Work Log:
- Updated `src/components/inventory/purchase-receipts-list.tsx`:
  - Added `purchaseOrderId` and `purchaseOrder` to PurchaseReceipt interface
  - Added `PurchaseOrder` interface for the purchase orders dropdown
  - Added `purchaseOrderId` to `createForm` state object
  - Added `purchaseOrders` state array and `fetchPurchaseOrders` function (fetches CONFIRMED orders from `/api/purchases/orders?companyId=X&status=CONFIRMED`)
  - Added useEffect to check `localStorage.getItem('pendingPurchaseReceipt')` on mount:
    - Parses JSON data from Purchase Orders component
    - Pre-fills warehouseId, supplierId, purchaseOrderId from the order
    - Pre-fills lines with remaining qty (ordered - received) per line
    - Opens create dialog automatically
    - Clears localStorage key after reading
  - Added `handlePurchaseOrderChange` function that:
    - Fetches order details from `/api/purchases/orders/[id]?companyId=X`
    - Auto-fills supplierId and warehouseId from the order
    - Pre-populates lines with remaining qty (quantity - receivedQty)
    - Shows info toast if all items already fully received
  - Added "أمر الشراء" Select dropdown in create dialog (between Warehouse and Purchase Invoice)
  - Updated supplier disabled state to also disable when purchaseOrderId is set
  - Updated line add/remove/edit disabled states to also respect purchaseOrderId
  - Updated auto-fill hint text to show "أمر الشراء" or "الفاتورة" contextually
  - Added `purchaseOrderId` in the POST body when creating a purchase receipt
  - Added "أمر الشراء" column in the main table showing linked order number
  - Added "أمر الشراء" field in the view/detail dialog showing linked order number
  - Updated colSpan from 8 to 9 for empty state row
- Updated `src/app/api/inventory/purchase-receipts/route.ts`:
  - GET: Added `purchaseOrder` include (select: id, number) in list query
  - POST: Added `purchaseOrderId` destructuring from body
  - POST: Added purchase order validation - validates order exists and belongs to company
  - POST: Auto-fills supplierId and warehouseId from purchase order
  - POST: Validates items belong to the purchase order
  - POST: Saves `purchaseOrderId` in the created receipt
  - POST: Added `purchaseOrder` include in the returned receipt
  - POST: Added receivedQty increment on purchase order lines after creating receipt
- Updated `src/app/api/inventory/purchase-receipts/[id]/route.ts`:
  - GET: Added `purchaseOrder` include in single receipt query
  - PUT confirm: Added `purchaseOrder` include in returned data
  - PUT cancel (confirmed): Added `purchaseOrder` include in returned data
  - PUT cancel (draft): Added `purchaseOrder` include in returned data
- Lint passes cleanly
- Dev server running successfully

---
Task ID: 12
Agent: Workflow Agent
Task: Add workflow buttons to navigate from confirmed receipts/notes to invoice creation

Work Log:
- Updated `src/components/inventory/purchase-receipts-list.tsx`:
  - Added `FileText` to lucide-react imports
  - In the view/detail dialog's DialogFooter, when `selectedReceipt.status === 'CONFIRMED'`, added "إنشاء فاتورة شراء" (Create Purchase Invoice) button with amber styling
  - Button stores receipt data in localStorage under key `pendingPurchaseInvoice` with: id, number, supplierId, warehouseId, lines (itemId, quantity)
  - Navigates to purchases > purchase-invoices using `useAppStore.getState().setModule('purchases')` and `useAppStore.getState().setView('purchase-invoices')`
  - Wrapped the CONFIRMED section in a Fragment (<>...</>) to accommodate both the new workflow button and the existing cancel button

- Updated `src/components/purchases/purchase-invoices-list.tsx`:
  - Added useEffect on mount that checks localStorage for `pendingPurchaseInvoice`
  - If found: parses data, removes localStorage key
  - Pre-fills the new invoice form with: supplierId, warehouseId, notes mentioning receipt number, lines from receipt items
  - Opens the new invoice dialog automatically

- Updated `src/components/inventory/delivery-notes-list.tsx`:
  - Added `FileText` to lucide-react imports
  - In the view/detail dialog's DialogFooter, when `selectedNote.status === 'CONFIRMED'`, added "إنشاء فاتورة بيع" (Create Sales Invoice) button with amber styling
  - Button stores note data in localStorage under key `pendingSalesInvoice` with: id, number, customerId, lines (itemId, quantity)
  - Navigates to sales > sales-invoices using `useAppStore.getState().setModule('sales')` and `useAppStore.getState().setView('sales-invoices')`
  - Wrapped the CONFIRMED section in a Fragment (<>...</>) to accommodate both the new workflow button and the existing cancel button

- Updated `src/components/sales/sales-invoices-list.tsx`:
  - Added useEffect on mount that checks localStorage for `pendingSalesInvoice`
  - If found: parses data, removes localStorage key
  - Pre-fills the new invoice form with: customerId, notes mentioning delivery note number, lines from note items
  - Opens the new invoice sheet automatically

- All text in Arabic
- Lint passes cleanly
- Dev server running successfully
---
Task ID: 1
Agent: Main Agent
Task: Convert Purchases module (Suppliers, Purchase Orders, Purchase Invoices) from popup dialogs to full pages, add Save/Submit workflow, remove سندات الصرف

Work Log:
- Updated page.tsx: Removed PaymentVouchersList import and render, added SupplierFormPage, PurchaseOrderFormPage, PurchaseInvoiceFormPage imports and rendering
- Removed سندات الصرف from Purchases navigation children
- Added view titles for supplier-form, purchase-order-form, purchase-invoice-form
- Added editingDocId field to Zustand store for passing document IDs between list and form pages
- Created SupplierFormPage: Full-page form with Save button, edit support via editingDocId
- Created PurchaseOrderFormPage: Full-page form with Save (حفظ كمسودة) and Submit (تأكيد) buttons, status badges, editable when DRAFT, read-only when confirmed
- Created PurchaseInvoiceFormPage: Same pattern as PO form page with Save/Submit workflow
- Updated SuppliersList: Removed dialog, navigates to supplier-form page on add/edit
- Updated PurchaseOrdersList: Removed creation dialog, navigates to purchase-order-form page, kept detail and confirm dialogs
- Updated PurchaseInvoicesList: Removed creation dialog, navigates to purchase-invoice-form page, kept detail and confirm dialogs
- Updated store.ts PurchasesView type to include new view IDs
- All labels in Arabic as requested
- Lint passes cleanly

Stage Summary:
- Purchases module now uses full pages instead of popup dialogs
- Save button creates DRAFT, Submit (تأكيد) button confirms the document
- سندات الصرف removed from المشتريات sidebar
- Three new form page components created: supplier-form-page, purchase-order-form-page, purchase-invoice-form-page
- Three list components updated to navigate to form pages instead of using dialogs
- editingDocId added to store for document ID passing between views

---
Task ID: 3-a
Agent: UI Agent
Task: Create 3 new dedicated full-page form components for the Sales module

Work Log:
- Created `src/components/sales/customer-form-page.tsx` - Full-page form for adding/editing customers
  - Fields: code (auto), nameAr*, nameEn, phone, email, address, creditLimit, paymentTerms, isActive switch
  - Back button navigates to `setModule('sales')` + `setView('customers')`
  - Uses `editingDocId` from store for editing existing customers
  - Save button creates new (POST) or updates existing (PUT) via `/api/sales/customers`
  - Loads existing customer data when `editingDocId` is set
  - RTL Arabic layout with emerald color scheme, shadcn/ui components

- Created `src/components/sales/sales-order-form-page.tsx` - Full-page form with Save/Submit workflow
  - Header: customer select, date, due date
  - Lines: item, quantity, unit price, discount, tax, line total (qty * unitPrice - discount + tax)
  - Footer: order-level discount, tax percent, totals summary
  - Notes textarea
  - **Save (حفظ كمسودة)** → creates/updates as DRAFT via POST/PUT `/api/sales/orders`
  - **Submit (تأكيد)** → saves then confirms via PUT action "confirm"
  - When DRAFT/NEW: fields are editable, both buttons visible
  - When CONFIRMED/CLOSED/CANCELLED: fields are read-only, no edit buttons
  - Status badge visible in header
  - Back button → `setModule('sales')` + `setView('sales-orders')`
  - Auto-fills unit price from item's sellPrice when item selected
  - Follows exact same pattern as PurchaseOrderFormPage

- Created `src/components/sales/sales-invoice-form-page.tsx` - Full-page form with Save/Submit workflow
  - Header: customer select, date, due date
  - Lines: item, quantity, unit price, discount, tax, line total
  - Footer: invoice-level discount, tax percent, totals summary
  - Notes textarea
  - **Save (حفظ كمسودة)** → creates/updates as DRAFT via POST/PUT `/api/sales/invoices`
  - **Submit (تأكيد)** → saves then confirms via PUT action "confirm"
  - When DRAFT/NEW: fields are editable, both buttons visible
  - When CONFIRMED/PAID/CANCELLED: fields are read-only
  - Status badge visible in header
  - Back button → `setModule('sales')` + `setView('sales-invoices')`
  - Auto-fills unit price from item's sellPrice when item selected
  - Support pre-fill from localStorage `pendingSalesInvoice` (for workflow from Delivery Note)
  - Follows exact same pattern as PurchaseInvoiceFormPage

- Updated `src/app/page.tsx`:
  - Added imports for CustomerFormPage, SalesOrderFormPage, SalesInvoiceFormPage
  - Added view titles: 'customer-form', 'sales-order-form', 'sales-invoice-form'
  - Added route cases in Sales switch block for all 3 new form views

- Updated `src/components/sales/customers-list.tsx`:
  - Removed Dialog-based create/edit form and related state (formData, submitting, editingId, dialogOpen)
  - Removed unused imports (Label, Switch, Dialog components)
  - Added setView, setEditingDocId from store
  - handleOpenAdd now navigates to 'customer-form' view
  - handleOpenEdit now navigates to 'customer-form' view with editingDocId
  - Table rows are clickable to edit
  - Delete dialog kept as-is

- Updated `src/components/sales/sales-orders-list.tsx`:
  - Removed Sheet-based create/edit form and all related state/logic
  - Removed unused interfaces (Item, OrderLineInput, emptyLine) and functions (calcLineTotal, calcSubtotal, calcTaxAmount, calcTotal, handleItemSelect, addLine, removeLine, updateLine, handleSubmit)
  - Added setView, setEditingDocId from store
  - handleOpenNew now navigates to 'sales-order-form' view
  - handleOpenEdit now navigates to 'sales-order-form' view with editingDocId
  - Kept detail dialog, confirm dialog, cancel dialog, and "Create Delivery Note" workflow
  - Removed fetchItems and items state (no longer needed)

- Updated `src/components/sales/sales-invoices-list.tsx`:
  - Removed Sheet-based create/edit form and all related state/logic
  - Removed unused interfaces (Item, InvoiceLineInput, emptyLine) and functions (calcLineTotal, calcSubtotal, calcTotal, handleItemSelect, addLine, removeLine, updateLine, handleSubmit)
  - Added setView, setEditingDocId from store
  - handleOpenNew now navigates to 'sales-invoice-form' view
  - handleOpenEdit now navigates to 'sales-invoice-form' view with editingDocId
  - Kept detail dialog, confirm dialog, cancel dialog
  - Updated localStorage pendingSalesInvoice handler to navigate to form page instead of opening sheet
  - Removed fetchItems and items state (no longer needed)

Stage Summary:
- Sales module now uses full pages for create/edit instead of popup dialogs/sheets
- 3 new form page components created: customer-form-page, sales-order-form-page, sales-invoice-form-page
- 3 list components updated to navigate to form pages instead of using dialogs/sheets
- All form pages follow the same pattern as their Purchase module counterparts
- Lint passes cleanly, dev server running successfully

---
Task ID: 1
Agent: Main Agent
Task: Fix bugs and convert Sales module to dedicated pages

Work Log:
- Fixed supplier-form-page.tsx bug: replaced undefined `editingId` with `editingDocId` in 3 places (loadSupplier call, useEffect dependency, payload id field)
- Updated store.ts types: added missing view IDs to InventoryView (item-detail, stock-transfer-form, material-requests, delivery-notes, purchase-receipts, pick-lists) and SalesView (sales-orders, customer-form, sales-order-form, sales-invoice-form)
- Created customer-form-page.tsx: Full-page form for adding/editing customers with Save button, edit support via editingDocId
- Created sales-order-form-page.tsx: Full-page form with Save (حفظ كمسودة) / Submit (تأكيد) workflow, line items, totals, status badges, read-only when confirmed
- Created sales-invoice-form-page.tsx: Full-page form with Save/Submit workflow, pre-fill from localStorage (pendingSalesInvoice), status badges for all states
- Updated page.tsx: Added imports and route cases for all 3 new sales form pages
- Updated customers-list.tsx: Removed Dialog popup, navigates to customer-form page
- Updated sales-orders-list.tsx: Removed Sheet popup, navigates to sales-order-form page
- Updated sales-invoices-list.tsx: Removed Sheet popup, navigates to sales-invoice-form page
- All components follow same pattern as Purchase module form pages
- Lint passes cleanly

Stage Summary:
- Sales module now uses full dedicated pages instead of popup dialogs (matching Purchases module pattern)
- Both Purchases and Sales modules now consistently use: list → form page navigation
- Save (حفظ كمسودة) creates DRAFT, Submit (تأكيد) confirms the document
- All form pages support edit mode via editingDocId from store
- Supplier form page bug fixed (editingId → editingDocId)
- Store types updated to include all view IDs

---
Task ID: 7
Agent: API Agent
Task: Create Purchases Analytics API endpoint

Work Log:
- Created `src/app/api/purchases/analytics/route.ts` - GET endpoint for Purchases module dashboard analytics
  - Accepts `companyId` as a query parameter (required)
  - Requires `purchases.view` permission via requirePermission
  - Returns comprehensive analytics data as JSON with status 200
  - Data returned:
    - `supplierCount`: Total number of suppliers for the company
    - `activeSupplierCount`: Number of active suppliers (isActive=true)
    - `totalPurchaseOrders`: Total purchase orders count
    - `pendingPurchaseOrders`: Purchase orders with DRAFT status
    - `confirmedPurchaseOrders`: Purchase orders with CONFIRMED status
    - `totalPurchaseInvoices`: Total purchase invoices count
    - `pendingPurchaseInvoices`: Purchase invoices with DRAFT status
    - `totalPurchaseAmount`: Sum of totalAmount from CONFIRMED invoices
    - `totalPaidAmount`: Sum of paidAmount from CONFIRMED invoices
    - `totalBalanceDue`: Sum of balanceDue from CONFIRMED invoices
    - `recentOrders`: Last 10 purchase orders with id, number, supplierName, date, totalAmount, status
    - `recentInvoices`: Last 10 purchase invoices with id, number, supplierName, date, totalAmount, status, balanceDue
    - `topSuppliers`: Top 10 suppliers by confirmed invoice totalAmount with supplierId, supplierName, totalAmount, invoiceCount
    - `monthlyPurchases`: Monthly aggregation (last 12 months) with month (YYYY-MM), totalAmount, invoiceCount
  - Uses Promise.all for parallel execution of independent count queries
  - Uses Prisma aggregate for financial sums (totalAmount, paidAmount, balanceDue)
  - Uses Prisma groupBy for top suppliers by supplierId
  - Monthly aggregation done in JavaScript (fetch + Map grouping) for SQLite compatibility
  - All queries filtered by companyId
  - Follows existing API patterns: requirePermission, companyId validation, Arabic error messages, error handling
- Lint passes cleanly
---
Task ID: 8
Agent: API Agent
Task: Create Sales Analytics API endpoint

Work Log:
- Created `src/app/api/sales/analytics/route.ts` - GET endpoint for Sales module dashboard analytics
  - Accepts `companyId` as a required query parameter
  - Returns comprehensive analytics data including:
    - `customerCount`: Total number of customers for the company
    - `activeCustomerCount`: Number of active customers (isActive: true)
    - `totalSalesOrders`: Total sales orders count
    - `pendingSalesOrders`: Count of DRAFT status sales orders
    - `confirmedSalesOrders`: Count of CONFIRMED status sales orders
    - `totalSalesInvoices`: Total sales invoices count
    - `pendingSalesInvoices`: Count of DRAFT status sales invoices
    - `totalSalesAmount`: Sum of totalAmount from all CONFIRMED/PAID invoices
    - `totalPaidAmount`: Sum of paidAmount from all CONFIRMED/PAID invoices
    - `totalBalanceDue`: Sum of balanceDue from all CONFIRMED/PAID invoices
    - `recentOrders`: Last 5 orders with id, number, customerName, date, totalAmount, status
    - `recentInvoices`: Last 5 invoices with id, number, customerName, date, totalAmount, status, balanceDue
    - `topCustomers`: Top 10 customers by totalAmount from confirmed/paid invoices, with invoiceCount
    - `monthlySales`: Monthly aggregation of sales (month, totalAmount, invoiceCount) from confirmed/paid invoices
  - All queries filter by companyId
  - Uses Promise.all for parallel query execution (12 independent queries)
  - Financial totals computed by fetching confirmed/paid invoices and summing in-memory
  - Top customers aggregated using Map from confirmed/paid invoices
  - Monthly sales aggregated using Map with YYYY-MM key format, sorted chronologically
  - All monetary values rounded to 2 decimal places
  - Error handling with Arabic error message for internal errors
  - Follows same pattern as inventory analytics endpoint
- Lint passes cleanly


---
Task ID: 4
Agent: UI Agent
Task: Create Purchases Dashboard component (لوحة تحكم المشتريات)

Work Log:
- Created `src/components/purchases/purchases-dashboard.tsx` - Full dashboard page for the Purchases module
- Component features:
  - 'use client' component that fetches data from `/api/purchases/analytics?companyId=${companyId}`
  - **Stat Cards** (4-card grid): إجمالي المشتريات (TrendingUp, orange), الموردين (Building2, purple), أوامر شراء معلقة (ClipboardList, amber), فواتير معلقة (FileText, red)
    - Alert badges for pending orders/invoices with animate-pulse
  - **Quick Actions** (5-column grid on desktop, 2 on mobile): الموردين, أمر شراء جديد, فاتورة شراء جديدة, أوامر الشراء, فواتير الشراء
    - Each with color-coded icon, label, description, and hover animation
    - Uses setView() for navigation
  - **Analytics Row** (2-column):
    - Left: أعلى الموردين (Top Suppliers) - ranked list with bar chart visualization, color-coded progress bars, invoice count per supplier
    - Right: آخر أوامر الشراء (Recent Purchase Orders) - list with status badges, supplier name, date, amount
  - **Financial Summary Card** (3-column grid):
    - إجمالي المشتريات (Total Purchase Amount) - orange theme
    - إجمالي المدفوع (Total Paid) - emerald theme with payment progress bar
    - المتبقي (Balance Due) - red theme when >0 with AlertTriangle icon, green checkmark when 0
  - **Bottom Row** (2-column):
    - Left: آخر الفواتير (Recent Invoices) - list with status badges, balance due shown in red
    - Right: المشتريات الشهرية (Monthly Purchases) - bar chart of monthly amounts with invoice counts
  - Loading skeleton states for all sections
  - Empty states with relevant icons
  - max-h-72 overflow-y-auto for scrollable lists
  - Arabic labels throughout
  - Same styling patterns as inventory dashboard (Card with border shadow-sm, rounded-xl icons, color-coded sections, progress bars)
  - Icons imported from lucide-react: Building2, ClipboardList, FileText, PackageCheck, Receipt, TrendingUp, AlertTriangle, ArrowRight, Loader2
  - Uses useAppStore for companyId and setView
  - Uses formatCurrency, formatDate, getStatusColor, getStatusLabel from erp-utils
- Lint passes cleanly

---
Task ID: 5
Agent: UI Agent
Task: Create Sales Dashboard component (لوحة تحكم المبيعات)

Work Log:
- Created `src/components/sales/sales-dashboard.tsx` - Full dashboard page for the Sales module (المبيعات)
  - Follows the exact same styling patterns as the Inventory Dashboard (inventory-dashboard.tsx)
  - 'use client' component that fetches data from `/api/sales/analytics?companyId=${companyId}`
  - Stat Cards (4 cards in a grid):
    - إجمالي المبيعات (totalSalesAmount) - TrendingUp icon, emerald color scheme, currency formatted
    - العملاء (customerCount) - Users icon, teal color scheme
    - أوامر بيع معلقة (pendingSalesOrders) - ClipboardCheck icon, amber color scheme, alert badge when > 0
    - فواتير معلقة (pendingSalesInvoices) - FileText icon, red color scheme, alert badge when > 0
  - Quick Action Shortcuts (5 columns on desktop, 2 on mobile):
    - العملاء → viewId: 'customers' - Users icon, emerald color
    - أمر بيع جديد → viewId: 'sales-order-form' - ClipboardCheck icon, amber color
    - فاتورة بيع جديدة → viewId: 'sales-invoice-form' - FileText icon, orange color
    - أوامر البيع → viewId: 'sales-orders' - ShoppingCart icon, teal color
    - فواتير البيع → viewId: 'sales-invoices' - Receipt icon, purple color
  - Analytics Row (2 cards side by side):
    - Left: أعلى العملاء (Top Customers) - list with bar chart visualization, progress bars, invoice count per customer
    - Right: آخر أوامر البيع (Recent Sales Orders) - list with status badges, amount, date
  - Financial Summary Card:
    - إجمالي المبيعات (Total Sales Amount) - emerald color scheme
    - إجمالي المحصل (Total Paid/Collected) - teal color scheme
    - المتبقي (Balance Due) - red color when > 0 with AlertTriangle icon and "مبالغ مستحقة" warning
  - Bottom Row (2 cards side by side):
    - Left: آخر الفواتير (Recent Invoices) - list with status badges and balanceDue shown in red
    - Right: المبيعات الشهرية (Monthly Sales) - bar chart with Arabic month names, colored bars, invoice count
  - Loading skeleton states matching inventory dashboard pattern
  - All labels in Arabic
  - RTL layout, useAppStore for companyId and setView
  - formatCurrency, formatDate from erp-utils
  - Color-coded sections, rounded-xl icons, max-h-72 overflow-y-auto for scrollable lists
  - hover:shadow-md transition effects on stat cards and action buttons
- Lint passes cleanly

Stage Summary:
- Sales Dashboard component created with all 6 required sections
- Fetches from existing `/api/sales/analytics` endpoint
- All Arabic labels, consistent styling with inventory dashboard
- Financial summary highlights outstanding amounts in red
- Top customers shown with bar chart visualization
- Monthly sales displayed with Arabic month names
---
Task ID: 10
Agent: Main Agent
Task: Add Purchases and Sales dashboards with analytics, enhance document linking

Work Log:
- Created `/src/app/api/purchases/analytics/route.ts` - GET endpoint for purchases dashboard analytics (supplier count, order counts, invoice counts, financial totals, recent orders/invoices, top suppliers, monthly purchases)
- Created `/src/app/api/sales/analytics/route.ts` - GET endpoint for sales dashboard analytics (customer count, order counts, invoice counts, financial totals, recent orders/invoices, top customers, monthly sales)
- Created `/src/components/purchases/purchases-dashboard.tsx` - Full dashboard with stat cards, quick action shortcuts, top suppliers chart, recent orders, financial summary, recent invoices, monthly purchases chart
- Created `/src/components/sales/sales-dashboard.tsx` - Full dashboard with stat cards, quick action shortcuts, top customers chart, recent orders, financial summary, recent invoices, monthly sales chart
- Updated `/src/app/page.tsx` - Added PurchasesDashboard and SalesDashboard imports, rendered when module is selected without a view
- Added "Create Purchase Invoice from Purchase Order" button in purchase-orders-list.tsx (both in table actions and detail dialog)
- Added "Create Sales Invoice from Sales Order" button in sales-orders-list.tsx (both in table actions and detail dialog)
- Removed unused payment-vouchers-list.tsx component from Purchases
- All lint checks pass, dev server running

Stage Summary:
- Purchases and Sales modules now have rich dashboards with analytics (similar to Inventory Dashboard)
- Document linking enhanced: Purchase Order → Purchase Invoice, Sales Order → Sales Invoice
- Quick action shortcuts on dashboards for fast navigation
- Financial summaries with total amounts, paid amounts, and balance due
- Monthly trend charts for purchases and sales
- Top suppliers/customers visualization with progress bars

