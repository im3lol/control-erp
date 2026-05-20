# Control ERP - Worklog

---
Task ID: 1
Agent: Main Orchestrator
Task: Create shared document page UI components and refactor all document form pages with improved UI/UX segmentation

Work Log:
- Read current project state: page.tsx, store.ts, schema.prisma
- Read all existing document form pages (material-request, delivery-note, purchase-receipt, pick-list, purchase-order, sales-order)
- Identified consistent patterns across all form pages that need standardization
- Starting implementation of shared document components

Stage Summary:
- Project has 8 document form pages that need UI/UX improvement
- All pages follow similar structure: header, info card, lines card, totals/notes card
- Key improvement areas: consistent layout, workflow visualization, better visual segmentation

---
Task ID: 7
Agent: Refactor Agent
Task: Refactor Purchase Order form page to use shared document components and improve UI/UX segmentation

Work Log:
- Read worklog.md to understand previous agent work (Task 1: created shared components)
- Read current purchase-order-form-page.tsx (866 lines, custom header/cards/status badge)
- Read all shared components: DocumentPageHeader, getDocumentStatusBadge, DocumentSection, LinkedDocumentBadge, WorkflowStepper, getPurchaseWorkflow
- Replaced custom getStatusBadge with getDocumentStatusBadge from shared component
- Replaced custom page header with DocumentPageHeader component (supports primaryActions + shortcutActions)
- Added WorkflowStepper showing: أمر الشراء → إذن الاستلام → فاتورة الشراء
  - When DRAFT: أمر الشراء is "current", rest are "upcoming"
  - When CONFIRMED: أمر الشراء becomes "completed"
- Replaced Card components with DocumentSection for info, lines, totals, and notes sections
- Added icons to each DocumentSection: ClipboardList (info), Package (lines), Calculator (totals), FileText (notes)
- Improved barcode/search area: moved into lines section with bg-slate-50/60 background, better visual distinction
- Added alternating row backgrounds for line items (even rows bg-slate-50/70, odd rows bg-white)
- Improved line item header row with bg-slate-50 background and proper padding
- Enhanced totals section: larger total amount (text-2xl), added discount total row, better visual hierarchy with separators
- Used noPadding on lines section for full-bleed table layout
- Maintained all existing business logic: save draft, confirm, barcode scan, search, convert to purchase receipt
- All API endpoints unchanged
- Lint passes cleanly with no errors

Changes Summary:
- Removed: local getStatusBadge function, Card/CardHeader/CardContent/CardTitle imports, Badge import
- Added: DocumentPageHeader, getDocumentStatusBadge, DocumentSection, WorkflowStepper, getPurchaseWorkflow imports
- Added: ClipboardList, Package, Calculator icon imports
- Emerald green identity preserved throughout (bg-emerald-50, text-emerald-600, bg-emerald-600)
- RTL Arabic maintained

---
Task ID: 9
Agent: Refactor Agent
Task: Refactor Sales Order form page to use shared document components and improve UI/UX segmentation

Work Log:
- Read worklog.md to understand previous agent work (Task 1: created shared components, Task 7: refactored purchase order)
- Read current sales-order-form-page.tsx (816 lines, custom header/cards/status badge)
- Read all shared components: DocumentPageHeader, getDocumentStatusBadge, DocumentSection, LinkedDocumentBadge, WorkflowStepper, getSalesWorkflow
- Replaced custom getStatusBadge with getDocumentStatusBadge from shared component
- Replaced custom page header with DocumentPageHeader component (supports primaryActions + shortcutActions)
- Added WorkflowStepper showing: أمر البيع → إذن الصرف → فاتورة البيع
  - When DRAFT: أمر البيع is "current", rest are "upcoming"
  - When CONFIRMED/CLOSED: أمر البيع becomes "completed"
- Replaced Card components with DocumentSection for info, lines, totals, and notes sections
- Added icons to each DocumentSection: ClipboardList (info), Package (lines), Calculator (totals), FileText (notes)
- Improved barcode/search area: moved into lines section with bg-slate-50/60 background, better visual distinction
- Added alternating row backgrounds for line items (even rows bg-slate-50/70, odd rows bg-white)
- Improved line item header row with bg-slate-50 background and proper padding
- Enhanced totals section: larger total amount (text-2xl), added discount total row, better visual hierarchy with separators
- Used noPadding on lines section for full-bleed table layout
- Maintained all existing business logic: save draft, confirm, barcode scan, search, convert to delivery note
- All API endpoints unchanged
- Lint passes cleanly with no errors

Changes Summary:
- Removed: local getStatusBadge function, Card/CardHeader/CardContent/CardTitle imports, Badge import
- Added: DocumentPageHeader, getDocumentStatusBadge, DocumentSection, WorkflowStepper, getSalesWorkflow imports
- Added: ClipboardList, Package, Calculator icon imports
- Emerald green identity preserved throughout (bg-emerald-50, text-emerald-600, bg-emerald-600)
- RTL Arabic maintained

---
Task ID: 4
Agent: Refactor Agent
Task: Refactor Delivery Note form page to use shared document components and improve UI/UX segmentation

Work Log:
- Read worklog.md to understand previous agent work (Task 1: created shared components, Task 7: refactored purchase order, Task 9: refactored sales order)
- Read current delivery-note-form-page.tsx (932 lines, custom header/cards/status badge)
- Read all shared components: DocumentPageHeader, getDocumentStatusBadge, DocumentSection, LinkedDocumentBadge, WorkflowStepper, getSalesWorkflow
- Replaced custom getStatusBadge with getDocumentStatusBadge from shared component
- Replaced custom page header with DocumentPageHeader component using Truck icon with amber styling (bg-amber-50, text-amber-600) — delivery/shipment identity
- Added WorkflowStepper showing: أمر البيع → إذن الصرف → فاتورة البيع
  - أمر البيع: "completed" if linked sales order exists, "upcoming" otherwise
  - إذن الصرف: "current" when DRAFT, "completed" when CONFIRMED
  - فاتورة البيع: "completed" if linked sales invoice exists, "upcoming" otherwise
- Added linked document numbers tracking (noteSalesOrderNumber, noteSalesInvoiceNumber) for workflow stepper & badges
- Added LinkedDocumentBadge for linked sales order and sales invoice displayed below workflow stepper
- Replaced Card components with DocumentSection for info, lines, and notes sections
- Added icons to each DocumentSection: Truck (info, amber), Package (lines, amber), FileText (notes, amber)
- Improved barcode/search area: moved into lines section with bg-slate-50/60 background, better visual distinction
- Added alternating row backgrounds for line items (even rows bg-white, odd rows bg-slate-50/70)
- Improved line item header row with bg-slate-50 background and proper padding
- Moved "إنشاء فاتورة بيع" button to shortcutActions on DocumentPageHeader with amber styling
- Used noPadding on lines section for full-bleed table layout
- Added empty state message when no lines exist
- Maintained all existing business logic: save draft, confirm, barcode scan, search, sales order/invoice auto-fill, create sales invoice shortcut
- All API endpoints unchanged
- Lint passes cleanly with no errors

