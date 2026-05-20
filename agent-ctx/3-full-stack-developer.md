# Task 3 - Stock Transaction Form Pages

## Task: Create 4 full-page form components for stock transactions AND update their corresponding list components

## Work Completed

### New Form Page Components Created
1. `src/components/inventory/material-request-form-page.tsx` - Material Request form with barcode + search, Save Draft / Submit buttons, edit support via editingDocId
2. `src/components/inventory/delivery-note-form-page.tsx` - Delivery Note form with sales invoice/order auto-fill, barcode + search, Create Sales Invoice shortcut
3. `src/components/inventory/purchase-receipt-form-page.tsx` - Purchase Receipt form with PO auto-fill, barcode + search, Create Purchase Invoice shortcut
4. `src/components/inventory/pick-list-form-page.tsx` - Pick List form with IN_PROGRESS pickedQty editing, barcode + search

### List Components Updated (dialogs removed, navigation added)
1. `src/components/inventory/material-requests-list.tsx` - No more Dialog/AlertDialog, navigates to material-request-form
2. `src/components/inventory/delivery-notes-list.tsx` - No more Dialog/AlertDialog, navigates to delivery-note-form
3. `src/components/inventory/purchase-receipts-list.tsx` - No more Dialog/AlertDialog, navigates to purchase-receipt-form
4. `src/components/inventory/pick-lists-list.tsx` - No more Dialog/AlertDialog, navigates to pick-list-form

### Key Patterns
- All forms use Card layout, back button, Save Draft + Submit buttons
- Barcode scanning: Input with ScanLine icon, searches `/api/inventory/item-codes?companyId=X&code=BARCODE`
- Name search: Input with Search icon, filters items locally with autocomplete dropdown
- Navigation: `setModule('inventory')` + `setView('xxx-form')` + `setEditingDocId(id)`
- Status badges in form headers
- Inline status actions (confirm, cancel) preserved in list tables
- localStorage pre-fill support for workflow navigation from other modules
