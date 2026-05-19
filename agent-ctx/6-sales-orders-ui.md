# Task 6 - Sales Orders UI Component

## Summary
Created `/home/z/my-project/src/components/sales/sales-orders-list.tsx` - a comprehensive Sales Orders component following the exact same pattern as `sales-invoices-list.tsx`.

## Key Features Implemented
1. **List View**: Table with columns رقم, العميل, التاريخ, الإجمالي, المسلم, الحالة, إجراءات
2. **Filters**: Status, customer, date range, item filter
3. **New/Edit Sheet**: Full form with header fields, dynamic line items, tax percent, totals
4. **Detail Dialog**: Full order details with delivered qty tracking, linked delivery notes
5. **Workflow Actions**: Confirm (DRAFT→CONFIRMED), Cancel (DRAFT/CONFIRMED→CANCELLED)
6. **Create Delivery Note**: Stores order data in localStorage and navigates to inventory/delivery-notes
7. **Delivered Qty Tracking**: Progress bar in list, per-line badges in detail

## Status
- Lint passes cleanly
- Work log appended to `/home/z/my-project/worklog.md`