Changes Summary:
- Removed: local getStatusBadge function, Card/CardHeader/CardContent/CardTitle imports, Badge import, ArrowRight import (now handled by DocumentPageHeader)
- Added: DocumentPageHeader, getDocumentStatusBadge, DocumentSection, LinkedDocumentBadge, WorkflowStepper, getSalesWorkflow imports
- Added: Package icon import (Truck, FileText, ScanLine, Search, Plus, XCircle, Loader2, Save, Send already existed)
- Added: noteSalesOrderNumber, noteSalesInvoiceNumber state variables for workflow stepper linked document numbers
- Amber color identity for delivery note document (bg-amber-50, text-amber-600) — distinct from emerald green used by other docs
- Emerald green identity preserved for action buttons and general UI (bg-emerald-600, text-emerald-600)
- RTL Arabic maintained

---
Task ID: 5
Agent: Refactor Agent
Task: Refactor Purchase Receipt form page to use shared document components and improve UI/UX segmentation

Work Log:
- Read worklog.md to understand previous agent work (Task 1: created shared components, Task 7: refactored purchase order, Task 9: refactored sales order, Task 4: refactored delivery note)
- Read current purchase-receipt-form-page.tsx (833 lines, custom header/cards/status badge)
- Read all shared components: DocumentPageHeader, getDocumentStatusBadge, DocumentSection, LinkedDocumentBadge, WorkflowStepper, getPurchaseWorkflow
- Replaced custom getStatusBadge with getDocumentStatusBadge from shared component
- Replaced custom page header with DocumentPageHeader component using PackageCheck icon with sky/blue styling (bg-sky-50, text-sky-600) — receiving document identity
- Added WorkflowStepper showing purchase workflow: أمر الشراء → إذن الاستلام → فاتورة الشراء
  - أمر الشراء: "completed" if linked purchase order exists, "upcoming" otherwise
  - إذن الاستلام: "current" when DRAFT, "completed" when CONFIRMED
  - فاتورة الشراء: "completed" if linked purchase invoice exists, "upcoming" otherwise
- Added linked document numbers tracking (linkedPurchaseOrderNumber, linkedPurchaseInvoiceNumber) for workflow stepper & badges
- Added LinkedDocumentBadge for linked purchase order displayed below workflow stepper
- Replaced Card components with DocumentSection for info, lines, and notes sections
- Added icons to each DocumentSection: PackageCheck (info, sky), Package (lines, sky), FileText (notes, sky)
- Improved barcode/search area: moved into lines section with bg-slate-50/60 background, better visual distinction, white input backgrounds
- Added alternating row backgrounds for line items (even rows bg-white, odd rows bg-slate-50/70)
- Improved line item header row with bg-slate-50 background and proper padding
- Moved "إنشاء فاتورة شراء" button to shortcutActions on DocumentPageHeader with sky styling
- Used noPadding on lines section for full-bleed table layout
- Added empty state message when no lines exist
- Updated loading spinner color to sky-600 to match document identity
- Maintained all existing business logic: save draft, confirm, barcode scan, search, PO auto-fill, create purchase invoice shortcut
- All API endpoints unchanged
- Lint passes cleanly with no errors

Changes Summary:
- Removed: local getStatusBadge function, Card/CardHeader/CardContent/CardTitle imports, Badge import, ArrowRight import (now handled by DocumentPageHeader)
- Removed: redundant notes Input field in info section (notes now only in dedicated notes section with Textarea)
- Added: DocumentPageHeader, getDocumentStatusBadge, DocumentSection, LinkedDocumentBadge, WorkflowStepper, getPurchaseWorkflow imports
- Added: Package icon import (PackageCheck, FileText, ScanLine, Search, Plus, XCircle, Loader2, Save, Send already existed)
- Added: linkedPurchaseOrderNumber, linkedPurchaseInvoiceNumber state variables for workflow stepper linked document numbers
- Sky/blue color identity for purchase receipt document (bg-sky-50, text-sky-600) — distinct from emerald green (purchase order), amber (delivery note)
- Emerald green identity preserved for action buttons and general UI (bg-emerald-600, text-emerald-600)
- RTL Arabic maintained

---
Task ID: 3
Agent: Refactor Agent
Task: Refactor Material Request form page to use shared document components and improve UI/UX segmentation

Work Log:
- Read worklog.md to understand previous agent work (Task 1: created shared components, Task 7: refactored purchase order, Task 9: refactored sales order, Task 4: refactored delivery note, Task 5: refactored purchase receipt)
- Read current material-request-form-page.tsx (593 lines, custom header/cards/status badge)
- Read all shared components: DocumentPageHeader, getDocumentStatusBadge, DocumentSection, LinkedDocumentBadge, WorkflowStepper, getMaterialRequestWorkflow
- Replaced custom getStatusBadge with getDocumentStatusBadge from shared component
- Replaced custom page header with DocumentPageHeader component using ClipboardList icon with violet styling (bg-violet-50, text-violet-600) — material request identity
- Added WorkflowStepper showing material request workflow: طلب المواد → اعتماد → تلبية
  - When DRAFT/NEW: طلب المواد = current, اعتماد = upcoming, تلبية = upcoming
  - When PENDING: طلب المواد = completed, اعتماد = current, تلبية = upcoming
  - When APPROVED: طلب المواد = completed, اعتماد = completed, تلبية = current
  - When FULFILLED: all completed
  - When CANCELLED: طلب المواد = current (reverted to draft-like state)
- Replaced Card components with DocumentSection for info, lines, and notes sections
- Added icons to each DocumentSection: ClipboardList (info, violet), Package (lines, violet), FileText (notes, violet)
- Removed duplicate notes field: notes Input was in both the info card AND a separate notes card — kept only the dedicated notes section with Textarea
- Changed info section from 3-column to 2-column grid (removed notes field from info section)
- Improved barcode/search area: moved into lines section with bg-slate-50/60 background, white input backgrounds, better visual distinction
- Added alternating row backgrounds for line items (even rows bg-white, odd rows bg-slate-50)
- Improved line item header row with bg-slate-50 background and proper padding
- Added hover effects on remove button (hover:bg-red-50)
- Added empty state message when no lines exist
- Improved search dropdown with font-weight hierarchy (name bold, code mono secondary)
- Used noPadding on lines section for full-bleed table layout
- Updated loading spinner color to violet-600 to match document identity
- Maintained all existing business logic: save draft, submit/confirm, barcode scan, search
- All API endpoints unchanged
- Lint passes cleanly with no errors

