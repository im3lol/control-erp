# Task 3-a - Sales Form Pages Agent

## Task
Create 3 new dedicated full-page form components for the Sales module, converting from popup/drawer patterns to dedicated pages.

## Work Completed

### 1. Customer Form Page (`src/components/sales/customer-form-page.tsx`)
- Full-page form with back navigation, Save button
- Fields: code (auto C-0001), nameAr*, nameEn, phone, email, address, creditLimit, paymentTerms, isActive switch
- Uses editingDocId from store for edit mode
- API: POST/PUT `/api/sales/customers`
- Follows exact pattern of SupplierFormPage

### 2. Sales Order Form Page (`src/components/sales/sales-order-form-page.tsx`)
- Full-page form with Save (حفظ كمسودة) / Submit (تأكيد) workflow
- Header: customer select, date, due date
- Lines: item, quantity, unit price, discount, tax, line total
- Footer: discount, tax percent, totals summary
- Auto-fills unit price from item's sellPrice
- Status badges: DRAFT, CONFIRMED, CANCELLED, CLOSED
- Read-only when not DRAFT
- API: POST/PUT `/api/sales/orders`

### 3. Sales Invoice Form Page (`src/components/sales/sales-invoice-form-page.tsx`)
- Full-page form with Save/Submit workflow
- Same structure as order form
- Support pre-fill from localStorage `pendingSalesInvoice`
- Status badges: DRAFT, CONFIRMED, PARTIAL_PAID, PAID, CANCELLED
- API: POST/PUT `/api/sales/invoices`

### 4. Page.tsx Updates
- Added imports for all 3 form pages
- Added view titles: customer-form, sales-order-form, sales-invoice-form
- Added route cases in Sales module switch

### 5. List Components Updated
- **customers-list.tsx**: Removed Dialog, navigates to customer-form page
- **sales-orders-list.tsx**: Removed Sheet, navigates to sales-order-form page, kept detail/confirm/cancel dialogs
- **sales-invoices-list.tsx**: Removed Sheet, navigates to sales-invoice-form page, kept detail/confirm/cancel dialogs, updated localStorage handler

## Lint: Passes cleanly
## Dev Server: Running successfully
