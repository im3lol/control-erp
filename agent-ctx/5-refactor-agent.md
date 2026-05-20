# Task 5 - Refactor Agent: Purchase Receipt Form Page

## Task
Refactor the Purchase Receipt form page to use shared document components and improve UI/UX segmentation.

## What was done
- Replaced custom `getStatusBadge` with `getDocumentStatusBadge` from shared component
- Replaced custom page header with `DocumentPageHeader` (PackageCheck icon, sky/blue styling)
- Added `WorkflowStepper` showing: أمر الشراء → إذن الاستلام → فاتورة الشراء
- Added `LinkedDocumentBadge` for linked purchase order
- Replaced all `Card` components with `DocumentSection`
- Added icons: PackageCheck (info), Package (lines), FileText (notes) — all with sky-600 color
- Moved "إنشاء فاتورة شراء" to shortcutActions
- Improved barcode/search area with bg-slate-50/60
- Added alternating row backgrounds
- Removed redundant notes Input from info section
- Added linkedPurchaseOrderNumber/linkedPurchaseInvoiceNumber state for workflow
- Loading spinner changed to sky-600

## No changes to
- API endpoints
- Business logic
- Data types

## Lint: PASS