Changes Summary:
- Removed: local getStatusBadge function, Card/CardHeader/CardContent/CardTitle imports, Badge import, ArrowRight import (now handled by DocumentPageHeader)
- Removed: redundant notes Input field in info section (notes now only in dedicated notes section with Textarea)
- Added: DocumentPageHeader, getDocumentStatusBadge, DocumentSection imports
- Added: WorkflowStepper import (custom workflow steps computed inline based on status)
- Added: Package, FileText icon imports (ClipboardList, ScanLine, Search, Plus, XCircle, Loader2, Save, Send already existed)
- Violet color identity for material request document (bg-violet-50, text-violet-600) — distinct from emerald green (purchase order), sky/blue (purchase receipt), amber (delivery note)
- Emerald green identity preserved for action buttons and general UI (bg-emerald-600, text-emerald-600)
- RTL Arabic maintained

---
Task ID: 6
Agent: Refactor Agent
Task: Refactor Pick List form page to use shared document components and improve UI/UX segmentation

Work Log:
- Read worklog.md to understand previous agent work (Task 1: created shared components, Task 7: refactored purchase order, Task 9: refactored sales order, Task 4: refactored delivery note, Task 5: refactored purchase receipt, Task 3: refactored material request)
- Read current pick-list-form-page.tsx (805 lines, custom header/cards/status badge)
- Read all shared components: DocumentPageHeader, getDocumentStatusBadge, DocumentSection, LinkedDocumentBadge, WorkflowStepper, getPickListWorkflow
- Replaced custom getStatusBadge with getDocumentStatusBadge from shared component
- Replaced custom page header with DocumentPageHeader component using ClipboardCheck icon with teal styling (bg-teal-50, text-teal-600) — pick list identity
- Added WorkflowStepper showing pick list workflow: قائمة التحضير → تحضير → اكتمال
  - When DRAFT/NEW: قائمة التحضير = current, تحضير = upcoming, اكتمال = upcoming
  - When IN_PROGRESS: قائمة التحضير = completed, تحضير = current, اكتمال = upcoming
  - When COMPLETED: all completed
  - When CANCELLED: قائمة التحضير = current (reverted to draft-like state)
- Added conditional primaryActions: DRAFT shows "حفظ كمسودة" + "تأكيد", IN_PROGRESS shows "حفظ بيانات التحضير" + "إكمال التحضير"
- Custom className on primaryActions for teal styling (border-teal-200, text-teal-700, bg-teal-600) — matching document identity
- Replaced Card components with DocumentSection for info, lines, and notes sections
- Added icons to each DocumentSection: ClipboardCheck (info, teal), Package (lines, teal), FileText (notes, teal)
- Removed duplicate notes field: notes Input was in both the info card AND a separate notes card — kept only the dedicated notes section with Textarea
- Changed info section from 3-column to 2-column grid (removed notes field from info section)
- Improved barcode/search area: moved into lines section with bg-slate-50/60 background, white input backgrounds, better visual distinction
- Added alternating row backgrounds for line items (even rows bg-white, odd rows bg-slate-50) — applied to both DRAFT and IN_PROGRESS line modes
- Improved line item header rows with bg-slate-50 background and proper padding
- Added hover effects on remove button (hover:bg-red-50)
- Added empty state message when no lines exist
- Improved search dropdown with font-weight hierarchy (name bold, code mono secondary) and teal hover (hover:bg-teal-50)
- Used noPadding on lines section for full-bleed table layout
- Updated loading spinner color to teal-600 to match document identity
- Maintained all existing business logic: save draft, submit/start picking, barcode scan, search, update picked lines, complete picking
- All API endpoints unchanged
- Lint passes cleanly with no errors

Changes Summary:
- Removed: local getStatusBadge function, Card/CardHeader/CardContent/CardTitle imports, Badge import, ArrowRight import (now handled by DocumentPageHeader)
- Removed: redundant notes Input field in info section (notes now only in dedicated notes section with Textarea)
- Added: DocumentPageHeader, getDocumentStatusBadge, DocumentSection imports
- Added: WorkflowStepper import (custom workflow steps computed inline based on status)
- Added: Package, FileText icon imports (ClipboardCheck, ScanLine, Search, Plus, XCircle, Loader2, Save, Send already existed)
- Teal color identity for pick list document (bg-teal-50, text-teal-600) — distinct from emerald green (purchase order), sky/blue (purchase receipt), amber (delivery note), violet (material request)
- Emerald green preserved for "إكمال التحضير" button (bg-emerald-600) — denotes completion action
- RTL Arabic maintained

---
Task ID: 8
Agent: Refactor Agent
Task: Refactor Purchase Invoice form page to use shared document components and improve UI/UX segmentation

Work Log:
- Read worklog.md to understand previous agent work (Task 1: created shared components, Tasks 3/4/5/6/7/9: refactored other document pages)
- Read current purchase-invoice-form-page.tsx (957 lines, custom header/cards/status badge)
- Read all shared components: DocumentPageHeader, getDocumentStatusBadge, DocumentSection, LinkedDocumentBadge, WorkflowStepper, getPurchaseWorkflow
- Replaced custom getStatusBadge with getDocumentStatusBadge from shared component
- Replaced custom page header with DocumentPageHeader component using Receipt icon with orange styling (bg-orange-50, text-orange-600) — purchase invoice identity
- Added WorkflowStepper showing purchase workflow: أمر الشراء → إذن الاستلام → فاتورة الشراء
  - فاتورة الشراء: "current" when DRAFT, "completed" when CONFIRMED/PARTIAL_PAID/PAID/CLOSED
  - أمر الشراء: "completed" if linked purchase order number exists, "upcoming" otherwise
  - إذن الاستلام: "completed" if linked purchase receipt number exists, "upcoming" otherwise
