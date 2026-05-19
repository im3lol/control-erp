# Task 4 - API Agent: Create Sales Orders API routes

## Summary
Created both Sales Orders API route files following the exact same pattern as the existing Sales Invoices API.

## Files Created
1. `src/app/api/sales/orders/route.ts` - GET (list with filters) + POST (create with auto-numbering)
2. `src/app/api/sales/orders/[id]/route.ts` - GET (single with full relations) + PUT (4 actions: update, confirm, cancel, close)

## Key Decisions
- Sales Order confirm does NOT perform stock movements (unlike Sales Invoice confirm) because orders are not stock documents - only delivery notes/invoices move stock
- Cancel of a confirmed order is a simple status change (no stock reversal needed)
- Close action checks that all lines have deliveredQty >= quantity before transitioning
- Tax calculation uses taxPercent on subtotal rather than requiring explicit taxAmount input
- Document number format: SO-{year}-{seq} (e.g., SO-2026-0001)

## Lint
- Passes cleanly with no errors
