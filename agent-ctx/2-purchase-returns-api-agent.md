# Task 2 - Purchase Returns API Agent

## Task: Create Purchase Returns API endpoints

## Files Created:
1. `/home/z/my-project/src/app/api/purchases/returns/route.ts` - GET (list) + POST (create)
2. `/home/z/my-project/src/app/api/purchases/returns/[id]/route.ts` - GET (single) + PUT (actions)

## Key Implementation Details:

### GET /api/purchases/returns
- Lists purchase returns for a company (companyId required)
- Supports filters: status, supplierId, fromDate, toDate
- Includes: supplier, warehouse, purchaseOrder (number), purchaseInvoice (number), purchaseReceipt (number), lines with item details, _count of lines

### POST /api/purchases/returns
- Auto-generates number: `PRET-{YYYY}-{0001}` using generateDocNumber
- Validates: companyId, supplierId, warehouseId, lines (at least 1)
- Validates linked documents (purchaseOrder, purchaseInvoice, purchaseReceipt) belong to company
- Calculates totalAmount from lines (quantity * unitPrice per line)
- Defaults status to DRAFT
- Returns created record with full includes

### GET /api/purchases/returns/[id]
- Gets single purchase return with full details
- Includes: supplier (with phone/address), warehouse (with type), linked documents (with status), lines with item + uom

### PUT /api/purchases/returns/[id] - Three actions:
- **confirm**: DRAFT → CONFIRMED, uses $transaction to:
  - Check sufficient stock for each line (throws error if insufficient)
  - Create OUT StockMovement for each line (referenceType: PURCHASE_RETURN)
  - Update ItemBalance: reduce quantity, recalculate avgCost
  - Update status to CONFIRMED
- **cancel**: DRAFT → CANCELLED only (no stock reversal since DRAFT never affected stock)
- **update**: Only while DRAFT, supports field updates and line replacement with recalculation

## Auth: Uses requirePermission with purchases.view, purchases.create, purchases.confirm, purchases.edit

## Lint: Passes cleanly with no errors