- Added linked document numbers tracking (linkedPurchaseReceiptNumber, linkedPurchaseOrderNumber) for workflow stepper & badges
- Added LinkedDocumentBadge for linked purchase receipt and purchase order displayed below workflow stepper
- Replaced Card components with DocumentSection for info, lines, totals, and notes sections
- Added icons to each DocumentSection: Receipt (info, orange), Package (lines, orange), Calculator (totals, orange), FileText (notes, orange)
- Improved barcode/search area: moved into lines section with bg-slate-50/60 background, white input backgrounds, better visual distinction
- Improved purchase receipt linking area: moved inside barcode/search bg-slate-50/60 container with amber-50/80 background, white Select background
- Added alternating row backgrounds for line items (even rows bg-slate-50/70, odd rows bg-white)
- Improved line item header row with bg-slate-50 background and proper padding
- Enhanced totals section: larger total amount (text-2xl), added discount total row with red color, better visual hierarchy with separators
- Used noPadding on lines section for full-bleed table layout
- Added empty state message when no lines exist
- Improved search dropdown with font-weight hierarchy (name bold, code mono secondary) and orange hover (hover:bg-orange-50)
- Updated loading spinner color to orange-600 to match document identity
- Custom className on primaryActions for orange styling (border-orange-200, text-orange-700, bg-orange-600) — matching document identity
- Maintained all existing business logic: save draft, confirm, barcode scan, search, purchase receipt linking, localStorage pre-fill from pendingPurchaseInvoice
- All API endpoints unchanged
- Lint passes cleanly with no errors

Changes Summary:
- Removed: local getStatusBadge function, Card/CardHeader/CardContent/CardTitle imports, Badge import, ArrowRight import (now handled by DocumentPageHeader)
- Added: DocumentPageHeader, getDocumentStatusBadge, DocumentSection, LinkedDocumentBadge, WorkflowStepper, getPurchaseWorkflow imports
- Added: Receipt, Package, Calculator icon imports (FileText, ScanLine, Search, Plus, XCircle, Loader2, Save, Send, PackageCheck already existed)
- Added: linkedPurchaseReceiptNumber, linkedPurchaseOrderNumber state variables for workflow stepper linked document numbers
- Orange color identity for purchase invoice document (bg-orange-50, text-orange-600) — distinct from emerald green (purchase order), sky/blue (purchase receipt), amber (delivery note), violet (material request), teal (pick list)
- Emerald green identity preserved for general UI where appropriate
- RTL Arabic maintained

---
Task ID: 10
Agent: Refactor Agent
Task: Refactor Sales Invoice form page to use shared document components and improve UI/UX segmentation

Work Log:
- Read worklog.md to understand previous agent work (Task 1: created shared components, Tasks 3/4/5/6/7/8/9: refactored other document pages)
- Read current sales-invoice-form-page.tsx (725 lines, custom header/cards/status badge)
- Read all shared components: DocumentPageHeader, getDocumentStatusBadge, DocumentSection, LinkedDocumentBadge, WorkflowStepper, getSalesWorkflow
- Read purchase-invoice-form-page.tsx and delivery-note-form-page.tsx as reference for patterns
- Replaced custom getStatusBadge with getDocumentStatusBadge from shared component
- Replaced custom page header with DocumentPageHeader component using FileText icon with rose styling (bg-rose-50, text-rose-600) — sales invoice identity
- Added WorkflowStepper showing sales workflow: أمر البيع → إذن الصرف → فاتورة البيع
  - فاتورة البيع: "current" when DRAFT, "completed" when CONFIRMED/PARTIAL_PAID/PAID/CLOSED
  - أمر البيع: "completed" if linked sales order number exists, "upcoming" otherwise
  - إذن الصرف: "completed" if linked delivery note number exists, "upcoming" otherwise
- Added linked document numbers tracking (linkedSalesOrderNumber, linkedDeliveryNoteNumber) for workflow stepper & badges
- Added LinkedDocumentBadge for linked sales order and delivery note displayed below workflow stepper
- Replaced Card components with DocumentSection for info, lines, totals, and notes sections
- Added icons to each DocumentSection: FileText (info, rose), Package (lines, rose), Calculator (totals, rose), FileText (notes, rose)
- Added barcode and search functionality (following purchase invoice pattern): ScanLine input with Enter-key barcode scanning, Search input with dropdown filtered results
- Improved barcode/search area: inside lines section with bg-slate-50/60 background, white input backgrounds, better visual distinction
- Added alternating row backgrounds for line items (even rows bg-slate-50, odd rows bg-white)
- Improved line item header row with bg-slate-50 background and proper padding
- Enhanced totals section: larger total amount (text-2xl), added discount total row with red color, better visual hierarchy with separators
- Used noPadding on lines section for full-bleed table layout
- Added empty state message when no lines exist
- Improved search dropdown with font-weight hierarchy (name bold, code mono secondary) and rose hover (hover:bg-rose-50)
- Added hover effects on remove button (hover:bg-red-50)
- Updated loading spinner color to rose-600 to match document identity
- Custom className on primaryActions for rose styling (border-rose-200, text-rose-700, bg-rose-600) — matching document identity
- Extracted linked document numbers (salesOrderNumber, deliveryNoteNumber) from localStorage pendingSalesInvoice data for workflow stepper
- Maintained all existing business logic: save draft, confirm, barcode scan, search, localStorage pre-fill from pendingSalesInvoice
- All API endpoints unchanged
- Lint passes cleanly with no errors

Changes Summary:
- Removed: local getStatusBadge function, Card/CardHeader/CardContent/CardTitle imports, Badge import, ArrowRight import (now handled by DocumentPageHeader)
- Added: DocumentPageHeader, getDocumentStatusBadge, DocumentSection, LinkedDocumentBadge, WorkflowStepper, getSalesWorkflow imports
- Added: ScanLine, Search, Package, Calculator icon imports (FileText, Plus, XCircle, Loader2, Save, Send already existed)
- Added: barcodeInput, searchQuery, linkedSalesOrderNumber, linkedDeliveryNoteNumber state variables
- Added: handleBarcodeScan, handleAddItemById, filteredItems — barcode & search functionality
- Rose/pink color identity for sales invoice document (bg-rose-50, text-rose-600) — distinct from emerald green (purchase order, sales order), sky/blue (purchase receipt), amber (delivery note), violet (material request), teal (pick list), orange (purchase invoice)
- RTL Arabic maintained

---
Task ID: Final
Agent: Main Orchestrator
Task: Complete UI/UX improvement implementation across all document form pages

Stage Summary:
- Created 3 shared components: DocumentPageHeader, DocumentSection, WorkflowStepper
- Refactored all 8 document form pages with consistent UI/UX patterns
- Each document type now has a unique color identity:
  - 🟢 Purchase Order: emerald (bg-emerald-50)
  - 🔵 Purchase Receipt: sky/blue (bg-sky-50)
  - 🟠 Purchase Invoice: orange (bg-orange-50)
  - 🟢 Sales Order: emerald (bg-emerald-50)
  - 🟡 Delivery Note: amber (bg-amber-50)
  - 🔴 Sales Invoice: rose (bg-rose-50)
  - 🟣 Material Request: violet (bg-violet-50)
  - 🩵 Pick List: teal (bg-teal-50)
