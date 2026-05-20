---
Task ID: 1
Agent: Main
Task: Fix notifications system - Sonner Toaster not rendered in layout

Work Log:
- Found that layout.tsx imported Toaster from @/components/ui/toaster (Radix/shadcn)
- But all business components use `import { toast } from 'sonner'` (Sonner library)
- The Sonner Toaster was never mounted in the layout, so all toast calls disappeared
- Replaced the import to use @/components/ui/sonner instead
- Enhanced Sonner Toaster with position="top-center", dir="rtl", richColors, closeButton

Stage Summary:
- Notifications now work correctly with Sonner toast system
- All toast.success() / toast.error() calls throughout the app will now render

---
Task ID: 2
Agent: Main
Task: Fix company deletion - force-delete route had wrong Prisma model names

Work Log:
- The force-delete route used old model names like pickListItem, purchaseReceiptItem, etc.
- The actual schema uses PickListLine, PurchaseReceiptLine, etc.
- Rewrote the entire force-delete route with correct model names matching the Prisma schema
- Added missing models: SalesReturnLine, PurchaseReturnLine, ReceiptLine, PaymentLine, StockMovement, FifoLayer, ItemBalance, ItemCode

Stage Summary:
- Company force-delete now works correctly
- All related data is deleted in the correct order respecting foreign key constraints

---
Task ID: 3
Agent: Main
Task: Clear all existing data from the system

Work Log:
- Deleted the SQLite database file at db/custom.db
- Ran `bun run db:push` to recreate the database with the current schema
- Database is now empty and fresh

Stage Summary:
- All previous data has been cleared
- Fresh database ready for new data entry

---
Task ID: 4
Agent: Main
Task: Fix company name not updating in header

Work Log:
- Investigated the store update chain: company-form.tsx -> updateCompany() -> store -> header
- The updateCompany() method in the store correctly updates the companies array
- The header reads from companies.find((c) => c.id === currentCompanyId)?.nameAr
- The main issue was that toasts weren't showing (Bug 1), so users thought it didn't save
- Also fixed: company-form useEffect now has [companyId] dependency (was empty [])
- Also fixed: setLoading(true) added when companyId changes so form shows loading state

Stage Summary:
- Company name now updates immediately in the header when saved
- Toast notifications now confirm the save operation
- Form properly refreshes when switching between companies

---
Task ID: 5
Agent: Main
Task: Add PUT handler for investor edit in API route

Work Log:
- The investors-list.tsx was calling PUT /api/investors but no PUT handler existed
- Added a PUT handler to /api/investors/route.ts
- Handler updates investor fields: fullName, phone, email, nationalId, status
- Also updates related capital and profit payable account names when fullName changes

Stage Summary:
- Investor edit now works via PUT /api/investors with { id, ...formData }

---
Task ID: 6
Agent: Main
Task: Add DELETE handler for investor and delete button in UI

Work Log:
- Created /api/investors/[id]/route.ts with DELETE handler
- DELETE handler removes: investorShares, withdrawals, investments, related accounts, then investor
- Added Trash2 and AlertTriangle icons to investors-list imports
- Added deleteOpen, deletingInvestor, deleting state variables
- Added handleDeleteInvestor function
- Added delete button (Trash2 icon) in the actions column for each investor
- Added delete confirmation dialog with warning about data deletion
- Dialog shows investor's financial summary (total investment, pending profit)

Stage Summary:
- Investors can now be deleted with a confirmation dialog
- All related data (investments, withdrawals, shares, accounts) is properly cleaned up
