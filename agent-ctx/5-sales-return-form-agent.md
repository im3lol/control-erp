# Task 5 - Sales Return Form Agent

## Task
Create the SalesReturnFormPage component at `/home/z/my-project/src/components/sales/sales-return-form-page.tsx`

## Summary
Created a full-page form component for creating and editing sales returns (مرتجع مبيعات) following the exact same design pattern as the existing sales-order-form-page.tsx.

## Key Implementation Details
- **File**: `src/components/sales/sales-return-form-page.tsx` (~520 lines)
- **Color Identity**: Red (bg-red-50, text-red-600) — denotes reverse/return operation
- **Icon**: Undo2 from lucide-react
- **Header**: DocumentPageHeader with new title "مرتجع مبيعات جديد" and edit title "مرتجع مبيعات"
- **Workflow Stepper**: Extends sales workflow (أمر البيع → إذن الصرف → فاتورة البيع) with مرتجع البيع step
- **LinkedDocumentBadge**: Shows linked sales order, delivery note, sales invoice numbers
- **Info Section**: Date, Customer (select), Warehouse (select), linked document reference (read-only)
- **Lines Section**: Table with كود الصنف, اسم الصنف, الكمية, السعر, الإجمالي, حذف columns + barcode/search
- **Totals Section**: Item count, total quantity, total amount (text-2xl text-red-600)
- **Notes Section**: Textarea

## Pre-fill Logic
Reads from `localStorage.getItem('pendingSalesReturn')` on mount:
- sourceType, sourceId, sourceNumber → sets linked document
- customerId, warehouseId → pre-fills customer & warehouse
- lines[] → pre-fills return lines with originalQty reference

## Workflow States
- DRAFT: Editable, can save & confirm
- CONFIRMED: Read-only
- CANCELLED: Read-only

## API Endpoints Used
- GET/POST `/api/sales/returns`
- GET/PUT `/api/sales/returns/[id]`
- GET `/api/sales/customers`
- GET `/api/inventory/warehouses`
- GET `/api/inventory/items`

## Lint Status
✅ 0 errors, 0 warnings in this file