- All pages now have workflow steppers showing document chains
- All pages have alternating row backgrounds, improved barcode/search areas, better totals sections
- Lint passes cleanly, dev server running on port 3000

---
Task ID: 11
Agent: Main Orchestrator
Task: Create Accounting Dashboard page with analytics and shortcuts (صفحة الحسابات التحليل والاختصارات)

Work Log:
- Read current project state: page.tsx, store.ts, schema.prisma, existing components
- Read existing dashboards (PurchasesDashboard) as reference for design patterns
- Read existing accounting components (ChartOfAccounts, JournalEntriesList)
- Read existing API patterns (purchases/analytics, accounting/accounts)
- Created API endpoint: /api/accounting/analytics/route.ts
  - Returns: totalAccounts, leafAccounts, activeAccounts, accountDistribution, totalJournalEntries, draftEntries, postedEntries, reversedEntries, totalDebit, totalCredit, totalsByType, recentEntries, monthlyEntries, topAccounts
  - Uses parallel Promise.all for independent queries
  - Aggregates financial data from POSTED journal entries only
  - Groups monthly data by month key for chart display
  - Gets top accounts by movement using groupBy
- Created component: src/components/accounting/accounting-dashboard.tsx
  - Stat Cards: Total accounts, Total journal entries, Draft entries (with alert badge), Total debit
  - Quick Actions/Shortcuts: شجرة الحسابات, القيود اليومية, ميزان المراجعة, الميزانية العمومية, قائمة الدخل
  - Reports shortcuts navigate to reports module
  - Account Distribution by Type: visual bar chart with type colors (cyan/red/purple/emerald/orange)
  - Financial Summary: Total Debit, Total Credit, Balance indicator, Entry status summary (draft/posted/reversed)
  - Recent Journal Entries: last 10 entries with status badges
  - Top Accounts by Movement: ranked with visual bars and type badges
  - Monthly Activity: dual-bar chart (debit/credit) with month labels and legend
- Updated page.tsx:
  - Added import for AccountingDashboard
  - Changed accounting module default view from ModulePlaceholder to AccountingDashboard
  - When no sub-view selected, shows dashboard; when sub-view selected, shows specific component
- Verified: API returns proper data (28 accounts, 3 entries, correct distribution)
- Verified: Page loads with HTTP 200
- Lint passes cleanly with no errors

Stage Summary:
- Created complete Accounting Dashboard with analytics and shortcuts
- Dashboard follows the same design pattern as PurchasesDashboard
- Preserved system identity: RTL Arabic, emerald green scheme, consistent card/badge styling
- All shortcuts are functional and navigate to correct views
- Financial summary shows balance indicator (balanced vs unbalanced)
- Monthly activity shows debit/credit trend visualization

---
Task ID: 2
Agent: Purchase Returns API Agent
Task: Create Purchase Returns API endpoints

Work Log:
- Read worklog.md to understand previous agent work (UI/UX refactoring, accounting dashboard)
- Read existing purchase orders API (route.ts + [id]/route.ts) as pattern reference
- Read purchase receipts API ([id]/route.ts) for stock movement/ItemBalance update patterns
- Read Prisma schema to confirm PurchaseReturn and PurchaseReturnLine model structure
- Read auth-guard.ts to confirm requirePermission usage
- Read erp-utils.ts to confirm generateDocNumber signature
- Created /api/purchases/returns/route.ts with GET and POST handlers
  - GET: List purchase returns for a company with status, supplierId, fromDate/toDate filters; includes lines with item details, supplier, warehouse, and linked documents (purchaseOrder, purchaseInvoice, purchaseReceipt)
  - POST: Create new purchase return with auto-generated number (PRET-{YYYY}-{0001}); validates supplier, warehouse, and linked documents; calculates totalAmount from lines; defaults status to DRAFT
- Created /api/purchases/returns/[id]/route.ts with GET and PUT handlers
  - GET: Get single purchase return with full details (lines with item info + uom, supplier, warehouse, linked documents)
  - PUT: Three action handlers:
    - "confirm": Changes DRAFT→CONFIRMED, creates OUT stock movements for each line, updates ItemBalance (reduces quantity and recalculates avgCost), checks sufficient stock before confirming
    - "cancel": Changes DRAFT→CANCELLED only (no stock reversal needed since DRAFT never affected stock)
    - "update": Updates fields while still DRAFT, supports line replacement with recalculation
- Created directory structure: /api/purchases/returns/ and /api/purchases/returns/[id]/
- Lint passes cleanly with no errors
- Dev server running on port 3000 (HTTP 200)

Stage Summary:
- Created 2 API route files for Purchase Returns module
- GET /api/purchases/returns — List with filters and full includes
- POST /api/purchases/returns — Create with PRET-{YYYY}-{0001} numbering, validation, auto-calculation
- GET /api/purchases/returns/[id] — Single return with full details
- PUT /api/purchases/returns/[id] — Confirm (with stock movements OUT + ItemBalance updates), Cancel (DRAFT only), Update (DRAFT only)
- Follows same patterns as purchase orders API and purchase receipts stock movement logic
- Uses requirePermission for auth (purchases.view, purchases.create, purchases.confirm, purchases.edit)

---
Task ID: 3
Agent: Sales Returns API Agent
Task: Create Sales Returns API endpoints

Work Log:
- Read worklog.md to understand previous agent work (UI/UX refactoring, accounting dashboard, purchase returns API)
- Read existing sales orders API (route.ts + [id]/route.ts) as pattern reference
- Read delivery notes API ([id]/route.ts) for stock movement/ItemBalance update patterns on confirm
- Read Prisma schema to confirm SalesReturn and SalesReturnLine model structure
- Read auth-guard.ts to confirm requirePermission usage
- Read erp-utils.ts to confirm generateDocNumber signature
- Created /api/sales/returns/route.ts with GET and POST handlers
  - GET: List sales returns for a company with status, customerId, fromDate/toDate filters; includes lines with item details, customer, warehouse, and linked documents (salesOrder, salesInvoice, deliveryNote)
  - POST: Create new sales return with auto-generated number (SRET-{YYYY}-{0001}); validates customer, warehouse, and linked documents; calculates totalAmount from lines (qty * unitPrice per line); defaults status to DRAFT
- Created /api/sales/returns/[id]/route.ts with GET and PUT handlers
  - GET: Get single sales return with full details (lines with item info + uom, customer, warehouse, linked documents)
  - PUT: Three action handlers:
    - "confirm": Changes DRAFT→CONFIRMED using $transaction; creates IN stock movements for each line (items returning to warehouse), updates ItemBalance (increases quantity and recalculates avgCost using weighted average); creates ItemBalance record if none exists
    - "cancel": Changes DRAFT→CANCELLED only
    - "update": Updates fields while still DRAFT, validates changed customer/warehouse/linked docs, supports line replacement with totalAmount recalculation
- Created directory structure: /api/sales/returns/ and /api/sales/returns/[id]/
- Lint passes cleanly with no errors

Stage Summary:
- Created 2 API route files for Sales Returns module
- GET /api/sales/returns — List with filters (status, customerId, date range) and full includes (lines with items, customer, warehouse, linked documents)
- POST /api/sales/returns — Create with SRET-{YYYY}-{0001} numbering, validation of customer/warehouse/linked docs, auto-calculation of totalAmount from lines
- GET /api/sales/returns/[id] — Single return with full details (lines with item + uom, customer, warehouse, linked documents)
- PUT /api/sales/returns/[id] — Confirm (with IN stock movements + ItemBalance weighted average updates), Cancel (DRAFT only), Update (DRAFT only with line replacement)
- Follows same patterns as sales orders API and delivery notes stock movement logic
- Uses requirePermission for auth (sales.view, sales.create, sales.edit)

---
Task ID: 5
Agent: Sales Return Form Agent
Task: Create SalesReturnFormPage component for creating and editing sales returns (مرتجع مبيعات)

Work Log:
- Read worklog.md to understand previous agent work (UI/UX refactoring, sales returns API by Task 3)
- Read sales-order-form-page.tsx as the primary design pattern reference
- Read all shared components: DocumentPageHeader, getDocumentStatusBadge, DocumentSection, LinkedDocumentBadge, WorkflowStepper, getSalesWorkflow
- Read sales returns API endpoints (route.ts + [id]/route.ts) to understand data structure and actions
- Read store.ts for useAppStore interface (editingDocId, setView, setModule, etc.)
- Read erp-utils.ts for formatCurrency, formatDate utilities
- Created src/components/sales/sales-return-form-page.tsx with the following structure:
  - DocumentPageHeader using Undo2 icon with red styling (bg-red-50, text-red-600) — return/reverse operation identity
  - WorkflowStepper showing sales workflow + return step: أمر البيع → إذن الصرف → فاتورة البيع → مرتجع البيع
    - مرتجع البيع: "current" when DRAFT, "completed" when CONFIRMED/CANCELLED
    - Linked document numbers shown via LinkedDocumentBadge
  - Info Section (DocumentSection): Date, Customer (select), Warehouse (select), linked document reference (read-only)
  - Lines Section (DocumentSection, noPadding):
    - Table columns: كود الصنف, اسم الصنف, الكمية, السعر, الإجمالي, حذف
    - Barcode & search area with red hover styling
    - Alternating row backgrounds
    - Original quantity reference from source document shown as small text
  - Totals Section (DocumentSection): Item count, total quantity, total amount (text-2xl, red-600)
  - Notes Section (DocumentSection): Textarea for notes
- Pre-fill logic from localStorage key `pendingSalesReturn`:
  - Reads sourceType, sourceId, sourceNumber, customerId, warehouseId, lines
  - Pre-fills customer, warehouse, and lines from source document
  - Sets linked document IDs based on sourceType (salesOrder/salesInvoice/deliveryNote)
  - Clears localStorage key after reading
  - Shows linked document number as read-only in info section
- Workflow:
  - DRAFT: Can edit, save, confirm
  - CONFIRMED: Read-only, no actions
  - CANCELLED: Read-only
- Actions:
  - "حفظ كمسودة" (Save Draft) — always when DRAFT
  - "تأكيد المرتجع" (Confirm Return) — only when DRAFT, with red styling (bg-red-600)
- Store integration:
  - Uses editingDocId to determine new vs edit mode
  - Navigates to 'sales-returns' view on go back
  - Clears editingDocId on back navigation
- Data fetching:
  - Customers: /api/sales/customers?companyId=${companyId}
  - Warehouses: /api/inventory/warehouses?companyId=${companyId}
  - Items: /api/inventory/items?companyId=${companyId}
- Lint passes cleanly (0 errors, 0 warnings in this file)

Changes Summary:
- Created: src/components/sales/sales-return-form-page.tsx (~520 lines)
- Red color identity for sales return document (bg-red-50, text-red-600) — reverse operation, distinct from other document types
- Undo2 icon for document type identity
- Full localStorage pre-fill from pendingSalesReturn key
- Workflow stepper extends sales workflow with return step
- LinkedDocumentBadge for sales order, delivery note, sales invoice references
- RTL Arabic maintained throughout
- Follows exact same code style as sales-order-form-page.tsx

---
Task ID: 4
Agent: Purchase Return Form Agent
Task: Create PurchaseReturnFormPage component for creating and editing purchase returns (مرتجع مشتريات)

Work Log:
- Read worklog.md to understand previous agent work (UI/UX refactoring, purchase returns API by Task 2, sales returns API by Task 3, sales return form by Task 5)
- Read purchase-order-form-page.tsx as the primary design pattern reference
- Read purchase-invoice-form-page.tsx for additional pattern reference (orange styling, linked documents)
- Read all shared components: DocumentPageHeader, getDocumentStatusBadge, DocumentSection, LinkedDocumentBadge, WorkflowStepper, getPurchaseWorkflow
- Read purchase returns API endpoints (route.ts + [id]/route.ts) to understand data structure and actions
- Read Prisma schema for PurchaseReturn and PurchaseReturnLine model structure
- Read store.ts for useAppStore interface (editingDocId, setView, setModule, etc.)
- Read erp-utils.ts for formatCurrency, formatDate utilities
- Created src/components/purchases/purchase-return-form-page.tsx with the following structure:
  - DocumentPageHeader using Undo2 icon with red styling (bg-red-50, text-red-600) — return/reverse operation identity
  - WorkflowStepper showing purchase workflow: أمر الشراء → إذن الاستلام → فاتورة الشراء
    - Linked document numbers shown via LinkedDocumentBadge (purchase order, purchase receipt, purchase invoice)
  - Info Section (DocumentSection): Date, Supplier (select), Warehouse (select), linked document reference (read-only when pre-filled from localStorage)
  - Lines Section (DocumentSection, noPadding):
    - Table columns: كود الصنف, اسم الصنف, الكمية, السعر, الإجمالي, حذف
    - Barcode & search area with red hover styling (hover:bg-red-50)
    - Alternating row backgrounds (even rows bg-white, odd rows bg-slate-50/70)
    - Original quantity reference from source document shown as small text above quantity input
    - Each line has quantity and unitPrice inputs, totalAmount auto-calculated (qty * price)
  - Totals Section (DocumentSection): Item count, total quantity, total amount (text-2xl, text-red-700)
  - Notes Section (DocumentSection): Textarea for notes
- Pre-fill logic from localStorage key `pendingPurchaseReturn`:
  - Reads sourceType (purchaseOrder/purchaseInvoice/purchaseReceipt), sourceId, sourceNumber, supplierId, supplierName, warehouseId, lines
  - Pre-fills supplier, warehouse, and lines from source document
  - Sets linked document IDs based on sourceType (purchaseOrderId/purchaseInvoiceId/purchaseReceiptId)
  - Tracks linked document numbers for workflow stepper badges
  - Clears localStorage key after reading
  - Shows linked document number as read-only in info section with source type label in Arabic
- Workflow:
  - DRAFT: Can edit, save, confirm
  - CONFIRMED: Read-only, no actions
  - CANCELLED: Read-only
- Actions:
  - "حفظ كمسودة" (Save Draft) — always when DRAFT, with red outline styling (border-red-200, text-red-700)
  - "تأكيد المرتجع" (Confirm Return) — only when DRAFT, with red filled styling (bg-red-600)
- Store integration:
  - Uses editingDocId to determine new vs edit mode
  - Navigates to 'purchase-returns' view on go back
  - Clears editingDocId on back navigation via setEditingDocId(null)
- Data fetching:
  - Suppliers: /api/purchases/suppliers?activeOnly=true&companyId=${companyId}
  - Warehouses: /api/inventory/warehouses?activeOnly=true&companyId=${companyId}
  - Items: /api/inventory/items?activeOnly=true&companyId=${companyId}
- Simpler line model (no per-line discount/tax — just quantity, unitPrice, totalAmount = qty * price)
- Loading spinner uses red-600 to match document identity
- Lint passes cleanly (0 errors, 0 warnings)

Changes Summary:
- Created: src/components/purchases/purchase-return-form-page.tsx (~510 lines)
- Red color identity for purchase return document (bg-red-50, text-red-600) — reverse operation, consistent with sales return
- Undo2 icon for document type identity
- Full localStorage pre-fill from pendingPurchaseReturn key
- Workflow stepper shows purchase workflow with linked document badges
- LinkedDocumentBadge for purchase order, purchase receipt, purchase invoice references
- RTL Arabic maintained throughout
- Follows exact same code style as purchase-order-form-page.tsx

---
Task ID: 6a
Agent: Returns List Agent
Task: Create Purchase Returns List and Sales Returns List page components

Work Log:
- Read worklog.md to understand previous agent work (UI/UX refactoring, returns APIs by Tasks 2/3, return forms by Tasks 4/5)
- Read purchase-orders-list.tsx as primary pattern reference for purchase returns list
- Read sales-orders-list.tsx as primary pattern reference for sales returns list
- Read purchase returns API (route.ts) to understand GET response structure: includes supplier, warehouse, purchaseOrder/purchaseInvoice/purchaseReceipt linked docs, lines with items, _count
- Read sales returns API (route.ts) to understand GET response structure: includes customer, warehouse, salesOrder/salesInvoice/deliveryNote linked docs, lines with items, _count
- Read erp-utils.ts to confirm getStatusColor/getStatusLabel (DRAFT=مسودة/yellow, CONFIRMED=مؤكدة/blue, CANCELLED=ملغية/red)
- Read store.ts to confirm useAppStore interface (editingDocId, setView, setModule, setEditingDocId)

Created: /src/components/purchases/purchase-returns-list.tsx (~300 lines)
- Undo2 icon with red styling (bg-red-50, text-red-600) — return/reverse operation identity
- Card header with "مرتجعات المشتريات" title and count subtitle
- "إضافة مرتجع" button → navigate to 'purchase-return-form' view with setEditingDocId(null)
- Filters: status (all/DRAFT/CONFIRMED/CANCELLED), date range (from/to)
- Table columns: الرقم, التاريخ, المورد, المخزن, المستند المرتبط, الإجمالي, الحالة, إجراءات
- Click number → navigate to 'purchase-return-form' view with editingDocId set
- Linked document column shows number + type label (إذن استلام/فاتورة شراء/أمر شراء) with priority: purchaseReceipt > purchaseInvoice > purchaseOrder
- Status badges using getStatusColor/getStatusLabel from erp-utils
- Actions: View detail (Eye), Confirm (CheckCircle) and Cancel (XCircle) for DRAFT status
- Detail dialog with return info, lines table, total, and notes
- Confirm/Cancel dialog with appropriate Arabic messages mentioning stock movements
- Fetch from /api/purchases/returns?companyId=${companyId} with filters
- Loading skeleton state
- Empty state with Undo2 icon and helpful message
- Arabic RTL, emerald green identity for navigation/confirm actions

Created: /src/components/sales/sales-returns-list.tsx (~300 lines)
- Undo2 icon with red styling (bg-red-50, text-red-600) — return/reverse operation identity
- Card header with "مرتجعات البيع" title and count subtitle
- "إضافة مرتجع" button → navigate to 'sales-return-form' view with setEditingDocId(null)
- Filters: status (all/DRAFT/CONFIRMED/CANCELLED), date range (from/to)
- Table columns: الرقم, التاريخ, العميل, المخزن, المستند المرتبط, الإجمالي, الحالة, إجراءات
- Click number → navigate to 'sales-return-form' view with editingDocId set
- Linked document column shows number + type label (فاتورة بيع/إذن صرف/أمر بيع) with priority: salesInvoice > deliveryNote > salesOrder
- Status badges using getStatusColor/getStatusLabel from erp-utils
- Actions: View detail (Eye), Confirm (CheckCircle) and Cancel (XCircle) for DRAFT status
- Detail dialog with return info, lines table, total, and notes
- Confirm/Cancel dialog with appropriate Arabic messages mentioning stock movements
- Fetch from /api/sales/returns?companyId=${companyId} with filters
- Loading skeleton state
- Empty state with Undo2 icon and helpful message
- Arabic RTL, emerald green identity for navigation/confirm actions

Both components use view strings 'purchase-returns', 'sales-returns', 'purchase-return-form', 'sales-return-form' for setView() navigation.

Lint passes cleanly with no errors.

---
Task ID: 6b
Agent: Return Shortcut Agent
Task: Add "إنشاء مرتجع" (Create Return) shortcut buttons to existing document form pages

Work Log:
- Read worklog.md to understand previous agent work (UI/UX refactoring, purchase/sales returns API, return form pages)
- Read all 6 target files to understand their structure and existing shortcutActions patterns
- Read PurchaseReturnFormPage and SalesReturnFormPage to understand localStorage format (PendingPurchaseReturn, PendingSalesReturn interfaces)
- Read page.tsx to understand view routing and confirm return form views needed registration
- Read store.ts to understand view type definitions

Modified 6 form pages:
1. purchase-order-form-page.tsx:
   - Added Undo2 import
   - Added handleCreateReturn function (sourceType: 'purchaseOrder', localStorage key: pendingPurchaseReturn)
   - Added "إنشاء مرتجع" shortcut alongside existing "تحويل لإذن استلام" when status === CONFIRMED
   - Red styling: border-red-200 text-red-700 hover:bg-red-50

2. purchase-invoice-form-page.tsx:
   - Added Undo2 import
   - Added handleCreateReturn function (sourceType: 'purchaseInvoice', localStorage key: pendingPurchaseReturn)
   - Added shortcutActions prop (new — previously no shortcutActions on this page) with "إنشاء مرتجع" when CONFIRMED

3. purchase-receipt-form-page.tsx:
   - Added Undo2 import
   - Added handleCreateReturn function (sourceType: 'purchaseReceipt', localStorage key: pendingPurchaseReturn, unitPrice: 0)
   - Added "إنشاء مرتجع" shortcut alongside existing "إنشاء فاتورة شراء" when CONFIRMED

4. sales-order-form-page.tsx:
   - Added Undo2 import
   - Added handleCreateReturn function (sourceType: 'salesOrder', localStorage key: pendingSalesReturn, warehouseId: '')
   - Added "إنشاء مرتجع" shortcut alongside existing "تحويل لإذن صرف" when CONFIRMED

5. sales-invoice-form-page.tsx:
   - Added Undo2 import
   - Added handleCreateReturn function (sourceType: 'salesInvoice', localStorage key: pendingSalesReturn, warehouseId: '')
   - Added shortcutActions prop (new) with "إنشاء مرتجع" when CONFIRMED

6. delivery-note-form-page.tsx:
   - Added Undo2 import
   - Added handleCreateReturn function (sourceType: 'deliveryNote', localStorage key: pendingSalesReturn, unitPrice: 0)
   - Added "إنشاء مرتجع" shortcut alongside existing "إنشاء فاتورة بيع" when CONFIRMED

Additional changes for navigation support:
- Updated page.tsx: Added imports for PurchaseReturnFormPage and SalesReturnFormPage, added switch cases for 'purchase-return-form' and 'sales-return-form' views, added view title mappings
- Updated store.ts: Added 'purchase-return-form' to PurchasesView type, added 'sales-return-form' to SalesView type

All return shortcut buttons:
- Use Undo2 icon from lucide-react
- Only appear when document status === 'CONFIRMED'
- Store return data in localStorage matching the PendingPurchaseReturn/PendingSalesReturn interfaces
- Navigate to the appropriate return form page via setView
- Use red styling (border-red-200 text-red-700 hover:bg-red-50) consistent with return/reverse operation identity

Lint passes cleanly with no errors. Dev server running on port 3000 (HTTP 200).

---
Task ID: 12
Agent: Main Orchestrator
Task: Implement Returns System (نظام المرتجعات) - Full/Partial returns for all document types

Work Log:
- Added PurchaseReturn, PurchaseReturnLine, SalesReturn, SalesReturnLine models to Prisma schema
- Added reverse relations to all existing models (Company, Supplier, Customer, Warehouse, Item, PurchaseOrder, PurchaseInvoice, PurchaseReceipt, SalesOrder, SalesInvoice, DeliveryNote)
- Ran db:push and prisma generate successfully
- Created Purchase Returns API: GET/POST /api/purchases/returns, GET/PUT /api/purchases/returns/[id]
  - GET: List with filters (status, supplierId, date range), includes supplier/warehouse/linked docs/lines
  - POST: Create with auto-numbering PRET-{YYYY}-{0001}, validates supplier/warehouse/linked docs
  - PUT: confirm (DRAFT→CONFIRMED, creates OUT stock movements, reduces ItemBalance), cancel, update
- Created Sales Returns API: GET/POST /api/sales/returns, GET/PUT /api/sales/returns/[id]
  - GET: List with filters (status, customerId, date range), includes customer/warehouse/linked docs/lines
  - POST: Create with auto-numbering SRET-{YYYY}-{0001}, validates customer/warehouse/linked docs
  - PUT: confirm (DRAFT→CONFIRMED, creates IN stock movements, increases ItemBalance), cancel, update
- Created PurchaseReturnFormPage component with red identity (bg-red-50, text-red-600)
  - Pre-fills from localStorage (pendingPurchaseReturn) when creating from existing document
  - Shows linked document reference, original quantities from source
  - Workflow: DRAFT (editable) → CONFIRMED (read-only)
- Created SalesReturnFormPage component with same red identity
  - Pre-fills from localStorage (pendingSalesReturn) when creating from existing document
  - Same workflow pattern as purchase returns
- Created PurchaseReturnsList and SalesReturnsList list pages with red identity
  - Table with status badges, linked document column, detail dialog
  - Confirm/Cancel actions for DRAFT returns
- Added "إنشاء مرتجع" (Create Return) shortcut to 6 document form pages:
  - Purchase Order (sourceType: purchaseOrder) - only when CONFIRMED
  - Purchase Invoice (sourceType: purchaseInvoice) - only when CONFIRMED
  - Purchase Receipt (sourceType: purchaseReceipt) - only when CONFIRMED
  - Sales Order (sourceType: salesOrder) - only when CONFIRMED
  - Sales Invoice (sourceType: salesInvoice) - only when CONFIRMED
  - Delivery Note (sourceType: deliveryNote) - only when CONFIRMED
- Updated store.ts: Added purchase-returns, sales-returns, purchase-return-form, sales-return-form view types
- Updated page.tsx: Added Undo2 import, navigation items for مرتجعات المشتريات and مرتجعات المبيعات, view titles, rendering cases
- Updated dashboards: Added returns shortcuts to PurchasesDashboard and SalesDashboard
- Fixed: Prisma client regeneration needed after schema change (server restart)
- Fixed: Changed Record<string, unknown> to any for Prisma where clauses
- Lint passes with 0 errors

Stage Summary:
- Complete returns system implemented with full/partial return support
- Returns can be created from any confirmed purchase/sales document via shortcut button
- Returns track linked source documents and show original quantities
- Confirming a return automatically updates stock (OUT for purchase returns, IN for sales returns)
- Red color identity for returns (reverse operations) across all return components
- Navigation: مرتجعات المشتريات under المشتريات, مرتجعات المبيعات under المبيعات
